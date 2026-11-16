-- Phase 3 (registry side): decision kinds for the badge lifecycle, the
-- applicant's vendor-link claim, and the vendor sync queue.

ALTER TYPE "DecisionKind" ADD VALUE IF NOT EXISTS 'suspend';
ALTER TYPE "DecisionKind" ADD VALUE IF NOT EXISTS 'lift_suspension';
ALTER TYPE "DecisionKind" ADD VALUE IF NOT EXISTS 'close';

ALTER TABLE "Application" ADD COLUMN "voeqVendorUrl" TEXT;

CREATE TYPE "VendorSyncStatus" AS ENUM ('pending', 'synced', 'failed');

CREATE TABLE "VendorSync" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "VendorSyncStatus" NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "syncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorSync_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VendorSync_applicationId_key" ON "VendorSync"("applicationId");

ALTER TABLE "VendorSync" ADD CONSTRAINT "VendorSync_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
