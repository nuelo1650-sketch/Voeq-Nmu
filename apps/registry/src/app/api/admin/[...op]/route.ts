// Real super-admin mutation door — one catch-all, thin over lib/admin-actions.
// Identity: the signed-in platform account; authority: its open RoleGrants.
// Every action re-checks its permission key inside runAdminAction, so a
// missing grant fails with 403 before anything is touched.

import { NextResponse } from "next/server";
import { adminActionSchema, runAdminAction } from "@/lib/admin-actions";
import { getPlatformAdminContext } from "@/lib/admin";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const ctx = await getPlatformAdminContext();
  if (!ctx) {
    return NextResponse.json(
      { error: "Sign in with a platform-family account" },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON" }, { status: 400 });
  }

  const parsed = adminActionSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      { error: `${first?.path?.join(".") ?? "input"}: ${first?.message ?? "invalid"}` },
      { status: 400 },
    );
  }

  const result = await runAdminAction(ctx, parsed.data);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.data ?? { ok: true }, { status: result.status });
}
