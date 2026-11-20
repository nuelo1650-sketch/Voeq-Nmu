-- Certificate code — the permanent identifier of a registered business
-- (Kai, 2026-11-20). NMU-REG-2026-0001, issued once in the fee-confirm
-- transaction. Additive only: two nullable columns, one unique index.

ALTER TABLE "Application" ADD COLUMN "certificateCode" TEXT;
ALTER TABLE "Application" ADD COLUMN "certificateIssuedAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "Application_certificateCode_key" ON "Application"("certificateCode");
