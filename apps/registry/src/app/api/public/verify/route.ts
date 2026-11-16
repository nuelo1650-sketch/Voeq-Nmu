// 3.3 — the public verification API. THE source of badge truth for voeq.ng
// (3.7/3.8): a badge is valid only while the business is `registered` AND
// `published`. Suspended or closed businesses verify as invalid with the
// reason — a badge that cannot be lost means nothing. No personal contact
// data is returned, ever.

import { NextResponse } from "next/server";
import { prisma } from "@voeq/db";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // Phase 5.1 — the badge API is hot but not infinite: 120 checks a minute
  // per address. voeq.ng profiles check on page view, well under the cap.
  const blocked = tooManyRequests(rateLimit("public.verify", clientIp(req)));
  if (blocked) return blocked;

  const url = new URL(req.url);
  const reference = (url.searchParams.get("reference") ?? "").trim().toUpperCase();
  if (!/^NMU-\d{4}-\d{4}$/.test(reference)) {
    return NextResponse.json(
      { valid: false, reason: "Not a register reference" },
      { status: 400 },
    );
  }

  const application = await prisma.application.findUnique({
    where: { reference },
    select: {
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
    return NextResponse.json({ valid: false, reason: "No such registration" });
  }

  const active = application.status === "registered" && application.publicationStatus === "published";
  const lastLifecycle = application.decisions[0];

  return NextResponse.json(
    {
      reference,
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
    { headers: { "Cache-Control": "public, max-age=60" } },
  );
}
