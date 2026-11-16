// Real statement import — register-family session required.

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { importStatement } from "@/lib/ledger";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Attach the statement CSV" }, { status: 400 });
  }

  try {
    const text = await file.text();
    const result = await importStatement(file.name.slice(0, 120), text, session.user.email);
    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Import failed" },
      { status: 400 },
    );
  }
}
