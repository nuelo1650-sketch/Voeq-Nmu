// The applications export — every application, one row each, the whole
// picture for Excel or printing. Permission: applications.read (the same
// key that opens the queue). Includes the certificate code so the export
// itself can answer "is this business in our records?".

import { prisma } from "@voeq/db";
import { staffGate } from "@/lib/staff";
import { csvResponse, toCsv, naira, stamp } from "@/lib/export";

export const dynamic = "force-dynamic";

const STATUS_WORDS: Record<string, string> = {
  draft: "draft",
  submitted: "new",
  under_review: "in review",
  needs_correction: "awaiting fixes",
  approved: "approved — awaiting payment",
  rejected: "rejected",
  registered: "registered",
  suspended: "suspended",
  closed: "closed",
};

const FEE_WORDS: Record<string, string> = {
  issued: "not paid",
  awaiting_bank_evidence: "claimed — awaiting bank proof",
  matched: "on bank record — awaiting confirm",
  confirmed: "paid — confirmed",
  voided: "voided",
};

export async function GET() {
  const gate = await staffGate();
  if (!gate.ok) {
    return Response.json({ error: gate.error }, { status: gate.status });
  }
  const grants = await prisma.roleGrant.findMany({
    where: { staffAccountId: gate.staff.id, revokedAt: null },
    select: { permissionKey: true },
  });
  const holds = grants.some((g) => g.permissionKey === "applications.read");
  if (!holds) {
    return Response.json({ error: 'Requires the "applications.read" permission' }, { status: 403 });
  }

  const apps = await prisma.application.findMany({
    orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
    select: {
      reference: true,
      certificateCode: true,
      businessName: true,
      ownerName: true,
      ownerPhone: true,
      contactEmail: true,
      status: true,
      publicationStatus: true,
      submittedAt: true,
      decidedAt: true,
      registeredAt: true,
      category: { select: { name: true } },
      campus: { select: { name: true } },
      feeIntent: { select: { status: true, totalMinor: true, confirmedAt: true } },
    },
  });

  const today = new Date().toISOString().slice(0, 10);
  const csv = toCsv(
    ["Reference", "Registration number", "Business", "Owner", "Phone", "Email", "Category", "Campus", "Status", "Payment", "Amount (NGN)", "Submitted", "Decided", "Registered / fee confirmed"],
    apps.map((a) => [
      a.reference,
      a.certificateCode ?? "",
      a.businessName,
      a.ownerName,
      a.ownerPhone,
      a.contactEmail,
      a.category.name,
      a.campus.name,
      STATUS_WORDS[a.status] ?? a.status,
      a.feeIntent ? (FEE_WORDS[a.feeIntent.status] ?? a.feeIntent.status) : "no fee issued yet",
      a.feeIntent ? naira(a.feeIntent.totalMinor) : "",
      stamp(a.submittedAt),
      stamp(a.decidedAt),
      stamp(a.registeredAt ?? a.feeIntent?.confirmedAt ?? null),
    ]),
  );

  return csvResponse(`nmu-register-${today}.csv`, csv);
}
