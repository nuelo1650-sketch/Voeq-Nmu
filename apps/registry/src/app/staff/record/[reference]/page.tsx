// ---------------------------------------------------------------------------
// The printable record — one business, on paper (Kai, 2026-11-20: "download
// or print a person's information"). The register's answer to "how do we get
// data OUT": this page prints clean (and the browser's Save-as-PDF turns it
// into a local file). Every fact is sourced live from the database at print
// time — a printout is a snapshot, dated, of the record as it stands.
//
// Reached from the review screen's "Print this record" button. Gated like
// every desk door: an active staff account behind a real session.
// ---------------------------------------------------------------------------

import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { prisma } from "@voeq/db";
import { auth } from "@/lib/auth";
import { formatNaira } from "@voeq/core";
import { signedAuthenticatedUrl } from "@/lib/cloudinary";
import { PrintButton } from "./print-button";

export const dynamic = "force-dynamic";

export default async function PrintableRecord({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  // Same desk gate as /staff — a session is not authority.
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase() ?? "";
  const account = email
    ? await prisma.staffAccount.findUnique({ where: { email } }).catch(() => null)
    : null;
  if (!session?.user || !account || account.status !== "active") {
    redirect("/staff/signin");
  }

  const { reference: rawRef } = await params;
  const reference = decodeURIComponent(rawRef);

  const a = await prisma.application.findFirst({
    where: { reference: { equals: reference, mode: "insensitive" } },
    include: {
      category: { select: { name: true } },
      campus: { select: { name: true } },
      revisions: { orderBy: { revisionNo: "desc" }, include: { images: true } },
      decisions: { orderBy: { decidedAt: "asc" } },
    },
  });
  if (!a) notFound();

  const feeIntent = await prisma.feeIntent.findUnique({
    where: { applicationId: a.id },
    include: {
      allocations: { where: { status: "confirmed" }, include: { credit: true } },
    },
  });

  const rev = a.revisions[0];
  const data = (rev?.data ?? {}) as Record<string, unknown>;
  const str = (k: string): string =>
    typeof data[k] === "string" && data[k] ? (data[k] as string) : "";
  const when = (d: Date | null | undefined): string =>
    d ? d.toLocaleString("en-GB", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

  const FEE_WORDS: Record<string, string> = {
    issued: "Not paid",
    awaiting_bank_evidence: "Claimed — awaiting bank proof",
    matched: "On bank record — awaiting confirmation",
    confirmed: "Paid — confirmed",
    voided: "Voided",
  };

  return (
    <div className="min-h-dvh bg-white text-neutral-900 print:bg-white">
      {/* screen chrome — gone on paper */}
      <div className="mx-auto flex max-w-3xl items-center justify-between px-6 pt-8 print:hidden">
        <a href={`/staff?id=${a.id}`} className="text-sm font-semibold text-vq-forest">
          ← Back to the desk
        </a>
        <PrintButton />
      </div>

      <main className="mx-auto max-w-3xl px-6 py-8 print:px-0 print:py-4">
        {/* masthead — the same grammar as the site, on paper */}
        <div className="border-b-2 border-neutral-900 pb-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-500">
            NMU Business Register · Nigeria Maritime University · Official record
          </p>
          <h1 className="mt-2 font-display text-3xl leading-snug text-neutral-900">
            {a.businessName}
          </h1>
        </div>

        {/* the certificate line — the whole point of paper proof */}
        <div className="mt-4 border border-neutral-900 px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-500">
            Registration number
          </p>
          <p className="mt-1 font-mono text-2xl font-bold tracking-wide text-neutral-900">
            {a.certificateCode ?? "— not yet registered —"}
          </p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-500">
            Application reference {a.reference}
          </p>
        </div>

        {/* the facts */}
        <dl className="mt-6 border border-neutral-300 printable-avoid-break">
          <PrintRow label="Status" value={(a.status.replace(/_/g, " ") || "—").toUpperCase()} />
          <PrintRow label="Owner" value={str("ownerName") || a.ownerName} />
          <PrintRow label="Phone" value={str("ownerPhone") || a.ownerPhone} />
          <PrintRow label="Email" value={str("contactEmail") || a.contactEmail} />
          <PrintRow label="Category" value={str("categoryOther") ? `${a.category.name} — “${str("categoryOther")}”` : a.category.name} />
          <PrintRow label="Campus" value={a.campus.name} />
          <PrintRow label="Website" value={str("website") || "—"} />
          <PrintRow label="Social media" value={str("socialHandle") || "—"} />
          <PrintRow label="Description" value={a.businessDescription || str("businessDescription") || "—"} wide />
          <PrintRow label="Submitted" value={when(a.submittedAt ?? a.createdAt)} />
          <PrintRow label="Decision" value={when(a.decidedAt)} />
          <PrintRow label="Registered" value={when(a.registeredAt)} />
        </dl>

        {/* payment history */}
        <h2 className="mt-6 border-b border-neutral-300 pb-1 font-display text-lg">
          Payment
        </h2>
        <dl className="mt-2 border border-neutral-300 printable-avoid-break">
          <PrintRow label="Fee" value={feeIntent ? formatNaira(feeIntent.totalMinor) : "no fee issued"} />
          <PrintRow
            label="State"
            value={feeIntent ? (FEE_WORDS[feeIntent.status] ?? feeIntent.status) : "—"}
          />
          {feeIntent?.claimAt && (
            <PrintRow
              label="Claim"
              value={`${feeIntent.claimSenderName ?? "—"} via ${feeIntent.claimPayerBank ?? "—"}, ${when(feeIntent.claimAt)}`}
            />
          )}
          {feeIntent?.allocations[0] && (
            <PrintRow
              label="Confirmed"
              value={`by ${feeIntent.allocations[0].confirmedByEmail ?? "—"}, bank transaction ${when(feeIntent.allocations[0].credit.txnDate)} — payer ${feeIntent.allocations[0].credit.payerName ?? "—"}`}
            />
          )}
        </dl>

        {/* decision history */}
        <h2 className="mt-6 border-b border-neutral-300 pb-1 font-display text-lg">
          History
        </h2>
        <ul className="mt-2">
          {a.decisions.map((d) => (
            <li key={d.id} className="border border-neutral-300 border-t-0 px-4 py-2.5 text-sm printable-avoid-break">
              <span className="font-semibold">{d.kind.replace(/_/g, " ")}</span>
              <span className="text-neutral-500"> · {d.decidedByEmail} · {when(d.decidedAt)}</span>
              {d.reason && <p className="mt-1 text-neutral-700">{d.reason}</p>}
            </li>
          ))}
          {a.decisions.length === 0 && (
            <li className="border border-neutral-300 border-t-0 px-4 py-2.5 text-sm text-neutral-500">
              No decisions recorded yet.
            </li>
          )}
        </ul>

        {/* photos print too — signed URLs minted fresh for this render */}
        {rev && rev.images.length > 0 && (
          <>
            <h2 className="mt-6 border-b border-neutral-300 pb-1 font-display text-lg">
              Photographs on file
            </h2>
            <div className="mt-3 flex flex-wrap gap-4">
              {rev.images.map((img) => (
                <figure key={img.id} className="w-40 printable-avoid-break">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={signedAuthenticatedUrl(img.cloudinaryPublicId)}
                    alt={img.field.replace(/_/g, " ")}
                    className="h-40 w-40 border border-neutral-300 object-cover"
                  />
                  <figcaption className="mt-1 font-mono text-[9px] uppercase tracking-[0.12em] text-neutral-500">
                    {img.field.replace(/_/g, " ")}
                  </figcaption>
                </figure>
              ))}
            </div>
          </>
        )}

        {/* the honesty footer */}
        <div className="mt-8 border-t border-neutral-300 pt-3">
          <p className="font-mono text-[10px] leading-relaxed uppercase tracking-[0.12em] text-neutral-500">
            Printed {when(new Date())} · from the live record — verify against the
            register before relying on this sheet · Media Unit, Nigeria Maritime
            University
          </p>
        </div>
      </main>
    </div>
  );
}

function PrintRow({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={`border-t border-neutral-300 px-4 py-2 ${wide ? "" : "flex items-baseline justify-between gap-4"}`}>
      <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-500">{label}</dt>
      <dd className={`${wide ? "mt-1" : "text-right"} text-sm`}>{value}</dd>
    </div>
  );
}
