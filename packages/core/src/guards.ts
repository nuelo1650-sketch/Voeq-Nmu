// ---------------------------------------------------------------------------
// Zod input guards — the validation layer every mutation runs through.
// Server-side validation is the real gate; client-side is UX only.
// ---------------------------------------------------------------------------

import { z } from "zod";

export const emailSchema = z.string().trim().toLowerCase().email();

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^[0-9+\-\s()]{7,20}$/, "Enter a valid phone number");

// --- application form (six sections per spec §4) ---------------------------

export const businessDetailsSchema = z.object({
  businessName: z.string().trim().min(2).max(120),
  businessDescription: z.string().trim().max(2_000).optional().or(z.literal("")),
  campusId: z.string().min(1),
  categoryId: z.string().min(1),
});

export const ownerDetailsSchema = z.object({
  ownerName: z.string().trim().min(2).max(120),
  ownerPhone: phoneSchema,
  contactEmail: emailSchema,
});

export const imageFieldSchema = z.enum(["cac_certificate", "owner_photo", "business_photo"]);

export const imageUploadMetaSchema = z.object({
  field: imageFieldSchema,
  originalName: z.string().min(1).max(255),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  sizeBytes: z.number().int().min(1_000).max(10 * 1024 * 1024), // 10MB hard cap
  checksumSha256: z.string().length(64),
});

// Image compression contract (doc 05 image pipeline stage 2): the client
// re-encodes to ≤200KB; the server still enforces the 10MB original cap.
export const COMPRESSED_TARGET_BYTES = 200 * 1024;

export const consentSchema = z.object({
  declaration: z.literal(true),
  terms: z.literal(true),
  privacy: z.literal(true),
  public_listing: z.literal(true),
});
export type Consents = z.infer<typeof consentSchema>;

export const submissionSchema = z.object({
  business: businessDetailsSchema,
  owner: ownerDetailsSchema,
  images: z.array(imageUploadMetaSchema).min(3).max(6),
  consents: consentSchema,
});
export type SubmissionInput = z.infer<typeof submissionSchema>;

// --- decisions -------------------------------------------------------------

export const decisionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("approve"),
    note: z.string().max(1_000).optional(),
  }),
  z.object({
    kind: z.literal("reject"),
    reason: z.string().trim().min(10, "A rejection reason is required").max(2_000),
  }),
  z.object({
    kind: z.literal("request_corrections"),
    items: z
      .array(z.object({ field: z.string(), instruction: z.string().trim().min(5).max(500) }))
      .min(1, "At least one correction item is required"),
    message: z.string().max(2_000).optional(),
  }),
]);
export type DecisionInput = z.infer<typeof decisionSchema>;

// --- staff auth (Google OAuth only, doc 07 §4.7) ----------------------------

export const staffSignInSchema = z.object({
  email: emailSchema,
  emailVerified: z.literal(true), // Google must have verified the address
  googleSub: z.string().min(1),
});
