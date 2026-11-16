// The real super-admin surface — platform-family Google sign-in required
// (spec §13). Authority comes from the account's open RoleGrants, resolved
// through lib/admin; a tab whose permission is missing renders locked, and
// its data is never fetched. Every mutation behind this page re-checks the
// permission key server-side and lands in the audit chain.

import { redirect } from "next/navigation";
import { getPlatformAdminContext } from "@/lib/admin";
import { AdminSurface } from "@/components/admin/AdminSurface";
import type { AuditQuery } from "@/components/admin/AuditPanel";

export const dynamic = "force-dynamic";

export const metadata = { title: "Super admin" };

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const viewer = await getPlatformAdminContext();
  if (!viewer) redirect("/staff/signin");

  const sp = await searchParams;
  const one = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };

  const auditQuery: AuditQuery = {
    entityType: one("entityType"),
    entityId: one("entityId"),
    action: one("action"),
    actor: one("actor"),
    page: Math.max(1, Number.parseInt(one("page") ?? "1", 10) || 1),
  };

  return (
    <main className="mx-auto max-w-3xl px-5 pb-24 pt-8">
      <AdminSurface viewer={viewer} tab={one("tab") ?? "overview"} auditQuery={auditQuery} />
    </main>
  );
}
