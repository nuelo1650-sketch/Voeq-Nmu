// Getting data OUT of the register (Kai, 2026-11-20: "an easy way to take
// out data — downloadable, for printing or local saving"). CSV here, the
// printable dossier is a screen. The rules:
//   - Permission-gated like every desk door: applications CSV needs
//     applications.read, the ledger CSV needs ledger.read. A session alone
//     is never authority (lib/staff.ts's own rule).
//   - The CSV opens in Excel with double-clicking: header row, comma
//     separated, every field quoted, UTF-8 BOM so Excel reads the names
//     right, CRLF line endings (Excel's parser is picky).
//   - Money is written in NAIRA (decimal), never minor units — the register
//     never shows kobo to humans.

export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const cell = (v: string | number | null | undefined): string => {
    const s = v === null || v === undefined ? "" : String(v);
    // Quote everything; double any embedded quote. This also defuses the
    // classic CSV-injection trick (=SUM(...) opening in Excel as a formula).
    const guarded = /^[=+\-@]/.test(s) ? `'${s}` : s;
    return `"${guarded.replace(/"/g, '""')}"`;
  };
  const lines = [headers.map(cell).join(","), ...rows.map((r) => r.map(cell).join(","))];
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

export function csvResponse(filename: string, body: string): Response {
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

export function naira(minor: number | null | undefined): string {
  return ((minor ?? 0) / 100).toFixed(2);
}

export function stamp(date: Date | null | undefined): string {
  if (!date) return "";
  return date.toISOString().replace("T", " ").slice(0, 16) + " UTC";
}
