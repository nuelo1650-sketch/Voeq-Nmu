// ---------------------------------------------------------------------------
// Applicant access tokens (roadmap 1.5 — magic-link access, no passwords).
//
// Stateless signed tokens, HMAC-SHA256 over (applicationId | email | expiry)
// with AUTH_SECRET. No token table: a link works until it expires, and an
// expired link is simply refused — the applicant requests another, which
// costs nothing (letter #8). Verification also re-checks the email against
// the live application, so a token minted before an email change dies.
//
// Two lifetimes:
//   SHORT — 30 minutes, for on-demand /track requests (letter #8).
//   LONG  — 30 days, minted once at approval so letter #3's button opens the
//           status page (and the payment step) straight from the email.
//
// Rate limiting on the request endpoint is Phase 5 (5.1); the endpoint is
// also deliberately silent — it never reveals whether a reference exists.
// ---------------------------------------------------------------------------

import { createHmac, timingSafeEqual } from "crypto";

const SHORT_TTL_MINUTES = 30;
const LONG_TTL_MINUTES = 30 * 24 * 60;

export const ACCESS_LINK_SHORT_MINUTES = SHORT_TTL_MINUTES;

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set — access links cannot be minted");
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function mintAccessToken(applicationId: string, email: string, ttl: "short" | "long"): string {
  const ttlMinutes = ttl === "short" ? SHORT_TTL_MINUTES : LONG_TTL_MINUTES;
  const exp = Date.now() + ttlMinutes * 60_000;
  const payload = Buffer.from(`${applicationId}|${email.toLowerCase()}|${exp}`).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifyAccessToken(
  token: string,
): { applicationId: string; email: string } | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const given = Buffer.from(token.slice(dot + 1));
  const expected = Buffer.from(sign(payload));
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  let decoded: string;
  try {
    decoded = Buffer.from(payload, "base64url").toString("utf8");
  } catch {
    return null;
  }
  const parts = decoded.split("|");
  if (parts.length !== 3) return null;
  const applicationId = parts[0];
  const email = parts[1];
  const expRaw = parts[2];
  if (!applicationId || !email || !expRaw) return null;
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || Date.now() > exp) return null;
  return { applicationId, email };
}
