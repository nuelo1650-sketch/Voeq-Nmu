// The ledger machinery (doc 07 §2.6) — the no-mistake chain, in code:
//
//   1. The statement CSV is the ONLY thing that creates a bank credit.
//      Every import batch is hashed; every row is hashed; re-importing the
//      same file is a no-op, a different file with the same rows fails the
//      row hash unique.
//   2. The matcher is reference-first · exact-amount-only · date-window.
//      Two of three signals is not a match. Anything imperfect stays in the
//      exception queue. No guessing, no fuzzy matching.
//   3. Matching STAGES an allocation; only a checker confirms. The stage is
//      written by one account, the confirm must come from a different one
//      (maker-checker, enforced at the route — dev is single-operator).
//
// CSV format the finance officer exports (documented on the ledger screen):
//   date,narration,amount,payer
//   2026-11-16,NMU-2026-0001 Blessing Provision registration,5200,Blessing Oyibo
// Amount is in NAIRA (5200), not kobo. Dates are ISO (YYYY-MM-DD).

import { createHash } from "node:crypto";
import { prisma } from "@voeq/db";
import { isExactMatch, assertFeeIntentTransition, assertApplicationTransition, formatNaira, formatCertificateCode, parseReference } from "@voeq/core";
import { createNotification } from "@voeq/db/outbox";
import { feeConfirmed, paymentException } from "@voeq/email";
import { writeAudit } from "@/lib/audit-write";

const REFERENCE_RE = /NMU-\d{4}-\d{4}/i;

export interface StatementRow {
  txnDate: Date;
  narration: string;
  payerName: string | null;
  amountMinor: number;
}

export interface ImportResult {
  importId: string;
  rowsParsed: number;
  creditsCreated: number;
  duplicatesSkipped: number;
  staged: number;
  unmatched: number;
}

/** Parse the CSV body. Throws with a human-readable message on bad input —
 *  a malformed statement must stop loudly, never partially. */
export function parseStatementCsv(text: string): StatementRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) throw new Error("The file is empty");

  // Optional header — tolerate or require? Require nothing; skip a header
  // that starts with "date".
  const first = lines[0] ?? "";
  const body =
    /^\s*date\b/i.test(first) && !/\d{4}/.test(first) ? lines.slice(1) : lines;
  if (body.length === 0) throw new Error("The file has a header but no rows");

  const rows: StatementRow[] = [];
  for (let i = 0; i < body.length; i++) {
    const raw = body[i] ?? "";
    const parts = raw.split(",").map((p) => p.trim());
    if (parts.length < 3) {
      throw new Error(`Line ${i + 1}: expected date,narration,amount,payer — got "${raw.slice(0, 80)}"`);
    }
    const dateStr = parts[0] ?? "";
    const narration = parts[1] ?? "";
    const amountStr = parts[2] ?? "";
    const payer = parts[3] ?? "";
    const txnDate = new Date(`${dateStr}T00:00:00Z`);
    if (Number.isNaN(txnDate.getTime())) {
      throw new Error(`Line ${i + 1}: "${dateStr}" is not a date (use YYYY-MM-DD)`);
    }
    const amount = Number(amountStr.replace(/[₦,\s]/g, ""));
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error(`Line ${i + 1}: "${amountStr}" is not an amount in naira`);
    }
    rows.push({
      txnDate,
      narration,
      payerName: payer && payer.length > 0 ? payer : null,
      amountMinor: Math.round(amount * 100),
    });
  }
  return rows;
}

function rowHash(r: StatementRow): string {
  return createHash("sha256")
    .update(
      `${r.txnDate.toISOString().slice(0, 10)}|${r.narration}|${r.amountMinor}|${r.payerName ?? ""}`,
    )
    .digest("hex");
}

/** Import a statement file, then run the matcher over the fresh credits. */
export async function importStatement(
  fileName: string,
  fileBody: string,
  operatorEmail: string,
): Promise<ImportResult> {
  const rows = parseStatementCsv(fileBody);
  const fileHash = createHash("sha256").update(fileBody).digest("hex");

  const existing = await prisma.bankFeedImport.findUnique({ where: { fileHashSha256: fileHash } });
  if (existing) {
    throw new Error(`This exact file was already imported (${existing.fileName}) — nothing re-ran`);
  }

  const result: ImportResult = {
    importId: "",
    rowsParsed: rows.length,
    creditsCreated: 0,
    duplicatesSkipped: 0,
    staged: 0,
    unmatched: 0,
  };

  // One statement, one row: createMany is atomic and fast — on a slow
  // pooler a per-row loop can outlive the interactive transaction, which
  // would abort the whole import. skipDuplicates leans on the row-hash
  // unique: the same credit never enters twice, no matter how many times
  // the officer re-runs the file.
  const imp = await prisma.bankFeedImport.create({
    data: {
      fileName,
      fileHashSha256: fileHash,
      importedByEmail: operatorEmail,
      rowCount: rows.length,
    },
  });
  result.importId = imp.id;

  const created = await prisma.bankCredit.createMany({
    data: rows.map((r) => ({
      importId: imp.id,
      txnDate: r.txnDate,
      narration: r.narration,
      payerName: r.payerName,
      amountMinor: r.amountMinor,
      referenceExtracted: r.narration.match(REFERENCE_RE)?.[0].toUpperCase() ?? null,
      rowHashSha256: rowHash(r),
    })),
    skipDuplicates: true,
  });
  result.creditsCreated = created.count;
  result.duplicatesSkipped = rows.length - created.count;

  const matched = await runMatcher(operatorEmail);
  result.staged = matched.staged;
  result.unmatched = matched.unmatched;
  return result;
}

/** Reference-first · exact-amount · date-window. Only intents in
 *  awaiting_bank_evidence are candidates — the state machine's own gate. */
export async function runMatcher(
  operatorEmail: string,
): Promise<{ staged: number; unmatched: number }> {
  const credits = await prisma.bankCredit.findMany({ where: { status: "unmatched" } });
  const intents = await prisma.feeIntent.findMany({
    where: { status: "awaiting_bank_evidence" },
    include: {
      application: { select: { id: true, status: true, contactEmail: true } },
    },
  });

  let staged = 0;
  const claimedIntents = new Set<string>();
  const claimedCredits = new Set<string>();

  for (const credit of credits) {
    if (!credit.referenceExtracted) continue;
    const intent = intents.find(
      (i) =>
        !claimedIntents.has(i.id) &&
        i.application.status === "approved" &&
        isExactMatch({
          intentReference: i.reference,
          intentTotalMinor: i.totalMinor,
          intentIssuedAt: i.issuedAt,
          creditReference: credit.referenceExtracted,
          creditAmountMinor: credit.amountMinor,
          creditTxnDate: credit.txnDate,
        }),
    );
    if (!intent) continue;

    // Stage, never confirm — the checker's account confirms (§2.6 rule 5).
    await prisma.$transaction(async (tx) => {
      assertFeeIntentTransition("awaiting_bank_evidence", "matched");
      await tx.feeIntent.update({ where: { id: intent.id }, data: { status: "matched" } });
      await tx.bankCredit.update({ where: { id: credit.id }, data: { status: "matched" } });
      await tx.feeAllocation.create({
        data: {
          creditId: credit.id,
          intentId: intent.id,
          schoolMinor: intent.schoolMinor,
          voeqMinor: intent.voeqMinor,
          totalMinor: intent.totalMinor,
          status: "staged",
          stagedByEmail: operatorEmail,
        },
      });
    });
    claimedIntents.add(intent.id);
    claimedCredits.add(credit.id);
    staged++;
  }

  // Exceptions (Q-P6): a credit that NAMES a reference the register issued
  // but fails the other signals never stays silent — the applicant gets the
  // exact concern (§2.6 rule 7). Credits naming an intent that has not been
  // claimed yet (`issued`) are skipped: the matcher will see them again once
  // the applicant claims, and an early email would cry wolf.
  for (const credit of credits) {
    if (claimedCredits.has(credit.id)) continue;
    if (!credit.referenceExtracted) continue;
    const intent = intents.find((i) => i.reference === credit.referenceExtracted);
    if (!intent || intent.status !== "awaiting_bank_evidence") continue;

    const concern =
      credit.amountMinor !== intent.totalMinor
        ? `The bank record shows a credit of ${formatNaira(credit.amountMinor)} against ${intent.reference} — the fee is ${formatNaira(intent.totalMinor)} exactly.`
        : `The bank record shows a credit of ${formatNaira(credit.amountMinor)} against ${intent.reference} on ${credit.txnDate.toISOString().slice(0, 10)}, outside the accepted date window.`;

    await prisma.$transaction(async (tx) => {
      await tx.bankCredit.update({ where: { id: credit.id }, data: { status: "excepted" } });
      await createNotification(tx, {
        topic: "fee.exception",
        payload: {
          to: intent.application.contactEmail,
          template: paymentException(intent.reference, concern),
        },
      });
    });
  }

  return { staged, unmatched: credits.length - staged };
}

// --- confirmation (the checker's step) --------------------------------------

export interface ConfirmResult {
  reference: string;
  businessName: string;
  certificateCode: string;
  schoolMinor: number;
  voeqMinor: number;
}

/** Confirm a staged allocation. This is the one action that moves an
 *  application to `registered` — and it is gated on EVERY layer:
 *  allocation staged → intent matched → application approved, all three
 *  asserted by the state machines, in one transaction. */
export async function confirmAllocation(
  allocationId: string,
  checkerEmail: string,
  opts: { allowSelfConfirm?: boolean } = {},
): Promise<ConfirmResult> {
  const allocation = await prisma.feeAllocation.findUniqueOrThrow({
    where: { id: allocationId },
    include: {
      intent: { include: { application: { select: { id: true, reference: true, businessName: true, status: true, contactEmail: true } } } },
    },
  });
  if (allocation.status !== "staged") {
    throw new Error(`This allocation is ${allocation.status}, not staged — nothing to confirm`);
  }
  if (!opts.allowSelfConfirm && allocation.stagedByEmail === checkerEmail) {
    throw new Error("Maker-checker: the account that staged a match cannot confirm it");
  }
  const intent = allocation.intent;
  const application = intent.application;
  if (application.status !== "approved") {
    throw new Error(`The application is ${application.status}, not approved — nothing to register`);
  }

  const base = process.env.APP_URL ?? "http://localhost:3000";
  const publicUrl = `${base}/`; // the public directory entry — placeholder until it exists

  // The certificate code (Kai, 2026-11-20): derived from the application's
  // own reference — NMU-2026-0003 → NMU-REG-2026-0003 — so it shares the
  // per-year sequence, is unique by construction, and is year-aware for
  // free (2027 registrations read NMU-REG-2027-####). Issued exactly once,
  // in the same transaction that registers the business.
  const parsed = parseReference(application.reference);
  if (!parsed) {
    throw new Error(`Reference "${application.reference}" is not parseable — cannot issue a certificate code`);
  }
  const certificateCode = formatCertificateCode(
    parsed.prefix,
    parsed.year,
    parsed.seq,
  );

  await prisma.$transaction(async (tx) => {
    assertFeeIntentTransition("matched", "confirmed");
    await tx.feeAllocation.update({
      where: { id: allocation.id },
      data: { status: "confirmed", confirmedByEmail: checkerEmail, confirmedAt: new Date() },
    });
    await tx.feeIntent.update({
      where: { id: intent.id },
      data: { status: "confirmed", confirmedAt: new Date() },
    });
    assertApplicationTransition("approved", "registered");
    await tx.application.update({
      where: { id: application.id },
      data: {
        status: "registered",
        publicationStatus: "published",
        // The certificate is minted with the registration, atomically.
        // If a code somehow already exists (impossible via this path — the
        // derivation is injective on references), the transaction fails
        // loudly rather than silently reissuing.
        certificateCode,
        certificateIssuedAt: new Date(),
      },
    });

    // Phase 3: the vendor-sync row is created in the SAME transaction as the
    // registration. Until VOEQ_SYNC_URL is configured the row waits — the
    // badge's truth lives in /api/public/verify regardless.
    const fullApplication = await tx.application.findUniqueOrThrow({
      where: { id: application.id },
      select: {
        reference: true,
        businessName: true,
        businessDescription: true,
        voeqVendorUrl: true,
        category: { select: { name: true } },
        campus: { select: { name: true } },
      },
    });
    await tx.vendorSync.upsert({
      where: { applicationId: application.id },
      create: {
        applicationId: application.id,
        payload: {
          reference: fullApplication.reference,
          businessName: fullApplication.businessName,
          description: fullApplication.businessDescription,
          category: fullApplication.category.name,
          campus: fullApplication.campus.name,
          existingVendorUrl: fullApplication.voeqVendorUrl,
        },
      },
      update: { payload: {
        reference: fullApplication.reference,
        businessName: fullApplication.businessName,
        description: fullApplication.businessDescription,
        category: fullApplication.category.name,
        campus: fullApplication.campus.name,
        existingVendorUrl: fullApplication.voeqVendorUrl,
      } },
    });
    await createNotification(tx, {
      topic: "fee.confirmed",
      payload: {
        to: application.contactEmail,
        template: feeConfirmed(application.reference, application.businessName, publicUrl, certificateCode),
      },
    });
    await writeAudit(tx, {
      entityType: "Application",
      entityId: application.id,
      action: "fee.confirmed",
      actorEmail: checkerEmail,
      actorFamily: "register",
      data: {
        reference: application.reference,
        certificateCode,
        allocationId: allocation.id,
        totalMinor: allocation.totalMinor,
        schoolMinor: allocation.schoolMinor,
        voeqMinor: allocation.voeqMinor,
      },
    });
  });

  // Stage 8 — the public display copies, best-effort after the commit. A
  // failure here never rolls back the registration; the directory renders
  // the placeholder and a re-run promotes the rest.
  try {
    const { promoteApplicationImages } = await import("@/lib/promote");
    await promoteApplicationImages(application.id);
  } catch {
    // recorded nothing on purpose — promotion is recoverable and idempotent
  }

  return {
    reference: application.reference,
    businessName: application.businessName,
    certificateCode,
    schoolMinor: allocation.schoolMinor,
    voeqMinor: allocation.voeqMinor,
  };
}
