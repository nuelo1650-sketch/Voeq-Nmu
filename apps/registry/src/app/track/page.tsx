// ---------------------------------------------------------------------------
// /track — the applicant's front door (roadmap 1.5, 1.15). Reference + email
// in; an access link goes out by email (letter #8). No passwords, no vendor
// account — the register proves who you are by what you know and hold.
// The endpoint behind the form is deliberately silent: it never reveals
// whether a reference exists (phase 5 adds rate limiting on top).
// ---------------------------------------------------------------------------

import { TrackRequestForm } from "./track-request-form";

export const metadata = { title: "Track your application — NMU Business Register" };

export default function TrackPage() {
  return (
    <div className="min-h-dvh">
      <header className="border-b border-vq-forest/10 bg-white/60 backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center justify-between px-5 py-4">
          <span className="font-display text-xl text-vq-forest-dark">Voeq</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-vq-amber-dark">
            NMU Business&nbsp;Register
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-5 pb-24 pt-10">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-vq-amber-dark">
          Your application, your page
        </p>
        <h1 className="mt-2 font-display text-3xl leading-snug text-vq-forest-dark sm:text-4xl">
          Track your application.
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-vq-ink-muted">
          Give us your reference and the email you applied with, and we send
          you a private link. It opens your application&apos;s own page — the
          full story, every decision, and your next step.
        </p>

        <div className="mt-8 rounded-2xl border border-vq-forest/10 bg-white/80 p-5 shadow-sm sm:p-6">
          <TrackRequestForm />
        </div>

        <p className="mt-6 text-xs leading-relaxed text-vq-ink-subtle">
          Lost your reference? It is in every email we have sent you — the
          dashed box, near the top. Or reply to any of those emails and a
          person will find it with you.
        </p>
      </main>

      <footer className="border-t border-vq-forest/10 py-8 text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-vq-ink-subtle">
          Nigeria Maritime University · Okerenkoko &amp; Kurutie · A Voeq service · Powered by Legacylm
        </p>
      </footer>
    </div>
  );
}
