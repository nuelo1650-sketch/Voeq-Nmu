// ---------------------------------------------------------------------------
// State machines — the gate battery (doc 07 §1.8). Every state transition is
// an explicit predicate here; no code path "happens to work". The DB layer
// re-checks these guards before persisting.
// ---------------------------------------------------------------------------

export type ApplicationStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "needs_correction"
  | "approved"
  | "rejected"
  | "registered"
  | "suspended"
  | "closed";

export type FeeIntentStatus =
  | "issued"
  | "awaiting_bank_evidence"
  | "matched"
  | "confirmed"
  | "voided";

// --- application machine ---------------------------------------------------

type ApplicationTransition = {
  from: readonly ApplicationStatus[];
  to: ApplicationStatus;
  /** Human-readable rule; enforced by the caller in addition to the machine. */
  guard: string;
};

export const APPLICATION_TRANSITIONS: readonly ApplicationTransition[] = [
  { from: ["draft"], to: "submitted", guard: "all sections valid + four consents recorded" },
  { from: ["submitted"], to: "under_review", guard: "register staff claims the review" },
  { from: ["under_review"], to: "needs_correction", guard: "correction items written" },
  { from: ["needs_correction"], to: "under_review", guard: "applicant resubmitted (new revision)" },
  { from: ["under_review"], to: "approved", guard: "review checklist complete" },
  { from: ["under_review"], to: "rejected", guard: "rejection reason written" },
  { from: ["approved"], to: "registered", guard: "fee intent CONFIRMED (never merely paid)" },
  { from: ["registered"], to: "suspended", guard: "suspension authority recorded" },
  { from: ["suspended"], to: "registered", guard: "suspension lifted" },
  { from: ["registered"], to: "closed", guard: "closure authority recorded" },
];

export function canTransitionApplication(
  from: ApplicationStatus,
  to: ApplicationStatus,
): boolean {
  return APPLICATION_TRANSITIONS.some((t) => t.to === to && t.from.includes(from));
}

export function assertApplicationTransition(from: ApplicationStatus, to: ApplicationStatus): void {
  if (!canTransitionApplication(from, to)) {
    throw new Error(`Illegal application transition: ${from} → ${to}`);
  }
}

/** Publication is a separate axis (ADR-006): only registered entries may publish. */
export function canPublish(status: ApplicationStatus): boolean {
  return status === "registered";
}

// --- fee intent machine (doc 07 §2.6) --------------------------------------

type FeeIntentTransition = {
  from: readonly FeeIntentStatus[];
  to: FeeIntentStatus;
  guard: string;
};

export const FEE_INTENT_TRANSITIONS: readonly FeeIntentTransition[] = [
  { from: ["issued"], to: "awaiting_bank_evidence", guard: "applicant submitted 'I have paid'" },
  { from: ["awaiting_bank_evidence"], to: "matched", guard: "a bank credit matched: reference-first, exact-amount, date window" },
  { from: ["matched"], to: "confirmed", guard: "CHECKER (different Google account) confirmed the staged allocation" },
  { from: ["awaiting_bank_evidence"], to: "voided", guard: "application withdrawn before evidence" },
  { from: ["matched"], to: "awaiting_bank_evidence", guard: "match rejected by checker — back to evidence wait" },
];

export function canTransitionFeeIntent(from: FeeIntentStatus, to: FeeIntentStatus): boolean {
  return FEE_INTENT_TRANSITIONS.some((t) => t.to === to && t.from.includes(from));
}

export function assertFeeIntentTransition(from: FeeIntentStatus, to: FeeIntentStatus): void {
  if (!canTransitionFeeIntent(from, to)) {
    throw new Error(`Illegal fee intent transition: ${from} → ${to}`);
  }
}

/**
 * THE no-mistake rule, as a predicate (doc 07 §2.6 rule 3+4):
 * a match requires reference agreement AND exact amount AND a date window.
 * Two of three signals is not a match.
 */
export function isExactMatch(args: {
  intentReference: string;
  intentTotalMinor: number;
  intentIssuedAt: Date;
  creditReference: string | null;
  creditAmountMinor: number;
  creditTxnDate: Date;
  windowDays?: number;
}): boolean {
  const windowDays = args.windowDays ?? 30;
  if (args.creditReference !== args.intentReference) return false;
  if (args.creditAmountMinor !== args.intentTotalMinor) return false;
  const earliest = new Date(args.intentIssuedAt.getTime() - windowDays * 86_400_000);
  return args.creditTxnDate >= earliest;
}

/** Maker-checker: the confirming account must differ from the staging account. */
export function canConfirm(stagedByEmail: string, checkerEmail: string): boolean {
  return stagedByEmail.toLowerCase() !== checkerEmail.toLowerCase();
}
