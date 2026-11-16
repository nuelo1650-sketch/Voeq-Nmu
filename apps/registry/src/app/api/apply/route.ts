// The submit route — the moment an application is born.
//
// One DB transaction writes everything (§19 outbox invariant): the
// application at status `submitted`, its first revision (immutable form
// snapshot), the image rows pointing at already-stored private Cloudinary
// assets, the four consent records, and the outbox notification whose worker
// sends letter #1. The reference is issued atomically from the per-year
// sequence and IS the future payment narration.

import { NextResponse } from "next/server";
import { prisma } from "@voeq/db";
import { createNotification } from "@voeq/db/outbox";
import { applicationReceived } from "@voeq/email";
import { formatReference } from "@voeq/core";
import { applySchema, missingRequiredImages, CONSENT_DOC_VERSION, IMAGE_FIELDS, type ImageField } from "@/lib/apply-schema";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON" }, { status: 400 });
  }

  const parsed = applySchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      { error: `${first?.path?.join(".") ?? "form"}: ${first?.message ?? "invalid"}` },
      { status: 400 },
    );
  }
  const input = parsed.data;

  const missing = missingRequiredImages(input.images);
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `Missing required photo${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}` },
      { status: 400 },
    );
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = req.headers.get("user-agent")?.slice(0, 300) ?? null;

  const institution = await prisma.institution.findFirst({
    where: { slug: "nmu", status: "active" },
    select: { id: true, prefix: true },
  });
  if (!institution) {
    return NextResponse.json({ error: "Institution not configured" }, { status: 503 });
  }

  // Both choices must belong to this institution — a tampered client cannot
  // point an application at another campus or a made-up category.
  const [campus, category] = await Promise.all([
    prisma.campus.findFirst({ where: { id: input.campusId, institutionId: institution.id } }),
    prisma.category.findFirst({ where: { id: input.categoryId, institutionId: institution.id, active: true } }),
  ]);
  if (!campus || !category) {
    return NextResponse.json({ error: "Unknown campus or business category" }, { status: 400 });
  }

  const year = new Date().getFullYear();

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Atomic per-year sequence: insert-on-conflict increment returns the
      // fresh value; two simultaneous applicants can never share a number.
      const seqRow = await tx.referenceSequence.upsert({
        where: { institutionId_year: { institutionId: institution.id, year } },
        create: { institutionId: institution.id, year, last: 1 },
        update: { last: { increment: 1 } },
      });
      const reference = formatReference(institution.prefix, year, seqRow.last);

      const application = await tx.application.create({
        data: {
          reference,
          institutionId: institution.id,
          campusId: campus.id,
          categoryId: category.id,
          status: "submitted",
          businessName: input.businessName,
          ownerName: input.ownerName,
          ownerPhone: input.ownerPhone,
          contactEmail: input.contactEmail,
          businessDescription: input.businessDescription || null,
          submittedAt: new Date(),
        },
      });

      const revision = await tx.applicationRevision.create({
        data: {
          applicationId: application.id,
          revisionNo: 1,
          data: {
            businessName: input.businessName,
            businessDescription: input.businessDescription || null,
            campus: { id: campus.id, name: campus.name },
            category: { id: category.id, name: category.name },
            ownerName: input.ownerName,
            ownerPhone: input.ownerPhone,
            contactEmail: input.contactEmail,
            consents: input.consents,
          },
          ip,
          userAgent,
        },
      });

      const imageByField = new Map(input.images.map((i) => [i.field, i]));
      for (const field of IMAGE_FIELDS) {
        const img = imageByField.get(field as ImageField);
        if (!img) continue;
        await tx.applicationImage.create({
          data: {
            revisionId: revision.id,
            field,
            cloudinaryPublicId: img.publicId,
            originalName: img.originalName,
            mimeType: img.mimeType,
            sizeBytes: img.sizeBytes,
            width: img.width,
            height: img.height,
            checksumSha256: img.checksumSha256,
            status: "validated",
            validation: { magicBytes: true, sniffedMime: img.mimeType, clientReportedDimensions: true },
          },
        });
      }

      for (const type of ["declaration", "terms", "privacy", "public_listing"] as const) {
        await tx.consentRecord.create({
          data: {
            applicationId: application.id,
            revisionId: revision.id,
            type,
            docVersion: CONSENT_DOC_VERSION,
            ip,
            userAgent,
          },
        });
      }

      // Letter #1 — queued in the SAME transaction (§19). The worker sends it;
      // if the process dies right now, the poller still finds this row.
      await createNotification(tx, {
        topic: "application.received",
        payload: {
          to: input.contactEmail,
          template: applicationReceived(reference, input.businessName),
        },
      });

      return { reference, applicationId: application.id };
    });

    return NextResponse.json({ reference: result.reference }, { status: 201 });
  } catch (err) {
    console.error("[apply] submit failed:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: "We could not save your application just now. Try again — nothing was charged." },
      { status: 500 },
    );
  }
}
