// ---------------------------------------------------------------------------
// The audit writer — Phase 4 (4.7). Nothing wrote to AuditLog before this;
// the table, the hash-chain machinery in @voeq/core and the append-only SQL
// existed from Phase 0 waiting for the first writer.
//
// Chain rule (@voeq/core hashEntry): each entry's hash commits to the previous
// hash FOR THE SAME entityId, so history is tamper-evident per entity without
// serialising every write behind one global chain. The reader re-verifies with
// verifyChain; the audit browser surfaces a broken link in red.
// ---------------------------------------------------------------------------

import { prisma } from "@voeq/db";
import { hashEntry, type AuditEntry } from "@voeq/core";
import type { Prisma } from "@voeq/db";

// Inside a transaction the entry commits or dies with the mutation it
// describes; the singleton is accepted too for standalone appends.
type AuditDb = Prisma.TransactionClient | typeof prisma;

export interface WriteAuditInput {
  entityType: string;
  entityId: string;
  action: string;
  actorEmail: string | null;
  actorFamily: "platform" | "register" | null;
  data?: unknown;
}

/**
 * Append one audit entry inside the caller's transaction (or standalone when
 * no tx is given — but prefer the transaction so the entry commits or dies
 * with the mutation it describes).
 */
export async function writeAudit(db: AuditDb, input: WriteAuditInput): Promise<void> {
  const now = new Date();
  const prev = await db.auditLog.findFirst({
    where: { entityId: input.entityId },
    orderBy: { id: "desc" },
    select: { hash: true },
  });

  const entry: AuditEntry = {
    entityType: input.entityType,
    entityId: input.entityId,
    action: input.action,
    actorEmail: input.actorEmail,
    actorFamily: input.actorFamily,
    data: input.data ?? null,
    createdAt: now,
  };

  await db.auditLog.create({
    data: {
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      actorEmail: input.actorEmail,
      actorFamily: input.actorFamily,
      data: (input.data ?? null) as Prisma.InputJsonValue,
      prevHash: prev?.hash ?? null,
      hash: hashEntry(entry, prev?.hash ?? null),
      createdAt: now,
    },
  });
}
