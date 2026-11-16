// Statement import — maker's step. DEV preview (blocked in production).
// The real route (api/staff/ledger/import) requires a register-family session.

import { NextResponse } from "next/server";
import { importStatement } from "@/lib/ledger";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Attach the statement CSV" }, { status: 400 });
  }
  if (file.size > 2_000_000) {
    return NextResponse.json({ error: "File too large (2 MB max)" }, { status: 400 });
  }

  try {
    const text = await file.text();
    const result = await importStatement(
      file.name.slice(0, 120),
      text,
      "dev-preview@media.unit",
    );
    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Import failed" },
      { status: 400 },
    );
  }
}
