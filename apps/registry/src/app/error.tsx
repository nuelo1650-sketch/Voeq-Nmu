"use client";

// Root error boundary — the one that turns "Application error: a server-side
// exception has occurred…" into an honest, designed page. Added after a
// transient DB-pool hiccup on /admin surfaced as Next's raw default screen
// (digest 4166713706, 2026-11-17). The rule it enforces: a failure is
// reported in the register's own voice, with the digest verbatim so the
// server logs can be matched to what the visitor saw.

import { useEffect } from "react";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surfaces in the browser console for anyone diagnosing; the digest is
    // what links this screen to the server-side log line.
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto max-w-3xl px-5 pb-24 pt-16">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-vq-amber-dark">
        Voeq × NMU · fault
      </p>
      <h1 className="mt-1 font-display text-3xl text-vq-forest-dark">
        Something failed while loading this page
      </h1>
      <div className="mt-4 border border-vq-amber/50 bg-vq-amber-light/60 px-4 py-3 text-sm leading-relaxed text-vq-amber-dark">
        The fault was on the server side, not in anything you did. Usually a
        short hiccup reaching the register&apos;s database. Nothing has been lost
        — try again, and if it keeps happening, quote the digest below against
        the server logs.
      </div>
      {error.digest && (
        <p className="mt-3 font-mono text-xs text-vq-ink-subtle">
          Digest {error.digest}
        </p>
      )}
      <button
        type="button"
        onClick={reset}
        className="mt-6 border border-vq-forest bg-vq-forest px-4 py-2 font-mono text-[11px] uppercase tracking-[0.1em] text-white transition hover:bg-vq-forest-dark enabled:cursor-pointer"
      >
        Try again
      </button>
    </main>
  );
}
