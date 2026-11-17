// Real staff notes route — requires an ACTIVE register-family account (the
// desk gate re-reads the account row on every call). Notes are the desk's
// internal marginalia: attributed to the signed-in account, never emailed,
// never visible to the applicant.

import { NextResponse } from "next/server";
import { prisma } from "@voeq/db";
import { noteSchema } from "@/lib/notes";
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

  const parsed = noteSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      { error: `${first?.path?.join(".") ?? "note"}: ${first?.message ?? "invalid"}` },
      { status: 400 },
    );
  }

  try {
    const note = await prisma.staffNote.create({
      data: {
        applicationId: parsed.data.applicationId,
        authorEmail: gate.staff.email,
        body: parsed.data.body,
      },
    });
    return NextResponse.json({ ok: true, id: note.id }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Could not save the note" }, { status: 500 });
  }
}
