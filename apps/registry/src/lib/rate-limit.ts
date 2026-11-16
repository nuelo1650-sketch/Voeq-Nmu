// ---------------------------------------------------------------------------
// Rate limiting (Phase 5.1) — brute-force protection on the PUBLIC endpoints,
// the surfaces an anonymous visitor can hit:
//
//   /api/track/link      5 / minute / IP   — the silent endpoint must never
//                                          become a reference+email prober
//   /api/apply           3 / hour / IP     — a real applicant submits once
//   /api/apply/image     30 / hour / IP    — up to 6 images per submission
//   /api/track/resubmit  10 / hour / IP    — corrections are not a firehose
//   /api/track/claim     10 / hour / IP    — one claim per intent
//   /api/public/verify   120 / min / IP    — badge checks are hot but public
//   /api/public/directory 60 / min / IP    — same
//
// Implementation: fixed-window counters in module memory. Honest limits of
// that design, stated plainly: on a single Node instance it is exact; across
// serverless instances each instance counts independently, so effective
// limits multiply by the instance count. For THIS scale (one university's
// register desk, a few thousand applications a year) that is more than
// sufficient — the point is making brute-force probing expensive, not
// surviving a DDoS. If voeq.ng ever fronted this with a CDN/WAF, its rate
// rules supersede these.
//
// A 429 here is not an error the applicant caused — it means the endpoint is
// being hammered. The response says so and includes Retry-After.
// ---------------------------------------------------------------------------

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

// Periodic sweep so dead keys do not accumulate forever.
let lastSweep = 0;
function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export interface RateLimitRule {
  /** requests allowed per window */
  limit: number;
  /** window in milliseconds */
  windowMs: number;
}

export const RATE_LIMITS: Record<string, RateLimitRule> = {
  "track.link": { limit: 5, windowMs: 60_000 },
  "apply.submit": { limit: 3, windowMs: 3_600_000 },
  "apply.image": { limit: 30, windowMs: 3_600_000 },
  "track.resubmit": { limit: 10, windowMs: 3_600_000 },
  "track.claim": { limit: 10, windowMs: 3_600_000 },
  "public.verify": { limit: 120, windowMs: 60_000 },
  "public.directory": { limit: 60, windowMs: 60_000 },
};

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Count one request against `key` (a rule name) for `identity` (IP or IP +
 * route token). Call BEFORE doing any work — including the cheap work, so
 * probing costs nothing but a counter.
 */
export function rateLimit(ruleName: keyof typeof RATE_LIMITS | string, identity: string): RateLimitResult {
  const rule = RATE_LIMITS[ruleName] ?? { limit: 30, windowMs: 60_000 };
  const now = Date.now();
  sweep(now);

  const key = `${ruleName}:${identity}`;
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + rule.windowMs });
    return { allowed: true, remaining: rule.limit - 1, retryAfterSeconds: 0 };
  }
  existing.count += 1;
  if (existing.count > rule.limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }
  return { allowed: true, remaining: rule.limit - existing.count, retryAfterSeconds: 0 };
}

/** Best-effort client IP. Behind a proxy/Vercel, x-forwarded-for is the real one. */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip") ?? "unknown";
}

/**
 * The standard 429 response shape — identical everywhere so the API stays
 * predictable. Returns null when the request is allowed (call inside a guard).
 */
export function tooManyRequests(result: RateLimitResult): Response | null {
  if (result.allowed) return null;
  return Response.json(
    { error: "Too many requests from this address. Wait a moment and try again." },
    { status: 429, headers: { "Retry-After": String(result.retryAfterSeconds) } },
  );
}
