"use client";

import { useState } from "react";

// The "I have paid" claim (doc 07 §5.1a) — the applicant's word, recorded
// with care, able to start the SLA clock, never able to create a credit.

export function ClaimForm({ token, reference }: { token: string; reference: string }) {
  const [payerBank, setPayerBank] = useState("");
  const [senderName, setSenderName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/track/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, payerBank, senderName }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Claim failed");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Claim failed");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <p className="mt-4 border-l-4 border-vq-forest bg-vq-forest/5 px-3 py-2 text-sm text-vq-forest-dark">
        Claim recorded — refresh this page to see the waiting state.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="mt-5 border-t border-vq-forest/10 pt-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-vq-ink-subtle">
        After you have transferred — tell the register
      </p>
      <p className="mt-1 text-xs leading-relaxed text-vq-ink-muted">
        Not a screenshot — just your word, recorded against {reference}. It starts
        the confirmation clock; the bank&apos;s own record does the proving.
      </p>
      <div className="mt-3 space-y-2.5">
        <input
          value={payerBank}
          onChange={(e) => setPayerBank(e.target.value)}
          placeholder="The bank you paid from (e.g. Opay, GTBank)"
          required
          minLength={2}
          maxLength={60}
          className="w-full border border-vq-forest/20 bg-white px-3 py-2.5 text-sm text-vq-ink placeholder:text-vq-ink-subtle focus:border-vq-forest focus:outline-none"
        />
        <input
          value={senderName}
          onChange={(e) => setSenderName(e.target.value)}
          placeholder="The name on the sending account"
          required
          minLength={2}
          maxLength={80}
          className="w-full border border-vq-forest/20 bg-white px-3 py-2.5 text-sm text-vq-ink placeholder:text-vq-ink-subtle focus:border-vq-forest focus:outline-none"
        />
      </div>
      <button
        type="submit"
        disabled={busy}
        className="mt-3 bg-vq-forest px-5 py-2.5 text-sm font-semibold text-white shadow-md transition enabled:cursor-pointer enabled:hover:bg-vq-forest-mid disabled:opacity-40"
      >
        {busy ? "Recording…" : "I have paid"}
      </button>
      {error && (
        <p className="mt-2 border-l-4 border-red-600 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </form>
  );
}
