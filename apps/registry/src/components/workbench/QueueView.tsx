// The queue — every application, newest first, one row each. The reviewer's
// first screen: what arrived, what state it is in, and the ONE obvious next
// action for every encounter — a fresh application asks to be opened and
// decided, a resubmission asks for the diff first, an approved row waits on
// payment. Overview counts (1.10) and the money strip sit above the filters.

import { prisma } from "@voeq/db";
import Link from "next/link";
import { formatNaira } from "@voeq/core";
import { StatusChip, QueueFilterBar, STATUS_META } from "./shared";

const NEXT_ACTION: Record<string, string> = {
  submitted: "open & decide",
  under_review: "open & decide",
  needs_correction: "awaiting the applicant",
  approved: "awaiting payment",
  rejected: "decided",
  registered: "on the record",
};

// What the row says about money, derived from the fee intent (if any).
function feeWord(fee?: { status: string } | null): { text: string; paid: boolean } | null {
  if (!fee) return null;
  switch (fee.status) {
    case "confirmed":
      return { text: "paid · confirmed", paid: true };
    case "matched":
      return { text: "paid · in bank record, awaiting confirm", paid: true };
    case "awaiting_bank_evidence":
      return { text: "PAID CLAIM — check bank record", paid: true };
    default:
      return { text: "not paid yet", paid: false };
  }
}

export async function QueueView({ statusFilter, query }: { statusFilter?: string; query?: string }) {
  // The pseudo-filters (shared.tsx PAYMENT_FILTERS) translate into
  // fee-intent-aware queries — this is where "who has paid" and "who has
  // been approved but not paid" are actually answered.
  const where =
    query !== undefined && query !== ""
      ? {
          OR: [
            { reference: { contains: query, mode: "insensitive" as const } },
            { certificateCode: { contains: query, mode: "insensitive" as const } },
            { businessName: { contains: query, mode: "insensitive" as const } },
            { ownerName: { contains: query, mode: "insensitive" as const } },
            { ownerPhone: { contains: query } },
            { contactEmail: { contains: query, mode: "insensitive" as const } },
          ],
        }
      : statusFilter === "resubmitted"
        ? { status: "under_review", revisions: { some: { revisionNo: { gt: 1 } } } }
        : statusFilter === "awaiting-payment"
          ? // Approved, money not yet in hand: intent still `issued` (or not
            // yet cut). This is the "approved but pending payment" answer.
            {
              status: "approved",
              OR: [{ feeIntent: null }, { feeIntent: { status: "issued" } }],
            }
          : statusFilter === "paid-pending"
            ? // They say they paid — the desk has not confirmed it yet.
              {
                feeIntent: { status: { in: ["awaiting_bank_evidence", "matched"] } },
              }
            : statusFilter
              ? { status: statusFilter }
              : undefined;

  const [apps, counts, feeSums] = await Promise.all([
    prisma.application.findMany({
      where: where as never,
      orderBy: { submittedAt: "desc" },
      include: {
        category: { select: { name: true } },
        campus: { select: { name: true } },
        feeIntent: { select: { status: true } },
        revisions: {
          orderBy: { revisionNo: "desc" },
          take: 1,
          select: { revisionNo: true, images: { select: { id: true } } },
        },
      },
      take: 100,
    }),
    prisma.application.groupBy({ by: ["status"], _count: { _all: true } }),
    // The money strip (Kai: the workbench must show what is owned and what
    // is coming in — transparency). Three figures, straight from the ledger
    // of fee intents: confirmed money, claimed money awaiting the bank's
    // proof, and everything still owed.
    prisma.feeIntent.groupBy({ by: ["status"], _sum: { totalMinor: true }, _count: { _all: true } }),
  ]);

  const sumOf = (...statuses: string[]): number =>
    feeSums
      .filter((s) => statuses.includes(s.status))
      .reduce((acc, s) => acc + (s._sum.totalMinor ?? 0), 0);
  const collectedMinor = sumOf("confirmed");
  const inFlightMinor = sumOf("matched", "awaiting_bank_evidence");
  const owedMinor = sumOf("issued");

  const countOf = (status: string): number =>
    counts.find((c) => c.status === status)?._count._all ?? 0;
  const resubmittedCount = await prisma.application.count({
    where: { status: "under_review", revisions: { some: { revisionNo: { gt: 1 } } } },
  });

  return (
    <div>
      {/* the desk header — ONE ruled block, same grammar as the admin
          overview: hairline-ruled cells, label over a big mono figure.
          Money reads as a pipeline left to right: owed → claimed →
          collected (1.10 + Kai's transparency ask). Each figure is a
          CLICKABLE FILTER — the number answers the question, the click
          answers it with names (Kai: clear directions for every turn). */}
      <div className="border border-vq-forest/20 bg-white">
        <div className="grid grid-cols-1 gap-px bg-vq-forest/10 sm:grid-cols-3">
          <MoneyStat
            label="Still owed"
            value={formatNaira(owedMinor)}
            valueCls="text-vq-ink"
            href="?status=awaiting-payment"
            note="approved · not yet paid"
          />
          <MoneyStat
            label="Claimed · awaiting proof"
            value={formatNaira(inFlightMinor)}
            valueCls="text-vq-amber-dark"
            href="?status=paid-pending"
            note="they say paid · check the bank record"
          />
          <MoneyStat
            label="Collected, all time"
            value={formatNaira(collectedMinor)}
            valueCls="text-vq-forest-dark"
            href="?status=registered"
            note="confirmed on the bank record"
          />
        </div>
        {/* queue counts — compact footer strip inside the same block */}
        <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-vq-forest/10 px-4 py-2.5">
          <Count label="New" value={countOf("submitted")} />
          <Count label="In review" value={countOf("under_review")} />
          <Count label="Awaiting fixes" value={countOf("needs_correction")} />
          <Count label="Awaiting payment" value={countOf("approved")} />
          <Count label="Registered" value={countOf("registered")} />
          {resubmittedCount > 0 && <Count label="Resubmitted" value={resubmittedCount} accent />}
        </div>
        {/* the directions (Kai: clear for each turn). Money questions have
            two answers and one path each. */}
        <div className="border-t border-vq-forest/10 bg-vq-cream/60 px-4 py-3 text-xs leading-relaxed text-vq-ink-muted">
          <p>
            <b className="text-vq-forest-dark">Who has paid?</b> Click{" "}
            <span className="font-mono text-[10px] uppercase">Paid — awaiting confirm</span> or{" "}
            <span className="font-mono text-[10px] uppercase">Paid — on the record</span> below.
          </p>
          <p className="mt-1">
            <b className="text-vq-forest-dark">Approved but not paid?</b> Click{" "}
            <span className="font-mono text-[10px] uppercase">Awaiting payment</span>. To collect a
            payment: import the bank statement CSV in the ledger → match the reference → a second
            account confirms. Full steps sit inside each record.
          </p>
        </div>
      </div>

      {/* the register search (Kai: find anyone and say "yes, he's in our
          records"). Searches certificate codes, references, names, phones. */}
      <form action="/staff" method="get" className="mt-4 flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={query ?? ""}
          placeholder="Search: NMU-REG-2026-0001, NMU-2026-0001, name, phone, email…"
          className="min-w-0 flex-1 border border-vq-forest/20 bg-white px-4 py-2.5 font-mono text-sm text-vq-ink placeholder:font-sans placeholder:text-vq-ink-subtle focus:border-vq-forest focus:outline-none"
        />
        <button
          type="submit"
          className="shrink-0 bg-vq-forest px-4 py-2.5 text-xs font-bold text-white transition hover:opacity-90"
        >
          Search the register
        </button>
      </form>
      {query !== undefined && query !== "" && (
        <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-vq-ink-subtle">
          searching for “{query}” — {apps.length} match{apps.length === 1 ? "" : "es"} ·{" "}
          <a href="/staff" className="underline">
            clear
          </a>
        </p>
      )}

      <div className="mt-4">
        <QueueFilterBar current={statusFilter} />
      </div>

      {/* the way data leaves the register (Kai: downloadable, printable) */}
      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="text-xs text-vq-ink-subtle">
          Need the data outside this screen? The export below opens in Excel.
        </p>
        <a
          href="/api/staff/export/applications"
          className="shrink-0 border border-vq-forest/25 bg-white px-3 py-2 text-xs font-semibold text-vq-forest transition hover:border-vq-forest"
        >
          ⤓ Export all as CSV
        </a>
      </div>

      {apps.length === 0 ? (
        <div className="mt-6 border border-vq-forest/10 bg-white/70 p-8 text-center">
          <p className="font-display text-lg text-vq-forest-dark">Nothing here.</p>
          <p className="mt-1 text-sm text-vq-ink-muted">
            No applications in this state. The queue fills itself; you bring the judgement.
          </p>
        </div>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {apps.map((a) => {
            const rev = a.revisions[0]?.revisionNo ?? 1;
            const isResubmission = rev > 1;
            const action =
              a.status === "under_review" && isResubmission
                ? "resubmitted — read what changed first"
                : (NEXT_ACTION[a.status] ?? "");
            const fee = feeWord(a.feeIntent);
            return (
              <li key={a.id}>
                <Link
                  href={`?id=${a.id}`}
                  className="block border border-vq-forest/10 bg-white/80 px-4 py-3.5 transition hover:border-vq-forest/40 hover:shadow-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-semibold text-vq-forest-dark">
                        {a.businessName}
                        {isResubmission && (
                          <span className="ml-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-vq-amber-dark">
                            resubmitted · rev {rev}
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 text-xs text-vq-ink-muted">
                        <span className="font-mono">{a.reference}</span> · {a.category.name} ·{" "}
                        {a.campus.name.replace(" Campus", "")} · {a.revisions[0]?.images.length ?? 0} photo
                        {(a.revisions[0]?.images.length ?? 0) === 1 ? "" : "s"}
                      </p>
                      {a.certificateCode && (
                        <p className="mt-0.5 font-mono text-[11px] font-bold text-vq-forest-dark">
                          {a.certificateCode}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <StatusChip status={a.status} />
                      <p className="mt-1 text-[11px] text-vq-ink-subtle">
                        {a.submittedAt?.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                      </p>
                    </div>
                  </div>
                  {fee && (a.status === "approved" || a.status === "registered") && (
                    <p
                      className={`mt-2 inline-block px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] ${
                        fee.paid
                          ? "bg-vq-forest text-white"
                          : "border border-vq-amber text-vq-amber-dark"
                      }`}
                    >
                      {fee.text}
                    </p>
                  )}
                  {action && !(fee && action === "awaiting payment") && (
                    <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-vq-ink-subtle">
                      → {action}
                    </p>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// Money cell — same grammar as the admin overview Metric: micro label over
// a large mono figure, sitting in a hairline-ruled cell (parent supplies
// the gap-px rules; this supplies the white surface). The whole cell is a
// link: the figure answers "how much", the click answers "who".
function MoneyStat({
  label,
  value,
  valueCls,
  href,
  note,
}: {
  label: string;
  value: string;
  valueCls: string;
  href?: string;
  note?: string;
}) {
  const body = (
    <div className="bg-white px-4 py-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-vq-ink-subtle">{label}</p>
      <p className={`mt-1.5 font-mono text-2xl leading-none ${valueCls}`}>{value}</p>
      {note && (
        <p className="mt-1.5 font-mono text-[9px] uppercase tracking-[0.12em] text-vq-ink-subtle">
          {note}
        </p>
      )}
    </div>
  );
  return href ? (
    <a href={href} className="block transition hover:bg-vq-cream/50">
      {body}
    </a>
  ) : (
    body
  );
}

function Count({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-vq-ink-subtle">
      {label} <b className={`ml-0.5 text-xs ${accent ? "text-vq-amber-dark" : "text-vq-forest-dark"}`}>{value}</b>
    </p>
  );
}

// STATUS_META is imported to keep the vocabulary import honest if the row
// rendering ever grows into using per-state styles again.
void STATUS_META;
