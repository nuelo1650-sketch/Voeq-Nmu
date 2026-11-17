// ---------------------------------------------------------------------------
// The staff desk gate — the counterpart to lib/admin.ts, for the register
// desk (Media Unit) rather than the super-admin surface. One rule, enforced
// at every door: a session alone is NOT authority. The StaffAccount row must
// exist and be ACTIVE, and these doors belong to the register family only.
//
// Found the hard way (2026-11-17 investigation): the desk routes trusted the
// session email alone, so a suspended or disabled account kept full decision
// and ledger power on its live 30-day JWT, and the decision route hardcoded
// family: "register" instead of checking. Disable now means disable.
// ---------------------------------------------------------------------------

import { prisma } from "@voeq/db";
import { auth } from "@/lib/auth";
import type { AdminFamily } from "@voeq/core";

export interface ActiveStaff {
  id: string;
  email: string;
  name: string | null;
  family: AdminFamily;
  institutionId: string | null;
}

export type StaffGateResult =
  | { ok: true; staff: ActiveStaff }
  | { ok: false; status: 401 | 403; error: string };

/**
 * Resolve the signed-in Google identity into an ACTIVE staff account.
 * Returns a typed refusal otherwise:
 *   - 401: no session (not signed in at all)
 *   - 403: signed in, but the account is missing, suspended/disabled, or the
 *     wrong family for the door being asked.
 */
export async function staffGate(
  family?: AdminFamily,
): Promise<StaffGateResult> {
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) {
    return { ok: false, status: 401, error: "Sign in required" };
  }

  const account = await prisma.staffAccount
    .findUnique({ where: { email } })
    .catch(() => null);

  if (!account) {
    return {
      ok: false,
      status: 403,
      error: "No staff account exists for this Google email",
    };
  }
  if (account.status !== "active") {
    return {
      ok: false,
      status: 403,
      error: `This account is ${account.status} — a super admin must activate it before the desk responds`,
    };
  }
  if (family && account.family !== family) {
    return {
      ok: false,
      status: 403,
      error: `This desk belongs to the ${family} family — the families never mix`,
    };
  }

  return {
    ok: true,
    staff: {
      id: account.id,
      email: account.email,
      name: account.name,
      family: account.family,
      institutionId: account.institutionId,
    },
  };
}
