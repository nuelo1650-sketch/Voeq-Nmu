// Health endpoint — the uptime-monitor's single probe (5.6). Two jobs:
//
// 1. "Is the app and its database alive?" — the Phase 0 gate's question.
// 2. "Is the machine HEALTHY?" — Phase 5.6's question: letters piling up in
//    the outbox, vendor syncs failing, evidence photos that never promoted.
//    Each has a threshold; breaching one flips `status` to "degraded" and
//    names the breach, so an uptime monitor (anything that checks
//    status == "ok") alerts without bespoke integrations.
//
// Always 200 in both states — the body, not the status code, is the signal.

import { prisma } from "@voeq/db";

export const dynamic = "force-dynamic";

export async function GET() {
  let db = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = true;
  } catch {
    db = false;
  }

  // Monitoring queries are cheap counts; if the DB is down they fail closed
  // with nulls and the response stays honest.
  let outboxPending: number | null = null;
  let outboxFailed: number | null = null;
  let vendorSyncFailed: number | null = null;
  let imagesUnpromoted: number | null = null;

  if (db) {
    try {
      const [pending, failed, syncFailed, unpromoted] = await Promise.all([
        prisma.notification.count({ where: { status: "pending" } }),
        prisma.notification.count({ where: { status: "failed" } }),
        prisma.vendorSync.count({ where: { status: "failed" } }),
        prisma.applicationImage.count({ where: { status: { in: ["uploaded", "validated"] } } }),
      ]);
      outboxPending = pending;
      outboxFailed = failed;
      vendorSyncFailed = syncFailed;
      imagesUnpromoted = unpromoted;
    } catch {
      // leave the nulls — degraded below covers it
    }
  }

  // Thresholds: a small morning's backlog is normal (letters wait for the
  // worker); anything beyond this means the machine is stalled.
  const breaches: string[] = [];
  if (db) {
    if (outboxPending !== null && outboxPending > 25) breaches.push(`outbox backlog ${outboxPending}`);
    if (outboxFailed !== null && outboxFailed > 0) breaches.push(`failed letters ${outboxFailed}`);
    if (vendorSyncFailed !== null && vendorSyncFailed > 0) breaches.push(`vendor sync failures ${vendorSyncFailed}`);
    if (imagesUnpromoted !== null && imagesUnpromoted > 12) {
      breaches.push(`evidence awaiting promotion ${imagesUnpromoted}`);
    }
  }

  const status = !db ? "degraded" : breaches.length > 0 ? "degraded" : "ok";

  return Response.json({
    status,
    db,
    breaches,
    monitors: {
      outboxPending,
      outboxFailed,
      vendorSyncFailed,
      imagesUnpromoted,
    },
    thresholds: {
      outboxPending: 25,
      outboxFailed: 0,
      vendorSyncFailed: 0,
      imagesUnpromoted: 12,
    },
    ts: new Date().toISOString(),
  });
}
