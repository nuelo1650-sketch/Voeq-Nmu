// Confirm a staged allocation — checker's step. DEV preview (blocked in
// production). Single-operator is ALLOWED here on purpose: Kai exercises the
// full loop without a second account. The real staff route refuses
// self-confirmation; that is where maker-checker actually bites.

import { NextResponse } from "next/server";
import { confirmAllocation } from "@/lib/ledger";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
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
    const result = await confirmAllocation(body.allocationId, "dev-preview@media.unit", {
      allowSelfConfirm: true,
    });
    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Confirm failed" },
      { status: 400 },
    );
  }
}
