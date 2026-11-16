"use client";

// Dev-only client: mint a real access link inline (and queue letter #8).

import { useState } from "react";

export function DevTrackForm() {
  const [reference, setReference] = useState("NMU-2026-0001");
  const [email, setEmail] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const [queued, setQueued] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function mint() {
    setBusy(true);
    setError(null);
    setLink(null);
    setQueued(null);
    try {
      const res = await fetch("/api/dev/track/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference, email: email || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      setLink(json.link);
      setQueued(Boolean(json.queued));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border border-vq-forest/10 bg-white/80 p-5">
      <label className="mb-1.5 block text-sm font-semibold text-vq-forest-dark">Reference</label>
      <input
        value={reference}
        onChange={(e) => setReference(e.target.value.toUpperCase())}
        className="w-full border border-vq-forest/20 bg-white px-4 py-3 font-mono text-[15px] tracking-wide text-vq-ink focus:border-vq-forest focus:outline-none"
      />
      <label className="mb-1.5 mt-4 block text-sm font-semibold text-vq-forest-dark">
        Applicant email — optional; defaults to the application&apos;s own
      </label>
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        type="email"
        placeholder="leave empty to use the application's email"
        className="w-full border border-vq-forest/20 bg-white px-4 py-3 text-[15px] text-vq-ink placeholder:text-vq-ink-subtle focus:border-vq-forest focus:outline-none"
      />
      {error && (
        <p className="mt-3 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
      )}
      <button
        onClick={mint}
        disabled={!reference.trim() || busy}
        className="mt-4 w-full bg-vq-forest px-5 py-3 text-sm font-semibold text-white shadow-md transition enabled:cursor-pointer enabled:hover:bg-vq-forest-mid disabled:opacity-40"
      >
        {busy ? "Minting…" : "Mint the access link"}
      </button>

      {link && (
        <div className="mt-4 border border-vq-forest/20 bg-vq-cream p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-vq-ink-subtle">
            Real 30-minute access link
          </p>
          <a
            href={link}
            className="mt-2 block break-all font-mono text-xs leading-relaxed text-vq-forest underline"
          >
            {link}
          </a>
          <p className="mt-2 text-xs text-vq-ink-subtle">
            {queued
              ? "Letter #8 was also queued to the outbox with this link."
              : "Application not found — no letter queued."}
          </p>
        </div>
      )}
    </div>
  );
}
