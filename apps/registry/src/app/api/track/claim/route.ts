// Applicant's "I have paid" claim — token-gated, one per application.
//
// Doc 07 §5.1a: the claim is the applicant's WORD. It annotates the fee
// intent and starts the SLA clock ("the bank record reaches us once a day"),
// but it can never create a bank credit or move money. Truth comes from the
// statement CSV only.
//
// Fires letter #5 (feeAwaitingEvidence) in the same transaction.

import { NextResponse } from "next/server";
import { prisma } from "@voeq/db";
import { createNotification } from "@voeq/db/outbox";
import { feeAwaitingEvidence } from "@voeq/email";
import { assertFeeIntentTransition } from "@voeq/core";
import { verifyAccessToken } from "@/lib/access";
import { z } from "zod";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const claimSchema = z.object({
  token: z.string().min(10),
  payerBank: z.string().trim().min(2).max(60),
  senderName: z.string().trim().min(2).max(80),
});

export async function POST(req: Request) {
  // Phase 5.1 — token-gated already; the IP cap stops token-free probing.
  const blocked = tooManyRequests(rateLimit("track.claim", clientIp(req)));
  if (blocked) return blocked;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON" }, { status: 400 });
  }

  const parsed = claimSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      { error: `${first?.path?.join(".") ?? "claim"}: ${first?.message ?? "invalid"}` },
      { status: 400 },
    );
  }

  const claimed = verifyAccessToken(parsed.data.token);
  if (!claimed) {
    return NextResponse.json({ error: "This link has done its time" }, { status: 401 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const application = await tx.application.findUniqueOrThrow({
        where: { id: claimed.applicationId },
        select: { id: true, reference: true, status: true, contactEmail: true },
      });
      if (application.status !== "approved") {
        return { error: "Payment is not open for this application" , status: 409 as const };
      }

      const intent = await tx.feeIntent.findUnique({
        where: { applicationId: application.id },
      });
      if (!intent || intent.status !== "issued") {
        return { error: "This payment step is not open", status: 409 as const };
      }

      assertFeeIntentTransition("issued", "awaiting_bank_evidence");
      await tx.feeIntent.update({
        where: { id: intent.id },
        data: {
          status: "awaiting_bank_evidence",
          claimPayerBank: parsed.data.payerBank,
          claimSenderName: parsed.data.senderName,
          claimAmountMinor: intent.totalMinor, // the fee is exact; the claim states the same
          claimAt: new Date(),
        },
      });

      await createNotification(tx, {
        topic: "fee.claimed",
        payload: {
          to: application.contactEmail,
          template: feeAwaitingEvidence(application.reference),
        },
      });

      return { reference: application.reference };
    });

    if ("error" in result && result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ ok: true, reference: (result as { reference: string }).reference }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Claim failed" },
      { status: 400 },
    );
  }
}
