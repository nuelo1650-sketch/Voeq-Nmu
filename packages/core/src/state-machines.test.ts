import { describe, it, expect } from "vitest";
import {
  canTransitionApplication,
  assertApplicationTransition,
  canTransitionFeeIntent,
  isExactMatch,
  canConfirm,
} from "./state-machines";

describe("application state machine", () => {
  it("allows the happy path draft → submitted → under_review → approved → registered", () => {
    expect(canTransitionApplication("draft", "submitted")).toBe(true);
    expect(canTransitionApplication("submitted", "under_review")).toBe(true);
    expect(canTransitionApplication("under_review", "approved")).toBe(true);
    expect(canTransitionApplication("approved", "registered")).toBe(true);
  });

  it("allows the correction loop", () => {
    expect(canTransitionApplication("under_review", "needs_correction")).toBe(true);
    expect(canTransitionApplication("needs_correction", "under_review")).toBe(true);
  });

  it("rejects skipping review: submitted → approved is illegal", () => {
    expect(canTransitionApplication("submitted", "approved")).toBe(false);
    expect(() => assertApplicationTransition("submitted", "approved")).toThrow(/Illegal/);
  });

  it("rejects registered → draft and rejected → registered", () => {
    expect(canTransitionApplication("registered", "draft")).toBe(false);
    expect(canTransitionApplication("rejected", "registered")).toBe(false);
  });
});

describe("fee intent state machine", () => {
  it("walks issued → awaiting → matched → confirmed", () => {
    expect(canTransitionFeeIntent("issued", "awaiting_bank_evidence")).toBe(true);
    expect(canTransitionFeeIntent("awaiting_bank_evidence", "matched")).toBe(true);
    expect(canTransitionFeeIntent("matched", "confirmed")).toBe(true);
  });

  it("never confirms straight from issued — no skipping evidence", () => {
    expect(canTransitionFeeIntent("issued", "matched")).toBe(false);
    expect(canTransitionFeeIntent("issued", "confirmed")).toBe(false);
  });

  it("a rejected match returns to awaiting evidence", () => {
    expect(canTransitionFeeIntent("matched", "awaiting_bank_evidence")).toBe(true);
  });
});

describe("isExactMatch — the no-mistake rule", () => {
  const intent = {
    intentReference: "NMU-2026-0042",
    intentTotalMinor: 520_000,
    intentIssuedAt: new Date("2026-11-01T09:00:00Z"),
  };

  it("matches on all three signals", () => {
    expect(
      isExactMatch({
        ...intent,
        creditReference: "NMU-2026-0042",
        creditAmountMinor: 520_000,
        creditTxnDate: new Date("2026-11-03T10:00:00Z"),
      }),
    ).toBe(true);
  });

  it("rejects a wrong amount even with the right reference — ₦5,150 is not ₦5,200", () => {
    expect(
      isExactMatch({
        ...intent,
        creditReference: "NMU-2026-0042",
        creditAmountMinor: 515_000,
        creditTxnDate: new Date("2026-11-03T10:00:00Z"),
      }),
    ).toBe(false);
  });

  it("rejects a right amount with the wrong reference", () => {
    expect(
      isExactMatch({
        ...intent,
        creditReference: "NMU-2026-0043",
        creditAmountMinor: 520_000,
        creditTxnDate: new Date("2026-11-03T10:00:00Z"),
      }),
    ).toBe(false);
  });

  it("rejects a credit from before the intent existed", () => {
    expect(
      isExactMatch({
        ...intent,
        creditReference: "NMU-2026-0042",
        creditAmountMinor: 520_000,
        creditTxnDate: new Date("2026-10-01T10:00:00Z"),
      }),
    ).toBe(false);
  });

  it("rejects a missing reference even if amount matches — reference-first, never reference-alone", () => {
    expect(
      isExactMatch({
        ...intent,
        creditReference: null,
        creditAmountMinor: 520_000,
        creditTxnDate: new Date("2026-11-03T10:00:00Z"),
      }),
    ).toBe(false);
  });
});

describe("maker-checker", () => {
  it("blocks the maker confirming their own match", () => {
    expect(canConfirm("a@gmail.com", "A@gmail.com")).toBe(false);
  });

  it("allows a different checker", () => {
    expect(canConfirm("maker@gmail.com", "checker@gmail.com")).toBe(true);
  });
});
