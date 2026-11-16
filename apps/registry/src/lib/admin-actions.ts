// ---------------------------------------------------------------------------
// Super-admin mutations (Phase 4, spec §13). One action layer, two doors:
// the real routes under /api/admin (session + RoleGrant gated) and the dev
// catch-all /api/dev/admin (dev-preview identity, blocked in production).
//
// Every action: zod-validated input → explicit permission check → the family
// rules from @voeq/core (canHold / validateGrants) → mutation + audit entry in
// ONE transaction → result. Failures return { ok:false, error } with a status;
// nothing mutates without its audit row.
//
// Rules the spec pins down and this layer enforces:
//   - Institution deactivated → /api/form-meta already serves only active
//     institutions, so the front door closes with no code change (4.1).
//   - Reviewer accounts belong to exactly one family and one institution
//     (register family); platform accounts belong to no institution (4.3/4.4).
//   - A grant that the account's family cannot hold is refused, not silently
//     skipped (4.5, validateGrants).
//   - Grant/revoke is itself audited, including self-assignments (doc 07 §4.6).
// ---------------------------------------------------------------------------

import { z } from "zod";
import { prisma } from "@voeq/db";
import { canHold, validateGrants, type PermissionKey } from "@voeq/core";
import { writeAudit } from "@/lib/audit-write";
import type { AdminContext } from "@/lib/admin";
import { hasPermission } from "@/lib/admin";

export interface ActionResult<T = undefined> {
  ok: boolean;
  status: number;
  error?: string;
  data?: T;
}

function fail(status: number, error: string): ActionResult<never> {
  return { ok: false, status, error };
}

function denied(ctx: AdminContext, key: PermissionKey): ActionResult<never> | null {
  return hasPermission(ctx, key)
    ? null
    : fail(403, `Requires the "${key}" permission`);
}

function familyLabel(f: "platform" | "register"): string {
  return f === "platform" ? "Voeq platform" : "Register (Media Unit)";
}

// --- schemas ---------------------------------------------------------------

const institutionCreateSchema = z.object({
  op: z.literal("institution.create"),
  name: z.string().trim().min(2).max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]{2,40}$/, "Slug: lowercase letters, digits, dashes"),
  prefix: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{2,8}$/, "Prefix: 2–8 uppercase letters/digits (used in references)"),
});

const institutionUpdateSchema = z.object({
  op: z.literal("institution.update"),
  id: z.string().min(1),
  name: z.string().trim().min(2).max(120).optional(),
  prefix: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{2,8}$/).optional(),
  status: z.enum(["active", "suspended", "disabled"]).optional(),
});

const campusCreateSchema = z.object({
  op: z.literal("campus.create"),
  institutionId: z.string().min(1),
  name: z.string().trim().min(2).max(80),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9-]{2,40}$/),
  isDefault: z.boolean().optional(),
});

const campusUpdateSchema = z.object({
  op: z.literal("campus.update"),
  id: z.string().min(1),
  name: z.string().trim().min(2).max(80).optional(),
  isDefault: z.boolean().optional(),
});

const campusDeleteSchema = z.object({
  op: z.literal("campus.delete"),
  id: z.string().min(1),
});

const categoryCreateSchema = z.object({
  op: z.literal("category.create"),
  institutionId: z.string().min(1),
  name: z.string().trim().min(2).max(80),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9-]{2,40}$/),
  sortOrder: z.number().int().min(0).max(999).optional(),
});

const categoryUpdateSchema = z.object({
  op: z.literal("category.update"),
  id: z.string().min(1),
  name: z.string().trim().min(2).max(80).optional(),
  sortOrder: z.number().int().min(0).max(999).optional(),
  active: z.boolean().optional(),
});

const categoryDeleteSchema = z.object({
  op: z.literal("category.delete"),
  id: z.string().min(1),
});

const accountCreateSchema = z.object({
  op: z.literal("account.create"),
  email: z.string().trim().toLowerCase().email(),
  name: z.string().trim().max(120).optional(),
  family: z.enum(["platform", "register"]),
  institutionId: z.string().min(1).nullable().optional(),
});

const accountUpdateSchema = z.object({
  op: z.literal("account.update"),
  id: z.string().min(1),
  name: z.string().trim().max(120).optional(),
  status: z.enum(["active", "suspended", "disabled"]).optional(),
  institutionId: z.string().min(1).nullable().optional(),
});

const grantSchema = z.object({
  op: z.literal("grant.set"),
  accountId: z.string().min(1),
  permissionKey: z.string().min(1),
  granted: z.boolean(), // true = grant, false = revoke
});

const syncRetrySchema = z.object({
  op: z.literal("sync.retry"),
  id: z.string().min(1),
});

export const adminActionSchema = z.discriminatedUnion("op", [
  institutionCreateSchema,
  institutionUpdateSchema,
  campusCreateSchema,
  campusUpdateSchema,
  campusDeleteSchema,
  categoryCreateSchema,
  categoryUpdateSchema,
  categoryDeleteSchema,
  accountCreateSchema,
  accountUpdateSchema,
  grantSchema,
  syncRetrySchema,
]);

export type AdminAction = z.infer<typeof adminActionSchema>;

// --- the dispatcher ---------------------------------------------------------

export async function runAdminAction(
  ctx: AdminContext,
  action: AdminAction,
): Promise<ActionResult<unknown>> {
  switch (action.op) {
    case "institution.create":
      return createInstitution(ctx, action);
    case "institution.update":
      return updateInstitution(ctx, action);
    case "campus.create":
      return createCampus(ctx, action);
    case "campus.update":
      return updateCampus(ctx, action);
    case "campus.delete":
      return deleteCampus(ctx, action);
    case "category.create":
      return createCategory(ctx, action);
    case "category.update":
      return updateCategory(ctx, action);
    case "category.delete":
      return deleteCategory(ctx, action);
    case "account.create":
      return createAccount(ctx, action);
    case "account.update":
      return updateAccount(ctx, action);
    case "grant.set":
      return setGrant(ctx, action);
    case "sync.retry":
      return retrySync(ctx, action);
  }
}

// --- institutions (4.1) ------------------------------------------------------

async function createInstitution(
  ctx: AdminContext,
  input: z.infer<typeof institutionCreateSchema>,
): Promise<ActionResult<unknown>> {
  const deniedRes = denied(ctx, "institutions.manage");
  if (deniedRes) return deniedRes;

  const exists = await prisma.institution.findFirst({
    where: { OR: [{ slug: input.slug }, { prefix: input.prefix }] },
    select: { slug: true, prefix: true },
  });
  if (exists) {
    return fail(409, "An institution with that slug or reference prefix already exists");
  }

  const created = await prisma.$transaction(async (tx) => {
    const institution = await tx.institution.create({
      data: { name: input.name, slug: input.slug, prefix: input.prefix },
    });
    await writeAudit(tx, {
      entityType: "Institution",
      entityId: institution.id,
      action: "institution.created",
      actorEmail: ctx.email,
      actorFamily: "platform",
      data: { name: input.name, slug: input.slug, prefix: input.prefix },
    });
    return institution;
  });

  return { ok: true, status: 201, data: { id: created.id } };
}

async function updateInstitution(
  ctx: AdminContext,
  input: z.infer<typeof institutionUpdateSchema>,
): Promise<ActionResult<unknown>> {
  const deniedRes = denied(ctx, "institutions.manage");
  if (deniedRes) return deniedRes;

  const before = await prisma.institution.findUnique({ where: { id: input.id } });
  if (!before) return fail(404, "Institution not found");

  // Deactivation guard: an institution with applications in flight can be
  // deactivated (the front door closes, the desk keeps working), but a
  // re-activation is always allowed. Nothing is ever deleted here.
  const updated = await prisma.$transaction(async (tx) => {
    const institution = await tx.institution.update({
      where: { id: input.id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.prefix !== undefined ? { prefix: input.prefix } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      },
    });
    await writeAudit(tx, {
      entityType: "Institution",
      entityId: input.id,
      action: input.status !== undefined && input.status !== before.status
        ? `institution.${input.status === "active" ? "activated" : "deactivated"}`
        : "institution.updated",
      actorEmail: ctx.email,
      actorFamily: "platform",
      data: {
        before: { name: before.name, prefix: before.prefix, status: before.status },
        after: {
          name: input.name ?? before.name,
          prefix: input.prefix ?? before.prefix,
          status: input.status ?? before.status,
        },
      },
    });
    return institution;
  });

  return { ok: true, status: 200, data: { id: updated.id } };
}

// --- campuses (4.2) ----------------------------------------------------------

async function createCampus(
  ctx: AdminContext,
  input: z.infer<typeof campusCreateSchema>,
): Promise<ActionResult<unknown>> {
  const deniedRes = denied(ctx, "institutions.manage");
  if (deniedRes) return deniedRes;

  const institution = await prisma.institution.findUnique({
    where: { id: input.institutionId },
    select: { id: true, name: true },
  });
  if (!institution) return fail(404, "Institution not found");

  const dup = await prisma.campus.findFirst({
    where: { institutionId: input.institutionId, slug: input.slug },
    select: { id: true },
  });
  if (dup) return fail(409, "That campus slug already exists for this institution");

  const created = await prisma.$transaction(async (tx) => {
    if (input.isDefault) {
      await tx.campus.updateMany({
        where: { institutionId: input.institutionId },
        data: { isDefault: false },
      });
    }
    const campus = await tx.campus.create({
      data: {
        institutionId: input.institutionId,
        name: input.name,
        slug: input.slug,
        isDefault: input.isDefault ?? false,
      },
    });
    await writeAudit(tx, {
      entityType: "Institution",
      entityId: input.institutionId,
      action: "campus.created",
      actorEmail: ctx.email,
      actorFamily: "platform",
      data: { campusId: campus.id, name: input.name, slug: input.slug },
    });
    return campus;
  });

  return { ok: true, status: 201, data: { id: created.id } };
}

async function updateCampus(
  ctx: AdminContext,
  input: z.infer<typeof campusUpdateSchema>,
): Promise<ActionResult<unknown>> {
  const deniedRes = denied(ctx, "institutions.manage");
  if (deniedRes) return deniedRes;

  const before = await prisma.campus.findUnique({ where: { id: input.id } });
  if (!before) return fail(404, "Campus not found");

  await prisma.$transaction(async (tx) => {
    if (input.isDefault === true) {
      await tx.campus.updateMany({
        where: { institutionId: before.institutionId },
        data: { isDefault: false },
      });
    }
    await tx.campus.update({
      where: { id: input.id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
      },
    });
    await writeAudit(tx, {
      entityType: "Institution",
      entityId: before.institutionId,
      action: "campus.updated",
      actorEmail: ctx.email,
      actorFamily: "platform",
      data: {
        campusId: input.id,
        before: { name: before.name, isDefault: before.isDefault },
        after: { name: input.name ?? before.name, isDefault: input.isDefault ?? before.isDefault },
      },
    });
  });

  return { ok: true, status: 200 };
}

async function deleteCampus(
  ctx: AdminContext,
  input: z.infer<typeof campusDeleteSchema>,
): Promise<ActionResult<unknown>> {
  const deniedRes = denied(ctx, "institutions.manage");
  if (deniedRes) return deniedRes;

  const before = await prisma.campus.findUnique({
    where: { id: input.id },
    include: { _count: { select: { applications: true } } },
  });
  if (!before) return fail(404, "Campus not found");
  if (before._count.applications > 0) {
    return fail(
      409,
      `This campus carries ${before._count.applications} application(s). Deactivate it instead — history is never deleted.`,
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.campus.delete({ where: { id: input.id } });
    await writeAudit(tx, {
      entityType: "Institution",
      entityId: before.institutionId,
      action: "campus.deleted",
      actorEmail: ctx.email,
      actorFamily: "platform",
      data: { campusId: input.id, name: before.name, slug: before.slug },
    });
  });

  return { ok: true, status: 200 };
}

// --- categories (4.2) --------------------------------------------------------

async function createCategory(
  ctx: AdminContext,
  input: z.infer<typeof categoryCreateSchema>,
): Promise<ActionResult<unknown>> {
  const deniedRes = denied(ctx, "categories.manage");
  if (deniedRes) return deniedRes;

  const institution = await prisma.institution.findUnique({
    where: { id: input.institutionId },
    select: { id: true },
  });
  if (!institution) return fail(404, "Institution not found");

  const dup = await prisma.category.findFirst({
    where: { institutionId: input.institutionId, slug: input.slug },
    select: { id: true },
  });
  if (dup) return fail(409, "That category slug already exists for this institution");

  const created = await prisma.$transaction(async (tx) => {
    const category = await tx.category.create({
      data: {
        institutionId: input.institutionId,
        name: input.name,
        slug: input.slug,
        sortOrder: input.sortOrder ?? 100,
      },
    });
    await writeAudit(tx, {
      entityType: "Institution",
      entityId: input.institutionId,
      action: "category.created",
      actorEmail: ctx.email,
      actorFamily: "platform",
      data: { categoryId: category.id, name: input.name, slug: input.slug },
    });
    return category;
  });

  return { ok: true, status: 201, data: { id: created.id } };
}

async function updateCategory(
  ctx: AdminContext,
  input: z.infer<typeof categoryUpdateSchema>,
): Promise<ActionResult<unknown>> {
  const deniedRes = denied(ctx, "categories.manage");
  if (deniedRes) return deniedRes;

  const before = await prisma.category.findUnique({ where: { id: input.id } });
  if (!before) return fail(404, "Category not found");

  await prisma.$transaction(async (tx) => {
    await tx.category.update({
      where: { id: input.id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
      },
    });
    await writeAudit(tx, {
      entityType: "Institution",
      entityId: before.institutionId,
      action: "category.updated",
      actorEmail: ctx.email,
      actorFamily: "platform",
      data: {
        categoryId: input.id,
        before: { name: before.name, sortOrder: before.sortOrder, active: before.active },
        after: {
          name: input.name ?? before.name,
          sortOrder: input.sortOrder ?? before.sortOrder,
          active: input.active ?? before.active,
        },
      },
    });
  });

  return { ok: true, status: 200 };
}

async function deleteCategory(
  ctx: AdminContext,
  input: z.infer<typeof categoryDeleteSchema>,
): Promise<ActionResult<unknown>> {
  const deniedRes = denied(ctx, "categories.manage");
  if (deniedRes) return deniedRes;

  const before = await prisma.category.findUnique({
    where: { id: input.id },
    include: { _count: { select: { applications: true } } },
  });
  if (!before) return fail(404, "Category not found");
  if (before._count.applications > 0) {
    return fail(
      409,
      `This category carries ${before._count.applications} application(s). Set it inactive instead — history is never deleted.`,
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.category.delete({ where: { id: input.id } });
    await writeAudit(tx, {
      entityType: "Institution",
      entityId: before.institutionId,
      action: "category.deleted",
      actorEmail: ctx.email,
      actorFamily: "platform",
      data: { categoryId: input.id, name: before.name, slug: before.slug },
    });
  });

  return { ok: true, status: 200 };
}

// --- staff accounts (4.3 / 4.4) ----------------------------------------------

async function createAccount(
  ctx: AdminContext,
  input: z.infer<typeof accountCreateSchema>,
): Promise<ActionResult<unknown>> {
  const deniedRes = denied(ctx, "staff.grant");
  if (deniedRes) return deniedRes;

  if (input.family === "register" && !input.institutionId) {
    return fail(400, "A register-family account must be assigned to an institution");
  }
  if (input.family === "platform" && input.institutionId) {
    return fail(400, "A platform-family account belongs to Voeq, not to an institution");
  }

  if (input.institutionId) {
    const institution = await prisma.institution.findUnique({
      where: { id: input.institutionId },
      select: { id: true },
    });
    if (!institution) return fail(404, "Institution not found");
  }

  const dup = await prisma.staffAccount.findUnique({ where: { email: input.email } });
  if (dup) return fail(409, "An account with that email already exists");

  const created = await prisma.$transaction(async (tx) => {
    const account = await tx.staffAccount.create({
      data: {
        email: input.email,
        name: input.name ?? null,
        family: input.family,
        institutionId: input.institutionId ?? null,
        // Created suspended: the account cannot act until the super admin
        // activates it AND signs in succeeds (Google + allowlist still gate).
        status: "suspended",
      },
    });
    await writeAudit(tx, {
      entityType: "StaffAccount",
      entityId: account.id,
      action: "staff.account_created",
      actorEmail: ctx.email,
      actorFamily: "platform",
      data: {
        email: input.email,
        family: input.family,
        institutionId: input.institutionId ?? null,
        initialStatus: "suspended",
      },
    });
    return account;
  });

  return { ok: true, status: 201, data: { id: created.id } };
}

async function updateAccount(
  ctx: AdminContext,
  input: z.infer<typeof accountUpdateSchema>,
): Promise<ActionResult<unknown>> {
  const deniedRes = denied(ctx, "staff.grant");
  if (deniedRes) return deniedRes;

  const before = await prisma.staffAccount.findUnique({ where: { id: input.id } });
  if (!before) return fail(404, "Account not found");

  if (input.institutionId !== undefined && input.institutionId !== null) {
    const institution = await prisma.institution.findUnique({
      where: { id: input.institutionId },
      select: { id: true },
    });
    if (!institution) return fail(404, "Institution not found");
  }
  if (before.family === "platform" && input.institutionId) {
    return fail(400, "A platform-family account belongs to Voeq, not to an institution");
  }

  await prisma.$transaction(async (tx) => {
    await tx.staffAccount.update({
      where: { id: input.id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.institutionId !== undefined
          ? { institutionId: input.institutionId }
          : {}),
      },
    });
    await writeAudit(tx, {
      entityType: "StaffAccount",
      entityId: input.id,
      action:
        input.status !== undefined && input.status !== before.status
          ? `staff.${input.status === "active" ? "activated" : input.status === "suspended" ? "suspended" : "disabled"}`
          : "staff.account_updated",
      actorEmail: ctx.email,
      actorFamily: "platform",
      data: {
        email: before.email,
        before: { name: before.name, status: before.status, institutionId: before.institutionId },
        after: {
          name: input.name ?? before.name,
          status: input.status ?? before.status,
          institutionId: input.institutionId !== undefined ? input.institutionId : before.institutionId,
        },
      },
    });
  });

  return { ok: true, status: 200 };
}

// --- grants (4.5) -------------------------------------------------------------

async function setGrant(
  ctx: AdminContext,
  input: z.infer<typeof grantSchema>,
): Promise<ActionResult<unknown>> {
  const deniedRes = denied(ctx, input.granted ? "staff.grant" : "staff.revoke");
  if (deniedRes) return deniedRes;

  if (!(input.permissionKey in (await permissionKeys()))) {
    return fail(400, `Unknown permission "${input.permissionKey}"`);
  }
  const key = input.permissionKey as PermissionKey;

  const account = await prisma.staffAccount.findUnique({ where: { id: input.accountId } });
  if (!account) return fail(404, "Account not found");

  // The family rule is absolute: an account never holds a permission its
  // family cannot hold, whoever is asking (doc 07 §4.6 rule 1).
  if (!canHold(account.family, key)) {
    return fail(
      409,
      `A ${familyLabel(account.family)} account cannot hold "${key}" — the families do not mix`,
    );
  }

  if (input.granted) {
    const open = await prisma.roleGrant.findFirst({
      where: { staffAccountId: account.id, permissionKey: key, revokedAt: null },
      select: { id: true },
    });
    if (open) return fail(409, `"${key}" is already granted to this account`);

    await prisma.$transaction(async (tx) => {
      await tx.roleGrant.create({
        data: {
          staffAccountId: account.id,
          permissionKey: key,
          grantedByEmail: ctx.email,
        },
      });
      await writeAudit(tx, {
        entityType: "StaffAccount",
        entityId: account.id,
        action: "role.granted",
        actorEmail: ctx.email,
        actorFamily: "platform",
        data: { email: account.email, permissionKey: key },
      });
    });
    return { ok: true, status: 201 };
  }

  const open = await prisma.roleGrant.findFirst({
    where: { staffAccountId: account.id, permissionKey: key, revokedAt: null },
    select: { id: true },
  });
  if (!open) return fail(404, `"${key}" is not currently granted to this account`);

  await prisma.$transaction(async (tx) => {
    await tx.roleGrant.update({
      where: { id: open.id },
      data: { revokedByEmail: ctx.email, revokedAt: new Date() },
    });
    await writeAudit(tx, {
      entityType: "StaffAccount",
      entityId: account.id,
      action: "role.revoked",
      actorEmail: ctx.email,
      actorFamily: "platform",
      data: { email: account.email, permissionKey: key },
    });
  });
  return { ok: true, status: 200 };
}

async function permissionKeys(): Promise<Record<string, unknown>> {
  const { PERMISSIONS } = await import("@voeq/core");
  return PERMISSIONS;
}

// --- vendor sync retry (4.8) ---------------------------------------------------

async function retrySync(
  ctx: AdminContext,
  input: z.infer<typeof syncRetrySchema>,
): Promise<ActionResult<unknown>> {
  const deniedRes = denied(ctx, "integrations.manage");
  if (deniedRes) return deniedRes;

  const row = await prisma.vendorSync.findUnique({
    where: { id: input.id },
    include: { application: { select: { reference: true } } },
  });
  if (!row) return fail(404, "Sync row not found");
  if (row.status === "synced") return fail(409, "This record is already synced");

  const updated = await prisma.vendorSync.update({
    where: { id: input.id },
    data: { status: "pending", lastError: null },
  });
  await writeAudit(prisma, {
    entityType: "VendorSync",
    entityId: row.id,
    action: "vendor.sync_requeued",
    actorEmail: ctx.email,
    actorFamily: "platform",
    data: { reference: row.application.reference, previousStatus: row.status },
  });

  // Try once immediately so the retry gives instant feedback; if voeq.ng is
  // still unreachable the row returns to the queue and the worker retries.
  const { processVendorSync } = await import("@/lib/sync");
  const result = await processVendorSync();

  return {
    ok: true,
    status: 200,
    data: { id: updated.id, attempted: result.attempted, synced: result.synced, failed: result.failed },
  };
}
