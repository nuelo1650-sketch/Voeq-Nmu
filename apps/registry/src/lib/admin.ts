// ---------------------------------------------------------------------------
// Super-admin identity + permission resolution (Phase 4, spec §13).
//
// The matrix lives in @voeq/core (PERMISSIONS, canHold, validateGrants) — this
// file only resolves "who is asking": session → StaffAccount → open RoleGrants.
// No code path "happens to work": every admin mutation calls requirePermission
// with an explicit key before it touches the database.
//
// Dev preview uses a synthetic platform account holding every platform
// permission, so Kai reviews the full surface without Google sign-in. The
// synthetic identity is attributed in the audit trail as
// dev-superadmin@platform.voeq — same rule as the dev workbench.
// ---------------------------------------------------------------------------

import { prisma } from "@voeq/db";
import { auth } from "@/lib/auth";
import {
  PERMISSIONS,
  type AdminFamily,
  type PermissionKey,
} from "@voeq/core";

export const DEV_ADMIN_EMAIL = "dev-superadmin@platform.voeq";

export interface AdminContext {
  email: string;
  name: string | null;
  family: AdminFamily;
  permissions: ReadonlySet<PermissionKey>;
  dev: boolean;
}

const ALL_PLATFORM_PERMISSIONS = Object.entries(PERMISSIONS)
  .filter(([, family]) => family === "platform")
  .map(([key]) => key) as PermissionKey[];

export async function devAdminContext(): Promise<AdminContext> {
  return {
    email: DEV_ADMIN_EMAIL,
    name: "Dev preview",
    family: "platform",
    permissions: new Set([...ALL_PLATFORM_PERMISSIONS, "directory.read"]),
    dev: true,
  };
}

/**
 * Resolve the signed-in staff account into an admin context. Returns null when
 * there is no session, the account is not active, or the family is not
 * platform — the super-admin surface is platform-family only (spec §13).
 */
export async function getPlatformAdminContext(): Promise<AdminContext | null> {
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) return null;

  const account = await prisma.staffAccount
    .findUnique({ where: { email } })
    .catch(() => null);
  if (!account) return null;
  if (account.family !== "platform") return null;
  if (account.status !== "active") return null;

  const grants = await prisma.roleGrant.findMany({
    where: { staffAccountId: account.id, revokedAt: null },
    select: { permissionKey: true },
  });

  const permissions = new Set<PermissionKey>();
  for (const g of grants) {
    if (g.permissionKey in PERMISSIONS) permissions.add(g.permissionKey as PermissionKey);
  }

  return {
    email,
    name: account.name,
    family: "platform",
    permissions,
    dev: false,
  };
}

export function hasPermission(ctx: AdminContext, key: PermissionKey): boolean {
  return ctx.permissions.has(key);
}

export function missingPermissions(
  ctx: AdminContext,
  keys: readonly PermissionKey[],
): PermissionKey[] {
  return keys.filter((k) => !ctx.permissions.has(k));
}
