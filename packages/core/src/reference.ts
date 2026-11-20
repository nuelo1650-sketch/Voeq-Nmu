// ---------------------------------------------------------------------------
// References — NMU-2026-0001. Issued per institution per year.
// The reference IS the payment code (doc 07 §2.6): the student writes it as
// the transfer narration, and it is what makes every credit traceable to
// exactly one application.
// ---------------------------------------------------------------------------

const REFERENCE_PATTERN = /^([A-Z]{2,6})-(\d{4})-(\d+)$/; // seq is 4-padded when issued; parsing is lenient

// The register lives on Nigerian time. The server runs UTC (Vercel), so a
// submission at 00:30 Lagos time on 1 January would otherwise be stamped with
// the previous year. Every year-bearing code derives from this.
export function registryYear(now: Date = new Date()): number {
  const year = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
  }).format(now);
  return Number(year);
}

export function formatReference(prefix: string, year: number, seq: number): string {
  return `${prefix}-${year}-${String(seq).padStart(4, "0")}`;
}

// The certificate code — NMU-REG-2026-0001 — the permanent identifier of a
// REGISTERED business. It shares the application's per-year sequence, so it
// is unique by construction and year-aware for free: 2027 issues
// NMU-REG-2027-0001 without any change here.
export function formatCertificateCode(prefix: string, year: number, seq: number): string {
  return `${prefix}-REG-${year}-${String(seq).padStart(4, "0")}`;
}

export function parseCertificateCode(code: string): { prefix: string; year: number; seq: number } | null {
  const m = /^([A-Z0-9]{2,8})-REG-(\d{4})-(\d+)$/i.exec(code.trim().toUpperCase());
  const [, prefix, yearStr, seqStr] = m ?? [];
  if (!prefix || !yearStr || !seqStr) return null;
  return { prefix, year: Number(yearStr), seq: Number(seqStr) };
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
