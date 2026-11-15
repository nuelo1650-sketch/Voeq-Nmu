// ---------------------------------------------------------------------------
// Phase 0 home — a placeholder front door. The real landing (landing-v3
// direction) is built in Phase 1 (roadmap 1.1). This page exists so the app
// boots, renders in the voeq grammar, and links the two Phase 0 surfaces.
// ---------------------------------------------------------------------------

export default function Home() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-24">
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-vq-amber-dark">
        Nigeria Maritime University · Official business register
      </p>
      <h1 className="mt-4 font-display text-4xl leading-tight text-vq-forest-dark">
        The register is being built.
      </h1>
      <p className="mt-4 text-vq-ink-muted">
        Phase 0 — foundations. The database schema, auth, outbox, and the design
        system are in place. The application flow arrives in Phase 1.
      </p>
      <div className="mt-8 flex gap-4">
        <a
          href="/health"
          className="rounded-full border border-vq-forest/25 bg-white/50 px-5 py-2.5 text-sm font-semibold text-vq-forest transition hover:bg-white/80"
        >
          System health
        </a>
        <a
          href="/staff"
          className="rounded-full bg-vq-forest px-5 py-2.5 text-sm font-semibold text-vq-glass shadow-md transition hover:bg-vq-forest-mid"
        >
          Staff sign-in
        </a>
      </div>
    </main>
  );
}
