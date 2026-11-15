// ---------------------------------------------------------------------------
// Outbox worker — run alongside the app (Phase 1 wires it into the deploy):
//   tsx packages/db/src/worker.ts
// Polls the outbox every 15s and sends pending notifications via Resend.
// pg-boss scheduled jobs (statement reminders, remittance runs) attach here
// in Phase 2 (doc 05 deliverable 0.5).
// ---------------------------------------------------------------------------

import { prisma } from "./index.js";
import { processOutbox } from "./outbox.js";
import { emailAdapter } from "@voeq/email";

const INTERVAL_MS = 15_000;

async function tick() {
  try {
    const r = await processOutbox(prisma, emailAdapter);
    if (r.processed > 0) console.log(`[outbox] processed=${r.processed} sent=${r.sent} failed=${r.failed}`);
  } catch (err) {
    console.error("[outbox] tick failed:", err instanceof Error ? err.message : err);
  }
}

void tick();
setInterval(tick, INTERVAL_MS);
console.log(`[outbox] worker running every ${INTERVAL_MS / 1000}s`);
