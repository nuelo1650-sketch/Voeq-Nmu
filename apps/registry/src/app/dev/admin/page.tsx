// DEV-ONLY super-admin preview (blocked in production) — the approval gate.
// Kai reviews every admin screen and exercises every mutation here before
// anything deploys. Mutations run for real against the dev database and are
// attributed to dev-superadmin@platform.voeq in the audit chain.

import { notFound } from "next/navigation";
import { devAdminContext } from "@/lib/admin";
import { AdminSurface } from "@/components/admin/AdminSurface";
import type { AuditQuery } from "@/components/admin/AuditPanel";

export const dynamic = "force-dynamic";

export const metadata = { title: "Super admin — dev preview" };

export default async function DevAdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const sp = await searchParams;
  const viewer = await devAdminContext();

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
      <div className="border border-vq-amber bg-vq-amber-light/60 px-4 py-2.5 text-sm text-vq-amber-dark">
        <b>Dev-only preview of the super-admin surface.</b> Everything here is real
        against the dev database — creating an institution, granting a permission,
        re-queuing a sync — and each action lands in the audit chain. Production
        serves the same screen at /admin behind a platform-family Google sign-in.
      </div>
      <div className="mt-6">
        <AdminSurface viewer={viewer} tab={one("tab") ?? "overview"} auditQuery={auditQuery} />
      </div>
    </main>
  );
}
