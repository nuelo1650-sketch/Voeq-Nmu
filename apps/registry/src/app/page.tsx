// ---------------------------------------------------------------------------
// Phase 1.1 — the application form IS the home page (Kai's decision, landing
// scrapped). Slim voeq header, a two-line trust strip, then the form begins.
// No scroll past marketing to reach it. Mobile-first: no pixel of this page
// ships without passing 390px.
// ---------------------------------------------------------------------------

import { ApplyForm } from "./apply/ApplyForm";

export default function Home() {
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

      <main className="mx-auto max-w-xl px-5 pb-24 pt-8">
        <h1 className="font-display text-3xl leading-snug text-vq-forest-dark sm:text-4xl">
          Register your business with the University.
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-vq-ink-muted">
          One application, read by a person at the Media Unit. Listed for the
          whole campus when approved.
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          <TrustChip>Nothing is charged until approved</TrustChip>
          <TrustChip>Decision within five working days</TrustChip>
          <TrustChip>Operated by the Media Unit</TrustChip>
        </div>

        <ApplyForm />
      </main>

      <footer className="border-t border-vq-forest/10 py-8 text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-vq-ink-subtle">
          Nigeria Maritime University · Okerenkoko &amp; Kurutie · A Voeq service · Powered by Legacylm
        </p>
      </footer>
    </div>
  );
}

function TrustChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-vq-forest/15 bg-white/70 px-3 py-1.5 text-xs font-semibold text-vq-forest">
      {children}
    </span>
  );
}
