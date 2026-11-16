// 3.3 — the public directory API. Same data as the /directory page, as JSON,
// so voeq.ng (or anyone) can render it. No personal contact data leaves the
// register: business name, description, category, campus, reference, photo.

import { NextResponse } from "next/server";
import { prisma } from "@voeq/db";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const blocked = tooManyRequests(rateLimit("public.directory", clientIp(req)));
  if (blocked) return blocked;

  const url = new URL(req.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 100), 1), 200);

  const businesses = await prisma.application.findMany({
    where: { status: "registered", publicationStatus: "published" },
    orderBy: { decidedAt: "desc" },
    select: {
      reference: true,
      businessName: true,
      businessDescription: true,
      voeqVendorUrl: true,
      category: { select: { name: true } },
      campus: { select: { name: true } },
      revisions: {
        orderBy: { revisionNo: "desc" },
        take: 1,
        select: { images: { select: { field: true, promotedPublicId: true } } },
      },
    },
    take: limit,
  });

  return NextResponse.json(
    {
      count: businesses.length,
      businesses: businesses.map((b) => ({
        reference: b.reference,
        businessName: b.businessName,
        description: b.businessDescription,
        category: b.category.name,
        campus: b.campus.name,
        existingVendorUrl: b.voeqVendorUrl,
        photo: b.revisions[0]?.images.find((i) => i.promotedPublicId)?.promotedPublicId ?? null,
      })),
    },
    { headers: { "Cache-Control": "public, max-age=60" } },
  );
}
