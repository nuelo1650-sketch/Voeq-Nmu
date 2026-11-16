"use client";

// Staff internal notes — the desk's marginalia. Internal ONLY: the applicant
// never sees these, no letter ever reads them. Attributed to whoever wrote
// them, newest first. Dev mode posts to /api/dev/notes (dev-preview@media.unit).

import { useRouter } from "next/navigation";
import { useState } from "react";

export interface NoteRow {
  id: string;
  authorEmail: string;
  body: string;
  createdAt: string;
}

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function NotesPanel({
  applicationId,
  notes,
  devMode,
}: {
  applicationId: string;
  notes: NoteRow[];
  devMode: boolean;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    if (body.trim().length < 2) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(devMode ? "/api/dev/notes" : "/api/staff/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId, body }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not save the note");
      setBody("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6">
      <div className="flex items-baseline justify-between">
        <h3 className="font-display text-lg text-vq-forest-dark">Desk notes</h3>
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-vq-ink-subtle">
          internal · the applicant never sees these
        </p>
      </div>
      {notes.length > 0 ? (
        <ul className="mt-2 space-y-2">
          {notes.map((n) => (
            <li key={n.id} className="border border-vq-forest/10 bg-white/70 px-4 py-3 text-sm">
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-vq-ink-subtle">
                {n.authorEmail} · {timeAgo(n.createdAt)}
              </p>
              <p className="mt-1 leading-relaxed text-vq-ink-muted">{n.body}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 border border-vq-forest/10 bg-white/60 px-4 py-3 text-sm text-vq-ink-subtle">
          No notes yet — the desk's marginalia live here: phone calls, promises,
          things the next reader should know.
        </p>
      )}
      <div className="mt-3">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          placeholder="e.g. Spoke to the owner — new shop photo arrives today…"
          className="w-full border border-vq-forest/20 bg-white px-3 py-2 text-sm text-vq-ink placeholder:text-vq-ink-subtle focus:border-vq-forest focus:outline-none"
        />
        {error && (
          <p className="mt-2 border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800">{error}</p>
        )}
        <button
          onClick={add}
          disabled={busy || body.trim().length < 2}
          className="mt-2 border border-vq-forest/25 bg-white px-4 py-2 text-sm font-semibold text-vq-forest transition enabled:cursor-pointer hover:border-vq-forest disabled:opacity-40"
        >
          {busy ? "Saving…" : "Add note"}
        </button>
      </div>
    </div>
  );
}
