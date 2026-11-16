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
      revisions: { orderBy: { revisionNo: "desc" }, take: 2, include: { images: true, consents: true } },
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
  const previous = a.revisions[1];
  const photos = revision?.images ?? [];
  // The full form snapshot — the reviewer sees EVERY field the applicant
  // wrote, with an honest placeholder where a field was left empty.
  const data = (revision?.data ?? {}) as Record<string, unknown>;
  const str = (k: string): string => (typeof data[k] === "string" && data[k] ? (data[k] as string) : "");

  // Side-by-side revisions (roadmap 1.14): what changed, field by field, so
  // the reviewer never re-reads an application from scratch after a
  // correction request.
  const FIELD_ORDER = [
    ["businessName", "Business name"],
    ["ownerName", "Owner"],
    ["ownerPhone", "Phone"],
    ["contactEmail", "Email"],
    ["website", "Website"],
    ["socialHandle", "Social media"],
    ["businessDescription", "Description"],
  ] as const;
  const prevData = (previous?.data ?? {}) as Record<string, unknown>;
  const textChanges = previous
    ? FIELD_ORDER.filter(([k]) => {
        const before = prevData[k];
        const after = data[k];
        const norm = (v: unknown) => (typeof v === "string" && v ? v : "");
        return norm(before) !== norm(after);
      })
    : [];
  const campusChanged =
    previous &&
    (prevData.campus as { name?: string } | undefined)?.name !== (data.campus as { name?: string } | undefined)?.name;
  const categoryChanged =
    previous &&
    (prevData.category as { name?: string } | undefined)?.name !== (data.category as { name?: string } | undefined)?.name;
  type PhotoChange = { field: string; what: "kept" | "replaced" | "added" | "removed" };
  const photoChanges: PhotoChange[] = [];
  if (previous) {
    for (const field of ["owner_photo", "business_photo", "cac_certificate"] as const) {
      const before = previous.images.find((i) => i.field === field)?.cloudinaryPublicId;
      const after = revision?.images.find((i) => i.field === field)?.cloudinaryPublicId;
      if (before === after) {
        if (before) photoChanges.push({ field, what: "kept" });
      } else if (before && after) {
        photoChanges.push({ field, what: "replaced" });
      } else if (!before && after) {
        photoChanges.push({ field, what: "added" });
      } else {
        photoChanges.push({ field, what: "removed" });
      }
    }
  }
  const hasDiff = Boolean(previous) && (textChanges.length > 0 || campusChanged || categoryChanged || photoChanges.some((p) => p.what !== "kept"));

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

      {/* side-by-side revisions — what changed, before the full dossier */}
      {hasDiff && (
        <div className="mt-5 border-l-4 border-vq-forest bg-vq-forest/5 p-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-vq-forest">
            Revision {revision!.revisionNo} — what changed since revision {previous!.revisionNo}
          </p>
          {textChanges.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {textChanges.map(([k, label]) => {
                const norm = (v: unknown) => (typeof v === "string" && v ? v : "—");
                const before = norm(prevData[k]);
                const after = norm(data[k]);
                return (
                  <li key={k} className="text-sm leading-relaxed">
                    <b className="text-vq-forest-dark">{label}:</b>{" "}
                    <span className="text-neutral-500 line-through">{before}</span>{" "}
                    <span className="text-vq-forest-dark">→ {after}</span>
                  </li>
                );
              })}
            </ul>
          )}
          {campusChanged && (
            <p className="mt-2 text-sm">
              <b className="text-vq-forest-dark">Campus:</b>{" "}
              <span className="text-neutral-500 line-through">{(prevData.campus as { name?: string })?.name}</span>{" "}
              <span className="text-vq-forest-dark">→ {(data.campus as { name?: string })?.name}</span>
            </p>
          )}
          {categoryChanged && (
            <p className="mt-2 text-sm">
              <b className="text-vq-forest-dark">Category:</b>{" "}
              <span className="text-neutral-500 line-through">{(prevData.category as { name?: string })?.name}</span>{" "}
              <span className="text-vq-forest-dark">→ {(data.category as { name?: string })?.name}</span>
            </p>
          )}
          {photoChanges.some((p) => p.what !== "kept") && (
            <p className="mt-2 text-sm">
              <b className="text-vq-forest-dark">Photos:</b>{" "}
              {photoChanges
                .filter((p) => p.what !== "kept")
                .map((p) => `${p.field.replace(/_/g, " ")} ${p.what}`)
                .join(" · ")}
              {photoChanges.some((p) => p.what === "kept") && " · the rest kept unchanged"}
            </p>
          )}
        </div>
      )}

      {/* details — every field on the form, nothing hidden */}
      <dl className="mt-5 divide-y divide-vq-forest/10 rounded-xl border border-vq-forest/10 bg-white/80">
        <Row label="Business name" value={a.businessName} />
        <Row label="Category" value={a.category.name} />
        <Row label="Campus" value={a.campus.name} />
        <Row label="Owner" value={str("ownerName") || a.ownerName} />
        <Row label="Phone" value={str("ownerPhone") || a.ownerPhone} />
        <Row label="Email" value={str("contactEmail") || a.contactEmail} />
        <Row label="Website" value={str("website") || "Not provided"} />
        <Row label="Social media" value={str("socialHandle") || "Not provided"} />
        <Row label="Description" value={a.businessDescription || str("businessDescription") || "Not provided"} wide />
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
