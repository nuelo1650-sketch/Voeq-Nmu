// Real staff notes route — requires an Auth.js session. Notes are the desk's
// internal marginalia: attributed to the signed-in account, never emailed,
// never visible to the applicant.

import { NextResponse } from "next/server";
import { prisma } from "@voeq/db";
import { auth } from "@/lib/auth";
import { noteSchema } from "@/lib/notes";

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
        authorEmail: session.user.email,
        body: parsed.data.body,
      },
    });
    return NextResponse.json({ ok: true, id: note.id }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Could not save the note" }, { status: 500 });
  }
}
