// The queue — every application, newest first, one row each. The reviewer's
// first screen: what arrived, what state it is in, what needs a human.

import { prisma } from "@voeq/db";
import Link from "next/link";
import { StatusChip, QueueFilterBar } from "./shared";

export async function QueueView({ statusFilter }: { statusFilter?: string }) {
  const apps = await prisma.application.findMany({
    where: statusFilter ? { status: statusFilter as never } : undefined,
    orderBy: { submittedAt: "desc" },
    include: {
      category: { select: { name: true } },
      campus: { select: { name: true } },
      revisions: { orderBy: { revisionNo: "desc" }, take: 1, select: { revisionNo: true, images: { select: { id: true } } } },
    },
    take: 100,
  });

  return (
    <div>
      <QueueFilterBar current={statusFilter} />

      {apps.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-vq-forest/10 bg-white/70 p-8 text-center">
          <p className="font-display text-lg text-vq-forest-dark">Nothing here.</p>
          <p className="mt-1 text-sm text-vq-ink-muted">
            No applications in this state. The queue fills itself; you bring the judgement.
          </p>
        </div>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {apps.map((a) => (
            <li key={a.id}>
              <Link
                href={`?id=${a.id}`}
                className="block rounded-xl border border-vq-forest/10 bg-white/80 px-4 py-3.5 transition hover:border-vq-forest/40 hover:shadow-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold text-vq-forest-dark">{a.businessName}</p>
                    <p className="mt-0.5 text-xs text-vq-ink-muted">
                      <span className="font-mono">{a.reference}</span>
                      {(a.revisions[0]?.revisionNo ?? 1) > 1 && (
                        <span className="font-mono text-vq-amber-dark"> · rev {a.revisions[0]!.revisionNo}</span>
                      )}{" "}
                      · {a.category.name} ·{" "}
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
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
