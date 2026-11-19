// Real confirmation — ACTIVE register-family account (the desk gate re-reads
// the account row on every call), maker-checker ENFORCED: the account that
// staged a match can never confirm it (doc 07 §2.6 rule 5).

import { NextResponse, after } from "next/server";
import { confirmAllocation } from "@/lib/ledger";
import { staffGate } from "@/lib/staff";
import { drainOutbox } from "@/lib/outbox-drain";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const gate = await staffGate("register");
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  let body: { allocationId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON" }, { status: 400 });
  }
  if (!body.allocationId) {
    return NextResponse.json({ error: "allocationId required" }, { status: 400 });
  }

  try {
    const result = await confirmAllocation(body.allocationId, gate.staff.email);
    // The registration/publication letters queue inside confirmAllocation —
    // send them now (serverless has no poller worker, see outbox-drain.ts).
    after(() => drainOutbox());
    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Confirm failed" },
      { status: 400 },
    );
  }
}
