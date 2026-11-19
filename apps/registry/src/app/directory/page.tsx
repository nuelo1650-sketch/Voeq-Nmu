// The public directory (3.2) — the register's face to the world. Every
// business here has been through the Media Unit, had its payment confirmed
// against the bank's own record, and been confirmed by a second person.
// That is the entire promise of the badge.
//
// No pills (Kai's rule). Rules, not shadows. The photo comes from the
// promoted public copy (stage 8); where promotion has not happened yet,
// an honest ruled placeholder block stands in — the badge is never faked
// by a stock photo.

import { prisma } from "@voeq/db";
import { SiteFooter, SiteHeader } from "@/components/brand";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "The NMU Business Register — directory",
  description:
    "Businesses registered through the Nigeria Maritime University business register — verified on the University's own bank record.",
};

const CLOUD = process.env.CLOUDINARY_CLOUD_NAME ?? "";

export default async function DirectoryPage() {
  const businesses = await prisma.application.findMany({
    where: { status: "registered", publicationStatus: "published" },
    orderBy: { decidedAt: "desc" },
    select: {
      reference: true,
      businessName: true,
      businessDescription: true,
      voeqVendorUrl: true,
      category: { select: { name: true } },
      campus: { select: { name: true } },
      revisions: {
        orderBy: { revisionNo: "desc" },
        take: 1,
        select: { images: { select: { field: true, promotedPublicId: true } } },
      },
    },
    take: 200,
  });

  return (
    <div className="min-h-dvh">
      <SiteHeader />
      <main id="main" className="mx-auto max-w-3xl px-5 pb-24 pt-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-vq-amber-dark">
          Nigeria Maritime University · Okerenkoko &amp; Kurutie
        </p>
        <h1 className="mt-2 font-display text-3xl text-vq-forest-dark">
          The business register
        </h1>
        <p className="mt-3 max-w-[62ch] text-sm leading-relaxed text-vq-ink-muted">
          Every business on this page was approved by the University&apos;s Media
          Unit, paid the registration fee, and had that payment confirmed against
          the bank&apos;s own record — your reference, the exact amount, the date.
          The badge means all of that happened. When a business loses its good
          standing, it loses its place here.
        </p>

        {businesses.length === 0 ? (
          <div className="mt-8 border border-vq-forest/15 bg-white/80 p-8 text-center">
            <p className="font-display text-lg text-vq-forest-dark">
              The register is open and waiting.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-vq-ink-muted">
              No businesses have completed registration yet. The first entry will
              appear here the day its fee is confirmed.{" "}
              <Link href="/" className="underline">
                Apply here
              </Link>{" "}
              — it costs nothing to apply.
            </p>
          </div>
        ) : (
          <ul className="mt-8 space-y-4">
            {businesses.map((b) => {
              const photo = b.revisions[0]?.images.find(
                (i) => i.field === "business_photo" && i.promotedPublicId,
              );
              return (
                <li key={b.reference} className="border border-vq-forest/15 bg-white/85">
                  <div className="flex flex-col gap-4 p-4 sm:flex-row">
                    {photo && CLOUD ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`https://res.cloudinary.com/${CLOUD}/image/upload/f_auto,q_auto,w_480/${photo.promotedPublicId}`}
                        alt={`The flyer of ${b.businessName}`}
                        className="h-40 w-full border border-vq-forest/10 object-cover sm:w-52"
                      />
                    ) : (
                      <div className="flex h-40 w-full items-center justify-center border border-vq-forest/10 bg-vq-forest/5 sm:w-52">
                        <p className="px-4 text-center font-mono text-[10px] uppercase tracking-[0.14em] text-vq-ink-subtle">
                          photo pending
                        </p>
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-vq-ink-subtle">
                        {b.reference} · {b.category.name} · {b.campus.name.replace(" Campus", "")}
                      </p>
                      <h2 className="mt-1 font-display text-xl text-vq-forest-dark">
                        {b.businessName}
                      </h2>
                      {b.businessDescription && (
                        <p className="mt-2 text-sm leading-relaxed text-vq-ink-muted">
                          {b.businessDescription}
                        </p>
                      )}
                      <p className="mt-3 inline-block border border-vq-forest/30 px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-vq-forest">
                        Registered — NMU Business Register
                      </p>
                      {b.voeqVendorUrl && (
                        <p className="mt-2 text-xs text-vq-ink-subtle">
                          Also sells on{" "}
                          <a
                            href={b.voeqVendorUrl}
                            className="text-vq-forest underline"
                            rel="noopener noreferrer"
                          >
                            Voeq
                          </a>
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <p className="mt-8 border-t border-vq-forest/15 pt-5 text-xs leading-relaxed text-vq-ink-subtle">
          To verify any registration yourself — for instance before signing a
          contract or stocking a supplier — call the reference by its full form
          (NMU-2026-0001) against{" "}
          <Link href="/track" className="underline">
            the applicant&apos;s own status page
          </Link>
          , or ask the Media Unit for a verification. Nobody from this register
          will ever charge a fee for verification.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
