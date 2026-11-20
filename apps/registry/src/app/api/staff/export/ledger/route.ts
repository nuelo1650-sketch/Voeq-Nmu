// The money export — every fee intent with its confirmed allocations: the
// full financial tracking sheet. Permission: ledger.read.

import { prisma } from "@voeq/db";
import { staffGate } from "@/lib/staff";
import { csvResponse, toCsv, naira, stamp } from "@/lib/export";

export const dynamic = "force-dynamic";

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
  const holds = grants.some((g) => g.permissionKey === "ledger.read");
  if (!holds) {
    return Response.json({ error: 'Requires the "ledger.read" permission' }, { status: 403 });
  }

  const intents = await prisma.feeIntent.findMany({
    orderBy: { issuedAt: "desc" },
    select: {
      reference: true,
      status: true,
      issuedAt: true,
      confirmedAt: true,
      schoolMinor: true,
      voeqMinor: true,
      totalMinor: true,
      claimPayerBank: true,
      claimSenderName: true,
      claimAt: true,
      application: {
        select: {
          businessName: true,
          ownerName: true,
          ownerPhone: true,
          certificateCode: true,
          status: true,
        },
      },
      allocations: {
        where: { status: "confirmed" },
        select: {
          totalMinor: true,
          confirmedByEmail: true,
          confirmedAt: true,
          credit: { select: { txnDate: true, payerName: true, narration: true } },
        },
      },
    },
  });

  const today = new Date().toISOString().slice(0, 10);
  const csv = toCsv(
    [
      "Reference",
      "Registration number",
      "Business",
      "Owner",
      "Phone",
      "Payment status",
      "Amount expected (NGN)",
      "School share (NGN)",
      "Voeq share (NGN)",
      "Claimed by",
      "Claimed via",
      "Claimed at",
      "Confirmed by",
      "Confirmed at",
      "Bank txn date",
      "Bank payer name",
    ],
    intents.map((i) => {
      const alloc = i.allocations[0];
      return [
        i.reference,
        i.application.certificateCode ?? "",
        i.application.businessName,
        i.application.ownerName,
        i.application.ownerPhone,
        FEE_WORDS[i.status] ?? i.status,
        naira(i.totalMinor),
        naira(i.schoolMinor),
        naira(i.voeqMinor),
        i.claimSenderName ?? "",
        i.claimPayerBank ?? "",
        stamp(i.claimAt),
        alloc?.confirmedByEmail ?? "",
        stamp(alloc?.confirmedAt ?? i.confirmedAt),
        alloc ? stamp(alloc.credit.txnDate) : "",
        alloc?.credit.payerName ?? "",
      ];
    }),
  );

  return csvResponse(`nmu-money-${today}.csv`, csv);
}
