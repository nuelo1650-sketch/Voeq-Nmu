"use client";

// Optional screenshot of the transfer receipt (Kai, 2026-11-19). Works
// before or after the "I have paid" claim; replaceable until the payment is
// matched. Camera AND gallery — no capture attribute (found the hard way:
// it forced camera-only on many Android browsers).

import { useRef, useState } from "react";
import { compressImage } from "@/lib/image-client";

export function ReceiptUpload({ token }: { token: string }) {
  const [status, setStatus] = useState<"idle" | "compressing" | "uploading" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus("compressing");
    setError(null);
    try {
      const { blob, width, height } = await compressImage(file);
      setStatus("uploading");
      const fd = new FormData();
      fd.append("token", token);
      fd.append("file", new File([blob], "receipt.jpg", { type: "image/jpeg" }));
      fd.append("width", String(width));
      fd.append("height", String(height));
      const res = await fetch("/api/track/claim/receipt", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Upload failed");
      setStatus("done");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Upload failed");
    }
  }

  function reset() {
    setStatus("idle");
    setError(null);
    setFileName(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  if (status === "done") {
    return (
      <div className="mt-3 border-l-4 border-vq-forest bg-vq-forest/5 px-3 py-2 text-sm text-vq-forest-dark">
        Receipt received ✓ — the desk can now see it alongside the bank record.
      </div>
    );
  }

  return (
    <div className="mt-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/heic,image/webp"
        className="hidden"
        id="receipt-file"
        onChange={pick}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={status === "compressing" || status === "uploading"}
        className="border-2 border-vq-forest bg-white px-4 py-2.5 text-sm font-bold text-vq-forest transition hover:bg-vq-cream disabled:opacity-40"
      >
        {status === "compressing"
          ? "Compressing on your phone…"
          : status === "uploading"
            ? "Sending…"
            : "Send a screenshot of the receipt"}
      </button>
      {fileName && <span className="ml-2 text-xs text-vq-ink-subtle">{fileName}</span>}
      <p className="mt-1.5 text-xs leading-relaxed text-vq-ink-subtle">
        Optional — the bank&apos;s own record still does the proving. The screenshot just lets a person see your
        receipt without asking.
      </p>
      {status === "error" && (
        <p className="mt-2 border-l-4 border-red-600 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}{" "}
          <button type="button" onClick={reset} className="font-semibold underline">
            Try again
          </button>
        </p>
      )}
    </div>
  );
}
