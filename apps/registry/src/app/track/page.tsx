// ---------------------------------------------------------------------------
// /track — the applicant's front door (roadmap 1.5, 1.15). This page is for
// the STUDENT who applied, never for staff. Identity here is knowledge, not
// passwords: the reference (which only the applicant was given) plus the
// email they applied with. Matching the pair mints a personal 30-minute link
// and posts it by email — letter #8. The endpoint is silent: it never
// reveals whether a pair matched, so nobody can probe the register.
//
// The page explains itself before it asks anything: how it works, what the
// link opens, and the three trust rules. Numbered steps echo the letters'
// walk-throughs — the same voice, on screen.
// ---------------------------------------------------------------------------

import { SiteFooter, SiteHeader } from "@/components/brand";
import { TrackRequestForm } from "./track-request-form";
import { RetrieveCodeForm } from "./retrieve-code-form";

export const metadata = { title: "Track your application — NMU Business Register" };

export default function TrackPage() {
  return (
    <div className="min-h-dvh">
      <SiteHeader />

      <main id="main" className="mx-auto max-w-xl px-5 pb-20 pt-10">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-vq-amber-dark">
          For applicants · Your application, your page
        </p>
        <h1 className="mt-2 font-display text-3xl leading-snug text-vq-forest-dark sm:text-4xl">
          Track your application.
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-vq-ink-muted">
          You applied; the Media Unit is reading it. This page is how you
          watch it move — without calling anyone, without an account. Your
          reference and the email you applied with are all it takes.
        </p>

        {/* how it works — the same numbered walk-through the letters use */}
        <section className="mt-8 border-y border-vq-forest/15 py-6">
          <h2 className="font-display text-xl text-vq-forest-dark">How it works</h2>
          <ol className="mt-4 space-y-3.5">
            <Step n={1}>
              Enter your <b>reference</b> and the <b>email you applied with</b> — the
              form below.
            </Step>
            <Step n={2}>
              We email you a private link. It is yours alone: it opens your
              application&apos;s page and nothing else.
            </Step>
            <Step n={3}>
              Click it within <b>30 minutes</b>. Links expire on purpose —
              requesting another is free and there is no limit.
            </Step>
            <Step n={4}>
              Your page opens: the full log of your application, every decision
              with its reason, and your next step — the same view the Media
              Unit works from.
            </Step>
          </ol>
        </section>

        {/* the form */}
        <section className="mt-8">
          <h2 className="font-display text-xl text-vq-forest-dark">Request your link</h2>
          <div className="mt-4 border border-vq-forest/10 bg-white/80 p-5 shadow-sm">
            <TrackRequestForm />
          </div>
        </section>

        {/* what the link opens */}
        <section className="mt-10">
          <h2 className="font-display text-xl text-vq-forest-dark">What the link opens</h2>
          <ul className="mt-4 divide-y divide-vq-forest/10 border border-vq-forest/10 bg-white/60">
            <OpenRow title="The log">
              Every event on your application, newest first — submitted, read,
              decided. Nothing hidden.
            </OpenRow>
            <OpenRow title="Every decision, with its reason">
              If something needs fixing, the exact instruction is here. If it
              is rejected, the reason is written out in full.
            </OpenRow>
            <OpenRow title="Your next step">
              What is required of you at this moment — and nothing more. When
              it changes, the page changes.
            </OpenRow>
            <OpenRow title="Payment details when approved">
              The amount, the University&apos;s account, and your narration,
              ready to copy character for character.
            </OpenRow>
          </ul>
        </section>

        {/* lost registration number — the register's "sweet method": the
            number travels by email, to the address on record, never shown
            to a stranger (Kai, 2026-11-20). */}
        <section className="mt-10">
          <h2 className="font-display text-xl text-vq-forest-dark">
            Lost your registration number?
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-vq-ink-muted">
            Registered businesses hold a registration number —{" "}
            <span className="font-mono">NMU-REG-2026-0001</span> shape. It is
            the one line that proves the business is formally on the record.
            If it is lost, this re-sends it to the email you applied with.
          </p>
          <div className="mt-4 border border-vq-forest/10 bg-white/80 p-5 shadow-sm">
            <RetrieveCodeForm />
          </div>
        </section>

        {/* trust rules */}
        <section className="mt-10">
          <h2 className="font-display text-xl text-vq-forest-dark">Three rules that protect you</h2>
          <ul className="mt-4 divide-y divide-vq-forest/10 border border-vq-forest/10 bg-white/60">
            <OpenRow title="The link is personal">
              It opens only your application. Never forward it — anyone holding
              it holds your application.
            </OpenRow>
            <OpenRow title="The page never asks for money or your details again">
              Payment happens only after approval, into the University&apos;s
              account, from your own page. If any page or message asks for
              payment before approval, it is not us.
            </OpenRow>
            <OpenRow title="A person reads every reply">
              Lost, confused, or something looks wrong? Reply to any email from
              the register. A person answers.
            </OpenRow>
          </ul>
        </section>

        <p className="mt-8 text-xs leading-relaxed text-vq-ink-subtle">
          Lost your reference? It is in every email we have sent you — the
          dashed box, near the top. Or reply to any of those emails and a
          person will find it with you.
        </p>
      </main>

      <SiteFooter />
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3.5 text-sm leading-relaxed text-vq-ink-muted">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center bg-vq-forest font-mono text-[11px] font-bold text-white">
        {n}
      </span>
      <span>{children}</span>
    </li>
  );
}

function OpenRow({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <li className="px-4 py-3.5">
      <p className="text-sm font-semibold text-vq-forest-dark">{title}</p>
      <p className="mt-1 text-sm leading-relaxed text-vq-ink-muted">{children}</p>
    </li>
  );
}
