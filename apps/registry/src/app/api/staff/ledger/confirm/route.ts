// Real confirmation — register-family session, maker-checker ENFORCED: the
// account that staged a match can never confirm it (doc 07 §2.6 rule 5).

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { confirmAllocation } from "@/lib/ledger";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
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
    const result = await confirmAllocation(body.allocationId, session.user.email);
    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Confirm failed" },
      { status: 400 },
    );
  }
}
