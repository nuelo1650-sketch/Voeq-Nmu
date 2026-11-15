import { describe, it, expect } from "vitest";
import { canHold, validateGrants, type PermissionKey } from "./permissions.js";
import { hashEntry, canonicalJson, verifyChain } from "./audit.js";
import { formatNaira, parseNairaToMinor, FEE_TOTAL_KOBO, FEE_SCHOOL_KOBO, FEE_VOEQ_KOBO } from "./money.js";
import { formatReference, parseReference, extractReferenceFromNarration } from "./reference.js";

describe("permission matrix — two families that cannot mix", () => {
  it("register accounts cannot hold platform permissions", () => {
    expect(canHold("register", "fee-schedule.manage")).toBe(false);
    expect(canHold("register", "staff.grant")).toBe(false);
  });

  it("platform accounts cannot hold register permissions", () => {
    expect(canHold("platform", "applications.decide")).toBe(false);
    expect(canHold("platform", "ledger.confirm-fee")).toBe(false);
  });

  it("each family holds its own permissions", () => {
    expect(canHold("platform", "staff.grant")).toBe(true);
    expect(canHold("register", "ledger.confirm-fee")).toBe(true);
    expect(canHold("register", "applications.decide")).toBe(true);
  });

  it("shared permissions pass both families", () => {
    expect(canHold("platform", "directory.read")).toBe(true);
    expect(canHold("register", "directory.read")).toBe(true);
  });

  it("validateGrants returns exactly the unlawful keys", () => {
    const grants: PermissionKey[] = ["applications.read", "staff.grant", "ledger.import", "categories.manage"];
    expect(validateGrants("register", grants)).toEqual(["staff.grant", "categories.manage"]);
    expect(validateGrants("platform", grants)).toEqual(["applications.read", "ledger.import"]);
  });
});

describe("audit hash chain", () => {
  const base = {
    entityType: "Application",
    entityId: "app_1",
    actorEmail: "officer@gmail.com" as const,
    actorFamily: "register" as const,
  };

  it("canonicalJson is order-independent", () => {
    expect(canonicalJson({ a: 1, b: 2 })).toBe(canonicalJson({ b: 2, a: 1 }));
    expect(canonicalJson({ a: { y: 1, x: 2 } })).toBe(canonicalJson({ a: { x: 2, y: 1 } }));
  });

  it("the hash changes when any field changes", () => {
    const e1 = { ...base, action: "fee.confirmed", createdAt: new Date("2026-11-15T10:00:00Z") };
    const e2 = { ...base, action: "fee.confirmed ", createdAt: new Date("2026-11-15T10:00:00Z") };
    expect(hashEntry(e1, null)).not.toBe(hashEntry(e2, null));
  });

  it("chains: entry 2's hash commits to entry 1's hash", () => {
    const e1 = { ...base, action: "fee.staged", createdAt: new Date("2026-11-15T10:00:00Z") };
    const e2 = { ...base, action: "fee.confirmed", createdAt: new Date("2026-11-15T10:05:00Z") };
    const h1 = hashEntry(e1, null);
    const h2 = hashEntry(e2, h1);
    expect(h2).not.toBe(h1);
    expect(verifyChain(
      [{ prevHash: null, hash: h1 }, { prevHash: h1, hash: h2 }],
      [e1, e2],
    )).toBeNull();
  });

  it("detects tampering with a middle entry", () => {
    const e1 = { ...base, action: "fee.staged", createdAt: new Date("2026-11-15T10:00:00Z") };
    const e2 = { ...base, action: "fee.confirmed", createdAt: new Date("2026-11-15T10:05:00Z") };
    const h1 = hashEntry(e1, null);
    const h2 = hashEntry(e2, h1);
    // An attacker rewrites entry 1 and recomputes only its own hash.
    const fake1 = { ...base, action: "fee.confirmed", createdAt: new Date("2026-11-15T10:00:00Z") };
    const broken = verifyChain(
      [{ prevHash: null, hash: hashEntry(fake1, null) }, { prevHash: h1, hash: h2 }],
      [fake1, e2],
    );
    expect(broken).toBe(1); // the break surfaces at entry 2: its prevHash no longer matches the rewritten entry 1
  });
});

describe("money", () => {
  it("formats minor units as naira — never shows kobo to humans", () => {
    expect(formatNaira(FEE_TOTAL_KOBO)).toBe("₦5,200.00");
    expect(formatNaira(FEE_SCHOOL_KOBO)).toBe("₦5,000.00");
    expect(formatNaira(FEE_VOEQ_KOBO)).toBe("₦200.00");
  });

  it("the invariant numbers hold", () => {
    expect(FEE_SCHOOL_KOBO + FEE_VOEQ_KOBO).toBe(FEE_TOTAL_KOBO);
  });

  it("parses human input back to minor units", () => {
    expect(parseNairaToMinor("5,200.00")).toBe(FEE_TOTAL_KOBO);
    expect(parseNairaToMinor("₦5200")).toBe(FEE_TOTAL_KOBO);
  });
});

describe("references", () => {
  it("formats the payment code", () => {
    expect(formatReference("NMU", 2026, 42)).toBe("NMU-2026-0042");
    expect(formatReference("NMU", 2026, 1)).toBe("NMU-2026-0001");
  });

  it("parses back", () => {
    expect(parseReference("NMU-2026-0042")).toEqual({ prefix: "NMU", year: 2026, seq: 42 });
    expect(parseReference("nmu-2026-42")).toEqual({ prefix: "NMU", year: 2026, seq: 42 });
  });

  it("extracts a reference from a messy bank narration", () => {
    expect(extractReferenceFromNarration("Transfer for NMU-2026-0042 business reg")).toBe("NMU-2026-0042");
    expect(extractReferenceFromNarration("ADA CHUKWUEMEKA no ref")).toBeNull();
  });
});
