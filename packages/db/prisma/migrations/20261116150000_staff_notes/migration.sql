-- Staff internal notes: the desk's marginalia on one application. Internal
-- only — the applicant-facing page and the letters never read from here.
CREATE TABLE "StaffNote" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "authorEmail" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StaffNote_applicationId_createdAt_idx" ON "StaffNote"("applicationId", "createdAt");

ALTER TABLE "StaffNote" ADD CONSTRAINT "StaffNote_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
