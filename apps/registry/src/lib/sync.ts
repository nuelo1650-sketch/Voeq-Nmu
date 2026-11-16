// The vendor sync queue (3.6, registry side). One row per registered
// business, created the moment the fee is confirmed. A worker posts it to
// voeq.ng's internal vendor endpoint when VOEQ_SYNC_URL is configured; until
// then rows WAIT — visible, counted, never lost. The badge's truth on
// voeq.ng always comes from /api/public/verify, so a pending sync never
// fakes a badge; it only delays the profile link.
//
// This runs as part of the same one-shot maintenance pass as the outbox.

import { prisma } from "@voeq/db";

export interface SyncResult {
  attempted: number;
  synced: number;
  failed: number;
  skippedNoUrl: boolean;
}

export function vendorPayload(sync: { payload: unknown }): unknown {
  return sync.payload;
}

export async function processVendorSync(): Promise<SyncResult> {
  const url = process.env.VOEQ_SYNC_URL;
  const pending = await prisma.vendorSync.findMany({
    where: { status: { in: ["pending", "failed"] }, attempts: { lt: 10 } },
    orderBy: { createdAt: "asc" },
    take: 50,
  });

  const result: SyncResult = { attempted: 0, synced: 0, failed: 0, skippedNoUrl: !url };
  if (!url) return result; // nothing configured — rows keep waiting, on purpose

  for (const row of pending) {
    result.attempted++;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(process.env.VOEQ_SYNC_TOKEN
            ? { Authorization: `Bearer ${process.env.VOEQ_SYNC_TOKEN}` }
            : {}),
        },
        body: JSON.stringify(row.payload),
      });
      if (!res.ok) throw new Error(`voeq.ng returned ${res.status}`);
      await prisma.vendorSync.update({
        where: { id: row.id },
        data: { status: "synced", syncedAt: new Date(), lastError: null },
      });
      result.synced++;
    } catch (err) {
      await prisma.vendorSync.update({
        where: { id: row.id },
        data: {
          status: "failed",
          attempts: { increment: 1 },
          lastError: err instanceof Error ? err.message.slice(0, 300) : "sync failed",
        },
      });
      result.failed++;
    }
  }
  return result;
}
