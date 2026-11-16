// ---------------------------------------------------------------------------
// Cloudinary service (roadmap 0.6, single storage decision 2026-11-15).
//
// The entire image pipeline lives on Cloudinary:
//   - originals: type "authenticated" in folder nmu/applications/ — an
//     authenticated asset has NO public URL; the only way to fetch it is a
//     signed delivery URL minted per request (built in Phase 1 workbench).
//   - public display: promoted to type "upload" under voeq/nmu/ on approval.
//
// No SDK dependency: signed uploads are a sha1 over the sorted params plus
// the API secret (Cloudinary's documented scheme). Fewer dependencies on an
// OneDrive-synced repo is worth the 15 lines.
// ---------------------------------------------------------------------------

import { createHash } from "node:crypto";

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME ?? "";
const API_KEY = process.env.CLOUDINARY_API_KEY ?? "";
const API_SECRET = process.env.CLOUDINARY_API_SECRET ?? "";

const APPLICATIONS_FOLDER = "nmu/applications";
const PUBLIC_FOLDER = "voeq/nmu";

export function cloudinaryConfigured(): boolean {
  return Boolean(CLOUD_NAME && API_KEY && API_SECRET);
}

function signParams(params: Record<string, string>): string {
  const toSign = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return createHash("sha1").update(toSign + API_SECRET).digest("hex");
}

export interface CloudinaryUploadResult {
  publicId: string;
  bytes: number;
  format: string;
}

/**
 * Stage 6 — store the ORIGINAL as a private authenticated asset.
 * Server-side only: the browser never sees the API secret, and bytes always
 * pass through our validation route first (roadmap stage 3/4).
 */
export async function uploadPrivateOriginal(args: {
  bytes: Buffer;
  mimeType: string;
}): Promise<CloudinaryUploadResult> {
  if (!cloudinaryConfigured()) {
    throw new Error("Cloudinary env vars are not set — image storage is unavailable");
  }
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const folder = APPLICATIONS_FOLDER;
  const type = "authenticated";
  const params: Record<string, string> = { folder, timestamp, type };
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(args.bytes)], { type: args.mimeType }));
  form.append("folder", folder);
  form.append("type", type);
  form.append("timestamp", timestamp);
  form.append("api_key", API_KEY);
  form.append("signature", signParams(params));

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
    method: "POST",
    body: form,
  });
  const json = (await res.json()) as {
    public_id?: string;
    bytes?: number;
    format?: string;
    error?: { message?: string };
  };
  if (!res.ok || !json.public_id) {
    throw new Error(`Cloudinary upload failed: ${json.error?.message ?? res.status}`);
  }
  return { publicId: json.public_id, bytes: json.bytes ?? 0, format: json.format ?? "" };
}
