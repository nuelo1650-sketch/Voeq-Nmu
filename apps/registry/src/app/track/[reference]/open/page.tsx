// ---------------------------------------------------------------------------
// The applicant's own page (roadmap 1.15) — reached only through a valid
// access token. The ship's log of ONE application: every event in order,
// the current state, and exactly what is required of the applicant next.
//
// No pills anywhere (Kai's rule) — statuses are mono uppercase text.
// The payment card shows the school's account details as clearly-labelled
// placeholders until Q-P3/Q-P4 land from the Media Unit; the amounts and
// the narration are real, because they are already decided.
// ---------------------------------------------------------------------------

import { prisma } from "@voeq/db";
import Link from "next/link";
import { formatNaira } from "@voeq/core";
import { SiteFooter, SiteHeader } from "@/components/brand";
import { verifyAccessToken } from "@/lib/access";
import { getBankAccount } from "@/lib/bank";
import { CopyText } from "./copy-text";
import { ClaimForm } from "./claim-form";
import { ReceiptUpload } from "./receipt-upload";

export const dynamic = "force-dynamic";

const KIND_LABELS: Record<string, string> = {
  approve: "Approved",
  reject: "Rejected",
  request_corrections: "Corrections requested",
  claim_fee: "Payment claimed",
  confirm_fee: "Fee confirmed",
  suspend: "Suspended",
  lift_suspension: "Suspension lifted",
  close: "Closed",
  reopen: "Reopened",
};

function stamp(date: Date): string {
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function ApplicationStatusPage({
  params,
  searchParams,
}: {
  params: Promise<{ reference: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { reference } = await params;
  const { token } = await searchParams;

  const claimed = verifyAccessToken(token ?? "");
  if (!claimed) {
    return <LockedScreen reference={decodeURIComponent(reference)} reason="expired-or-invalid" />;
  }

  const a = await prisma.application.findUnique({
    where: { id: claimed.applicationId },
    include: {
      category: { select: { name: true } },
      campus: { select: { name: true } },
      revisions: { orderBy: { revisionNo: "asc" } },
      decisions: { orderBy: { decidedAt: "asc" } },
    },
  });

  if (!a || a.reference.toUpperCase() !== decodeURIComponent(reference).toUpperCase() || a.contactEmail.toLowerCase() !== claimed.email) {
    return <LockedScreen reference={decodeURIComponent(reference)} reason="no-match" />;
  }

  // The log: submission first, then every decision in order.
  const log: { when: Date; what: string; detail?: string[] }[] = [
    {
      when: a.submittedAt ?? a.createdAt,
      what: "Application submitted",
      detail: [`${a.businessName} — ${a.category.name}, ${a.campus.name}`],
    },
    ...a.decisions.map((d) => ({
      when: d.decidedAt,
      what: KIND_LABELS[d.kind] ?? d.kind,
      detail: [
        ...(d.reason ? [d.reason] : []),
        ...(Array.isArray(d.items)
          ? (d.items as { field: string; instruction: string }[]).map((i) => `${i.field} — ${i.instruction}`)
          : []),
      ],
    })),
  ];

  const statusLine = a.status.replace(/_/g, " ").toUpperCase();
  const feeIntent = await prisma.feeIntent.findUnique({
    where: { applicationId: a.id },
  });

  return (
    <div className="min-h-dvh">
      <SiteHeader />

      <main id="main" className="mx-auto max-w-xl px-5 pb-20 pt-10">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-vq-amber-dark">
            {a.reference} · {statusLine}
          </p>
          <p className="font-mono text-[11px] text-vq-ink-subtle">
            {a.submittedAt?.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <h1 className="mt-2 font-display text-3xl leading-snug text-vq-forest-dark">
          {a.businessName}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-vq-ink-muted">
          Everything about this application, exactly as the Media Unit sees it.
          Every state change also goes to <b>{a.contactEmail}</b> — this page and
          your emails never disagree.
        </p>

        {/* the ship's log */}
        <h2 className="mt-8 border-b border-vq-forest/15 pb-2 font-display text-xl text-vq-forest-dark">
          The log
        </h2>
        <ol className="mt-1">
          {[...log].reverse().map((e, i) => (
            <li key={i} className="border-b border-vq-forest/10 py-3.5">
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-vq-ink-subtle">
                {stamp(e.when)}
              </p>
              <p className="mt-1 text-sm font-semibold text-vq-forest-dark">{e.what}</p>
              {e.detail?.map((line, k) => (
                <p key={k} className="mt-1 text-sm leading-relaxed text-vq-ink-muted">
                  {line}
                </p>
              ))}
            </li>
          ))}
        </ol>

        {/* what is required next — driven by the real status */}
        {/* StatusNextStep drives on the real status; the certificate code is
            shown only to the authenticated applicant — never to strangers. */}
        <StatusNextStep
          status={a.status}
          reference={a.reference}
          decisions={a.decisions}
          token={token ?? ""}
          feeIntent={feeIntent}
          certificateCode={a.certificateCode}
        />

        {/* the Voeq funnel (1.17) — a callout, not a footnote: Kai had it as an
            easy-to-miss P.S.; it must be seen once the entry is approved */}
        {(a.status === "approved" || a.status === "registered") && (
          <div className="mt-8 rounded-xl border-2 border-vq-forest bg-vq-cream px-5 py-5 text-center">
            <p className="font-display text-lg text-vq-forest-dark">Do you also want to sell on Voeq?</p>
            <p className="mt-1.5 text-sm leading-relaxed text-vq-ink-muted">
              The campus marketplace thousands of students already use. You are approved here; getting started there takes minutes.
            </p>
            <a
              href="https://voeq.ng/for-vendors"
              className="mt-4 inline-block rounded-full bg-vq-forest px-6 py-3 text-sm font-bold text-white transition hover:opacity-90"
            >
              Become a Voeq vendor →
            </a>
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}

// --- the next step, per status ----------------------------------------------

function StatusNextStep({
  status,
  reference,
  decisions,
  token,
  feeIntent,
  certificateCode,
}: {
  status: string;
  reference: string;
  decisions: { kind: string; reason: string | null; items: unknown }[];
  token: string;
  feeIntent: {
    status: string;
    totalMinor: number;
    claimPayerBank: string | null;
    claimSenderName: string | null;
    claimAt: Date | null;
    receiptPublicId: string | null;
  } | null;
  certificateCode: string | null;
}) {
  if (status === "submitted" || status === "under_review") {
    return (
      <div className="mt-8 border border-vq-forest/15 bg-white/80 p-5">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-vq-amber-dark">
          What happens now
        </p>
        <p className="mt-2 text-sm leading-relaxed text-vq-ink-muted">
          A person at the Media Unit reads your application — top to bottom,
          photos included. A decision comes within five working days, and the
          moment it is made, this page and your email both change. You do not
          need to do anything; this page does the waiting for you.
        </p>
      </div>
    );
  }

  if (status === "needs_correction") {
    const last = [...decisions].reverse().find((d) => d.kind === "request_corrections");
    const items = Array.isArray(last?.items)
      ? (last!.items as { field: string; instruction: string }[])
      : [];
    return (
      <div className="mt-8 border-l-4 border-vq-amber bg-vq-amber-light/60 p-5">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-vq-amber-dark">
          Your part now
        </p>
        <p className="mt-2 text-sm font-semibold text-vq-forest-dark">
          These are the fixes, exactly as written to you:
        </p>
        <ul className="mt-2 space-y-2">
          {items.map((i, k) => (
            <li key={k} className="text-sm leading-relaxed text-vq-ink-muted">
              <b className="text-vq-ink">{i.field}</b> — {i.instruction}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs leading-relaxed text-vq-ink-subtle">
          Nothing from your application is lost — the same reference continues.
          You fix only what is flagged and resubmit; the Media Unit re-reads it
          the day it arrives — no queue-jumping, no penalty.
        </p>
        <a
          href={`/track/${encodeURIComponent(reference)}/revise?token=${encodeURIComponent(token)}`}
          className="mt-4 inline-block bg-vq-amber-dark px-5 py-3 text-sm font-semibold text-white shadow-md transition hover:opacity-90"
        >
          Fix and resubmit
        </a>
      </div>
    );
  }

  if (status === "approved") {
    const bank = getBankAccount();
    // After the claim: the honest states the fee intent passes through.
    if (feeIntent && feeIntent.status !== "issued") {
      const line =
        feeIntent.status === "awaiting_bank_evidence"
          ? "Your claim is recorded. The bank's record reaches the register on its own, once a day — your entry is confirmed on the next working day after it appears. You do not need to do anything else."
          : feeIntent.status === "matched"
            ? "Your payment has been found on the bank's own record — your reference, the exact amount, the date, all three agree. It is now going through the final confirmation step, done by a second person. Nothing more is needed from you."
            : "Your payment is fully confirmed.";
      return (
        <div className="mt-8 border border-vq-forest/20 bg-white/85 p-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-vq-amber-dark">
            {feeIntent.status === "awaiting_bank_evidence"
              ? "Payment claimed — the bank record is on its way"
              : feeIntent.status === "matched"
                ? "Found on the bank record — awaiting the second person's confirm"
                : "Payment confirmed"}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-vq-ink-muted">{line}</p>
          {feeIntent.claimAt && (
            <p className="mt-3 text-xs text-vq-ink-subtle">
              Claimed by <b>{feeIntent.claimSenderName}</b> via{" "}
              {feeIntent.claimPayerBank} · {formatNaira(feeIntent.totalMinor)} against{" "}
              <span className="font-mono">{reference}</span>
            </p>
          )}
          {feeIntent.status === "awaiting_bank_evidence" && (
            feeIntent.receiptPublicId ? (
              <p className="mt-3 border-l-4 border-vq-forest bg-vq-forest/5 px-3 py-2 text-sm text-vq-forest-dark">
                Your receipt screenshot is with the desk ✓
              </p>
            ) : (
              <ReceiptUpload token={token} />
            )
          )}
        </div>
      );
    }

    return (
      <div className="mt-8">
        <div className="border border-vq-forest/20 bg-white/85 p-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-vq-amber-dark">
            The one step left — payment
          </p>
          <p className="mt-2 text-sm leading-relaxed text-vq-ink-muted">
            Your business is approved. One transfer completes the registration —
            nothing is charged beyond it, ever.
          </p>

          {bank.temporary && (
            <p className="mt-3 border-l-4 border-vq-amber bg-vq-amber-light/60 px-3 py-2 text-xs leading-relaxed text-vq-amber-dark">
              The account below is the Media Unit&apos;s account — the desk that runs
              this register. It is being used while the University&apos;s own dedicated
              account is being opened; this page switches to that account the day it
              lands. Nothing changes in how you pay or how your money is found.
            </p>
          )}

          <dl className="mt-4 divide-y divide-vq-forest/10 border border-vq-forest/10">
            <PayRow
              label="Amount"
              value={`${formatNaira(feeIntent?.totalMinor ?? 520_000)} — no more, no less`}
            />
            <PayRow label="Narration" value={reference} copy />
            <PayRow label="Account name" value={bank.accountName} />
            <PayRow label="Account number" value={bank.accountNumber} copy />
            <PayRow label="Bank" value={bank.bankName} />
          </dl>

          <p className="mt-3 text-xs leading-relaxed text-vq-ink-subtle">
            Put <span className="font-mono font-bold">{reference}</span> in the
            transfer narration exactly as written, character for character —
            that is how your money is found in the bank record.
          </p>
          <p className="mt-3 text-xs leading-relaxed text-vq-ink-subtle">
            You do not need to send a screenshot — the bank&apos;s record reaches the
            register on its own, and a person confirms your entry when the
            three signals line up: your reference, the exact amount, the date.
            But if you want the desk to see your receipt immediately, you can
            send one below.
          </p>

          {feeIntent ? (
            <ClaimForm token={token} reference={reference} />
          ) : (
            <p className="mt-4 border-l-4 border-vq-amber bg-vq-amber-light/60 px-3 py-2 text-xs text-vq-amber-dark">
              Your payment step is being prepared on the register&apos;s side — this
              card gains the claim button the moment it is ready. You can transfer
              meanwhile; the reference in the narration is what finds your money.
            </p>
          )}
        </div>
      </div>
    );
  }

  if (status === "suspended") {
    const last = [...decisions].reverse().find((d) => d.kind === "suspend");
    return (
      <div className="mt-8 border-l-4 border-vq-amber bg-vq-amber-light/60 p-5">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-vq-amber-dark">
          Registration suspended
        </p>
        <p className="mt-2 text-sm leading-relaxed text-vq-ink-muted">
          The NMU badge for this business is not valid while the suspension
          stands. The reason, exactly as recorded:{" "}
          <b>{last?.reason ?? "in your email"}</b> If you believe this is a
          mistake, reply to your email and say so plainly — a person reads it,
          and if the mistake is ours the suspension is lifted at no cost.
        </p>
      </div>
    );
  }

  if (status === "closed") {
    const last = [...decisions].reverse().find((d) => d.kind === "close");
    return (
      <div className="mt-8 border-l-4 border-neutral-300 bg-neutral-50 p-5">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-neutral-500">
          Registration closed
        </p>
        <p className="mt-2 text-sm leading-relaxed text-vq-ink-muted">
          This registration has been closed. The reason, exactly as recorded:{" "}
          <b>{last?.reason ?? "in your email"}</b> The history stays on the
          register; the badge does not.
        </p>
      </div>
    );
  }

  if (status === "rejected") {
    const last = [...decisions].reverse().find((d) => d.kind === "reject");
    return (
      <div className="mt-8 border-l-4 border-neutral-300 bg-neutral-50 p-5">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-neutral-500">
          The decision
        </p>
        <p className="mt-2 text-sm leading-relaxed text-vq-ink-muted">
          {last?.reason ?? "The written reason is in your email."} If you
          believe this is a mistake, reply to the email and say so plainly — a
          person reads it, and if we were wrong, the application reopens under
          the same reference at no cost.
        </p>
      </div>
    );
  }

  if (status === "registered") {
    return (
      <div className="mt-8 border border-vq-forest/20 bg-white/85 p-5">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-vq-forest">
          On the record
        </p>
        <p className="mt-2 text-sm leading-relaxed text-vq-ink-muted">
          Payment confirmed on the Media Unit&apos;s bank record. Your business now
          stands in the official NMU directory, and nobody from this register will
          ever ask you for another payment.
        </p>
        {certificateCode ? (
          <div className="mt-4 border-2 border-vq-forest bg-vq-cream px-4 py-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-vq-forest">
              Registration number — keep it safe
            </p>
            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="font-mono text-xl font-bold tracking-wide text-vq-forest-dark">
                {certificateCode}
              </p>
              <CopyText text={certificateCode} />
            </div>
            <p className="mt-2 text-xs leading-relaxed text-vq-ink-muted">
              This is the one line that proves this business is formally registered
              with the University. Show it at the Media Unit and your record comes
              up on the spot. If you ever lose it, it can be re-sent to the email
              address you applied with, from the track page.
            </p>
          </div>
        ) : (
          <p className="mt-3 text-xs leading-relaxed text-vq-ink-subtle">
            Registered before the certificate-number system began. Your reference{" "}
            <b>{reference}</b> remains your proof of registration; the Media Unit
            can confirm your status against it.
          </p>
        )}
      </div>
    );
  }

  return null;
}

function PayRow({
  label,
  value,
  copy,
  placeholder,
}: {
  label: string;
  value: string;
  copy?: boolean;
  placeholder?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5">
      <dt className="text-xs font-semibold uppercase tracking-wide text-vq-ink-subtle">
        {label}
      </dt>
      <dd className="flex items-center gap-2 text-right text-sm font-medium">
        <span className={placeholder ? "text-vq-ink-subtle italic" : "font-mono text-vq-ink"}>
          {value}
        </span>
        {copy && <CopyText text={value} />}
      </dd>
    </div>
  );
}

// --- locked / expired ---------------------------------------------------------

function LockedScreen({ reference, reason }: { reference: string; reason: string }) {
  return (
    <div className="min-h-dvh">
      <SiteHeader />
      <main id="main" className="mx-auto max-w-xl px-5 pb-24 pt-14 text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-vq-amber-dark">
          {reason === "expired-or-invalid" ? "Link expired" : "No match"}
        </p>
        <h1 className="mt-3 font-display text-2xl text-vq-forest-dark">
          This link has done its time.
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-vq-ink-muted">
          Access links are personal and expire on purpose —{" "}
          {reason === "expired-or-invalid"
            ? "this one has expired."
            : `it does not match ${reference}.`}{" "}
          Request a fresh one from the same page you started at. It costs
          nothing and arrives in minutes.
        </p>
        <Link
          href="/track"
          className="mt-6 inline-block bg-vq-forest px-5 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-vq-forest-mid"
        >
          Request a fresh link
        </Link>
      </main>
    </div>
  );
}
