// ---------------------------------------------------------------------------
// Money — integer minor units (kobo) everywhere. ₦5,000 = 500_000 kobo.
// Minor units are NEVER shown to a human; format through formatNaira().
// ---------------------------------------------------------------------------

export const NGN = "NGN";

export const FEE_SCHOOL_KOBO = 500_000; // ₦5,000
export const FEE_VOEQ_KOBO = 20_000; // ₦200
export const FEE_TOTAL_KOBO = FEE_SCHOOL_KOBO + FEE_VOEQ_KOBO; // ₦5,200

export function assertMinor(n: number): number {
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`Amount must be a non-negative integer of kobo, got ${n}`);
  }
  return n;
}

/** 520000 → "₦5,200.00" */
export function formatNaira(minor: number): string {
  assertMinor(minor);
  const naira = minor / 100;
  return `₦${naira.toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** "₦5,200.00" | "5200" | "5,200.00" → 520000 (kobo). Rejects sub-kobo precision. */
export function parseNairaToMinor(input: string): number {
  const cleaned = input.replace(/[₦,\s]/g, "");
  const value = Number(cleaned);
  if (!Number.isFinite(value)) throw new Error(`Not a valid amount: ${input}`);
  const minor = Math.round(value * 100);
  if (Math.abs(value * 100 - minor) > 1e-9) {
    throw new Error(`Amount has sub-kobo precision: ${input}`);
  }
  return minor;
}
