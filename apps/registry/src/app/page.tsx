// ---------------------------------------------------------------------------
// Phase 1.1 — the application form IS the home page (Kai's decision, landing
// scrapped). Slim voeq header, a two-line trust strip, then the form begins.
// No scroll past marketing to reach it. Mobile-first: no pixel of this page
// ships without passing 390px.
// ---------------------------------------------------------------------------

import { SiteFooter, SiteHeader } from "@/components/brand";
import { ApplyForm } from "./apply/ApplyForm";

export default function Home() {
  return (
    <div className="min-h-dvh">
      <SiteHeader />

      <main id="main" className="mx-auto max-w-xl px-5 pb-24 pt-8">
        <h1 className="font-display text-3xl leading-snug text-vq-forest-dark sm:text-4xl">
          Register your business with the University.
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-vq-ink-muted">
          One application, read by a person at the Media Unit. Listed for the
          whole campus when approved.
        </p>

        <div className="mt-5 border-y border-vq-forest/15 py-3">
          <ul className="space-y-1 text-sm text-vq-ink-muted">
            <li><span className="mr-2 text-vq-forest">—</span>Nothing is charged until approved</li>
            <li><span className="mr-2 text-vq-forest">—</span>Decision within five working days</li>
            <li><span className="mr-2 text-vq-forest">—</span>Operated by the Media Unit</li>
          </ul>
        </div>

        <ApplyForm />
      </main>

      <SiteFooter />
    </div>
  );
}
