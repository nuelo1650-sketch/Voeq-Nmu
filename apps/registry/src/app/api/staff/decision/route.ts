// Real staff decision route — requires an Auth.js session AND an ACTIVE
// register-family account. Identity is the verified Google email; the desk
// gate re-reads the account row server-side on every call, so suspended or
// disabled accounts lose their power the moment the admin flips the switch.

import { NextResponse } from "next/server";
import { decisionSchema, recordDecision } from "@/lib/decisions";
import { staffGate } from "@/lib/staff";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const gate = await staffGate("register");
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON" }, { status: 400 });
  }

  const parsed = decisionSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      { error: `${first?.path?.join(".") ?? "decision"}: ${first?.message ?? "invalid"}` },
      { status: 400 },
    );
  }

  try {
    const result = await recordDecision(parsed.data, {
      email: gate.staff.email,
      family: gate.staff.family,
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Decision failed" },
      { status: 400 },
    );
  }
}
