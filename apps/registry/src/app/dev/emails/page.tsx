import { notFound } from "next/navigation";
import {
  applicationReceived,
  correctionsRequested,
  applicationApproved,
  applicationRejected,
  feeAwaitingEvidence,
  feeConfirmed,
  paymentException,
  applicationReceivedFull,
  correctionsRequestedFull,
  applicationApprovedFull,
  applicationRejectedFull,
  feeAwaitingEvidenceFull,
  feeConfirmedFull,
  paymentExceptionFull,
} from "@voeq/email";
import { EmailPreviews } from "./preview-client";

// ---------------------------------------------------------------------------
// DEV-ONLY email preview. Every letter the system can send, rendered in the
// real skin — in BOTH directions Kai is choosing between:
//   A · compact  — the short, tight letter
//   B · fuller   — the proper letter: opening, walk-through, good-to-know, signature
// Names below are labelled preview fixtures — never shipped, never sent, and
// this page does not exist in production builds.
// ---------------------------------------------------------------------------

const REF = "NMU-2026-7";
const NAME = "Preview Fixture Traders";
const FIX_ITEMS = [
  { field: "Shop photo", instruction: "the photo is too dark — take a new one in daylight, showing the front of the shop" },
  { field: "Business phone", instruction: "the number starts with +234 but is one digit short — check and re-enter it" },
];
const FIX_REASON =
  "The documents show a business name different from the one on the form, and we cannot confirm which is correct. Bring the CAC slip or student ID to the Media Unit and we will reopen the application.";
const FIX_CONCERN =
  "The bank record shows ₦5,000 arriving, but the fee is ₦5,200. The missing ₦200 must be transferred before your entry can go live.";

const PREVIEWS = [
  {
    id: "application-received",
    name: "1 · Application received",
    gate: "Fires once, after the SUBMITTED transition is committed in its DB transaction.",
    a: applicationReceived(REF, NAME),
    b: applicationReceivedFull(REF, NAME, `http://localhost:3000/track/${REF}`),
  },
  {
    id: "corrections",
    name: "2 · Corrections requested",
    gate: "Fires only after a register-family staff member records a corrections decision with at least one concrete item. Never automatic.",
    a: correctionsRequested(REF, FIX_ITEMS),
    b: correctionsRequestedFull(REF, FIX_ITEMS),
  },
  {
    id: "approved",
    name: "3 · Approved — payment step",
    gate: "Fires on the APPROVED decision. Maker-checker applies: the approving account must differ from the reviewing account.",
    a: applicationApproved(REF, NAME, `http://localhost:3000/apply/${REF}/payment`),
    b: applicationApprovedFull(REF, NAME, `http://localhost:3000/apply/${REF}/payment`),
  },
  {
    id: "rejected",
    name: "4 · Rejected",
    gate: "Fires on the REJECTED decision with the written reason included verbatim. The reason is not edited or softened.",
    a: applicationRejected(REF, FIX_REASON),
    b: applicationRejectedFull(REF, FIX_REASON),
  },
  {
    id: "fee-claimed",
    name: "5 · Payment claim received",
    gate: "Fires once when the applicant claims payment (fee intent → CLAIMED). No repeat sends for the same intent.",
    a: feeAwaitingEvidence(REF),
    b: feeAwaitingEvidenceFull(REF),
  },
  {
    id: "fee-confirmed",
    name: "6 · Fee confirmed — on the record",
    gate: "Fires only after the three-signal match (reference + exact amount + date window) passes on the bank statement CSV AND a staff member confirms. Never auto-confirmed.",
    a: feeConfirmed(REF, NAME, "http://localhost:3000/directory/nmu-okerenkoko"),
    b: feeConfirmedFull(REF, NAME, "http://localhost:3000/directory/nmu-okerenkoko"),
  },
  {
    id: "payment-exception",
    name: "7 · Payment exception",
    gate: "Fires when a bank CSV credit fails the three-signal match against every expectation, or matches with a wrong amount/date. Sent within two working days of detection.",
    a: paymentException(REF, FIX_CONCERN),
    b: paymentExceptionFull(REF, FIX_CONCERN),
  },
];

export default function DevEmailsPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.18em] text-vq-amber-dark">
        Dev-only preview
      </p>
      <h1 className="font-display text-3xl text-vq-forest-dark">The seven letters — two directions</h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-neutral-600">
        Every email the system can send, in the real skin, in both directions
        Kai is choosing between. Nothing here is a real application — the names
        are labelled preview fixtures. Toggle the direction, then the width —
        every letter must survive the 390px phone pass like every screen.
      </p>
      <EmailPreviews previews={PREVIEWS} />
    </main>
  );
}
