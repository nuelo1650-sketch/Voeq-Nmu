// The registration-number retrieval endpoint (Kai: "easily retrievable if
// lost"). Deliberately silent — identical response whether or not the pair
// matched — so nobody can probe the register. The certificate code is never
// displayed to an arbitrary visitor: it travels by email, to the address
// already on record, and only for a REGISTERED business. Letter #9.

import { NextResponse, after } from "next/server";
import { prisma } from "@voeq/db";
import { createNotification } from "@voeq/db/outbox";
import { certificateCodeReminder } from "@voeq/email";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { verifyTurnstile, turnstileUserMessage } from "@/lib/turnstile";
import { drainOutbox } from "@/lib/outbox-drain";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // Same posture as the access-link endpoint: the silence is only honest if
  // probing is expensive.
  const blocked = tooManyRequests(rateLimit("track.retrieve", clientIp(req)));
  if (blocked) return blocked;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON" }, { status: 400 });
  }

  const parsed = (body as { reference?: unknown; email?: unknown; turnstileToken?: unknown }) ?? {};
  const reference = typeof parsed.reference === "string" ? parsed.reference.trim().toUpperCase() : "";
  const email = typeof parsed.email === "string" ? parsed.email.trim().toLowerCase() : "";
  if (!reference || !email.includes("@")) {
    return NextResponse.json({ error: "Reference and email are both required" }, { status: 400 });
  }

  const human = await verifyTurnstile(parsed.turnstileToken, clientIp(req));
  if (!human.ok) {
    return NextResponse.json(
      { error: turnstileUserMessage(human.reason) },
      { status: 403 },
    );
  }

  const app = await prisma.application.findFirst({
    where: { reference: { equals: reference, mode: "insensitive" } },
    select: { id: true, contactEmail: true, businessName: true, certificateCode: true },
  });

  // Only a registered business has a number to send — and only to the email
  // already on record. Everything else is silence.
  if (app && app.certificateCode && app.contactEmail.toLowerCase() === email) {
    await prisma.$transaction(async (tx) => {
      await createNotification(tx, {
        topic: "application.certificate_reminder",
        payload: {
          to: app.contactEmail,
          template: certificateCodeReminder(reference, app.businessName, app.certificateCode!),
        },
      });
    });
    after(() => drainOutbox());
  }

  return NextResponse.json({ ok: true });
}
