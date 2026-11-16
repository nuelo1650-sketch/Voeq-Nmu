// Public form metadata: the category list and campuses the applicant chooses
// from, straight from the seeded DB. force-dynamic — always current, never
// cached at build time.

import { prisma } from "@voeq/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const institution = await prisma.institution.findFirst({
    where: { slug: "nmu", status: "active" },
    select: {
      id: true,
      name: true,
      campuses: { orderBy: [{ isDefault: "desc" }, { name: "asc" }], select: { id: true, name: true, slug: true, isDefault: true } },
      categories: { where: { active: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true, slug: true } },
    },
  });
  if (!institution) {
    return NextResponse.json({ error: "Institution not configured" }, { status: 503 });
  }
  return NextResponse.json({
    institution: { id: institution.id, name: institution.name },
    campuses: institution.campuses,
    categories: institution.categories,
  });
}
