"use client";

// The decision panel — where judgement becomes record. The checklist gates
// the decision buttons (roadmap: "checklist gates decision"): a reviewer who
// has not looked cannot decide. Corrections use the reason templates; rejects
// demand a written reason. Maker-checker applies later at fee confirmation —
// this panel shows who is deciding, always.

import { useRouter } from "next/navigation";
import { useState } from "react";

// The gate has two tiers (Kai: "I should not agree that something is right
// when they are wrong"). Looking is required for EVERY decision. The two
// consistency affirmations assert the application is CORRECT — so they gate
// APPROVE only. You can reject or demand corrections having merely looked.
const CHECKLIST = [
  { text: "I have opened every photo full-size", approveOnly: false },
  { text: "The business name is consistent with the photos", approveOnly: true },
  { text: "The category fits what the business actually is", approveOnly: true },
];

// Reason templates — the honest, complete sentences, one tap away (roadmap
// 1.x "reason templates"). The reviewer edits before sending; the template
// only starts the thought.
const CORRECTION_TEMPLATES: { field: string; instruction: string }[] = [
  {
    field: "Business flyer",
    instruction: "the flyer is unreadable — upload a clear one showing the business name",
  },
  {
    field: "Business flyer",
    instruction: "the flyer is too dark or blurry — take a new photo of it in daylight",
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
  const [mode, setMode] = useState<
    "idle" | "corrections" | "reject" | "confirm-approve" | "lifecycle"
  >("idle");
  const [lifecycleKind, setLifecycleKind] = useState<"suspend" | "lift_suspension" | "close" | null>(null);
  const [items, setItems] = useState<CorrectionItem[]>([]);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const lookedChecked = checked[0];
  const allChecked = checked.every(Boolean);
  const decidable = status === "submitted" || status === "under_review";
  // The badge lifecycle (3.10): registered businesses can be suspended or
  // closed; suspended ones can be lifted back. Losing the badge requires a
  // written reason — a badge that cannot be lost means nothing (3.8).
  const lifecycleOpen = status === "registered" || status === "suspended";
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

  if (!decidable && !lifecycleOpen) {
    return (
      <p className="mt-6 rounded-xl border border-vq-forest/10 bg-white/60 px-4 py-3 text-sm text-vq-ink-muted">
        This application is <b>{status.replace("_", " ")}</b> — no decision is open on it right now.
      </p>
    );
  }

  // --- the badge lifecycle: a separate panel with its own gravity -----------
  if (!decidable && lifecycleOpen) {
    const LIFECYCLE = {
      suspend: {
        label: "Suspend",
        cls: "bg-vq-amber-dark",
        ask: "Suspend this business? The NMU badge stops being valid the moment this lands.",
        note: "The badge is checked live against the register — voeq.ng loses it automatically (3.8). A written reason is required.",
      },
      close: {
        label: "Close",
        cls: "bg-neutral-700",
        ask: "Close this registration permanently? The entry leaves the directory and the badge dies with it.",
        note: "Closure is final in this pass — the register keeps the history, but there is no reopen for closed.",
      },
      lift_suspension: {
        label: "Lift suspension",
        cls: "bg-vq-forest",
        ask: "Lift the suspension? The badge becomes valid again immediately.",
        note: "No new reason is required — the suspension's reason is already on the record.",
      },
    } as const;
    const actions =
      status === "registered"
        ? ([LIFECYCLE.suspend, LIFECYCLE.close] as const)
        : ([LIFECYCLE.lift_suspension] as const);
    const chosen = lifecycleKind ? LIFECYCLE[lifecycleKind] : null;

    return (
      <div className="mt-6 rounded-2xl border border-vq-forest/15 bg-white/85 p-5">
        <h3 className="font-display text-lg text-vq-forest-dark">The badge lifecycle</h3>
        <p className="mt-1 text-xs text-vq-ink-subtle">
          This business is <b>{status.replace("_", " ")}</b>. What you do here is
          visible to the world through the verify API — write accordingly.
        </p>

        {chosen && (
          <div className="mt-4 rounded-xl border border-vq-forest/25 bg-vq-cream px-4 py-3.5">
            <p className="text-sm font-semibold text-vq-forest-dark">{chosen.ask}</p>
            <p className="mt-1 text-xs text-vq-ink-subtle">{chosen.note}</p>
            {lifecycleKind !== "lift_suspension" && (
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="The reason, written plainly — it lands on the record and the verify response."
                className="mt-2 w-full rounded-lg border border-vq-forest/20 bg-white px-3 py-2 text-sm"
              />
            )}
            <div className="mt-3 flex gap-2">
              <button
                onClick={() =>
                  send(
                    { kind: lifecycleKind, reason: lifecycleKind === "lift_suspension" ? undefined : reason },
                    lifecycleKind === "suspend"
                      ? "Suspended"
                      : lifecycleKind === "close"
                        ? "Closed"
                        : "Suspension lifted",
                  )
                }
                disabled={busy || (lifecycleKind !== "lift_suspension" && reason.trim().length < 10)}
                className={`${chosen.cls} px-4 py-2 text-sm font-semibold text-white enabled:cursor-pointer disabled:opacity-40`}
              >
                {busy ? "Recording…" : `Confirm — ${chosen.label.toLowerCase()}`}
              </button>
              <button
                onClick={() => {
                  setMode("idle");
                  setLifecycleKind(null);
                }}
                className="border border-vq-forest/25 px-4 py-2 text-sm font-semibold text-vq-forest"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-2.5">
          {actions.map((a) => (
            <button
              key={a.label}
              onClick={() => {
                setLifecycleKind(status === "registered" ? (a.label === "Suspend" ? "suspend" : "close") : "lift_suspension");
                setMode("lifecycle");
              }}
              disabled={busy}
              className={`${a.cls} px-5 py-2.5 text-sm font-semibold text-white shadow-md transition enabled:cursor-pointer disabled:opacity-40`}
            >
              {a.label}
            </button>
          ))}
        </div>
        {error && (
          <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800">{error}</p>
        )}
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-2xl border border-vq-forest/15 bg-white/85 p-5">
      <h3 className="font-display text-lg text-vq-forest-dark">Your decision</h3>

      {/* checklist — the gate. Looking gates every decision; the two
          consistency affirmations gate APPROVE only. */}
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
            <span>
              {item.text}
              {item.approveOnly && (
                <span className="ml-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-vq-ink-subtle">
                  · needed to approve
                </span>
              )}
            </span>
          </label>
        ))}
      </div>
      {!lookedChecked ? (
        <p className="mt-2 text-xs text-vq-ink-subtle">
          Open every photo and tick — no decision of any kind until you have actually looked.
        </p>
      ) : !allChecked ? (
        <p className="mt-2 text-xs text-vq-ink-subtle">
          The two consistency checks unlock Approve only. Corrections and reject are yours once you have looked.
        </p>
      ) : null}

      {/* action buttons — all three SOLID fills: they must read as buttons,
          not as decoration (Kai: corrections "feels like it's not clickable") */}
      <div className="mt-4 flex flex-wrap gap-2.5">
        <button
          onClick={() => setMode("confirm-approve")}
          disabled={!allChecked || busy}
          className="bg-vq-forest px-5 py-2.5 text-sm font-semibold text-white shadow-md transition enabled:cursor-pointer enabled:hover:bg-vq-forest-mid disabled:opacity-40"
        >
          Approve
        </button>
        <button
          onClick={() => {
            setMode("corrections");
            if (items.length === 0) setItems([{ field: "", instruction: "" }]);
          }}
          disabled={!lookedChecked || busy}
          className="bg-vq-amber-dark px-5 py-2.5 text-sm font-semibold text-white shadow-md transition enabled:cursor-pointer enabled:hover:opacity-90 disabled:opacity-40"
        >
          Request corrections
        </button>
        <button
          onClick={() => setMode("reject")}
          disabled={!lookedChecked || busy}
          className="bg-neutral-700 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition enabled:cursor-pointer enabled:hover:bg-neutral-600 disabled:opacity-40"
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
              className="bg-vq-forest px-4 py-2 text-sm font-semibold text-white enabled:cursor-pointer disabled:opacity-40"
            >
              {busy ? "Recording…" : "Yes — approve"}
            </button>
            <button
              onClick={() => setMode("idle")}
              className="border border-vq-forest/25 px-4 py-2 text-sm font-semibold text-vq-forest"
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
                      className="border border-vq-forest/20 bg-white px-2.5 py-1 text-[11px] font-semibold text-vq-forest hover:border-vq-forest"
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
              className="bg-vq-amber-dark px-4 py-2 text-sm font-semibold text-white enabled:cursor-pointer disabled:opacity-40"
            >
              {busy ? "Recording…" : "Send corrections"}
            </button>
            <button
              onClick={() => setMode("idle")}
              className="border border-vq-forest/25 px-4 py-2 text-sm font-semibold text-vq-forest"
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
              className="bg-neutral-700 px-4 py-2 text-sm font-semibold text-white enabled:cursor-pointer disabled:opacity-40"
            >
              {busy ? "Recording…" : "Send rejection"}
            </button>
            <button
              onClick={() => setMode("idle")}
              className="border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-600"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
