// ---------------------------------------------------------------------------
// DEV-ONLY preview of the applicant access flow (blocked in production).
// Kai reviews the status page here BEFORE deployment — the approval gate.
// Mints a REAL short-lived token against a real application and shows the
// link inline, so the page can be walked without a mailbox. Also queues the
// real letter #8 through the outbox, exactly as production would.
// ---------------------------------------------------------------------------

import { notFound } from "next/navigation";
import { DevTrackForm } from "./track-form";

export const dynamic = "force-dynamic";

export default function DevTrackPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <div className="border border-vq-amber/50 bg-vq-amber-light px-4 py-3 text-sm text-vq-amber-dark">
        <b>Dev-only preview of the applicant access flow.</b> Enter a real
        reference and the applicant&apos;s email; a real 30-minute access token
        is minted and the real letter #8 is queued to the outbox. The link is
        also shown here so you can open the status page directly.
      </div>

      <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.18em] text-vq-amber-dark">
        NMU Business Register · Media Unit
      </p>
      <h1 className="mt-1 font-display text-3xl text-vq-forest-dark">
        The applicant&apos;s door
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-vq-ink-muted">
        The public flow lives at <span className="font-mono">/track</span> —
        reference plus email, link by email. This preview is the same
        machinery with the link shown inline.
      </p>

      <div className="mt-6">
        <DevTrackForm />
      </div>
    </main>
  );
}
