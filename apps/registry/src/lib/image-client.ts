"use client";

// Client-side image compression — stage 2 of the pipeline (roadmap): canvas
// re-encode, longest edge ≤1600px, quality stepped down from 0.85 until
// ≤200KB, EXIF orientation applied then stripped. Shared by the application
// form and the resubmission form — one implementation, no drift.

export const TARGET_BYTES = 200 * 1024;
export const HARD_BYTES = 300 * 1024;
export const LONGEST_EDGE = 1600;

export async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function compressImage(
  file: File,
): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  let w = bitmap.width;
  let h = bitmap.height;
  const long = Math.max(w, h);
  if (long > LONGEST_EDGE) {
    const s = LONGEST_EDGE / long;
    w = Math.round(w * s);
    h = Math.round(h * s);
  }
  let quality = 0.85;
  let cw = w;
  let ch = h;
  let blob: Blob | null = null;
  for (let attempt = 0; attempt < 6; attempt++) {
    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable on this browser");
    ctx.drawImage(bitmap, 0, 0, cw, ch);
    blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Re-encode failed"))), "image/jpeg", quality),
    );
    if (blob.size <= TARGET_BYTES) break;
    if (quality > 0.5) {
      quality -= 0.15;
    } else {
      cw = Math.round(cw * 0.8);
      ch = Math.round(ch * 0.8);
      if (cw < 200 || ch < 200) break;
    }
  }
  if (!blob || blob.size > HARD_BYTES) {
    throw new Error("This photo resists compression — try another one");
  }
  return { blob, width: cw, height: ch };
}
