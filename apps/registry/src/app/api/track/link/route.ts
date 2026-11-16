// The link request endpoint. Deliberately silent: identical response whether
// or not the pair matched — nobody can use it to probe the register.
// Letter #8 (access link) queues through the outbox inside a transaction.

import { NextResponse } from "next/server";
import { prisma } from "@voeq/db";
import { createNotification } from "@voeq/db/outbox";
import { applicationAccessLink } from "@voeq/email";
import { mintAccessToken, ACCESS_LINK_SHORT_MINUTES } from "@/lib/access";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON" }, { status: 400 });
  }

  const parsed = (body as { reference?: unknown; email?: unknown }) ?? {};
  const reference = typeof parsed.reference === "string" ? parsed.reference.trim().toUpperCase() : "";
  const email = typeof parsed.email === "string" ? parsed.email.trim().toLowerCase() : "";
  if (!reference || !email.includes("@")) {
    return NextResponse.json({ error: "Reference and email are both required" }, { status: 400 });
  }

  const app = await prisma.application.findFirst({
    where: { reference: { equals: reference, mode: "insensitive" } },
    select: { id: true, contactEmail: true, businessName: true },
  });

  if (app && app.contactEmail.toLowerCase() === email) {
    const token = mintAccessToken(app.id, email, "short");
    const base = process.env.APP_URL ?? "http://localhost:3000";
    const accessUrl = `${base}/track/${encodeURIComponent(reference)}/open?token=${token}`;
    await prisma.$transaction(async (tx) => {
      await createNotification(tx, {
        topic: "application.access_link",
        payload: {
          to: app.contactEmail,
          template: applicationAccessLink(reference, app.businessName, accessUrl, ACCESS_LINK_SHORT_MINUTES),
        },
      });
    });
  }

  return NextResponse.json({ ok: true });
}
