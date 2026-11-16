// ---------------------------------------------------------------------------
// /track/[reference]/revise — the corrections loop, applicant side (1.14).
// Reached from the status page while the application is in needs_correction.
// Shows exactly what the Media Unit flagged, pre-fills everything the
// applicant already wrote, lets them keep or replace each photo, and
// resubmits as a NEW revision under the SAME reference. Nothing is lost.
// ---------------------------------------------------------------------------

import { prisma } from "@voeq/db";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/brand";
import { verifyAccessToken } from "@/lib/access";
import { signedAuthenticatedUrl } from "@/lib/cloudinary";
import { ReviseForm, type ReviseInitial } from "./revise-form";

export const dynamic = "force-dynamic";

export default async function RevisePage({
  params,
  searchParams,
}: {
  params: Promise<{ reference: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { reference } = await params;
  const { token } = await searchParams;
  const ref = decodeURIComponent(reference);

  const claimed = verifyAccessToken(token ?? "");
  if (!claimed) {
    return (
      <Shell>
        <Notice
          kicker="Link expired"
          title="This link has done its time."
          body="Access links expire on purpose. Request a fresh one from /track — it costs nothing."
        />
      </Shell>
    );
  }

  const a = await prisma.application.findUnique({
    where: { id: claimed.applicationId },
    include: {
      revisions: { orderBy: { revisionNo: "desc" }, take: 1, include: { images: true } },
      decisions: { orderBy: { decidedAt: "desc" } },
    },
  });

  if (!a || a.reference.toUpperCase() !== ref.toUpperCase() || a.contactEmail.toLowerCase() !== claimed.email) {
    return (
      <Shell>
        <Notice
          kicker="No match"
          title="This link does not match this application."
          body="Request a fresh link from /track with your own reference and email."
        />
      </Shell>
    );
  }

  if (a.status !== "needs_correction") {
    return (
      <Shell>
        <Notice
          kicker={a.status.replace(/_/g, " ")}
          title="Nothing is awaiting your fix."
          body="This application is not in the corrections state right now. Open your application's page to see where it stands."
          openHref={`/track/${encodeURIComponent(a.reference)}/open?token=${token}`}
        />
      </Shell>
    );
  }

  const revision = a.revisions[0];
  const data = (revision?.data ?? {}) as Record<string, unknown>;
  const str = (k: string): string => (typeof data[k] === "string" && data[k] ? (data[k] as string) : "");

  const flagged = a.decisions.find((d) => d.kind === "request_corrections");
  const flaggedItems = Array.isArray(flagged?.items)
    ? (flagged!.items as { field: string; instruction: string }[])
    : [];

  const initial: ReviseInitial = {
    token: token ?? "",
    reference: a.reference,
    businessName: str("businessName") || a.businessName,
    businessDescription: str("businessDescription") || a.businessDescription || "",
    website: str("website"),
    socialHandle: str("socialHandle"),
    ownerName: str("ownerName") || a.ownerName,
    ownerPhone: str("ownerPhone") || a.ownerPhone,
    contactEmail: str("contactEmail") || a.contactEmail,
    campusId: (data.campus as { id?: string } | undefined)?.id ?? "",
    categoryId: (data.category as { id?: string } | undefined)?.id ?? "",
    photos: revision?.images.map((img) => ({
      field: img.field,
      publicId: img.cloudinaryPublicId,
      url: signedAuthenticatedUrl(img.cloudinaryPublicId),
      sizeBytes: img.sizeBytes,
    })) ?? [],
  };

  return (
    <div className="min-h-dvh">
      <SiteHeader />
      <main id="main" className="mx-auto max-w-xl px-5 pb-20 pt-10">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-vq-amber-dark">
          {a.reference} · Correction {revision?.revisionNo === 1 ? "" : `· revision ${revision!.revisionNo + 1} of your application`}
        </p>
        <h1 className="mt-2 font-display text-3xl leading-snug text-vq-forest-dark">
          Fix what was flagged.
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-vq-ink-muted">
          Same application, same reference — you are not starting over. Fix the
          items below, keep everything else as it is, and resubmit. The Media
          Unit re-reads it the day it arrives.
        </p>

        {flaggedItems.length > 0 && (
          <div className="mt-6 border-l-4 border-vq-amber bg-vq-amber-light/60 p-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-vq-amber-dark">
              What was flagged
            </p>
            <ul className="mt-2 space-y-2">
              {flaggedItems.map((i, k) => (
                <li key={k} className="text-sm leading-relaxed text-vq-ink-muted">
                  <b className="text-vq-ink">{i.field}</b> — {i.instruction}
                </li>
              ))}
            </ul>
          </div>
        )}

        <ReviseForm initial={initial} />
      </main>
      <SiteFooter />
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <SiteHeader />
      <main id="main" className="mx-auto max-w-xl px-5 pb-24 pt-14">{children}</main>
      <SiteFooter />
    </div>
  );
}

function Notice({
  kicker,
  title,
  body,
  openHref,
}: {
  kicker: string;
  title: string;
  body: string;
  openHref?: string;
}) {
  return (
    <div className="text-center">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-vq-amber-dark">{kicker}</p>
      <h1 className="mt-3 font-display text-2xl text-vq-forest-dark">{title}</h1>
      <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-vq-ink-muted">{body}</p>
      {openHref && (
        <Link
          href={openHref}
          className="mt-6 inline-block bg-vq-forest px-5 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-vq-forest-mid"
        >
          Open my application&apos;s page
        </Link>
      )}
      <p className="mt-4 text-xs text-vq-ink-subtle">
        or go to{" "}
        <Link href="/track" className="font-semibold text-vq-forest underline">
          /track
        </Link>{" "}
        to request a fresh link
      </p>
    </div>
  );
}
