// ---------------------------------------------------------------------------
// References — NMU-2026-0001. Issued per institution per year.
// The reference IS the payment code (doc 07 §2.6): the student writes it as
// the transfer narration, and it is what makes every credit traceable to
// exactly one application.
// ---------------------------------------------------------------------------

const REFERENCE_PATTERN = /^([A-Z]{2,6})-(\d{4})-(\d+)$/; // seq is 4-padded when issued; parsing is lenient

export function formatReference(prefix: string, year: number, seq: number): string {
  return `${prefix}-${year}-${String(seq).padStart(4, "0")}`;
}

export function parseReference(reference: string): { prefix: string; year: number; seq: number } | null {
  const m = REFERENCE_PATTERN.exec(reference.trim().toUpperCase());
  if (!m) return null;
  const [, prefix, yearStr, seqStr] = m;
  if (!prefix || !yearStr || !seqStr) return null;
  return { prefix, year: Number(yearStr), seq: Number(seqStr) };
}

/** Best-effort extraction of a register reference from a bank narration. */
export function extractReferenceFromNarration(narration: string): string | null {
  const m = /([A-Z]{2,6}-\d{4}-\d{4,})/.exec(narration.toUpperCase());
  return m?.[1] ?? null;
}
