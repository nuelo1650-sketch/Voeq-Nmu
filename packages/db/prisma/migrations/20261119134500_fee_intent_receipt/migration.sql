-- FeeIntent receipt screenshot (Kai, 2026-11-19): optional private Cloudinary
-- asset of the transfer receipt. Additive only; applied via db execute on the
-- live database (migrate dev wanted a full reset because two old migrations
-- were edited after being applied — refused).
ALTER TABLE "FeeIntent" ADD COLUMN "receiptPublicId" TEXT;
ALTER TABLE "FeeIntent" ADD COLUMN "receiptUploadedAt" TIMESTAMP(3);
