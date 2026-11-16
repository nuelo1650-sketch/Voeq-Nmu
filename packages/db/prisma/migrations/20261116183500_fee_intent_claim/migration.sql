ALTER TABLE "FeeIntent" ADD COLUMN "claimPayerBank" TEXT,
ADD COLUMN "claimSenderName" TEXT,
ADD COLUMN "claimAmountMinor" INTEGER,
ADD COLUMN "claimAt" TIMESTAMP(3);
