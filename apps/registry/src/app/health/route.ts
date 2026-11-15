// Health endpoint — the Phase 0 gate's "app runs" probe (roadmap, Phase 0 gate).
// Returns 200 in both states so a monitoring ping is unambiguous:
//   { status: "ok", db: true }    — app AND database reachable
//   { status: "degraded", db: false } — app reachable, database not
// Phase 2 will add the ledger's reconciliation freshness here.

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

  return Response.json({ status: db ? "ok" : "degraded", db, ts: new Date().toISOString() });
}
