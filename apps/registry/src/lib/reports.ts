// ---------------------------------------------------------------------------
// Reports + system monitoring (Phase 4, 4.6 / 4.9). One pass of aggregate
// queries — cheap groupBys and counts, no row scans of payload JSON — that
// feed the super-admin overview: the health strip across every institution,
// the pipeline counts, the money totals, and the flow speed.
// ---------------------------------------------------------------------------

import { prisma } from "@voeq/db";
import type { ApplicationStatus, VendorSyncStatus } from "@voeq/db";

export interface ReportBundle {
  applicationsByStatus: { status: ApplicationStatus; count: number }[];
  byCategory: { name: string; count: number }[];
  byCampus: { name: string; count: number }[];
  institutions: {
    id: string;
    name: string;
    slug: string;
    prefix: string;
    status: string;
    applicationCount: number;
  }[];
  registered: number;
  suspendedOrClosed: number;
  submissionsLast14Days: number;
  medianDecisionHours: number | null;
  money: {
    confirmedCount: number;
    confirmedTotalMinor: number;
    schoolMinor: number;
    voeqMinor: number;
    outstandingMinor: number;
  };
  outbox: { pending: number; failed: number; sent: number; lastSentAt: Date | null };
  vendorSync: Record<VendorSyncStatus, number>;
  images: { total: number; promoted: number };
  auditTotal: number;
}

function averageHours(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const hours =
    sorted.length % 2 === 1
      ? (sorted[mid] ?? 0)
      : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
  return Math.round(hours * 10) / 10;
}

export async function gatherReports(): Promise<ReportBundle> {
  const since14 = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  const [
    statusGroups,
    categoryGroups,
    campusGroups,
    institutions,
    submissions,
    firstDecisions,
    confirmedAgg,
    outstandingIntents,
    outboxPending,
    outboxFailed,
    outboxSent,
    lastSent,
    syncPending,
    syncSynced,
    syncFailed,
    imageTotal,
    imagePromoted,
    auditCount,
  ] = await Promise.all([
    prisma.application.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.application.groupBy({
      by: ["categoryId"],
      _count: { _all: true },
      where: { status: { not: "draft" } },
    }),
    prisma.application.groupBy({
      by: ["campusId"],
      _count: { _all: true },
      where: { status: { not: "draft" } },
    }),
    prisma.institution.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        prefix: true,
        status: true,
        _count: { select: { applications: true } },
      },
    }),
    prisma.application.count({ where: { submittedAt: { gte: since14 } } }),
    prisma.decision.findMany({
      // first decision per application, on submitted applications only —
      // the flow speed the Media Unit actually delivers
      orderBy: { decidedAt: "asc" },
      select: { applicationId: true, decidedAt: true, kind: true },
    }),
    prisma.feeAllocation.aggregate({
      where: { status: "confirmed", kind: "payment" },
      _count: { _all: true },
      _sum: { schoolMinor: true, voeqMinor: true, totalMinor: true },
    }),
    prisma.feeIntent.findMany({
      where: { status: { in: ["issued", "awaiting_bank_evidence", "matched"] } },
      select: { totalMinor: true },
    }),
    prisma.notification.count({ where: { status: "pending" } }),
    prisma.notification.count({ where: { status: "failed" } }),
    prisma.notification.count({ where: { status: "sent" } }),
    prisma.notification.findFirst({
      where: { status: "sent" },
      orderBy: { sentAt: "desc" },
      select: { sentAt: true },
    }),
    prisma.vendorSync.count({ where: { status: "pending" } }),
    prisma.vendorSync.count({ where: { status: "synced" } }),
    prisma.vendorSync.count({ where: { status: "failed" } }),
    prisma.applicationImage.count(),
    prisma.applicationImage.count({ where: { status: "promoted" } }),
    prisma.auditLog.count(),
  ]);

  // First decision per application (keep the earliest row only).
  const seen = new Set<string>();
  const decisionHours: number[] = [];
  const submissionsByApp = await prisma.application.findMany({
    where: { submittedAt: { not: null } },
    select: { id: true, submittedAt: true },
  });
  const submittedAtById = new Map(submissionsByApp.map((a) => [a.id, a.submittedAt as Date]));
  for (const d of firstDecisions) {
    if (seen.has(d.applicationId)) continue;
    seen.add(d.applicationId);
    const submittedAt = submittedAtById.get(d.applicationId);
    if (!submittedAt) continue;
    decisionHours.push((d.decidedAt.getTime() - submittedAt.getTime()) / 3_600_000);
  }

  const categoryIds = categoryGroups.map((g) => g.categoryId);
  const campusIds = campusGroups.map((g) => g.campusId);
  const [categories, campuses] = await Promise.all([
    categoryIds.length
      ? prisma.category.findMany({ where: { id: { in: categoryIds } }, select: { id: true, name: true } })
      : Promise.resolve([]),
    campusIds.length
      ? prisma.campus.findMany({ where: { id: { in: campusIds } }, select: { id: true, name: true } })
      : Promise.resolve([]),
  ]);
  const categoryName = new Map(categories.map((c) => [c.id, c.name]));
  const campusName = new Map(campuses.map((c) => [c.id, c.name]));

  const applicationsByStatus = statusGroups
    .map((g) => ({ status: g.status, count: g._count._all }))
    .sort((a, b) => a.status.localeCompare(b.status));

  const byCategory = categoryGroups
    .map((g) => ({ name: categoryName.get(g.categoryId) ?? "unknown", count: g._count._all }))
    .sort((a, b) => b.count - a.count);

  const byCampus = campusGroups
    .map((g) => ({ name: campusName.get(g.campusId) ?? "unknown", count: g._count._all }))
    .sort((a, b) => b.count - a.count);

  return {
    applicationsByStatus,
    byCategory,
    byCampus,
    institutions: institutions.map((i) => ({
      id: i.id,
      name: i.name,
      slug: i.slug,
      prefix: i.prefix,
      status: i.status,
      applicationCount: i._count.applications,
    })),
    registered: statusGroups.find((g) => g.status === "registered")?._count._all ?? 0,
    suspendedOrClosed:
      (statusGroups.find((g) => g.status === "suspended")?._count._all ?? 0) +
      (statusGroups.find((g) => g.status === "closed")?._count._all ?? 0),
    submissionsLast14Days: submissions,
    medianDecisionHours: averageHours(decisionHours),
    money: {
      confirmedCount: confirmedAgg._count._all,
      confirmedTotalMinor: confirmedAgg._sum.totalMinor ?? 0,
      schoolMinor: confirmedAgg._sum.schoolMinor ?? 0,
      voeqMinor: confirmedAgg._sum.voeqMinor ?? 0,
      outstandingMinor: outstandingIntents.reduce((s, i) => s + i.totalMinor, 0),
    },
    outbox: {
      pending: outboxPending,
      failed: outboxFailed,
      sent: outboxSent,
      lastSentAt: lastSent?.sentAt ?? null,
    },
    vendorSync: { pending: syncPending, synced: syncSynced, failed: syncFailed },
    images: { total: imageTotal, promoted: imagePromoted },
    auditTotal: auditCount,
  };
}
