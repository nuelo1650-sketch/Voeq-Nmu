// DEV-ONLY notes route (blocked in production) — same machinery as the real
// staff route, attributed to dev-preview@media.unit, so Kai can exercise the
// notes feature through the approval gate without a signed-in session.

import { NextResponse } from "next/server";
import { prisma } from "@voeq/db";
import { noteSchema } from "@/lib/notes";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
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

  const note = await prisma.staffNote.create({
    data: {
      applicationId: parsed.data.applicationId,
      authorEmail: "dev-preview@media.unit",
      body: parsed.data.body,
    },
  });
  return NextResponse.json({ ok: true, id: note.id }, { status: 201 });
}
