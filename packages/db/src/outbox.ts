// ---------------------------------------------------------------------------
// Transactional outbox (doc 05 deliverable 0.5).
//
// A Notification row is created INSIDE the same transaction as the state
// change it belongs to. A poller sends pending rows through the Resend
// adapter with retries and backoff. At-least-once delivery: a sent email
// twice is recoverable; a silent state is not.
// ---------------------------------------------------------------------------

import type { PrismaClient, Prisma } from "./client.js";
import type { EmailAdapter } from "@voeq/email";

export type OutboxTx = Prisma.TransactionClient;

/** Call inside the same transaction as the state change. */
export function createNotification(
  tx: OutboxTx,
  input: { topic: string; payload: Record<string, unknown>; availableAt?: Date },
) {
  return tx.notification.create({
    data: {
      topic: input.topic,
      payload: input.payload as Prisma.InputJsonValue,
      availableAt: input.availableAt ?? new Date(),
    },
  });
}

export interface OutboxProcessorOptions {
  batchSize?: number;
  maxAttempts?: number;
}

/** Poll + send. Returns the number of rows processed. */
export async function processOutbox(
  prisma: PrismaClient,
  adapter: EmailAdapter,
  options: OutboxProcessorOptions = {},
): Promise<{ processed: number; sent: number; failed: number }> {
  const { batchSize = 10, maxAttempts = 5 } = options;
  const rows = await prisma.notification.findMany({
    where: { status: "pending", availableAt: { lte: new Date() }, attempts: { lt: maxAttempts } },
    orderBy: { createdAt: "asc" },
    take: batchSize,
  });

  let sent = 0;
  let failed = 0;

  for (const row of rows) {
    const payload = row.payload as { to?: string; template?: { subject: string; html: string } };
    if (!payload?.to || !payload?.template) {
      await prisma.notification.update({
        where: { id: row.id },
        data: { status: "failed", lastError: "payload missing to/template", attempts: { increment: 1 } },
      });
      failed += 1;
      continue;
    }

    const result = await adapter.send(payload.to, payload.template);
    if (result.ok) {
      await prisma.notification.update({
        where: { id: row.id },
        data: { status: "sent", sentAt: new Date(), attempts: { increment: 1 }, lastError: null },
      });
      sent += 1;
    } else {
      const attempts = row.attempts + 1;
      // Exponential backoff: 1m, 2m, 4m, 8m… capped by maxAttempts.
      const availableAt = new Date(Date.now() + Math.min(2 ** attempts, 32) * 60_000);
      await prisma.notification.update({
        where: { id: row.id },
        data: {
          status: attempts >= maxAttempts ? "failed" : "pending",
          attempts,
          lastError: result.error ?? "unknown error",
          availableAt,
        },
      });
      failed += 1;
    }
  }

  return { processed: rows.length, sent, failed };
}
