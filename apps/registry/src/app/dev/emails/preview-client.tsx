"use client";

// Width toggle. sandbox="" blocks every script inside the email render —
// we are previewing static HTML, nothing executes.

import { useState } from "react";

interface Preview {
  id: string;
  name: string;
  gate: string;
  letter: { subject: string; html: string };
}

export function EmailPreviews({ previews }: { previews: Preview[] }) {
  const [width, setWidth] = useState<390 | 640>(640);

  return (
    <div className="mt-8">
      <div className="sticky top-0 z-10 -mx-4 flex flex-wrap items-center gap-2 bg-vq-cream/95 px-4 py-3 backdrop-blur">
        <span className="text-xs font-medium text-neutral-500">Width:</span>
        {([640, 390] as const).map((w) => (
          <button
            key={w}
            onClick={() => setWidth(w)}
            className={`px-3 py-1 text-xs font-semibold transition ${
              width === w
                ? "bg-vq-forest text-white"
                : "border border-neutral-300 bg-white text-neutral-600 hover:border-vq-forest"
            }`}
          >
            {w === 390 ? "390px · phone" : "640px · desktop"}
          </button>
        ))}
      </div>

      <div className="space-y-14">
        {previews.map((p) => (
          <section key={p.id}>
            <h2 className="font-display text-xl text-vq-forest-dark">{p.name}</h2>
            <p className="mt-1 text-xs leading-relaxed text-neutral-500">
              <span className="font-semibold text-neutral-600">Subject:</span> {p.letter.subject}
            </p>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-neutral-500">
              <span className="font-semibold text-vq-amber-dark">Gate:</span> {p.gate}
            </p>
            <div className="mt-4 overflow-hidden rounded-xl border border-neutral-200 bg-white p-3 shadow-sm">
              <iframe
                title={p.name}
                srcDoc={p.letter.html}
                sandbox=""
                className="mx-auto block rounded-lg border border-neutral-200 bg-vq-cream"
                style={{ width, height: 1100 }}
              />
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
