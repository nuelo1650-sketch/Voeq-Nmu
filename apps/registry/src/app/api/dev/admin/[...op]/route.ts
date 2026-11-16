// DEV-ONLY super-admin mutation door (blocked in production). Same action
// layer as /api/admin/[...op], but the identity is the synthetic dev-preview
// super admin — attributed in the audit trail as dev-superadmin@platform.voeq.
// Kai reviews every admin screen and every mutation here BEFORE deployment.

import { notFound } from "next/navigation";
import { NextResponse } from "next/server";
import { adminActionSchema, runAdminAction } from "@/lib/admin-actions";
import { devAdminContext } from "@/lib/admin";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") notFound();

  const ctx = await devAdminContext();

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
