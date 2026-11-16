// Workbench shared pieces — status vocabulary for the staff side.

import Link from "next/link";

export const STATUS_META: Record<
  string,
  { label: string; cls: string }
> = {
  draft: { label: "Draft", cls: "bg-neutral-100 text-neutral-500 border-neutral-200" },
  submitted: { label: "New — unread", cls: "bg-vq-amber/15 text-vq-amber-dark border-vq-amber/40" },
  under_review: { label: "Under review", cls: "bg-vq-forest/10 text-vq-forest border-vq-forest/30" },
  needs_correction: { label: "Awaiting fixes", cls: "bg-vq-amber-light text-vq-amber-dark border-vq-amber/40" },
  approved: { label: "Approved — awaiting payment", cls: "bg-vq-forest/10 text-vq-forest border-vq-forest/30" },
  rejected: { label: "Rejected", cls: "bg-neutral-100 text-neutral-500 border-neutral-300" },
  registered: { label: "On the record", cls: "bg-vq-forest text-white border-vq-forest" },
  suspended: { label: "Suspended", cls: "bg-red-50 text-red-700 border-red-200" },
  closed: { label: "Closed", cls: "bg-neutral-100 text-neutral-400 border-neutral-200" },
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
  const meta = STATUS_META[status] ?? { label: status, cls: "bg-neutral-100 text-neutral-500 border-neutral-200" };
  return (
    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${meta.cls}`}>
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
      className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
        active
          ? "bg-vq-forest text-white"
          : "border border-vq-forest/20 bg-white/70 text-vq-forest hover:border-vq-forest/50"
      }`}
    >
      {label}
    </Link>
  );
}
