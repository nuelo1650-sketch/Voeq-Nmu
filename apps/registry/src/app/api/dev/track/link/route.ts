// DEV-ONLY access-link minting (blocked in production). Same machinery as
// /api/track/link, but returns the link inline so the reviewer can open the
// status page without a mailbox, and defaults the email to the application's
// own contact email.

import { NextResponse } from "next/server";
import { prisma } from "@voeq/db";
import { createNotification } from "@voeq/db/outbox";
import { applicationAccessLink } from "@voeq/email";
import { mintAccessToken, ACCESS_LINK_SHORT_MINUTES } from "@/lib/access";

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
  const parsed = (body as { reference?: unknown; email?: unknown }) ?? {};
  const reference =
    typeof parsed.reference === "string" ? parsed.reference.trim().toUpperCase() : "";
  if (!reference) {
    return NextResponse.json({ error: "Reference is required" }, { status: 400 });
  }

  const app = await prisma.application.findFirst({
    where: { reference: { equals: reference, mode: "insensitive" } },
    select: { id: true, contactEmail: true, businessName: true, reference: true },
  });
  if (!app) return NextResponse.json({ error: "No application with that reference" }, { status: 404 });

  const email =
    typeof parsed.email === "string" && parsed.email.includes("@")
      ? parsed.email.trim().toLowerCase()
      : app.contactEmail.toLowerCase();

  const token = mintAccessToken(app.id, email, "short");
  const base = process.env.APP_URL ?? "http://localhost:3000";
  const link = `${base}/track/${encodeURIComponent(app.reference)}/open?token=${token}`;

  await prisma.$transaction(async (tx) => {
    await createNotification(tx, {
      topic: "application.access_link",
      payload: {
        to: app.contactEmail,
        template: applicationAccessLink(app.reference, app.businessName, link, ACCESS_LINK_SHORT_MINUTES),
      },
    });
  });

  return NextResponse.json({ link, queued: true });
}
