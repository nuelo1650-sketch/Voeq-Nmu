// Image pipeline stages 3–6 for a single image (roadmap, "The image pipeline"):
//   stage 3 — the browser POSTs here (NOT to the CDN); no upload secrets in
//             the browser, ever.
//   stage 4 — server validation BEFORE anything is stored: magic-byte sniff
//             (Content-Type never trusted), per-file size cap.
//   stage 6 — store as a PRIVATE authenticated Cloudinary asset in
//             nmu/applications/. No public URL exists from this moment.
//
// The returned descriptor is held by the client and sent with the submit
// payload; the DB row is only written inside the submit transaction (stage 5).
// If the applicant abandons the form, the orphaned asset is cleaned up by the
// Phase 1 hardening sweep (roadmap stage 7) — noted, not forgotten.

import { NextResponse } from "next/server";
import { SNIFFED_MIME, MAX_UPLOAD_BYTES } from "@/lib/apply-schema";
import { uploadPrivateOriginal, cloudinaryConfigured } from "@/lib/cloudinary";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // Phase 5.1 — 30 uploads per hour per address (6 images per submission,
  // retries included, with headroom).
  const blocked = tooManyRequests(rateLimit("apply.image", clientIp(req)));
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

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "File too large (10MB hard cap)" }, { status: 413 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  // Stage 4 — magic bytes only. A renamed .exe wearing a .jpg name dies here.
  const head = bytes.subarray(0, 8).toString("hex");
  const sniffed = SNIFFED_MIME.get(head) ?? SNIFFED_MIME.get(head.slice(0, 6));
  if (!sniffed) {
    return NextResponse.json(
      { error: "Not a real JPEG or PNG. Take the photo again or re-save it as an image." },
      { status: 415 },
    );
  }

  let result;
  try {
    result = await uploadPrivateOriginal({ bytes, mimeType: sniffed });
  } catch (err) {
    console.error("[apply/image] cloudinary upload failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Upload failed — check your connection and try again" }, { status: 502 });
  }

  // Client-reported display dimensions (it re-encoded the file and knows);
  // validation truth stays the magic-byte sniff above.
  const width = Number(form.get("width") ?? 0);
  const height = Number(form.get("height") ?? 0);

  return NextResponse.json({
    publicId: result.publicId,
    mimeType: sniffed,
    sizeBytes: result.bytes,
    width: Number.isFinite(width) && width > 0 ? width : null,
    height: Number.isFinite(height) && height > 0 ? height : null,
  });
}
