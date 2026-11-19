// Applicant's optional transfer-receipt screenshot (Kai, 2026-11-19).
//
// The claim is still the applicant's WORD and the bank statement still does
// the proving — the screenshot is supplementary evidence so a person at the
// desk can see the receipt without asking for it. Same pipeline rules as
// application images: browser POSTs here (no CDN secrets), magic-byte sniff
// before anything is stored, private authenticated Cloudinary asset, publicId
// recorded on the FeeIntent for the dossier.
//
// Allowed while the intent is `issued` or `awaiting_bank_evidence` — before
// or after the claim, replaceable until matched.

import { NextResponse } from "next/server";
import { prisma } from "@voeq/db";
import { SNIFFED_MIME, MAX_UPLOAD_BYTES } from "@/lib/apply-schema";
import { uploadPrivateOriginal, cloudinaryConfigured } from "@/lib/cloudinary";
import { verifyAccessToken } from "@/lib/access";
import { writeAudit } from "@/lib/audit-write";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const blocked = tooManyRequests(rateLimit("track.claim.receipt", clientIp(req)));
  if (blocked) return blocked;

  if (!cloudinaryConfigured()) {
    return NextResponse.json({ error: "Image storage is not configured" }, { status: 503 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const claimed = verifyAccessToken(String(form.get("token") ?? ""));
  if (!claimed) {
    return NextResponse.json({ error: "This link has done its time" }, { status: 401 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Attach the receipt screenshot" }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "File too large (10MB hard cap)" }, { status: 413 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  // Magic bytes only — a renamed PDF or .exe wearing a .jpg name dies here.
  const head = bytes.subarray(0, 8).toString("hex");
  const sniffed = SNIFFED_MIME.get(head) ?? SNIFFED_MIME.get(head.slice(0, 6));
  if (!sniffed) {
    return NextResponse.json(
      { error: "Not a real JPEG or PNG. Re-save the screenshot as an image and try again." },
      { status: 415 },
    );
  }

  let result;
  try {
    result = await uploadPrivateOriginal({ bytes, mimeType: sniffed });
  } catch (err) {
    console.error("[claim/receipt] cloudinary upload failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Upload failed — check your connection and try again" }, { status: 502 });
  }

  try {
    const intent = await prisma.feeIntent.findUnique({
      where: { applicationId: claimed.applicationId },
      select: { id: true, status: true, reference: true },
    });
    if (!intent || (intent.status !== "issued" && intent.status !== "awaiting_bank_evidence")) {
      return NextResponse.json(
        { error: "The receipt is not needed for this payment step any more" },
        { status: 409 },
      );
    }

    const previousId = await prisma.feeIntent.findUnique({
      where: { applicationId: claimed.applicationId },
      select: { receiptPublicId: true },
    });

    await prisma.feeIntent.update({
      where: { applicationId: claimed.applicationId },
      data: { receiptPublicId: result.publicId, receiptUploadedAt: new Date() },
    });

    await writeAudit(prisma, {
      entityType: "FeeIntent",
      entityId: intent.id,
      action: "fee.receipt_uploaded",
      actorEmail: claimed.email,
      actorFamily: null,
      data: {
        reference: intent.reference,
        publicId: result.publicId,
        replaced: Boolean(previousId?.receiptPublicId),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Receipt upload failed" },
      { status: 400 },
    );
  }
}
