// The fee ledger — dev preview (blocked in production; the real route joins
// it under /staff/ledger once the allowlists land). This is the screen the
// Media Unit's finance officer works from every morning (doc 07 §4.2):
// three numbers at the top that must always add up, the statement import,
// and every credit with its fate.

import { prisma } from "@voeq/db";
import { formatNaira } from "@voeq/core";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/brand";
import { ImportForm, ConfirmButton } from "./ledger-client";

export const dynamic = "force-dynamic";

export const metadata = { title: "Fee ledger — dev preview" };

export default async function DevLedgerPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const [intents, credits, stagedAllocations, confirmedAgg] = await Promise.all([
    prisma.feeIntent.findMany({
      orderBy: { issuedAt: "desc" },
      include: { application: { select: { reference: true, businessName: true, status: true } } },
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
    <div className="min-h-dvh">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-5 pb-24 pt-8">
        <div className="border border-vq-amber bg-vq-amber-light/60 px-4 py-2.5 text-xs text-vq-amber-dark">
          Dev preview — dev-preview@media.unit acts on everything here. Production
          blocks this route; the real one sits behind the register-family sign-in and
          refuses self-confirmation.
        </div>

        <h1 className="mt-5 font-display text-2xl text-vq-forest-dark">The fee ledger</h1>
        <p className="mt-1 text-sm text-vq-ink-muted">
          The bank&apos;s own statement is the only thing that moves money here.
          Screenshots annotate; they never confirm.
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
            Staged — waiting for the checker&apos;s confirm
          </h2>
          {stagedAllocations.length === 0 ? (
            <p className="mt-3 border border-vq-forest/10 bg-white/70 px-4 py-3 text-sm text-vq-ink-muted">
              Nothing staged. The matcher stages a match only when reference, exact
              amount and date window all agree.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {stagedAllocations.map((al) => (
                <li
                  key={al.id}
                  className="flex flex-wrap items-center justify-between gap-3 border border-vq-forest/15 bg-white/80 px-4 py-3"
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
                  <ConfirmButton allocationId={al.id} />
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* import */}
        <section className="mt-8">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-vq-ink-subtle">
            Import the bank statement
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
            Fee intents — what is owed
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
                </p>
              </li>
            ))}
          </ul>
        </section>

        {/* credits */}
        <section className="mt-8">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-vq-ink-subtle">
            Bank credits — what the statement said
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

        <p className="mt-8 text-sm text-vq-ink-muted">
          Back to the{" "}
          <Link href="/dev/workbench" className="underline">
            workbench
          </Link>{" "}
          · the applicant&apos;s view at{" "}
          <Link href="/dev/track" className="underline">
            /dev/track
          </Link>
        </p>
      </main>
    </div>
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
