// ---------------------------------------------------------------------------
// seed-superadmin.mjs — bootstrap the FIRST platform super-admin.
//
// Idempotent: run it again and it updates nothing that already exists.
// It grants every platform permission to one Google email. After this first
// account exists, ALL further accounts and grants are made through the admin
// surface (/admin → Accounts) — never through this script — so every grant
// after the bootstrap is an audited event.
//
// Usage:  node --env-file=.env tooling/seed-superadmin.mjs <google-email> [name]
// ---------------------------------------------------------------------------
import { PrismaClient } from "@prisma/client";

const email = process.argv[2]?.toLowerCase().trim();
const name = process.argv[3] ?? null;

if (!email || !email.includes("@")) {
  console.error("usage: node --env-file=.env tooling/seed-superadmin.mjs <google-email> [name]");
  process.exit(1);
}

// Platform-family permission keys — must stay in sync with @voeq/core PERMISSIONS.
const PLATFORM_PERMISSIONS = [
  "institutions.manage",
  "institutions.read",
  "categories.manage",
  "fee-schedule.manage",
  "staff.grant",
  "staff.revoke",
  "integrations.manage",
  "monitoring.read",
  "audit.read",
  "periods.close",
  "directory.read", // shared
];

// Register-family keys — the superuser model (Kai's Option A, 2026-11-18)
// means the bootstrap super-admin ALSO works the Media Unit desk: queue,
// decisions, ledger. Lawful since canHold lets platform hold register keys.
const REGISTER_PERMISSIONS = [
  "applications.read",
  "applications.decide",
  "applications.request-corrections",
  "ledger.import",
  "ledger.stage-match",
  "ledger.confirm-fee",
  "ledger.write-off",
  "ledger.read",
];

const ALL_PERMISSIONS = [...PLATFORM_PERMISSIONS, ...REGISTER_PERMISSIONS];

const prisma = new PrismaClient();

try {
  const account = await prisma.staffAccount.upsert({
    where: { email },
    update: { family: "platform", status: "active", name: name ?? undefined },
    create: { email, name, family: "platform", status: "active" },
  });

  let granted = 0;
  for (const key of ALL_PERMISSIONS) {
    const existing = await prisma.roleGrant.findFirst({
      where: { staffAccountId: account.id, permissionKey: key, revokedAt: null },
    });
    if (!existing) {
      await prisma.roleGrant.create({
        data: {
          staffAccountId: account.id,
          permissionKey: key,
          grantedByEmail: "seed@bootstrap",
        },
      });
      granted += 1;
    }
  }

  console.log(`super-admin ready: ${email}`);
  console.log(`  family: platform (superuser — also holds register keys) · status: active · institution: none`);
  console.log(`  grants: ${ALL_PERMISSIONS.length} permissions (${granted} newly written)`);
} finally {
  await prisma.$disconnect();
}
