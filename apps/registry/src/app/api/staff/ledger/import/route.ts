// Real statement import — ACTIVE register-family account required (the desk
// gate re-reads the account row on every call).

import { NextResponse, after } from "next/server";
import { importStatement } from "@/lib/ledger";
import { staffGate } from "@/lib/staff";
import { drainOutbox } from "@/lib/outbox-drain";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const gate = await staffGate("register");
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Attach the statement CSV" }, { status: 400 });
  }

  try {
    const text = await file.text();
    const result = await importStatement(file.name.slice(0, 120), text, gate.staff.email);
    // Fee-ready letters queue inside importStatement — send them now
    // (serverless has no poller worker, see outbox-drain.ts).
    after(() => drainOutbox());
    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Import failed" },
      { status: 400 },
    );
  }
}
