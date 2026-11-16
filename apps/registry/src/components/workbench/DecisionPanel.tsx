"use client";

// The decision panel — where judgement becomes record. The checklist gates
// the decision buttons (roadmap: "checklist gates decision"): a reviewer who
// has not looked cannot decide. Corrections use the reason templates; rejects
// demand a written reason. Maker-checker applies later at fee confirmation —
// this panel shows who is deciding, always.

import { useRouter } from "next/navigation";
import { useState } from "react";

const CHECKLIST = [
  "I have opened every photo full-size",
  "The business name is consistent with the photos",
  "The category fits what the business actually is",
];

// Reason templates — the honest, complete sentences, one tap away (roadmap
// 1.x "reason templates"). The reviewer edits before sending; the template
// only starts the thought.
const CORRECTION_TEMPLATES: { field: string; instruction: string }[] = [
  {
    field: "Shop photo",
    instruction: "the photo is too dark — take a new one in daylight, showing the front of the shop",
  },
  {
    field: "Shop photo",
    instruction: "the photo is blurry — retake it holding the phone steady",
  },
  {
    field: "Business name",
    instruction: "the name on the form does not match what the photos show — clarify which is correct",
  },
  {
    field: "Business phone",
    instruction: "the phone number is unreachable — check and re-enter it",
  },
  {
    field: "CAC certificate",
    instruction: "the certificate is unreadable — upload a clearer photo or scan",
  },
  {
    field: "Description",
    instruction: "add a line describing what you sell and where exactly you are",
  },
];

interface CorrectionItem {
  field: string;
  instruction: string;
}

export function DecisionPanel({
  applicationId,
  status,
  devMode,
}: {
  applicationId: string;
  status: string;
  devMode: boolean;
}) {
  const router = useRouter();
  const [checked, setChecked] = useState<boolean[]>(CHECKLIST.map(() => false));
  const [mode, setMode] = useState<"idle" | "corrections" | "reject" | "confirm-approve">("idle");
  const [items, setItems] = useState<CorrectionItem[]>([]);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const checklistComplete = checked.every(Boolean);
  const decidable = status === "submitted" || status === "under_review";
  const endpoint = devMode ? "/api/dev/decision" : "/api/staff/decision";

  async function send(body: Record<string, unknown>, label: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId, ...body }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Decision failed");
      setDone(label);
      setMode("idle");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Decision failed");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="mt-6 rounded-xl border border-vq-forest/30 bg-vq-forest/5 px-4 py-3.5 text-sm text-vq-forest-dark">
        <b>{done}.</b> The state moved, the decision is recorded, and the letter is queued to the applicant.
        {devMode && <span className="block text-xs text-vq-ink-subtle">Attributed to dev-preview@media.unit.</span>}
      </div>
    );
  }

  if (!decidable) {
    return (
      <p className="mt-6 rounded-xl border border-vq-forest/10 bg-white/60 px-4 py-3 text-sm text-vq-ink-muted">
        This application is <b>{status.replace("_", " ")}</b> — no decision is open on it right now.
      </p>
    );
  }

  return (
    <div className="mt-6 rounded-2xl border border-vq-forest/15 bg-white/85 p-5">
      <h3 className="font-display text-lg text-vq-forest-dark">Your decision</h3>

      {/* checklist — the gate */}
      <div className="mt-3 space-y-2">
        {CHECKLIST.map((item, i) => (
          <label key={i} className="flex cursor-pointer items-start gap-3 text-sm text-vq-ink">
            <input
              type="checkbox"
              checked={checked[i]}
              onChange={(e) =>
                setChecked((prev) => prev.map((v, k) => (k === i ? e.target.checked : v)))
              }
              className="mt-0.5 h-4 w-4 shrink-0 accent-[#0F2A1D]"
            />
            <span>{item}</span>
          </label>
        ))}
      </div>
      {!checklistComplete && (
        <p className="mt-2 text-xs text-vq-ink-subtle">
          Tick all three — the decision buttons unlock only when you have actually looked.
        </p>
      )}

      {/* action buttons */}
      <div className="mt-4 flex flex-wrap gap-2.5">
        <button
          onClick={() => setMode("confirm-approve")}
          disabled={!checklistComplete || busy}
          className="rounded-full bg-vq-forest px-5 py-2.5 text-sm font-semibold text-white shadow-md transition enabled:hover:bg-vq-forest-mid disabled:opacity-40"
        >
          Approve
        </button>
        <button
          onClick={() => {
            setMode("corrections");
            if (items.length === 0) setItems([{ field: "", instruction: "" }]);
          }}
          disabled={!checklistComplete || busy}
          className="rounded-full border border-vq-amber/60 bg-vq-amber-light px-5 py-2.5 text-sm font-semibold text-vq-amber-dark transition enabled:hover:border-vq-amber disabled:opacity-40"
        >
          Request corrections
        </button>
        <button
          onClick={() => setMode("reject")}
          disabled={!checklistComplete || busy}
          className="rounded-full border border-neutral-300 bg-white px-5 py-2.5 text-sm font-semibold text-neutral-600 transition enabled:hover:border-neutral-500 disabled:opacity-40"
        >
          Reject
        </button>
      </div>

      {error && (
        <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800">{error}</p>
      )}

      {/* approve confirm */}
      {mode === "confirm-approve" && (
        <div className="mt-4 rounded-xl border border-vq-forest/25 bg-vq-cream px-4 py-3.5">
          <p className="text-sm font-semibold text-vq-forest-dark">
            Approve this business? One transfer of ₦5,200 follows — nothing is charged before this moment.
          </p>
          <p className="mt-1 text-xs text-vq-ink-subtle">
            Letter #3 (the payment step, explained properly) queues to the applicant. Maker-checker applies again at
            fee confirmation.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => send({ kind: "approve" }, "Approved")}
              disabled={busy}
              className="rounded-full bg-vq-forest px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              {busy ? "Recording…" : "Yes — approve"}
            </button>
            <button
              onClick={() => setMode("idle")}
              className="rounded-full border border-vq-forest/25 px-4 py-2 text-sm font-semibold text-vq-forest"
            >
              Not yet
            </button>
          </div>
        </div>
      )}

      {/* corrections builder */}
      {mode === "corrections" && (
        <div className="mt-4 rounded-xl border border-vq-amber/50 bg-vq-amber-light/60 px-4 py-3.5">
          <p className="text-sm font-semibold text-vq-amber-dark">What exactly needs fixing?</p>
          <div className="mt-3 space-y-3">
            {items.map((item, i) => (
              <div key={i} className="rounded-lg border border-vq-amber/30 bg-white/80 p-3">
                <input
                  value={item.field}
                  onChange={(e) =>
                    setItems((prev) => prev.map((it, k) => (k === i ? { ...it, field: e.target.value } : it)))
                  }
                  placeholder="Which part (e.g. Shop photo)"
                  className="w-full rounded-lg border border-vq-forest/20 px-3 py-2 text-sm"
                />
                <textarea
                  value={item.instruction}
                  onChange={(e) =>
                    setItems((prev) => prev.map((it, k) => (k === i ? { ...it, instruction: e.target.value } : it)))
                  }
                  placeholder="The exact instruction"
                  rows={2}
                  className="mt-2 w-full rounded-lg border border-vq-forest/20 px-3 py-2 text-sm"
                />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {CORRECTION_TEMPLATES.map((t, k) => (
                    <button
                      key={k}
                      onClick={() => setItems((prev) => prev.map((it, j) => (j === i ? { ...t } : it)))}
                      className="rounded-full border border-vq-forest/20 bg-white px-2.5 py-1 text-[11px] font-semibold text-vq-forest hover:border-vq-forest"
                    >
                      {t.field.toLowerCase()}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={() => setItems((prev) => [...prev, { field: "", instruction: "" }])}
            className="mt-2 text-xs font-semibold text-vq-forest"
          >
            + another item
          </button>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() =>
                send(
                  {
                    kind: "request_corrections",
                    items: items.filter((i) => i.field.trim() && i.instruction.trim()),
                  },
                  "Corrections requested",
                )
              }
              disabled={busy || items.every((i) => !i.field.trim() || !i.instruction.trim())}
              className="rounded-full bg-vq-amber-dark px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              {busy ? "Recording…" : "Send corrections"}
            </button>
            <button
              onClick={() => setMode("idle")}
              className="rounded-full border border-vq-forest/25 px-4 py-2 text-sm font-semibold text-vq-forest"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* reject reason */}
      {mode === "reject" && (
        <div className="mt-4 rounded-xl border border-neutral-300 bg-neutral-50 px-4 py-3.5">
          <p className="text-sm font-semibold text-neutral-700">The reason, written plainly.</p>
          <p className="mt-1 text-xs text-vq-ink-subtle">
            The applicant reads this verbatim. We do not send vague rejections — say what is wrong and what would
            change it.
          </p>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="The documents show a business name different from the one on the form…"
            className="mt-2 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
          />
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => send({ kind: "reject", reason }, "Rejected")}
              disabled={busy || reason.trim().length < 10}
              className="rounded-full bg-neutral-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              {busy ? "Recording…" : "Send rejection"}
            </button>
            <button
              onClick={() => setMode("idle")}
              className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-600"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
