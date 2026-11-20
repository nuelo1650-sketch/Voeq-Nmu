"use client";

// The real desk's ledger actions — statement import and the checker's
// confirm. Same shapes as the dev preview's, but pointed at the gated
// /api/staff doors (register-family accounts, maker-checker enforced).

import { useState } from "react";

export function ImportForm() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // React 19 nulls the synthetic event's currentTarget after the await —
    // capture the element before anything asynchronous (E2E found this).
    const form = e.currentTarget;
    setBusy(true);
    setResult(null);
    setError(null);
    const fd = new FormData(form);
    try {
      const res = await fetch("/api/staff/ledger/import", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Import failed");
      setResult(
        `Imported ${json.creditsCreated} credit${json.creditsCreated === 1 ? "" : "s"}` +
          (json.duplicatesSkipped ? `, skipped ${json.duplicatesSkipped} duplicate row(s)` : "") +
          ` — ${json.staged} staged, ${json.unmatched} unmatched.`,
      );
      form.reset();
      // The numbers above changed — a fresh render reads them from the DB.
      setTimeout(() => window.location.reload(), 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <input
        type="file"
        name="file"
        accept=".csv,text/csv"
        required
        className="block w-full border border-vq-forest/20 bg-white px-3 py-2 text-sm text-vq-ink"
      />
      <button
        type="submit"
        disabled={busy}
        className="mt-3 bg-vq-forest px-5 py-2.5 text-sm font-semibold text-white shadow-md transition enabled:cursor-pointer enabled:hover:bg-vq-forest-mid disabled:opacity-40"
      >
        {busy ? "Importing…" : "Import statement"}
      </button>
      {result && (
        <p className="mt-2 border-l-4 border-vq-forest bg-vq-forest/5 px-3 py-2 text-sm text-vq-forest-dark">
          {result}
        </p>
      )}
      {error && (
        <p className="mt-2 border-l-4 border-red-600 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </form>
  );
}

export function ConfirmButton({ allocationId }: { allocationId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/staff/ledger/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allocationId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Confirm failed");
      setDone(`${json.certificateCode} issued — business registered`);
      setTimeout(() => window.location.reload(), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Confirm failed");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <p className="border-l-4 border-vq-forest bg-vq-forest/5 px-3 py-2 font-mono text-xs font-bold text-vq-forest-dark">
        ✓ {done}
      </p>
    );
  }

  return (
    <div className="text-right">
      <button
        onClick={confirm}
        disabled={busy}
        className="bg-vq-forest px-4 py-2 text-sm font-semibold text-white shadow-md transition enabled:cursor-pointer enabled:hover:bg-vq-forest-mid disabled:opacity-40"
      >
        {busy ? "Confirming…" : "Confirm — register the business"}
      </button>
      {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  );
}
