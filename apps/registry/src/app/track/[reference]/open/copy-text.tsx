"use client";

// One copy button, used for the transfer narration. The narration IS the
// payment's traceability — make copying it effortless and exact.

import { useState } from "react";

export function CopyText({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      }}
      className="border border-vq-forest/25 bg-white/70 px-2.5 py-1 font-mono text-[11px] font-semibold text-vq-forest transition hover:bg-white"
    >
      {copied ? "Copied ✓" : "Copy"}
    </button>
  );
}
