// ---------------------------------------------------------------------------
// The corrections loop — applicant side (roadmap 1.14). Same reference, new
// revision, history preserved: the state machine's own guard for
// needs_correction → under_review reads "applicant resubmitted (new revision)".
//
// Rules honoured here:
//   - The applicant edits the whole form again, but the flagged items are
//     shown first and marked — they are never left to guess what changed.
//   - A photo can be KEPT (same Cloudinary asset carried onto the new
//     revision) or REPLACED (fresh upload through the same pipeline).
//     Kept images are re-read from the DB server-side — the client's word
//     about an asset is never trusted.
//   - The declaration is re-affirmed and recorded on the new revision.
//   - No letter fires: the applicant performed the action themselves, and
//     letter #2 already promised "we re-read it the day it arrives".
// ---------------------------------------------------------------------------

import { z } from "zod";
import { IMAGE_FIELDS, ImageField, nigerianPhone, MAX_IMAGE_BYTES_AFTER_COMPRESS } from "./apply-schema";

export const resubmitSchema = z.object({
  businessName: z.string().trim().min(2).max(120),
  businessDescription: z.string().trim().max(600).optional().or(z.literal("")),
  website: z.string().trim().max(200).optional().or(z.literal("")),
  socialHandle: z.string().trim().max(80).optional().or(z.literal("")),
  campusId: z.string().min(1),
  categoryId: z.string().min(1),
  ownerName: z.string().trim().min(3).max(120),
  ownerPhone: nigerianPhone,
  contactEmail: z.string().trim().email().max(160),
  images: z
    .array(
      z.object({
        field: z.enum(IMAGE_FIELDS),
        keep: z.boolean().optional(),
        publicId: z.string().min(1).max(160),
        originalName: z.string().min(1).max(160).optional(),
        mimeType: z.enum(["image/jpeg", "image/png"]).optional(),
        sizeBytes: z.number().int().positive().lte(MAX_IMAGE_BYTES_AFTER_COMPRESS).optional(),
        width: z.number().int().positive().optional(),
        height: z.number().int().positive().optional(),
        checksumSha256: z.string().length(64).optional(),
      }),
    )
    .max(3),
  declaration: z.literal(true),
});

export type ResubmitInput = z.infer<typeof resubmitSchema>;

export function missingRequiredResubmitImages(images: { field: ImageField }[]): ImageField[] {
  return (["owner_photo", "business_photo"] as ImageField[]).filter(
    (req) => !images.some((i) => i.field === req),
  );
}
