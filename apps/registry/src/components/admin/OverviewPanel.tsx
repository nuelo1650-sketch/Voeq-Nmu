// Super-admin overview — the health of the whole system on one ruled surface
// (4.6 monitoring across institutions + 4.9 reports). Numbers are mono; the
// three that matter most (letters outbox, vendor sync, audit chain) sit at
// the top because a failure in any of them is a failure the applicant feels.

import { formatNaira } from "@voeq/core";
import type { ReportBundle } from "@/lib/reports";
import { StatusWord } from "./admin-client";

function Metric({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "warn" | "bad" | "good";
}) {
  const toneCls = tone === "warn" ? "text-vq-amber-dark" : tone === "bad" ? "text-red-700" : tone === "good" ? "text-vq-forest" : "text-vq-ink";
  return (
    <div className="bg-white/70 px-4 py-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-vq-ink-subtle">{label}</p>
      <p className={`mt-1 font-mono text-xl ${toneCls}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-vq-ink-subtle">{sub}</p>}
    </div>
  );
}

function Bar({ label, count, max }: { label: string; count: number; max: number }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div className="flex items-baseline gap-3">
      <span className="w-44 shrink-0 text-sm text-vq-ink-muted">{label}</span>
      <span className="font-mono text-sm text-vq-ink">{count}</span>
      <span className="h-2 flex-1 bg-neutral-100">
        <span className="block h-2 bg-vq-forest/50" style={{ width: `${pct}%` }} />
      </span>
    </div>
  );
}

export function OverviewPanel({ report }: { report: ReportBundle }) {
  const maxStatus = Math.max(1, ...report.applicationsByStatus.map((s) => s.count));
  const maxCat = Math.max(1, ...report.byCategory.map((c) => c.count));
  const lastSent = report.outbox.lastSentAt
    ? report.outbox.lastSentAt.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    : "never";

  return (
    <div className="space-y-8">
      {/* system health — a failure here is felt by an applicant today */}
      <section>
        <h3 className="font-mono text-[11px] uppercase tracking-[0.18em] text-vq-ink-subtle">
          System health — across every institution
        </h3>
        <div className="mt-3 grid grid-cols-2 gap-px border border-vq-forest/15 bg-vq-forest/10 sm:grid-cols-4">
          <Metric
            label="Letters queued"
            value={String(report.outbox.pending)}
            sub={`last sent ${lastSent}`}
            tone={report.outbox.pending > 20 ? "warn" : undefined}
          />
          <Metric
            label="Letters failed"
            value={String(report.outbox.failed)}
            sub="each one needs an eye"
            tone={report.outbox.failed > 0 ? "bad" : "good"}
          />
          <Metric
            label="Vendor sync"
            value={`${report.vendorSync.synced} synced`}
            sub={`${report.vendorSync.pending} waiting · ${report.vendorSync.failed} failed`}
            tone={report.vendorSync.failed > 0 ? "warn" : "good"}
          />
          <Metric
            label="Audit chain"
            value={String(report.auditTotal)}
            sub="entries, append-only"
          />
        </div>
      </section>

      {/* pipeline */}
      <section>
        <h3 className="font-mono text-[11px] uppercase tracking-[0.18em] text-vq-ink-subtle">
          The pipeline — applications by state
        </h3>
        <div className="mt-3 space-y-2 border border-vq-forest/10 bg-white/60 px-4 py-3">
          {report.applicationsByStatus.length === 0 ? (
            <p className="text-sm text-vq-ink-subtle">No applications yet.</p>
          ) : (
            report.applicationsByStatus.map((s) => (
              <Bar key={s.status} label={s.status.replace(/_/g, " ")} count={s.count} max={maxStatus} />
            ))
          )}
          <div className="border-t border-vq-forest/10 pt-2 font-mono text-[11px] uppercase tracking-[0.12em] text-vq-ink-subtle">
            on the record {report.registered} · suspended/closed {report.suspendedOrClosed} · submitted in
            last 14 days {report.submissionsLast14Days} · median first decision{" "}
            {report.medianDecisionHours === null ? "—" : `${report.medianDecisionHours} h`}
          </div>
        </div>
      </section>

      {/* money */}
      <section>
        <h3 className="font-mono text-[11px] uppercase tracking-[0.18em] text-vq-ink-subtle">
          Money — confirmed allocations only
        </h3>
        <div className="mt-3 grid grid-cols-2 gap-px border border-vq-forest/15 bg-vq-forest/10 sm:grid-cols-4">
          <Metric label="Confirmed" value={formatNaira(report.money.confirmedTotalMinor)} sub={`${report.money.confirmedCount} registrations`} />
          <Metric label="Outstanding" value={formatNaira(report.money.outstandingMinor)} sub="intents awaiting their credit" />
          <Metric label="School share" value={formatNaira(report.money.schoolMinor)} sub="memorandum — the university's" />
          <Metric label="Voeq receivable" value={formatNaira(report.money.voeqMinor)} sub="₦200 × confirmed" />
        </div>
      </section>

      {/* shape of demand */}
      <section className="grid gap-6 sm:grid-cols-2">
        <div>
          <h3 className="font-mono text-[11px] uppercase tracking-[0.18em] text-vq-ink-subtle">
            By category
          </h3>
          <div className="mt-3 space-y-2 border border-vq-forest/10 bg-white/60 px-4 py-3">
            {report.byCategory.length === 0 ? (
              <p className="text-sm text-vq-ink-subtle">—</p>
            ) : (
              report.byCategory.slice(0, 8).map((c) => (
                <Bar key={c.name} label={c.name} count={c.count} max={maxCat} />
              ))
            )}
          </div>
        </div>
        <div>
          <h3 className="font-mono text-[11px] uppercase tracking-[0.18em] text-vq-ink-subtle">
            By campus
          </h3>
          <div className="mt-3 space-y-2 border border-vq-forest/10 bg-white/60 px-4 py-3">
            {report.byCampus.length === 0 ? (
              <p className="text-sm text-vq-ink-subtle">—</p>
            ) : (
              report.byCampus.map((c) => (
                <Bar key={c.name} label={c.name} count={c.count} max={maxCat} />
              ))
            )}
          </div>
        </div>
      </section>

      {/* institutions at a glance */}
      <section>
        <h3 className="font-mono text-[11px] uppercase tracking-[0.18em] text-vq-ink-subtle">
          Institutions
        </h3>
        <ul className="mt-3 divide-y divide-vq-forest/10 border border-vq-forest/10 bg-white/60">
          {report.institutions.map((i) => (
            <li key={i.id} className="flex items-baseline justify-between px-4 py-2.5">
              <span className="text-sm text-vq-ink">
                {i.name} <span className="font-mono text-xs text-vq-ink-subtle">[{i.prefix}]</span>
              </span>
              <span className="flex items-baseline gap-4">
                <span className="font-mono text-xs text-vq-ink-subtle">{i.applicationCount} applications</span>
                <StatusWord status={i.status} />
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
