/**
 * Typed access to the Voeq design tokens.
 *
 * The CSS custom properties in `./tokens.css` are the source of truth; this
 * file mirrors the subset that application logic needs to reason about
 * (mainly status → colour mapping). Keep it in sync with the CSS.
 *
 * Two layers live in the CSS file:
 *   1. The marketplace layer (`--role-*`, `--color-*`) — extracted verbatim from
 *      voeq.ng production CSS. Do not adjust it.
 *   2. The NMU register layer (`--reg-*`) — authored for this registry, per
 *      docs/08-DESIGN-DIRECTION.md. See `REGISTER_STATUS_TOKEN` below.
 */

export const ENV = {
  CREAM: "cream",
  DEEP: "deep",
} as const;

export type Env = (typeof ENV)[keyof typeof ENV];

/** Staff surfaces sit on the ledger ground. */
export const SURFACE = {
  PAPER: "paper",
  LEDGER: "ledger",
} as const;

export type Surface = (typeof SURFACE)[keyof typeof SURFACE];

/** Application status values — mirrors spec §14.1. */
export const APPLICATION_STATUS = [
  "submitted",
  "under_review",
  "requires_correction",
  "approved_awaiting_payment",
  "rejected",
  "registered",
  "suspended",
  "closed",
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUS)[number];

/** Payment status values — mirrors spec §14.2. */
export const PAYMENT_STATUS = [
  "not_required_yet",
  "awaiting_payment",
  "payment_submitted",
  "awaiting_confirmation",
  "payment_confirmed",
  "payment_evidence_rejected",
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUS)[number];

/**
 * Status → semantic token mapping, identical in both environments.
 * Kept in one place so the portal and the dashboards never disagree.
 */
export const STATUS_TOKEN: Record<ApplicationStatus, string> = {
  submitted: "--role-text-muted",
  under_review: "--role-accent",
  requires_correction: "--role-warning",
  approved_awaiting_payment: "--role-gold",
  rejected: "--role-danger",
  registered: "--role-success-text",
  suspended: "--role-warning",
  closed: "--role-text-muted",
};

export const PAYMENT_STATUS_TOKEN: Record<PaymentStatus, string> = {
  not_required_yet: "--role-text-muted",
  awaiting_payment: "--role-gold",
  payment_submitted: "--role-accent",
  awaiting_confirmation: "--role-accent",
  payment_confirmed: "--role-success-text",
  payment_evidence_rejected: "--role-danger",
};

/**
 * Status → register-layer token mapping.
 *
 * The register layer has no coloured pills: a status is an ink mark plus a
 * label. This map gives the mark its colour. `--reg-signal` is reserved for
 * "action needed" and rejection; `--reg-seal` for registered and verified;
 * `--reg-marine-lift` for neutral in-progress states.
 */
export const REGISTER_STATUS_TOKEN: Record<ApplicationStatus, string> = {
  submitted: "--reg-ink-faint",
  under_review: "--reg-marine-lift",
  requires_correction: "--reg-signal",
  approved_awaiting_payment: "--reg-foil",
  rejected: "--reg-signal",
  registered: "--reg-seal",
  suspended: "--reg-signal",
  closed: "--reg-ink-faint",
};

export const REGISTER_PAYMENT_STATUS_TOKEN: Record<PaymentStatus, string> = {
  not_required_yet: "--reg-ink-faint",
  awaiting_payment: "--reg-ink-faint",
  payment_submitted: "--reg-marine-lift",
  awaiting_confirmation: "--reg-signal",
  payment_confirmed: "--reg-seal",
  payment_evidence_rejected: "--reg-signal",
};

/** Human-readable labels for status badges. */
export const APPLICATION_STATUS_LABEL: Record<ApplicationStatus, string> = {
  submitted: "Submitted",
  under_review: "Under Review",
  requires_correction: "Requires Correction",
  approved_awaiting_payment: "Approved – Awaiting Payment",
  rejected: "Rejected",
  registered: "Registered / Verified",
  suspended: "Suspended",
  closed: "Closed / No Longer Operating",
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  not_required_yet: "Not Required Yet",
  awaiting_payment: "Awaiting Payment",
  payment_submitted: "Payment Submitted",
  awaiting_confirmation: "Awaiting Confirmation",
  payment_confirmed: "Payment Confirmed",
  payment_evidence_rejected: "Payment Evidence Rejected",
};

/**
 * Labels as they appear in the register layer.
 *
 * The register says "fee", not "payment", and "entry", not "application" —
 * except in the applicant-facing surface, where the subject is a business
 * rather than a document, and the applicant's own thing is an "application".
 */
export const REGISTER_STATUS_LABEL: Record<ApplicationStatus, string> = {
  submitted: "Submitted",
  under_review: "Under review",
  requires_correction: "Needs correction",
  approved_awaiting_payment: "Approved — awaiting fee",
  rejected: "Rejected",
  registered: "Registered",
  suspended: "Suspended",
  closed: "Closed",
};

export const REGISTER_PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  not_required_yet: "Not required yet",
  awaiting_payment: "Awaiting payment",
  payment_submitted: "Fee submitted",
  awaiting_confirmation: "Fee submitted — to confirm",
  payment_confirmed: "Fee confirmed",
  payment_evidence_rejected: "Receipt rejected",
};

/** Format minor units (kobo) as a Nigerian Naira amount. */
export function formatNaira(minor: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
  }).format(minor / 100);
}
