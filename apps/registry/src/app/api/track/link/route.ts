// The link request endpoint. Deliberately silent: identical response whether
// or not the pair matched — nobody can use it to probe the register.
// Letter #8 (access link) queues through the outbox inside a transaction.

import { NextResponse, after } from "next/server";
import { prisma } from "@voeq/db";
import { createNotification } from "@voeq/db/outbox";
import { applicationAccessLink } from "@voeq/email";
import { mintAccessToken, ACCESS_LINK_SHORT_MINUTES } from "@/lib/access";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { verifyTurnstile, turnstileUserMessage } from "@/lib/turnstile";
import { drainOutbox } from "@/lib/outbox-drain";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // Phase 5.1 — brute-force guard: the silence of this endpoint is only
  // honest if probing is expensive. 5 reference+email guesses a minute, max.
  const blocked = tooManyRequests(rateLimit("track.link", clientIp(req)));
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

  // Cloudflare Turnstile — this endpoint queues a real email per hit, so a
  // bot burning the quota is a real harm. Verified before any lookup.
  const human = await verifyTurnstile(parsed.turnstileToken, clientIp(req));
  if (!human.ok) {
    return NextResponse.json(
      { error: turnstileUserMessage(human.reason) },
      { status: 403 },
    );
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
    // Send it now — serverless has no poller worker (see outbox-drain.ts).
    after(() => drainOutbox());
  }

  return NextResponse.json({ ok: true });
}
