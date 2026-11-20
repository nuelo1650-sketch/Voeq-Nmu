// 3.3 — the public verification API. THE source of badge truth for voeq.ng
// (3.7/3.8): a badge is valid only while the business is `registered` AND
// `published`. Suspended or closed businesses verify as invalid with the
// reason — a badge that cannot be lost means nothing. No personal contact
// data is returned, ever.

import { NextResponse } from "next/server";
import { prisma } from "@voeq/db";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";

// Badge truth must NEVER be served stale — a suspended or closed business
// whose badge still reads valid is a fraud vector. (Found by E2E: the CDN
// served a cached valid:true for a since-deleted application.)
const json = (body: unknown, init?: ResponseInit) =>
  NextResponse.json(body as object, {
    ...init,
    headers: { "Cache-Control": "no-store" }, // badge truth is NEVER cached
  });

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // Phase 5.1 — the badge API is hot but not infinite: 120 checks a minute
  // per address. voeq.ng profiles check on page view, well under the cap.
  const blocked = tooManyRequests(rateLimit("public.verify", clientIp(req)));
  if (blocked) return blocked;

  const url = new URL(req.url);
  const raw = (url.searchParams.get("reference") ?? "").trim().toUpperCase();
  // Two ways in: the application reference (NMU-2026-0001, the payment
  // narration) or the permanent registration number (NMU-REG-2026-0001).
  // The latter is what a business shows as proof on the ground (Kai,
  // 2026-11-20) — someone checking it must be able to paste it here.
  const byCode = /^[A-Z0-9]{2,8}-REG-\d{4}-\d+$/.test(raw);
  const reference = byCode ? null : /^NMU-\d{4}-\d{4}$/.test(raw) ? raw : null;
  const certificateCode = byCode ? raw : null;
  if (!reference && !certificateCode) {
    return json(
      { valid: false, reason: "Not a register reference or registration number" },
      { status: 400 },
    );
  }

  const application = await prisma.application.findUnique({
    where: reference ? { reference } : { certificateCode: certificateCode! },
    select: {
      reference: true,
      certificateCode: true,
      status: true,
      publicationStatus: true,
      businessName: true,
      category: { select: { name: true } },
      campus: { select: { name: true } },
      decisions: {
        where: { kind: { in: ["suspend", "close"] } },
        orderBy: { decidedAt: "desc" },
        take: 1,
        select: { kind: true, reason: true, decidedAt: true },
      },
    },
  });

  if (!application) {
    return json(
{ valid: false, reason: "No such registration" });
  }

  const active = application.status === "registered" && application.publicationStatus === "published";
  const lastLifecycle = application.decisions[0];

  return json(
    {
      reference: application.reference,
      certificateCode: application.certificateCode,
      valid: active,
      businessName: application.businessName,
      category: application.category.name,
      campus: application.campus.name,
      status: application.status,
      ...(active
        ? {}
        : {
            reason:
              application.status === "suspended"
                ? (lastLifecycle?.reason ?? "Registration suspended by the Media Unit")
                : application.status === "closed"
                  ? (lastLifecycle?.reason ?? "Registration closed")
                  : "Registration not yet complete or not published",
          }),
    },
  );
}
