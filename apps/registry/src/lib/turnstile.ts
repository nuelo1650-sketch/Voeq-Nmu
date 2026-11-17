// ---------------------------------------------------------------------------
// Cloudflare Turnstile — server-side verification (Phase 5.1 hardening).
//
// The gate is ENFORCED only when TURNSTILE_SECRET_KEY is set; without it the
// check passes silently so dev and CI never need Cloudflare keys. The site
// key (NEXT_PUBLIC_TURNSTILE_SITE_KEY) is the client-side half — it may be
// present without the secret (widget renders, server ignores) but never the
// reverse: no secret means no verification, anywhere.
//
// Where it runs: /api/apply (an application costs real review time) and
// /api/track/link (each hit can queue a real email). Rate limits cap volume;
// Turnstile caps automation.
// ---------------------------------------------------------------------------

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export function turnstileEnforced(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY);
}

export type TurnstileResult = { ok: true } | { ok: false; reason: string };

export async function verifyTurnstile(token: unknown, ip: string | null): Promise<TurnstileResult> {
  if (!turnstileEnforced()) return { ok: true };

  if (typeof token !== "string" || token.length < 1 || token.length > 4096) {
    return { ok: false, reason: "missing-token" };
  }

  const body = new URLSearchParams({
    secret: process.env.TURNSTILE_SECRET_KEY as string,
    response: token,
  });
  if (ip) body.set("remoteip", ip);

  try {
    const res = await fetch(SITEVERIFY_URL, { method: "POST", body, cache: "no-store" });
    const data = (await res.json()) as { success?: boolean; "error-codes"?: string[] };
    if (data.success) return { ok: true };
    return { ok: false, reason: (data["error-codes"] ?? ["unknown"]).join(",") };
  } catch {
    // Cloudflare unreachable: fail CLOSED. These endpoints hand out emails
    // and applications; a blind pass would be the cheaper failure only for
    // the attacker.
    return { ok: false, reason: "siteverify-unreachable" };
  }
}

export function turnstileUserMessage(reason: string): string {
  if (reason === "siteverify-unreachable") {
    return "We could not reach the bot check. Please try again in a moment.";
  }
  return "Verification failed — please try again.";
}
