// Integration monitoring (4.8) — the vendor-sync queue, server-rendered.
// The column that matters: attempts and the last error, verbatim. A pending
// row is honest waiting (VOEQ_SYNC_URL not configured, or voeq.ng down); a
// failed row after 10 attempts is a record that needs a human.

import { prisma } from "@voeq/db";
import { SyncRetryButton } from "./SyncRetryButton";

function StatusWord({ status }: { status: string }) {
  const cls =
    status === "synced"
      ? "text-vq-forest"
      : status === "pending"
        ? "text-vq-amber-dark"
        : "text-red-700";
  return (
    <span className={`font-mono text-[11px] font-semibold uppercase tracking-[0.14em] ${cls}`}>
      {status}
    </span>
  );
}

export async function IntegrationsPanel({ dev }: { dev: boolean }) {
  const rows = await prisma.vendorSync.findMany({
    orderBy: { createdAt: "desc" },
    include: { application: { select: { reference: true, businessName: true, status: true } } },
    take: 60,
  });

  const waiting = rows.filter((r) => r.status === "pending").length;
  const failed = rows.filter((r) => r.status === "failed").length;

  return (
    <div className="space-y-4">
      <p className="border border-vq-forest/10 bg-white/60 px-4 py-2.5 text-sm text-vq-ink-muted">
        Every registered business posts itself to voeq.ng through this queue.
        Until <span className="font-mono text-xs">VOEQ_SYNC_URL</span> is configured the
        rows wait by design — the NMU badge on voeq.ng never depended on this
        link; its truth lives in <span className="font-mono text-xs">/api/public/verify</span>.
        {waiting + failed > 0 && (
          <> Right now: <b>{waiting} waiting</b>, <b className={failed ? "text-red-700" : ""}>{failed} failed</b>.</>
        )}
      </p>

      <ul className="divide-y divide-vq-forest/10 border border-vq-forest/15 bg-white/60">
        {rows.length === 0 && (
          <li className="px-4 py-4 text-sm text-vq-ink-subtle">
            Nothing here yet — rows appear the moment a fee is confirmed.
          </li>
        )}
        {rows.map((r) => (
          <li key={r.id} className="px-4 py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <p className="text-sm text-vq-ink">
                  {r.application.businessName}{" "}
                  <span className="font-mono text-xs text-vq-ink-subtle">{r.application.reference}</span>
                </p>
                <p className="mt-0.5 font-mono text-[11px] text-vq-ink-subtle">
                  attempts {r.attempts}/10 · queued{" "}
                  {r.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                  {r.syncedAt
                    ? ` · synced ${r.syncedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`
                    : ""}
                </p>
              </div>
              <span className="flex items-center gap-3">
                <StatusWord status={r.status} />
                {r.status !== "synced" && <SyncRetryButton id={r.id} dev={dev} />}
              </span>
            </div>
            {r.lastError && (
              <p className="mt-1 border-l-2 border-red-300 pl-2 font-mono text-[11px] text-red-700">
                {r.lastError}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
