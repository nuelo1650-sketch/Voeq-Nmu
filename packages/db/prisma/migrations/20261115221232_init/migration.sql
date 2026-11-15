-- CreateEnum
CREATE TYPE "AdminFamily" AS ENUM ('platform', 'register');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('active', 'suspended', 'disabled');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('draft', 'submitted', 'under_review', 'needs_correction', 'approved', 'rejected', 'registered', 'suspended', 'closed');

-- CreateEnum
CREATE TYPE "PublicationStatus" AS ENUM ('not_published', 'published', 'unpublished');

-- CreateEnum
CREATE TYPE "DecisionKind" AS ENUM ('approve', 'reject', 'request_corrections');

-- CreateEnum
CREATE TYPE "ImageField" AS ENUM ('cac_certificate', 'owner_photo', 'business_photo');

-- CreateEnum
CREATE TYPE "ImageStatus" AS ENUM ('uploaded', 'validated', 'rejected', 'promoted');

-- CreateEnum
CREATE TYPE "ConsentType" AS ENUM ('declaration', 'terms', 'privacy', 'public_listing');

-- CreateEnum
CREATE TYPE "FeeIntentStatus" AS ENUM ('issued', 'awaiting_bank_evidence', 'matched', 'confirmed', 'voided');

-- CreateEnum
CREATE TYPE "CreditStatus" AS ENUM ('unmatched', 'matched', 'excepted');

-- CreateEnum
CREATE TYPE "AllocationKind" AS ENUM ('payment', 'refund');

-- CreateEnum
CREATE TYPE "AllocationStatus" AS ENUM ('staged', 'confirmed', 'written_off');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('pending', 'sent', 'failed');

-- CreateTable
CREATE TABLE "Institution" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "prefix" TEXT NOT NULL DEFAULT 'NMU',
    "status" "AccountStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Institution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campus" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Campus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferenceSequence" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "last" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ReferenceSequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffAccount" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "family" "AdminFamily" NOT NULL,
    "institutionId" TEXT,
    "status" "AccountStatus" NOT NULL DEFAULT 'active',
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoleGrant" (
    "id" TEXT NOT NULL,
    "staffAccountId" TEXT NOT NULL,
    "permissionKey" TEXT NOT NULL,
    "grantedByEmail" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedByEmail" TEXT,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "RoleGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MagicToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "applicationId" TEXT,
    "purpose" TEXT NOT NULL DEFAULT 'applicant_access',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MagicToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "campusId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'draft',
    "publicationStatus" "PublicationStatus" NOT NULL DEFAULT 'not_published',
    "businessName" TEXT NOT NULL,
    "ownerName" TEXT NOT NULL,
    "ownerPhone" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "businessDescription" TEXT,
    "currentRevisionId" TEXT,
    "submittedAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "registeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationRevision" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "revisionNo" INTEGER NOT NULL,
    "data" JSONB NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationImage" (
    "id" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "field" "ImageField" NOT NULL,
    "r2Key" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "checksumSha256" TEXT NOT NULL,
    "status" "ImageStatus" NOT NULL DEFAULT 'uploaded',
    "validation" JSONB,
    "promotedPublicId" TEXT,
    "promotedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentRecord" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "type" "ConsentType" NOT NULL,
    "docVersion" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Decision" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "revisionId" TEXT,
    "kind" "DecisionKind" NOT NULL,
    "reason" TEXT,
    "items" JSONB,
    "decidedByEmail" TEXT NOT NULL,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Decision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeSchedule" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "schoolMinor" INTEGER NOT NULL,
    "voeqMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeeSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeIntent" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "schoolMinor" INTEGER NOT NULL,
    "voeqMinor" INTEGER NOT NULL,
    "totalMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "status" "FeeIntentStatus" NOT NULL DEFAULT 'issued',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),

    CONSTRAINT "FeeIntent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankFeedImport" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileHashSha256" TEXT NOT NULL,
    "sourceBankCode" TEXT,
    "importedByEmail" TEXT NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rowCount" INTEGER NOT NULL,
    "notes" TEXT,

    CONSTRAINT "BankFeedImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankCredit" (
    "id" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "txnDate" TIMESTAMP(3) NOT NULL,
    "narration" TEXT NOT NULL,
    "payerName" TEXT,
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "sourceBankCode" TEXT,
    "referenceExtracted" TEXT,
    "rowHashSha256" TEXT NOT NULL,
    "status" "CreditStatus" NOT NULL DEFAULT 'unmatched',

    CONSTRAINT "BankCredit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeAllocation" (
    "id" TEXT NOT NULL,
    "creditId" TEXT NOT NULL,
    "intentId" TEXT NOT NULL,
    "kind" "AllocationKind" NOT NULL DEFAULT 'payment',
    "schoolMinor" INTEGER NOT NULL,
    "voeqMinor" INTEGER NOT NULL,
    "totalMinor" INTEGER NOT NULL,
    "status" "AllocationStatus" NOT NULL DEFAULT 'staged',
    "stagedByEmail" TEXT NOT NULL,
    "stagedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedByEmail" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "writtenOffByEmail" TEXT,
    "writtenOffReason" TEXT,

    CONSTRAINT "FeeAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" BIGSERIAL NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorEmail" TEXT,
    "actorFamily" "AdminFamily",
    "data" JSONB,
    "prevHash" TEXT,
    "hash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Institution_slug_key" ON "Institution"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Campus_institutionId_slug_key" ON "Campus"("institutionId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "Category_institutionId_slug_key" ON "Category"("institutionId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "ReferenceSequence_institutionId_year_key" ON "ReferenceSequence"("institutionId", "year");

-- CreateIndex
CREATE UNIQUE INDEX "StaffAccount_email_key" ON "StaffAccount"("email");

-- CreateIndex
CREATE INDEX "StaffAccount_family_institutionId_idx" ON "StaffAccount"("family", "institutionId");

-- CreateIndex
CREATE INDEX "RoleGrant_staffAccountId_idx" ON "RoleGrant"("staffAccountId");

-- CreateIndex
CREATE INDEX "RoleGrant_permissionKey_idx" ON "RoleGrant"("permissionKey");

-- CreateIndex
CREATE UNIQUE INDEX "MagicToken_tokenHash_key" ON "MagicToken"("tokenHash");

-- CreateIndex
CREATE INDEX "MagicToken_email_idx" ON "MagicToken"("email");

-- CreateIndex
CREATE INDEX "MagicToken_applicationId_idx" ON "MagicToken"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "Application_reference_key" ON "Application"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "Application_currentRevisionId_key" ON "Application"("currentRevisionId");

-- CreateIndex
CREATE INDEX "Application_institutionId_status_idx" ON "Application"("institutionId", "status");

-- CreateIndex
CREATE INDEX "Application_status_submittedAt_idx" ON "Application"("status", "submittedAt");

-- CreateIndex
CREATE INDEX "Application_campusId_idx" ON "Application"("campusId");

-- CreateIndex
CREATE INDEX "Application_categoryId_idx" ON "Application"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationRevision_applicationId_revisionNo_key" ON "ApplicationRevision"("applicationId", "revisionNo");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationImage_r2Key_key" ON "ApplicationImage"("r2Key");

-- CreateIndex
CREATE INDEX "ApplicationImage_revisionId_field_idx" ON "ApplicationImage"("revisionId", "field");

-- CreateIndex
CREATE UNIQUE INDEX "ConsentRecord_revisionId_type_key" ON "ConsentRecord"("revisionId", "type");

-- CreateIndex
CREATE INDEX "Decision_applicationId_idx" ON "Decision"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "FeeSchedule_institutionId_version_key" ON "FeeSchedule"("institutionId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "FeeIntent_applicationId_key" ON "FeeIntent"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "FeeIntent_reference_key" ON "FeeIntent"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "BankFeedImport_fileHashSha256_key" ON "BankFeedImport"("fileHashSha256");

-- CreateIndex
CREATE UNIQUE INDEX "BankCredit_rowHashSha256_key" ON "BankCredit"("rowHashSha256");

-- CreateIndex
CREATE INDEX "BankCredit_status_idx" ON "BankCredit"("status");

-- CreateIndex
CREATE INDEX "BankCredit_txnDate_idx" ON "BankCredit"("txnDate");

-- CreateIndex
CREATE INDEX "FeeAllocation_intentId_idx" ON "FeeAllocation"("intentId");

-- CreateIndex
CREATE INDEX "FeeAllocation_status_idx" ON "FeeAllocation"("status");

-- CreateIndex
CREATE INDEX "Notification_status_availableAt_idx" ON "Notification"("status", "availableAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_createdAt_idx" ON "AuditLog"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorEmail_idx" ON "AuditLog"("actorEmail");

-- AddForeignKey
ALTER TABLE "Campus" ADD CONSTRAINT "Campus_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferenceSequence" ADD CONSTRAINT "ReferenceSequence_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAccount" ADD CONSTRAINT "StaffAccount_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleGrant" ADD CONSTRAINT "RoleGrant_staffAccountId_fkey" FOREIGN KEY ("staffAccountId") REFERENCES "StaffAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationRevision" ADD CONSTRAINT "ApplicationRevision_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationImage" ADD CONSTRAINT "ApplicationImage_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "ApplicationRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "ApplicationRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeSchedule" ADD CONSTRAINT "FeeSchedule_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeIntent" ADD CONSTRAINT "FeeIntent_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeIntent" ADD CONSTRAINT "FeeIntent_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "FeeSchedule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankCredit" ADD CONSTRAINT "BankCredit_importId_fkey" FOREIGN KEY ("importId") REFERENCES "BankFeedImport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeAllocation" ADD CONSTRAINT "FeeAllocation_creditId_fkey" FOREIGN KEY ("creditId") REFERENCES "BankCredit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeAllocation" ADD CONSTRAINT "FeeAllocation_intentId_fkey" FOREIGN KEY ("intentId") REFERENCES "FeeIntent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
