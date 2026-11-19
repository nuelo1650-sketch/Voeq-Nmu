// ---------------------------------------------------------------------------
// The register desk — the real staff surface (Phase 1). Same components as
// the /dev/workbench preview, but behind Google sign-in: identity is the
// verified Google email, the allowlist decided who got in, and every decision
// is attributed to that account for the audit trail.
// ---------------------------------------------------------------------------

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@voeq/db";
import { QueueView } from "@/components/workbench/QueueView";
import { ReviewView } from "@/components/workbench/ReviewView";

export const dynamic = "force-dynamic";

export default async function StaffHome({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; status?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/staff/signin");
  // Superuser model (Kai chose Option A, 2026-11-18): platform accounts are
  // ALSO register workers, so the old bounce to /admin is gone — a platform
  // superuser works this desk like anyone else. The desk gate below still
  // refuses missing/suspended accounts, and the APIs gate identically
  // (lib/staff.ts lets platform through as superuser).
  const family = session.user.family;

  // The desk gate: a session is not authority. The account row must exist
  // and be ACTIVE — a suspended or disabled account sees the waiting screen,
  // and nothing behind it responds either way (the desk APIs gate too).
  const email = session.user.email?.trim().toLowerCase() ?? "";
  const account = email
    ? await prisma.staffAccount.findUnique({ where: { email } }).catch(() => null)
    : null;
  if (!account || account.status !== "active") {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-vq-amber-dark">
          NMU Business Register · Media Unit
        </p>
        <h1 className="mt-1 font-display text-3xl text-vq-forest-dark">The desk is closed</h1>
        <div className="mt-4 border border-vq-amber/50 bg-vq-amber-light/60 px-4 py-3 text-sm leading-relaxed text-vq-amber-dark">
          {account
            ? "This account is suspended — a super admin has to activate it before the workbench opens. Nothing was lost; the queue will be exactly where it was."
            : "No staff account exists for this Google email yet. Ask a super admin to create one in the admin console, then sign in again."}
        </div>
        <p className="mt-3 font-mono text-xs text-vq-ink-subtle">{email}</p>
      </main>
    );
  }

  const { id, status } = await searchParams;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-vq-amber-dark">
          NMU Business Register · Media Unit
        </p>
        <p className="text-xs text-vq-ink-subtle">
          {family === "platform" && (
            <a
              href="/admin"
              className="mr-3 inline-block border border-vq-forest/40 bg-white px-3 py-1.5 text-xs font-bold text-vq-forest transition hover:border-vq-forest"
            >
              Platform console
            </a>
          )}
          {session.user.email}
        </p>
      </div>
      <h1 className="mt-1 font-display text-3xl text-vq-forest-dark">The workbench</h1>
      <p className="mt-2 text-sm leading-relaxed text-vq-ink-muted">
        Every application, the whole picture, and the judgement. Nothing leaves this room without a written reason.
      </p>

      <div className="mt-6">
        {id ? (
          <ReviewView id={id} devMode={false} backHref="/staff" />
        ) : (
          <QueueView statusFilter={status} />
        )}
      </div>
    </main>
  );
}
