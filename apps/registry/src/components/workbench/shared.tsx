// Workbench shared pieces — status vocabulary for the staff side.

import Link from "next/link";

// Statuses are WORDS, not pills — mono uppercase text, colour carries the
// state. No rounded containers anywhere (Kai: "no words in pills").
export const STATUS_META: Record<
  string,
  { label: string; cls: string }
> = {
  draft: { label: "Draft", cls: "text-neutral-500" },
  submitted: { label: "New — unread", cls: "text-vq-amber-dark" },
  under_review: { label: "Under review", cls: "text-vq-forest" },
  needs_correction: { label: "Awaiting fixes", cls: "text-vq-amber-dark" },
  approved: { label: "Approved — awaiting payment", cls: "text-vq-forest" },
  rejected: { label: "Rejected", cls: "text-neutral-500" },
  registered: { label: "On the record", cls: "text-vq-forest-dark" },
  suspended: { label: "Suspended", cls: "text-red-700" },
  closed: { label: "Closed", cls: "text-neutral-400" },
};

export const QUEUE_FILTERS: { key: string; label: string }[] = [
  { key: "submitted", label: "New" },
  { key: "under_review", label: "In review" },
  { key: "needs_correction", label: "Awaiting fixes" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "registered", label: "Registered" },
];

export function StatusChip({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? { label: status, cls: "text-neutral-500" };
  return (
    <span className={`font-mono text-[11px] font-semibold uppercase tracking-[0.14em] ${meta.cls}`}>
      {meta.label}
    </span>
  );
}

export function QueueFilterBar({ current }: { current?: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      <FilterLink href="?" label="All" active={!current} />
      {QUEUE_FILTERS.map((f) => (
        <FilterLink key={f.key} href={`?status=${f.key}`} label={f.label} active={current === f.key} />
      ))}
    </div>
  );
}

function FilterLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`px-3 py-1.5 text-xs font-semibold transition ${
        active
          ? "bg-vq-forest text-white"
          : "border border-vq-forest/20 bg-white/70 text-vq-forest hover:border-vq-forest/50"
      }`}
    >
      {label}
    </Link>
  );
}
