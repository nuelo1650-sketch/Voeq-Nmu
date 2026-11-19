"use client";

// Click-to-zoom for the workbench evidence photos. Kai (2026-11-19): the
// dossier thumbnails could not be enlarged, so a reviewer could not actually
// inspect a flyer or certificate. Click (or tap) a photo for a fullscreen
// view; Esc or click-outside closes; arrow keys move between photos.

import { useEffect, useState } from "react";

export interface LightboxPhoto {
  src: string;
  alt: string;
  caption: string;
}

export function PhotoLightbox({ photos }: { photos: LightboxPhoto[] }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  useEffect(() => {
    if (openIdx === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenIdx(null);
      if (e.key === "ArrowRight") setOpenIdx((i) => (i === null ? null : Math.min(i + 1, photos.length - 1)));
      if (e.key === "ArrowLeft") setOpenIdx((i) => (i === null ? null : Math.max(i - 1, 0)));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openIdx, photos.length]);

  useEffect(() => {
    if (openIdx === null) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [openIdx]);

  return (
    <>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        {photos.map((p, i) => (
          <figure key={p.src} className="overflow-hidden rounded-xl border border-vq-forest/10 bg-white/80">
            <button
              type="button"
              onClick={() => setOpenIdx(i)}
              aria-label={`Enlarge ${p.alt}`}
              className="block w-full cursor-zoom-in"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.src} alt={p.alt} className="max-h-96 w-full object-contain bg-vq-cream" />
            </button>
            <figcaption className="flex items-center justify-between gap-2 px-3 py-2 text-xs text-vq-ink-muted">
              <span>{p.caption}</span>
              <span className="font-semibold text-vq-forest">Tap to enlarge</span>
            </figcaption>
          </figure>
        ))}
      </div>

      {openIdx !== null && photos[openIdx] && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Photo enlarged"
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-4"
          onClick={() => setOpenIdx(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photos[openIdx].src}
            alt={photos[openIdx].alt}
            className="max-h-[82vh] max-w-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <p className="mt-3 font-mono text-xs uppercase tracking-[0.14em] text-white/80">
            {photos[openIdx].caption} · {openIdx + 1}/{photos.length}
          </p>
          <div className="mt-3 flex items-center gap-2">
            {photos.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenIdx((i) => (i === null ? null : Math.max(i - 1, 0)));
                  }}
                  className="border border-white/40 px-3 py-1.5 text-xs font-bold text-white"
                >
                  ← Prev
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenIdx((i) => (i === null ? null : Math.min(i + 1, photos.length - 1)));
                  }}
                  className="border border-white/40 px-3 py-1.5 text-xs font-bold text-white"
                >
                  Next →
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => setOpenIdx(null)}
              className="border border-white/40 bg-white px-3 py-1.5 text-xs font-bold text-black"
            >
              Close ✕
            </button>
          </div>
        </div>
      )}
    </>
  );
}
