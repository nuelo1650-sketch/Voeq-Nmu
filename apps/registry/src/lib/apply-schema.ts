// ---------------------------------------------------------------------------
// The application form's single source of truth for shape and limits.
// Shared by the submit route (server validation) and importable by the client
// form for client-side hints. One schema, no drift.
// ---------------------------------------------------------------------------

import { z } from "zod";

export const IMAGE_FIELDS = ["cac_certificate", "owner_photo", "business_photo"] as const;
export type ImageField = (typeof IMAGE_FIELDS)[number];

/** Fields the register cannot review without. CAC is optional by design —
 *  most campus businesses are informal; the register exists to change that. */
export const REQUIRED_IMAGE_FIELDS: readonly ImageField[] = ["owner_photo", "business_photo"];

export const CONSENT_TYPES = ["declaration", "terms", "privacy", "public_listing"] as const;
export type ConsentType = (typeof CONSENT_TYPES)[number];

/** Consent document version accepted at submission (recorded per consent row). */
export const CONSENT_DOC_VERSION = "v1";

/** Hard cap on the ORIGINAL upload payload (roadmap stage 4). The client
 *  compresses to ≤200KB; the cap exists so a bypassed client still can't
 *  push bytes through. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Post-compression size ceiling recorded in the DB (stage 2 commitment). */
export const MAX_IMAGE_BYTES_AFTER_COMPRESS = 300 * 1024;

/** Sniffed-magic-bytes → allowed mime. Content-Type headers are never trusted. */
export const SNIFFED_MIME: ReadonlyMap<string, string> = new Map([
  ["ffd8ff", "image/jpeg"],
  ["89504e470d0a1a0a", "image/png"],
]);

export const nigerianPhone = z
  .string()
  .trim()
  .regex(
    /^(?:\+234\d{10}|0\d{10})$/,
    "Use a Nigerian number: 0801… (11 digits) or +234…",
  );

export const applySchema = z.object({
  businessName: z.string().trim().min(2).max(120),
  // Required (Kai, 2026-11-20: "description of business is compulsory").
  // Ten characters minimum — long enough to stop "asdf", short enough that
  // "I sell food" passes.
  businessDescription: z
    .string()
    .trim()
    .min(10, "Describe the business in at least 10 characters — what you sell, where, for whom")
    .max(600, "Keep the description under 600 characters"),
  website: z.string().trim().max(200).optional().or(z.literal("")),
  socialHandle: z.string().trim().max(80).optional().or(z.literal("")),
  // 3.4 light — the applicant's claim of an existing voeq.ng shop. Stored on
  // the register now; matching it against the marketplace is a cross-repo job.
  voeqVendorUrl: z.string().trim().max(200).optional().or(z.literal("")),
  campusId: z.string().min(1),
  categoryId: z.string().min(1),
  // When the applicant picks the "Other" category: their own words for what
  // the business sells. The Media Unit files it into a real category later —
  // this note is what they adjust FROM. Required server-side whenever the
  // chosen category's slug is "other".
  categoryOther: z.string().trim().min(2).max(80).optional().or(z.literal("")),
  ownerName: z.string().trim().min(3).max(120),
  ownerPhone: nigerianPhone,
  contactEmail: z.string().trim().email().max(160),
  // Cloudflare Turnstile token — single-use, verified server-side against
  // siteverify when TURNSTILE_SECRET_KEY is set. Optional here because the
  // server, not the form, decides whether it is required.
  turnstileToken: z.string().min(1).max(4096).optional(),
  images: z
    .array(
      z.object({
        field: z.enum(IMAGE_FIELDS),
        publicId: z.string().min(1).max(160),
        originalName: z.string().min(1).max(160),
        mimeType: z.enum(["image/jpeg", "image/png"]),
        sizeBytes: z.number().int().positive().lte(MAX_IMAGE_BYTES_AFTER_COMPRESS),
        width: z.number().int().positive(),
        height: z.number().int().positive(),
        checksumSha256: z.string().length(64),
      }),
    )
    .max(3),
  consents: z.object({
    declaration: z.literal(true),
    terms: z.literal(true),
    privacy: z.literal(true),
    public_listing: z.literal(true),
  }),
});

export type ApplyInput = z.infer<typeof applySchema>;

export function missingRequiredImages(images: { field: ImageField }[]): ImageField[] {
  return REQUIRED_IMAGE_FIELDS.filter((req) => !images.some((i) => i.field === req));
}
