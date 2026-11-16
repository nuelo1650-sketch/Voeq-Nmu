"use client";

import { useState } from "react";

export function ImportForm() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/dev/ledger/import", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Import failed");
      setResult(
        `Imported ${json.creditsCreated} credit${json.creditsCreated === 1 ? "" : "s"}` +
          (json.duplicatesSkipped ? `, skipped ${json.duplicatesSkipped} duplicate row(s)` : "") +
          ` — ${json.staged} staged, ${json.unmatched} unmatched.`,
      );
      e.currentTarget.reset();
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
  const [done, setDone] = useState(false);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/dev/ledger/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allocationId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Confirm failed");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Confirm failed");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-vq-forest">
        confirmed — on the record
      </span>
    );
  }
  return (
    <div className="text-right">
      <button
        onClick={confirm}
        disabled={busy}
        className="bg-vq-forest px-4 py-2 text-sm font-semibold text-white shadow-md transition enabled:cursor-pointer enabled:hover:bg-vq-forest-mid disabled:opacity-40"
      >
        {busy ? "Confirming…" : "Confirm fee"}
      </button>
      {error && <p className="mt-1 max-w-48 text-[11px] text-red-700">{error}</p>}
    </div>
  );
}
