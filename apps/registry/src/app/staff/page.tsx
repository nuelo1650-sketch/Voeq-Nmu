// ---------------------------------------------------------------------------
// The register desk — the real staff surface (Phase 1). Same components as
// the /dev/workbench preview, but behind Google sign-in: identity is the
// verified Google email, the allowlist decided who got in, and every decision
// is attributed to that account for the audit trail.
// ---------------------------------------------------------------------------

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
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
  // Role-based landing (Kai: "how do I get to admin?"): platform-family
  // accounts are bounced straight to the super-admin console — they should
  // never sit in the Media Unit's desk. Register family stays here.
  if (session.user.family === "platform") redirect("/admin");
  const { id, status } = await searchParams;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-vq-amber-dark">
          NMU Business Register · Media Unit
        </p>
        <p className="text-xs text-vq-ink-subtle">{session.user.email}</p>
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
