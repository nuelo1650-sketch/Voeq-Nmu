"use client";

// Integration monitoring (4.8): the vendor-sync queue. A row WAITING is not
// an error — the badge's truth never depended on it. A row FAILED needs the
// retry button; the server re-queues it and immediately attempts one post,
// then reports what happened.

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface SyncRow {
  id: string;
  reference: string;
  businessName: string;
  status: string;
  attempts: number;
  lastError: string | null;
  syncedAt: string | null;
  createdAt: string;
}

export function SyncRetryButton({
  id,
  dev,
  disabled,
}: {
  id: string;
  dev: boolean;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  async function retry() {
    setBusy(true);
    setError(null);
    setOkMsg(null);
    try {
      const res = await fetch(dev ? "/api/dev/admin/action" : "/api/admin/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "sync.retry", id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string }).error ?? "Retry failed");
      const data = json as { attempted?: number; synced?: number; failed?: number };
      setOkMsg(
        data.synced
          ? "Re-queued and delivered to voeq.ng just now."
          : `Re-queued — attempted ${data.attempted ?? 0} post(s) this pass, ${data.failed ?? 0} still failing. The worker keeps trying.`,
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Retry failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-end">
      <button
        type="button"
        onClick={retry}
        disabled={busy || disabled}
        className="border border-vq-forest/25 bg-white px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.1em] text-vq-forest transition enabled:cursor-pointer enabled:hover:border-vq-forest disabled:opacity-40"
      >
        {busy ? "Retrying…" : "Re-queue + retry"}
      </button>
      {error && <span className="mt-1 max-w-xs text-right text-xs text-red-700">{error}</span>}
      {okMsg && <span className="mt-1 max-w-xs text-right text-xs text-vq-forest">{okMsg}</span>}
    </span>
  );
}
