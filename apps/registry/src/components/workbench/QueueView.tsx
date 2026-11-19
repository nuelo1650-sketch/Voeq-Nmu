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

export async function QueueView({ statusFilter }: { statusFilter?: string }) {
  const [apps, counts, feeSums] = await Promise.all([
    prisma.application.findMany({
      where:
        statusFilter === "resubmitted"
          ? { status: "under_review", revisions: { some: { revisionNo: { gt: 1 } } } }
          : statusFilter
            ? { status: statusFilter as never }
            : undefined,
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
      {/* the money strip — what is owned, what is coming in (1.10 + Kai) */}
      <div className="border border-vq-forest/20 bg-white px-4 py-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-vq-ink-subtle">
          The money — this register, all time
        </p>
        <div className="mt-2 flex flex-wrap gap-x-8 gap-y-2">
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-vq-ink-subtle">
            Collected <b className="ml-1 text-base text-vq-forest-dark">{formatNaira(collectedMinor)}</b>
          </p>
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-vq-ink-subtle">
            Claimed, awaiting proof{" "}
            <b className="ml-1 text-base text-vq-amber-dark">{formatNaira(inFlightMinor)}</b>
          </p>
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-vq-ink-subtle">
            Still owed <b className="ml-1 text-base text-vq-ink">{formatNaira(owedMinor)}</b>
          </p>
        </div>
      </div>

      {/* overview metrics (1.10) — the desk at a glance */}
      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 border-y border-vq-forest/15 py-2.5">
        <Metric label="New" value={countOf("submitted")} />
        <Metric label="In review" value={countOf("under_review")} />
        <Metric label="Awaiting fixes" value={countOf("needs_correction")} />
        <Metric label="Awaiting payment" value={countOf("approved")} />
        <Metric label="Registered" value={countOf("registered")} />
        {resubmittedCount > 0 && (
          <Metric label="Resubmitted" value={resubmittedCount} accent />
        )}
      </div>

      <div className="mt-4">
        <QueueFilterBar current={statusFilter} />
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
                  {action && (
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

function Metric({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <p className="font-mono text-[11px] uppercase tracking-[0.12em]">
      <span className={accent ? "text-vq-amber-dark" : "text-vq-ink-subtle"}>
        {label}
      </span>{" "}
      <b className="text-vq-forest-dark">{value}</b>
    </p>
  );
}

// STATUS_META is imported to keep the vocabulary import honest if the row
// rendering ever grows into using per-state styles again.
void STATUS_META;
