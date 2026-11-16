// DEV-ONLY decision route for the /dev/workbench preview. Exists so Kai can
// exercise the full decision flow (state machine + letter queue) while the
// staff allowlists are still empty. Returns 404 in production builds — no
// production code path reaches this file's logic. Decisions made here are
// attributed to "dev-preview@media.unit" and are visible as such in the
// decision history.

import { NextResponse } from "next/server";
import { decisionSchema, recordDecision } from "@/lib/decisions";

export const dynamic = "force-dynamic";

const DEV_IDENTITY = { email: "dev-preview@media.unit", family: "register" as const };

export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") notFound();

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
    const result = await recordDecision(parsed.data, DEV_IDENTITY);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Decision failed" },
      { status: 400 },
    );
  }
}

function notFound() {
  return NextResponse.json({ error: "Not available" }, { status: 404 });
}
