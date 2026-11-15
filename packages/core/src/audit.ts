// ---------------------------------------------------------------------------
// Audit hash chain — per-entity (doc 07 §6.2.1). Each entry's hash commits to
// the previous hash for the same entity, making history tamper-evident without
// serialising every write behind one global chain.
//
// The chain is stored in AuditLog (prevHash, hash). The table is append-only
// at the DATABASE level (packages/db/prisma/sql/audit-immutable.sql) — the app
// role has no UPDATE/DELETE grant, so rewriting history is not possible even
// for the super admin.
// ---------------------------------------------------------------------------

import { createHash } from "node:crypto";

export interface AuditEntry {
  entityType: string;
  entityId: string;
  action: string;
  actorEmail: string | null;
  actorFamily: "platform" | "register" | null;
  data?: unknown;
  createdAt: Date;
}

export interface AuditableRow {
  prevHash: string | null;
  hash: string;
}

/** Deterministic JSON — key order must be stable for hashing. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
}

export function hashEntry(entry: AuditEntry, prevHash: string | null): string {
  return createHash("sha256")
    .update(prevHash ?? "")
    .update("|")
    .update(
      canonicalJson({
        entityType: entry.entityType,
        entityId: entry.entityId,
        action: entry.action,
        actorEmail: entry.actorEmail,
        actorFamily: entry.actorFamily,
        data: entry.data ?? null,
        createdAt: entry.createdAt.toISOString(),
      }),
    )
    .digest("hex");
}

/** Verify an entity's stored chain, oldest first. Returns the first broken index. */
export function verifyChain(rows: readonly AuditableRow[], entries: readonly AuditEntry[]): number | null {
  let prev: string | null = null;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const entry = entries[i];
    if (!row || !entry) return i;
    if (row.prevHash !== prev) return i;
    if (row.hash !== hashEntry(entry, prev)) return i;
    prev = row.hash;
  }
  return null;
}
