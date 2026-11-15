// ---------------------------------------------------------------------------
// Seed — Phase 0 deliverable 0.9.
// Idempotent: safe to run repeatedly. Creates NMU, its two campuses, the
// starter category list (adjustable in the super admin later), and the
// versioned fee schedule v1 (₦5,000 school / ₦200 Voeq, effective immediately).
//
// NOTE: no staff accounts are seeded. Staff accounts are created on first
// Google OAuth sign-in when the email is on the allowlist (doc 07 §4.7).
// ---------------------------------------------------------------------------

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const NMU_CAMPUSES = [
  { name: "Okerenkoko Campus", slug: "nmu-okerenkoko", isDefault: true },
  { name: "Kurutie Campus", slug: "nmu-kurutie", isDefault: false },
];

// Starter categories — provisional until the Media Unit confirms the list.
const NMU_CATEGORIES = [
  "Food & Drink",
  "Fashion & Accessories",
  "Electronics & Phone Repair",
  "Beauty & Personal Care",
  "Printing & Stationery",
  "Hairdressing & Barbering",
  "Tailoring & Fashion Design",
  "Laundry Services",
  "Phone Accessories",
  "Other",
];

async function main() {
  const institution = await prisma.institution.upsert({
    where: { slug: "nmu" },
    update: { name: "Nigeria Maritime University" },
    create: {
      name: "Nigeria Maritime University",
      slug: "nmu",
      prefix: "NMU",
    },
  });

  for (const campus of NMU_CAMPUSES) {
    await prisma.campus.upsert({
      where: { institutionId_slug: { institutionId: institution.id, slug: campus.slug } },
      update: { isDefault: campus.isDefault },
      create: { ...campus, institutionId: institution.id },
    });
  }

  let sortOrder = 0;
  for (const name of NMU_CATEGORIES) {
    const slug = name
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    await prisma.category.upsert({
      where: { institutionId_slug: { institutionId: institution.id, slug } },
      update: { sortOrder },
      create: { institutionId: institution.id, name, slug, sortOrder },
    });
    sortOrder += 1;
  }

  // Fee schedule v1 — ₦5,000 school / ₦200 Voeq = ₦5,200 total (kobo).
  const existingSchedule = await prisma.feeSchedule.findFirst({
    where: { institutionId: institution.id, version: 1 },
  });
  if (!existingSchedule) {
    await prisma.feeSchedule.create({
      data: {
        institutionId: institution.id,
        version: 1,
        effectiveFrom: new Date(),
        schoolMinor: 500_000,
        voeqMinor: 20_000,
        currency: "NGN",
      },
    });
  }

  // Reference sequence for the current year.
  const year = new Date().getFullYear();
  await prisma.referenceSequence.upsert({
    where: { institutionId_year: { institutionId: institution.id, year } },
    update: {},
    create: { institutionId: institution.id, year, last: 0 },
  });

  console.log("Seed complete: NMU institution, campuses, categories, fee schedule v1.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
