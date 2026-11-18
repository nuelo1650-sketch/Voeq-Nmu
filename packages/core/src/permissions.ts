// ---------------------------------------------------------------------------
// Permission matrix — two admin families (doc 07 §4.6), with ONE one-way
// exception added 2026-11-18 (Kai chose the superuser model, Option A):
//
// Rules, enforced here AND at every assignment site:
//   1. An account holds roles from ONE family only — platform OR register.
//      EXCEPTION: a platform account MAY additionally hold register-family
//      permissions — platform is the superuser over the whole machine. A
//      register account can NEVER hold platform permissions; the wall is
//      one-way.
//   2. Roles attach to accounts (Google emails), never to people.
//   3. Every grant/revocation is an audited event, including self-assignment.
//   4. Permission checks resolve through here — no code path "happens to work".
// ---------------------------------------------------------------------------

export type AdminFamily = "platform" | "register";

export const PERMISSIONS = {
  // ---- platform family (Voeq) ----
  "institutions.manage": "platform",
  "institutions.read": "platform",
  "categories.manage": "platform",
  "fee-schedule.manage": "platform",
  "staff.grant": "platform",
  "staff.revoke": "platform",
  "integrations.manage": "platform",
  "monitoring.read": "platform",
  "audit.read": "platform",
  "periods.close": "platform",

  // ---- register family (Media Unit) ----
  "applications.read": "register",
  "applications.decide": "register",
  "applications.request-corrections": "register",
  "ledger.import": "register",
  "ledger.stage-match": "register",
  "ledger.confirm-fee": "register", // the CHECKER action — maker-checker enforced at the call site
  "ledger.write-off": "register",
  "ledger.read": "register",

  // ---- shared, read-only ----
  "directory.read": "shared",
} as const satisfies Record<string, AdminFamily | "shared">;

export type PermissionKey = keyof typeof PERMISSIONS;

export function familyOf(permission: PermissionKey): AdminFamily | "shared" {
  return PERMISSIONS[permission];
}

/**
 * Can this account hold this permission? Rejected when the permission's
 * family conflicts with the account's family ("shared" passes both).
 */
export function canHold(
  accountFamily: AdminFamily,
  permission: PermissionKey,
): boolean {
  const family = familyOf(permission);
  if (family === "shared") return true;
  // The one-way wall: platform passes every door; register stays in its own.
  if (accountFamily === "platform") return true;
  return family === accountFamily;
}

/**
 * Validate a proposed set of grants for an account. Returns the offending
 * keys — an empty array means the assignment is lawful.
 */
export function validateGrants(
  accountFamily: AdminFamily,
  permissions: readonly PermissionKey[],
): PermissionKey[] {
  return permissions.filter((p) => !canHold(accountFamily, p));
}
