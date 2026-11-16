// The resubmit endpoint — token-gated (the 30-minute access link, or the
// long-lived one from the approval/corrections letter). Server re-validates
// everything; kept images are re-read from the DB, never trusted from the
// client. One transaction: new revision + image rows + declaration consent +
// the state-machine transition needs_correction → under_review (§19).

import { NextResponse } from "next/server";
import { prisma } from "@voeq/db";
import { assertApplicationTransition } from "@voeq/core";
import { IMAGE_FIELDS, missingRequiredImages, type ImageField } from "@/lib/apply-schema";
import { resubmitSchema, missingRequiredResubmitImages } from "@/lib/resubmit";
import { verifyAccessToken } from "@/lib/access";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // Phase 5.1 — resubmission is token-gated; the IP cap keeps it from
  // becoming a firehose when a token leaks into a script.
  const blocked = tooManyRequests(rateLimit("track.resubmit", clientIp(req)));
  if (blocked) return blocked;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON" }, { status: 400 });
  }

  const envelope = (body as { token?: unknown; payload?: unknown }) ?? {};
  const claimed = verifyAccessToken(typeof envelope.token === "string" ? envelope.token : "");
  if (!claimed) {
    return NextResponse.json({ error: "Your link has expired — request a fresh one" }, { status: 401 });
  }

  const parsed = resubmitSchema.safeParse(envelope.payload);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      { error: `${first?.path?.join(".") ?? "form"}: ${first?.message ?? "invalid"}` },
      { status: 400 },
    );
  }
  const input = parsed.data;

  const missing = missingRequiredResubmitImages(input.images);
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `Missing required photo${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}` },
      { status: 400 },
    );
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = req.headers.get("user-agent")?.slice(0, 300) ?? null;

  const application = await prisma.application.findUnique({
    where: { id: claimed.applicationId },
    include: {
      revisions: { orderBy: { revisionNo: "desc" }, take: 1, include: { images: true } },
    },
  });

  if (!application || application.contactEmail.toLowerCase() !== claimed.email) {
    return NextResponse.json({ error: "This link does not match the application" }, { status: 403 });
  }
  if (application.status !== "needs_correction") {
    return NextResponse.json(
      { error: "This application is not awaiting fixes right now" },
      { status: 409 },
    );
  }

  const lastRevision = application.revisions[0];
  const lastImages = lastRevision?.images ?? [];

  // Campus + category must belong to the same institution — a tampered
  // client cannot point the revision elsewhere.
  const [campus, category] = await Promise.all([
    prisma.campus.findFirst({ where: { id: input.campusId, institutionId: application.institutionId } }),
    prisma.category.findFirst({ where: { id: input.categoryId, institutionId: application.institutionId, active: true } }),
  ]);
  if (!campus || !category) {
    return NextResponse.json({ error: "Unknown campus or business category" }, { status: 400 });
  }

  // Resolve every image: KEPT assets are re-read from the previous revision
  // server-side; FRESH uploads must carry a complete descriptor.
  const resolved: {
    field: ImageField;
    keep: boolean;
    cloudinaryPublicId: string;
    originalName: string;
    mimeType: "image/jpeg" | "image/png";
    sizeBytes: number;
    width: number | null;
    height: number | null;
    checksumSha256: string;
  }[] = [];

  for (const img of input.images) {
    if (img.keep) {
      const old = lastImages.find((o) => o.field === img.field && o.cloudinaryPublicId === img.publicId);
      if (!old) {
        return NextResponse.json(
          { error: `Could not keep the previous ${img.field.replace(/_/g, " ")} — please upload it again` },
          { status: 400 },
        );
      }
      resolved.push({
        field: old.field,
        keep: true,
        cloudinaryPublicId: old.cloudinaryPublicId,
        originalName: old.originalName,
        mimeType: old.mimeType as "image/jpeg" | "image/png",
        sizeBytes: old.sizeBytes,
        width: old.width,
        height: old.height,
        checksumSha256: old.checksumSha256,
      });
    } else {
      if (
        !img.originalName ||
        !img.mimeType ||
        !img.sizeBytes ||
        !img.width ||
        !img.height ||
        !img.checksumSha256
      ) {
        return NextResponse.json(
          { error: `Incomplete upload for ${img.field.replace(/_/g, " ")} — please upload it again` },
          { status: 400 },
        );
      }
      resolved.push({
        field: img.field,
        keep: false,
        cloudinaryPublicId: img.publicId,
        originalName: img.originalName,
        mimeType: img.mimeType,
        sizeBytes: img.sizeBytes,
        width: img.width,
        height: img.height,
        checksumSha256: img.checksumSha256,
      });
    }
  }
  if (missingRequiredImages(resolved).length > 0) {
    return NextResponse.json({ error: "Required photos are missing" }, { status: 400 });
  }

  const revisionNo = (lastRevision?.revisionNo ?? 0) + 1;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const revision = await tx.applicationRevision.create({
        data: {
          applicationId: application.id,
          revisionNo,
          data: {
            businessName: input.businessName,
            businessDescription: input.businessDescription || null,
            website: input.website || null,
            socialHandle: input.socialHandle || null,
            campus: { id: campus.id, name: campus.name },
            category: { id: category.id, name: category.name },
            ownerName: input.ownerName,
            ownerPhone: input.ownerPhone,
            contactEmail: input.contactEmail,
            consents: { declaration: true },
            resubmitted: true,
          },
          ip,
          userAgent,
        },
      });

      for (const img of resolved) {
        await tx.applicationImage.create({
          data: {
            revisionId: revision.id,
            field: img.field,
            cloudinaryPublicId: img.cloudinaryPublicId,
            originalName: img.originalName,
            mimeType: img.mimeType,
            sizeBytes: img.sizeBytes,
            width: img.width,
            height: img.height,
            checksumSha256: img.checksumSha256,
            status: "validated",
            validation: { carriedForward: img.keep ?? false, magicBytes: !img.keep },
          },
        });
      }

      await tx.consentRecord.create({
        data: {
          applicationId: application.id,
          revisionId: revision.id,
          type: "declaration",
          docVersion: "v1",
          ip,
          userAgent,
        },
      });

      assertApplicationTransition(application.status, "under_review");
      await tx.application.update({
        where: { id: application.id },
        data: {
          status: "under_review",
          businessName: input.businessName,
          ownerName: input.ownerName,
          ownerPhone: input.ownerPhone,
          contactEmail: input.contactEmail,
          businessDescription: input.businessDescription || null,
        },
      });

      return { revisionNo };
    });

    return NextResponse.json({ ok: true, revisionNo: result.revisionNo }, { status: 201 });
  } catch (err) {
    console.error("[resubmit] failed:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: "We could not save your resubmission just now. Try again — nothing was lost." },
      { status: 500 },
    );
  }
}

// Keep IMAGE_FIELDS referenced so the import guard stays honest if the loop
// over fields is ever restructured.
void IMAGE_FIELDS;
