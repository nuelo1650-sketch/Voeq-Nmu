-- Storage decision (Kai, 2026-11-15): Cloudinary is the entire image pipeline.
-- The column that holds the private asset's id is renamed accordingly.
ALTER TABLE "ApplicationImage" RENAME COLUMN "r2Key" TO "cloudinaryPublicId";
