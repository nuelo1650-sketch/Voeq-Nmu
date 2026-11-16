// Stage 8 of the image pipeline (roadmap): on REGISTRATION — never before —
// the applicant's photos gain public display copies in `voeq/nmu/`, so the
// directory and voeq.ng can show them without a signed URL. The private
// originals stay authenticated forever; promotion ADDS a public copy with a
// deterministic public id (`voeq/nmu/nmu-2026-0001-business_photo`), so
// re-runs overwrite the same asset instead of duplicating.
//
// Best-effort by design: a failed promotion returns a per-image result and
// leaves the row unmarked; the directory renders the placeholder block for
// any business whose photos are not yet promoted, and a re-run promotes the
// rest. Nothing about the badge or the registration depends on it.

import { prisma } from "@voeq/db";
import { promotePublicDerivative, signedAuthenticatedUrl } from "@/lib/cloudinary";

export interface PromotionSummary {
  reference: string;
  promoted: { field: string; publicId: string }[];
  failed: { field: string; error: string }[];
}

export async function promoteApplicationImages(applicationId: string): Promise<PromotionSummary> {
  const application = await prisma.application.findUniqueOrThrow({
    where: { id: applicationId },
    select: {
      reference: true,
      revisions: { orderBy: { revisionNo: "desc" }, take: 1, include: { images: true } },
    },
  });
  const summary: PromotionSummary = { reference: application.reference, promoted: [], failed: [] };

  for (const img of application.revisions[0]?.images ?? []) {
    if (img.promotedPublicId) {
      summary.promoted.push({ field: img.field, publicId: img.promotedPublicId });
      continue; // already public — idempotent re-runs
    }
    try {
      const url = signedAuthenticatedUrl(img.cloudinaryPublicId);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`signed URL returned ${res.status}`);
      const bytes = Buffer.from(await res.arrayBuffer());

      // No folder prefix — the folder param already places it in voeq/nmu/;
      // a prefixed id would double the path on Cloudinary.
      const publicId = `${application.reference.toLowerCase()}-${img.field}`;
      const result = await promotePublicDerivative({
        bytes,
        mimeType: img.mimeType,
        publicId,
      });

      await prisma.applicationImage.update({
        where: { id: img.id },
        data: { promotedPublicId: result.publicId, promotedAt: new Date() },
      });
      summary.promoted.push({ field: img.field, publicId: result.publicId });
    } catch (err) {
      summary.failed.push({
        field: img.field,
        error: err instanceof Error ? err.message : "promotion failed",
      });
    }
  }
  return summary;
}
