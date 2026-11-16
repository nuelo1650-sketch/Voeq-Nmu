// Real staff decision route — requires an Auth.js session. Identity is the
// verified Google email; the allowlist decides who got here at all.

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { decisionSchema, recordDecision } from "@/lib/decisions";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
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
    // Family resolution from the allowlists happens in the staff pages; the
    // decision itself is attributed to the verified email either way.
    const result = await recordDecision(parsed.data, {
      email: session.user.email,
      family: "register",
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Decision failed" },
      { status: 400 },
    );
  }
}
