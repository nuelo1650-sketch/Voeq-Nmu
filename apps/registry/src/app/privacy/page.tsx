// Privacy notice & data-retention policy (5.9) — versioned to match the
// consent the applicant gives at submit time ("privacy notice (v1)").
// The register's privacy story is short and true: business details go on a
// public register the applicant asked to be on; personal contact details do
// not leave the room.

import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/brand";

export const metadata = { title: "Privacy notice — NMU Business Register" };

const RETENTION = [
  {
    what: "Application form data and evidence photos",
    how: "Kept while the application is in progress, then for the life of the registration on the register. Evidence photos live in private Cloudinary storage; only the approved business photo ever becomes public.",
  },
  {
    what: "Rejected / withdrawn applications",
    how: "Retained for 2 years for the university's records, then the evidence photos are deleted. The decision record itself is kept — the register's history is audit evidence.",
  },
  {
    what: "Bank statement rows",
    how: "The statement CSV rows we import carry payer names and narrations from your bank. They are kept for 7 years with the fee ledger — that is how long financial records must answer an audit.",
  },
  {
    what: "Access-link tokens",
    how: "Stored as hashes only, expiring in 30 minutes (or 30 days for the approval-letter payment link). The raw link exists only in your email.",
  },
  {
    what: "Staff audit trail",
    how: "Every decision and administrative action is recorded with the acting account, in an append-only chain that even the super admin cannot rewrite. Kept for the life of the register.",
  },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-dvh">
      <SiteHeader />
      <main id="main" className="mx-auto max-w-2xl px-5 pb-24 pt-10">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-vq-amber-dark">
          NMU Business Register · Privacy notice
        </p>
        <h1 className="mt-1 font-display text-3xl text-vq-forest-dark">
          What we hold, and for how long
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-vq-ink-muted">
          Version 1 — this is the notice the application form asks you to accept.
          Plain language, because a notice you cannot read is not consent.
        </p>

        <section className="mt-8 space-y-4">
          <h2 className="font-display text-xl text-vq-forest-dark">Who runs this register</h2>
          <p className="text-[15px] leading-relaxed text-vq-ink-muted">
            The business register is operated by Voeq together with the Nigeria
            Maritime University Media Unit. Questions, corrections, or deletion
            requests go through the register desk: the contact email or phone on
            your application reaches the same people, or write to the Media Unit
            directly.
          </p>

          <h2 className="font-display text-xl text-vq-forest-dark">What we collect, and why</h2>
          <p className="text-[15px] leading-relaxed text-vq-ink-muted">
            The application form asks for your business details, your identity
            as the owner, and evidence photos. The purpose is the register
            itself: the university needs to know who is trading on its campuses,
            and the marketplace needs to know who is verified. Nothing collected
            here is used for advertising, sold, or shared beyond the university
            department that runs the register and the marketplace service the
            badge points to.
          </p>
          <p className="text-[15px] leading-relaxed text-vq-ink-muted">
            What becomes <b>public</b>: business name, description, category,
            campus, your register reference, and the approved business photo —
            the same line a printed register would show. What stays{" "}
            <b>private</b>: your phone number, email, owner photo, and CAC
            certificate. Your bank details are never collected by this system
            at all; the fee is paid into the university&apos;s account and
            matched against the bank&apos;s own statement.
          </p>

          <h2 className="font-display text-xl text-vq-forest-dark">How long we keep things</h2>
          <ul className="divide-y divide-vq-forest/10 border border-vq-forest/15 bg-white/70">
            {RETENTION.map((r) => (
              <li key={r.what} className="px-4 py-3">
                <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-vq-ink-subtle">
                  {r.what}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-vq-ink-muted">{r.how}</p>
              </li>
            ))}
          </ul>

          <h2 className="font-display text-xl text-vq-forest-dark">Your rights</h2>
          <p className="text-[15px] leading-relaxed text-vq-ink-muted">
            You can correct your business details at any time through your
            application&apos;s status page — the desk reviews every change, and
            a registered business can be suspended or closed with a written
            reason you will see. If you want your evidence photos deleted after
            a decision, ask the desk; the decision record stays, the photos do
            not have to.
          </p>

          <h2 className="font-display text-xl text-vq-forest-dark">Where things live</h2>
          <p className="text-[15px] leading-relaxed text-vq-ink-muted">
            The register&apos;s database and its evidence photos are hosted in
            the European Union (Supabase and Cloudinary respectively). The
            audit trail is append-only: entries are hash-chained so any
            tampering is detectable, and no account — including the super
            admin — can edit or delete history.
          </p>
        </section>

        <p className="mt-10 text-sm text-vq-ink-muted">
          Back to <Link href="/" className="font-semibold text-vq-forest underline">the application form</Link>{" "}
          · <Link href="/directory" className="font-semibold text-vq-forest underline">the business register</Link>
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
