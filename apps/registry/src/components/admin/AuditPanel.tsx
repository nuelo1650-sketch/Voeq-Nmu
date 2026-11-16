// Audit log browser (4.7). Server-rendered: filters in, rows out, 40 per
// page. When the view is narrowed to ONE entity, the hash chain for that
// entity is re-verified with @voeq/core's verifyChain and the verdict is
// printed — an unverified chain is just a table; a verified one is evidence.

import Link from "next/link";
import { prisma } from "@voeq/db";
import { verifyChain, type AuditEntry } from "@voeq/core";

const PAGE_SIZE = 40;

export interface AuditQuery {
  entityType?: string;
  entityId?: string;
  action?: string;
  actor?: string;
  page: number;
}

function buildWhere(q: AuditQuery) {
  return {
    ...(q.entityType ? { entityType: q.entityType } : {}),
    ...(q.entityId ? { entityId: q.entityId } : {}),
    ...(q.action ? { action: { contains: q.action } } : {}),
    ...(q.actor ? { actorEmail: { contains: q.actor } } : {}),
  };
}

function ChainVerdict({ verified, brokenAt }: { verified: boolean; brokenAt: number | null }) {
  return verified ? (
    <p className="mt-3 border border-vq-forest/25 bg-white px-4 py-2.5 text-sm text-vq-forest">
      Chain verified — every hash in this entity&apos;s history commits to the one
      before it. This is evidence, not a table.
    </p>
  ) : (
    <p className="mt-3 border border-red-300 bg-red-50 px-4 py-2.5 text-sm text-red-800">
      CHAIN BROKEN at entry {((brokenAt ?? 0) + 1)} — history for this entity has
      been altered or corrupted. Investigate immediately.
    </p>
  );
}

export async function AuditPanel({ query }: { query: AuditQuery }) {
  const where = buildWhere(query);
  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { id: "desc" },
      skip: (query.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.auditLog.count({ where }),
  ]);

  // Full-chain verification only when narrowed to a single entity.
  let verified = false;
  let brokenAt: number | null = null;
  if (query.entityId) {
    const entityRows = await prisma.auditLog.findMany({
      where: { entityId: query.entityId },
      orderBy: { id: "asc" },
    });
    const entries: AuditEntry[] = entityRows.map((r) => ({
      entityType: r.entityType,
      entityId: r.entityId,
      action: r.action,
      actorEmail: r.actorEmail,
      actorFamily: r.actorFamily,
      data: r.data,
      createdAt: r.createdAt,
    }));
    brokenAt = verifyChain(entityRows, entries);
    verified = brokenAt === null;
  }

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filterLink = (patch: Partial<AuditQuery>) => {
    const merged = { ...query, ...patch };
    const params = new URLSearchParams();
    if (merged.entityType) params.set("entityType", merged.entityType);
    if (merged.entityId) params.set("entityId", merged.entityId);
    if (merged.action) params.set("action", merged.action);
    if (merged.actor) params.set("actor", merged.actor);
    if (merged.page > 1) params.set("page", String(merged.page));
    params.set("tab", "audit");
    return `?${params.toString()}`;
  };

  return (
    <div className="space-y-4">
      {query.entityId && (verified || brokenAt !== null) && (
        <ChainVerdict verified={verified} brokenAt={brokenAt} />
      )}

      <div className="flex flex-wrap items-baseline gap-4 border border-vq-forest/10 bg-white/60 px-4 py-3 font-mono text-[11px] uppercase tracking-[0.12em] text-vq-ink-subtle">
        <span>
          {total} entr{total === 1 ? "y" : "ies"}
          {query.entityId ? " · chain verified above" : " · filter to one entity to verify its chain"}
        </span>
        {(query.entityType || query.entityId || query.action || query.actor) && (
          <Link href={filterLink({ entityType: undefined, entityId: undefined, action: undefined, actor: undefined, page: 1 })} className="text-vq-forest underline underline-offset-2">
            clear filters
          </Link>
        )}
      </div>

      <ul className="divide-y divide-vq-forest/10 border border-vq-forest/15 bg-white/60">
        {rows.length === 0 && (
          <li className="px-4 py-4 text-sm text-vq-ink-subtle">
            Nothing recorded under these filters.
          </li>
        )}
        {rows.map((r) => (
          <li key={r.id.toString()} className="px-4 py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-mono text-xs text-vq-ink">
                <span className="font-semibold">{r.action}</span>
                <span className="text-vq-ink-subtle">
                  {"  ·  "}
                  {r.entityType}
                  {" / "}
                  {r.entityId.slice(0, 10)}…
                </span>
              </p>
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-vq-ink-subtle">
                {r.createdAt.toLocaleString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
            <p className="mt-0.5 font-mono text-[11px] text-vq-ink-subtle">
              by {r.actorEmail ?? "system"}
              {r.actorFamily ? ` (${r.actorFamily})` : ""}
            </p>
            {r.data !== null && (
              <pre className="mt-1 overflow-x-auto whitespace-pre-wrap text-xs leading-relaxed text-vq-ink-muted">
                {JSON.stringify(r.data)}
              </pre>
            )}
            <Link
              href={filterLink({ entityType: r.entityType, entityId: r.entityId, page: 1 })}
              className="mt-1 inline-block font-mono text-[10px] uppercase tracking-[0.12em] text-vq-forest underline underline-offset-2"
            >
              this entity&apos;s full chain
            </Link>
          </li>
        ))}
      </ul>

      {pages > 1 && (
        <div className="flex items-baseline justify-between font-mono text-[11px] uppercase tracking-[0.12em] text-vq-ink-subtle">
          {query.page > 1 ? (
            <Link href={filterLink({ page: query.page - 1 })} className="text-vq-forest underline underline-offset-2">
              ← newer
            </Link>
          ) : (
            <span />
          )}
          <span>
            page {query.page} of {pages}
          </span>
          {query.page < pages ? (
            <Link href={filterLink({ page: query.page + 1 })} className="text-vq-forest underline underline-offset-2">
              older →
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}
    </div>
  );
}
