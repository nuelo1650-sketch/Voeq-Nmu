import { notFound } from "next/navigation";
import { QueueView } from "@/components/workbench/QueueView";
import { ReviewView } from "@/components/workbench/ReviewView";

// ---------------------------------------------------------------------------
// DEV-ONLY workbench preview (blocked in production). Kai reviews every staff
// screen here BEFORE deployment — the approval gate. Real decisions are
// functional through /api/dev/decision and are attributed to
// "dev-preview@media.unit" in the decision history. The real session-gated
// surface is /staff (same components, real identity).
// ---------------------------------------------------------------------------

export const dynamic = "force-dynamic";

export default async function DevWorkbenchPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; status?: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const { id, status } = await searchParams;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="rounded-xl border border-vq-amber/50 bg-vq-amber-light px-4 py-3 text-sm text-vq-amber-dark">
        <b>Dev-only preview of the staff workbench.</b> Real decisions work here and are attributed to
        dev-preview@media.unit. Production serves the same screens at /staff behind Google sign-in.
      </div>

      <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.18em] text-vq-amber-dark">
        NMU Business Register · Media Unit
      </p>
      <h1 className="mt-1 font-display text-3xl text-vq-forest-dark">The workbench</h1>
      <p className="mt-2 text-sm leading-relaxed text-vq-ink-muted">
        Every application, the whole picture, and the judgement. Nothing leaves this room without a written reason.
      </p>

      <div className="mt-6">
        {id ? (
          <ReviewView id={id} devMode backHref="/dev/workbench" />
        ) : (
          <QueueView statusFilter={status} />
        )}
      </div>
    </main>
  );
}
