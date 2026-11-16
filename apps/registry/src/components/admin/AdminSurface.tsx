// The super-admin surface — shared by the dev preview (/dev/admin) and the
// real page (/admin). The page files only decide WHO is looking:
// dev = synthetic preview identity; real = a signed-in platform-family
// account whose open RoleGrants decide which tabs unlock. No tab "happens
// to work": the gate is checked server-side before any data is fetched.

import Link from "next/link";
import type { PermissionKey } from "@voeq/core";
import { PERMISSIONS } from "@voeq/core";
import { prisma } from "@voeq/db";
import { gatherReports } from "@/lib/reports";
import { OverviewPanel } from "./OverviewPanel";
import { InstitutionsPanel, type AdminInstitution } from "./InstitutionsPanel";
import { AccountsPanel, type AdminAccount, type PermissionMeta } from "./AccountsPanel";
import { AuditPanel, type AuditQuery } from "./AuditPanel";
import { IntegrationsPanel } from "./IntegrationsPanel";

const TABS: { key: string; label: string; permission: PermissionKey }[] = [
  { key: "overview", label: "Overview", permission: "monitoring.read" },
  { key: "institutions", label: "Institutions", permission: "institutions.read" },
  { key: "accounts", label: "Accounts", permission: "staff.grant" },
  { key: "audit", label: "Audit chain", permission: "audit.read" },
  { key: "integrations", label: "Integrations", permission: "monitoring.read" },
];

export interface AdminViewer {
  email: string;
  name: string | null;
  permissions: ReadonlySet<PermissionKey>;
  dev: boolean;
}

export async function AdminSurface({
  viewer,
  tab,
  auditQuery,
}: {
  viewer: AdminViewer;
  tab: string;
  auditQuery: AuditQuery;
}) {
  const can = (key: PermissionKey) => viewer.permissions.has(key);
  const activeTab = TABS.some((t) => t.key === tab) ? tab : "overview";

  return (
    <div>
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-vq-amber-dark">
        Voeq × NMU · Super Admin
      </p>
      <h1 className="mt-1 font-display text-3xl text-vq-forest-dark">The platform desk</h1>
      <p className="mt-2 text-sm leading-relaxed text-vq-ink-muted">
        Institutions, accounts, the audit chain, and the link to the marketplace —
        the whole machine from one chair. {viewer.name ?? viewer.email} ·{" "}
        {viewer.dev ? "dev preview" : "signed in"}.
      </p>

      {/* tab nav — mono, ruled, no pills */}
      <nav className="mt-6 flex flex-wrap gap-2 border-y border-vq-forest/10 py-3">
        {TABS.map((t) => {
          const locked = !can(t.permission);
          return (
            <span key={t.key} className="flex items-center">
              {locked ? (
                <span
                  className="px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.1em] text-vq-ink-subtle"
                  title={`Requires the "${t.permission}" permission`}
                >
                  {t.label} · locked
                </span>
              ) : (
                <Link
                  href={`?tab=${t.key}`}
                  aria-current={activeTab === t.key ? "page" : undefined}
                  className={`px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.1em] transition ${
                    activeTab === t.key
                      ? "bg-vq-forest text-white"
                      : "border border-vq-forest/20 bg-white text-vq-forest hover:border-vq-forest/50"
                  }`}
                >
                  {t.label}
                </Link>
              )}
            </span>
          );
        })}
      </nav>

      <div className="mt-6">
        {activeTab === "overview" &&
          (can("monitoring.read") ? (
            <OverviewPanel report={await gatherReports()} />
          ) : null)}

        {activeTab === "institutions" &&
          (can("institutions.read") ? <InstitutionsTab dev={viewer.dev} /> : null)}

        {activeTab === "accounts" && can("staff.grant") && <AccountsTab dev={viewer.dev} />}

        {activeTab === "audit" && can("audit.read") && <AuditPanel query={auditQuery} />}

        {activeTab === "integrations" && can("monitoring.read") && <IntegrationsPanel dev={viewer.dev} />}
      </div>
    </div>
  );
}

// --- per-tab data ------------------------------------------------------------

async function InstitutionsTab({ dev }: { dev: boolean }) {
  const institutions = await prisma.institution.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      campuses: {
        orderBy: [{ isDefault: "desc" }, { name: "asc" }],
        include: { _count: { select: { applications: true } } },
      },
      categories: {
        orderBy: { sortOrder: "asc" },
        include: { _count: { select: { applications: true } } },
      },
      _count: { select: { applications: true } },
    },
  });

  const shaped: AdminInstitution[] = institutions.map((i) => ({
    id: i.id,
    name: i.name,
    slug: i.slug,
    prefix: i.prefix,
    status: i.status,
    applicationCount: i._count.applications,
    campuses: i.campuses.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      isDefault: c.isDefault,
      applicationCount: c._count.applications,
    })),
    categories: i.categories.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      sortOrder: c.sortOrder,
      active: c.active,
      applicationCount: c._count.applications,
    })),
  }));

  return <InstitutionsPanel institutions={shaped} dev={dev} />;
}

async function AccountsTab({ dev }: { dev: boolean }) {
  const [accounts, institutions] = await Promise.all([
    prisma.staffAccount.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        roleGrants: { orderBy: { grantedAt: "asc" } },
        institution: { select: { name: true } },
      },
    }),
    prisma.institution.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, name: true } }),
  ]);

  const shaped: AdminAccount[] = accounts.map((a) => ({
    id: a.id,
    email: a.email,
    name: a.name,
    family: a.family,
    status: a.status,
    institutionName: a.institution?.name ?? null,
    lastLoginAt: a.lastLoginAt?.toISOString() ?? null,
    grants: a.roleGrants.map((g) => ({
      permissionKey: g.permissionKey,
      grantedAt: g.grantedAt.toISOString(),
      grantedByEmail: g.grantedByEmail,
      revokedAt: g.revokedAt?.toISOString() ?? null,
    })),
  }));

  const permissions: PermissionMeta[] = Object.entries(PERMISSIONS).map(([key, family]) => ({
    key,
    family: family as PermissionMeta["family"],
  }));

  return <AccountsPanel accounts={shaped} permissions={permissions} institutions={institutions} dev={dev} />;
}
