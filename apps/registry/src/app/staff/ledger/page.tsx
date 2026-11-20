// ---------------------------------------------------------------------------
// The fee ledger — the REAL production screen (the dev preview at /dev/ledger
// always said "the real route joins it under /staff/ledger once the
// allowlists land"; this is that route). The finance officer's morning:
// three numbers that must add up, the statement import, and every credit
// with its fate — behind the register desk's own gate.
//
// The directions are written into the screen (Kai: the directions must be
// clear for each turn the operator is on): what the import expects, who may
// confirm (a second person — maker-checker), and what confirmation does
// (registers the business, issues its certificate number).
// ---------------------------------------------------------------------------

import { redirect } from "next/navigation";
import { prisma } from "@voeq/db";
import { formatNaira } from "@voeq/core";
import { auth } from "@/lib/auth";
import { ImportForm, ConfirmButton } from "./ledger-client";

export const dynamic = "force-dynamic";

export const metadata = { title: "The fee ledger — NMU Business Register" };

export default async function StaffLedgerPage() {
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase() ?? "";
  const account = email
    ? await prisma.staffAccount.findUnique({ where: { email } }).catch(() => null)
    : null;
  if (!session?.user || !account || account.status !== "active") {
    redirect("/staff/signin");
  }

  const grants = await prisma.roleGrant.findMany({
    where: { staffAccountId: account.id, revokedAt: null },
    select: { permissionKey: true },
  });
  const held = new Set(grants.map((g) => g.permissionKey));
  if (!held.has("ledger.read")) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <h1 className="font-display text-3xl text-vq-forest-dark">The fee ledger</h1>
        <div className="mt-4 border border-vq-amber/50 bg-vq-amber-light/60 px-4 py-3 text-sm leading-relaxed text-vq-amber-dark">
          Your account does not hold the ledger permission — the money screen stays
          closed. A super admin can grant <span className="font-mono">ledger.read</span>{" "}
          (and the ledger actions) from the admin console.
        </div>
        <p className="mt-3 font-mono text-xs text-vq-ink-subtle">{email}</p>
      </main>
    );
  }

  const [intents, credits, stagedAllocations, confirmedAgg] = await Promise.all([
    prisma.feeIntent.findMany({
      orderBy: { issuedAt: "desc" },
      include: {
        application: {
          select: { reference: true, businessName: true, status: true, certificateCode: true },
        },
      },
      take: 50,
    }),
    prisma.bankCredit.findMany({ orderBy: { txnDate: "desc" }, take: 30 }),
    prisma.feeAllocation.findMany({
      where: { status: "staged" },
      include: {
        intent: { include: { application: { select: { reference: true, businessName: true } } } },
        credit: { select: { txnDate: true, payerName: true } },
      },
      orderBy: { stagedAt: "desc" },
    }),
    prisma.feeAllocation.aggregate({
      where: { status: "confirmed", kind: "payment" },
      _count: { _all: true },
      _sum: { schoolMinor: true, voeqMinor: true, totalMinor: true },
    }),
  ]);

  const confirmedCount = confirmedAgg._count._all;
  const confirmedTotal = confirmedAgg._sum.totalMinor ?? 0;
  const schoolHeld = confirmedAgg._sum.schoolMinor ?? 0;
  const voeqReceivable = confirmedAgg._sum.voeqMinor ?? 0;
  const outstanding = intents
    .filter((i) => i.status !== "confirmed" && i.status !== "voided")
    .reduce((sum, i) => sum + i.totalMinor, 0);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-vq-amber-dark">
          NMU Business Register · Media Unit · money desk
        </p>
        <a
          href="/staff"
          className="border border-vq-forest/40 bg-white px-3 py-1.5 text-xs font-bold text-vq-forest transition hover:border-vq-forest"
        >
          ← Workbench
        </a>
      </div>
      <h1 className="mt-1 font-display text-3xl text-vq-forest-dark">The fee ledger</h1>
      <p className="mt-2 text-sm leading-relaxed text-vq-ink-muted">
        The bank&apos;s own statement is the only thing that moves money here.
        A claim or a screenshot annotates; neither ever confirms. The whole
        route, in order: <b>import the statement CSV</b> → the matcher stages
        every row where reference, exact amount and date all agree → <b>a
        second person confirms</b> — the person who staged can never confirm —
        and confirmation registers the business and issues its certificate
        number.
      </p>

      {/* the three numbers (doc 07 §0) */}
      <div className="mt-5 grid grid-cols-2 gap-px border border-vq-forest/15 bg-vq-forest/10 sm:grid-cols-4">
        <Balance label="Confirmed" value={confirmedTotal} sub={`${confirmedCount} registrations`} />
        <Balance label="Outstanding" value={outstanding} sub="intents awaiting their credit" />
        <Balance label="School share held" value={schoolHeld} sub="memorandum — NMU's money" />
        <Balance label="Voeq receivable" value={voeqReceivable} sub="our ₦200 × confirmed" />
      </div>

      {/* staged allocations — the checker's queue */}
      <section className="mt-8">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-vq-ink-subtle">
          1 · Staged — waiting for the checker&apos;s confirm
        </h2>
        <p className="mt-1 text-xs text-vq-ink-muted">
          Each row below is money already found on the bank record. Confirm it and
          the business is registered on the spot. You cannot confirm a row you
          staged yourself.
        </p>
        {stagedAllocations.length === 0 ? (
          <p className="mt-3 border border-vq-forest/10 bg-white/70 px-4 py-3 text-sm text-vq-ink-muted">
            Nothing staged right now. The matcher stages a match only when reference,
            exact amount and date window all agree — import the statement below.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {stagedAllocations.map((al) => (
              <li
                key={al.id}
                className="flex flex-wrap items-center justify-between gap-3 border border-vq-amber bg-vq-amber-light/40 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-vq-forest-dark">
                    {al.intent.application.businessName}{" "}
                    <span className="font-mono text-xs text-vq-ink-muted">
                      {al.intent.application.reference}
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs text-vq-ink-muted">
                    {formatNaira(al.totalMinor)} · staged by{" "}
                    <span className="font-mono">{al.stagedByEmail}</span>
                  </p>
                </div>
                {al.stagedByEmail === email ? (
                  <p className="max-w-[16rem] text-right text-xs text-vq-amber-dark">
                    You staged this match — the confirm belongs to a second person.
                  </p>
                ) : (
                  <ConfirmButton allocationId={al.id} />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* import */}
      <section className="mt-8">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-vq-ink-subtle">
          2 · Import the bank statement
        </h2>
        <div className="mt-3 border border-vq-forest/15 bg-white/80 p-4">
          <p className="text-xs leading-relaxed text-vq-ink-muted">
            Four columns, one row per credit:{" "}
            <code className="font-mono text-vq-ink">date,narration,amount,payer</code>{" "}
            — dates ISO (<span className="font-mono">2026-11-16</span>), amounts in
            naira (<span className="font-mono">5200</span>), and the reference{" "}
            <span className="font-mono">NMU-2026-XXXX</span> somewhere in the
            narration. The file is hashed on arrival; the same file never imports
            twice, and a malformed line stops the whole import loudly.
          </p>
          <div className="mt-3">
            <ImportForm />
          </div>
        </div>
      </section>

      {/* fee intents */}
      <section className="mt-8">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-vq-ink-subtle">
          3 · Fee intents — what is owed
        </h2>
        <ul className="mt-3 divide-y divide-vq-forest/10 border border-vq-forest/15 bg-white/80">
          {intents.length === 0 && (
            <li className="px-4 py-3 text-sm text-vq-ink-muted">
              None yet. Approving an application issues its intent (₦5,200 exact).
            </li>
          )}
          {intents.map((i) => (
            <li key={i.id} className="px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-vq-forest-dark">
                  {i.application.businessName}{" "}
                  <span className="font-mono text-xs text-vq-ink-muted">{i.reference}</span>
                </p>
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-vq-ink-subtle">
                  {i.status.replace(/_/g, " ")}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-vq-ink-muted">
                {formatNaira(i.totalMinor)}{" "}
                {i.claimAt && (
                  <>
                    · claimed by <b>{i.claimSenderName}</b> via {i.claimPayerBank}
                  </>
                )}
                {i.application.certificateCode && (
                  <>
                    {" "}· <span className="font-mono font-bold text-vq-forest-dark">{i.application.certificateCode}</span>
                  </>
                )}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {/* credits */}
      <section className="mt-8">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-vq-ink-subtle">
          4 · Bank credits — what the statement said
        </h2>
        <ul className="mt-3 divide-y divide-vq-forest/10 border border-vq-forest/15 bg-white/80">
          {credits.length === 0 && (
            <li className="px-4 py-3 text-sm text-vq-ink-muted">
              Nothing imported yet.
            </li>
          )}
          {credits.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm text-vq-ink">
                  {c.narration}
                  {c.payerName && (
                    <span className="text-vq-ink-muted"> · {c.payerName}</span>
                  )}
                </p>
                <p className="mt-0.5 font-mono text-xs text-vq-ink-subtle">
                  {c.txnDate.toISOString().slice(0, 10)} ·{" "}
                  {c.referenceExtracted ?? "no reference found"}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-mono text-sm text-vq-ink">{formatNaira(c.amountMinor)}</p>
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-vq-ink-subtle">
                  {c.status}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* the money leaves here too */}
      <div className="mt-8 flex items-center justify-between gap-2">
        <p className="text-xs text-vq-ink-subtle">
          The whole ledger, for Excel or printing:
        </p>
        <a
          href="/api/staff/export/ledger"
          className="shrink-0 border border-vq-forest/25 bg-white px-3 py-2 text-xs font-semibold text-vq-forest transition hover:border-vq-forest"
        >
          ⤓ Export money as CSV
        </a>
      </div>
    </main>
  );
}

function Balance({ label, value, sub }: { label: string; value: number; sub: string }) {
  return (
    <div className="bg-white/80 px-4 py-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-vq-ink-subtle">
        {label}
      </p>
      <p className="mt-1 font-mono text-lg font-bold text-vq-forest-dark">
        {formatNaira(value)}
      </p>
      <p className="text-[11px] text-vq-ink-muted">{sub}</p>
    </div>
  );
}
