// ---------------------------------------------------------------------------
// Outbox drain for serverless — the poller worker (packages/db/src/worker.ts)
// is a long-running process, which Vercel functions are not. Found in the
// 2026-11-19 regression: production had pending Notification rows and
// NOTHING to send them — applicant emails would queue forever.
//
// Two layers now cover delivery:
//   1. after() drain — every route that enqueues also schedules a drain
//      immediately after its response (Next 15 `after`, backed by Vercel's
//      waitUntil). This is the normal path; emails go out in seconds.
//   2. /api/cron/outbox — secret-protected sweep on a Vercel cron schedule,
//      catching anything the inline drain missed (function freeze, Resend
//      hiccup, retry backoff windows).
// ---------------------------------------------------------------------------

import { prisma } from "@voeq/db";
import { processOutbox } from "@voeq/db/outbox";
import { emailAdapter } from "@voeq/email";

export async function drainOutbox(): Promise<void> {
  try {
    const r = await processOutbox(prisma, emailAdapter);
    if (r.processed > 0) {
      console.log(`[outbox] drained processed=${r.processed} sent=${r.sent} failed=${r.failed}`);
    }
  } catch (err) {
    // Never let the drain break the response — the cron sweep and the
    // retry backoff in processOutbox are the safety net.
    console.error("[outbox] drain failed:", err instanceof Error ? err.message : err);
  }
}
