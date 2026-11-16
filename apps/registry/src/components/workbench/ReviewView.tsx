// The review screen — the reviewer sees EVERYTHING: the full form snapshot,
// the photos full-size (signed URLs minted per request, ~10 min), the consent
// record, and the decision history. Judgement needs the whole picture.

import { prisma } from "@voeq/db";
import { signedAuthenticatedUrl } from "@/lib/cloudinary";
import Link from "next/link";
import { StatusChip } from "./shared";
import { DecisionPanel } from "./DecisionPanel";

const FIELD_LABELS: Record<string, string> = {
  owner_photo: "Photo of the owner",
  business_photo: "Photo of the business",
  cac_certificate: "CAC certificate",
};

function timeAgo(date: Date): string {
  const mins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.floor(hrs / 24)} d ago`;
}

export async function ReviewView({
  id,
  devMode,
  backHref,
}: {
  id: string;
  devMode: boolean;
  backHref: string;
}) {
  const a = await prisma.application.findUnique({
    where: { id },
    include: {
      category: { select: { name: true } },
      campus: { select: { name: true } },
      revisions: { orderBy: { revisionNo: "desc" }, take: 1, include: { images: true, consents: true } },
      decisions: { orderBy: { decidedAt: "desc" } },
    },
  });

  if (!a) {
    return (
      <div className="mt-6 rounded-2xl border border-vq-forest/10 bg-white/70 p-8 text-center">
        <p className="font-display text-lg text-vq-forest-dark">Application not found.</p>
        <Link href={backHref} className="mt-2 inline-block text-sm font-semibold text-vq-forest">
          ← Back to the queue
        </Link>
      </div>
    );
  }

  const revision = a.revisions[0];
  const photos = revision?.images ?? [];

  return (
    <div>
      <Link href={backHref} className="text-sm font-semibold text-vq-forest">
        ← Back to the queue
      </Link>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl text-vq-forest-dark">{a.businessName}</h2>
          <p className="mt-0.5 text-xs text-vq-ink-muted">
            <span className="font-mono">{a.reference}</span> · submitted {timeAgo(a.submittedAt ?? a.createdAt)}
          </p>
        </div>
        <StatusChip status={a.status} />
      </div>

      {/* details */}
      <dl className="mt-5 divide-y divide-vq-forest/10 rounded-xl border border-vq-forest/10 bg-white/80">
        <Row label="Category" value={a.category.name} />
        <Row label="Campus" value={a.campus.name} />
        <Row label="Owner" value={revision?.data ? (revision.data as Record<string, unknown>).ownerName as string : a.ownerName} />
        <Row label="Phone" value={a.ownerPhone} />
        <Row label="Email" value={a.contactEmail} />
        {a.businessDescription && <Row label="Description" value={a.businessDescription} wide />}
        <Row
          label="Consents"
          value={
            revision?.consents.length
              ? revision.consents.map((c) => c.type.replace("_", " ")).join(" · ") +
                ` (${revision.consents[0]?.docVersion ?? "v1"})`
              : "—"
          }
          wide
        />
      </dl>

      {/* photos — full-size, signed, ~10 min expiry, minted for this render */}
      <h3 className="mt-6 font-display text-lg text-vq-forest-dark">The evidence</h3>
      <p className="mt-1 text-xs text-vq-ink-subtle">
        Full-size originals, private on Cloudinary. These signed links are minted for this render only — they are
        never stored, logged, or emailed.
      </p>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        {photos.map((img) => (
          <figure key={img.id} className="overflow-hidden rounded-xl border border-vq-forest/10 bg-white/80">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={signedAuthenticatedUrl(img.cloudinaryPublicId)}
              alt={FIELD_LABELS[img.field] ?? img.field}
              className="max-h-96 w-full object-contain bg-vq-cream"
            />
            <figcaption className="px-3 py-2 text-xs text-vq-ink-muted">
              {FIELD_LABELS[img.field] ?? img.field} · {(img.sizeBytes / 1024).toFixed(0)}KB ·{" "}
              {img.width}×{img.height}
            </figcaption>
          </figure>
        ))}
      </div>

      {/* decision history */}
      {a.decisions.length > 0 && (
        <>
          <h3 className="mt-6 font-display text-lg text-vq-forest-dark">Decisions</h3>
          <ul className="mt-2 space-y-2">
            {a.decisions.map((d) => (
              <li key={d.id} className="rounded-xl border border-vq-forest/10 bg-white/70 px-4 py-3 text-sm">
                <p className="font-semibold text-vq-forest-dark">
                  {d.kind.replace("_", " ")}{" "}
                  <span className="font-normal text-vq-ink-subtle">· {d.decidedByEmail} · {timeAgo(d.decidedAt)}</span>
                </p>
                {d.reason && <p className="mt-1 text-vq-ink-muted">{d.reason}</p>}
                {Array.isArray(d.items) && (d.items as { field: string; instruction: string }[]).length > 0 && (
                  <ul className="mt-1 list-disc pl-5 text-vq-ink-muted">
                    {(d.items as { field: string; instruction: string }[]).map((i, k) => (
                      <li key={k}>
                        <b>{i.field}</b> — {i.instruction}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {/* the decision itself */}
      <DecisionPanel applicationId={a.id} status={a.status} devMode={devMode} />
    </div>
  );
}

function Row({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={`flex gap-4 px-4 py-2.5 ${wide ? "flex-col" : "items-baseline justify-between"}`}>
      <dt className="text-xs font-semibold uppercase tracking-wide text-vq-ink-subtle">{label}</dt>
      <dd className={`${wide ? "" : "text-right"} text-sm font-medium text-vq-ink`}>{value}</dd>
    </div>
  );
}
