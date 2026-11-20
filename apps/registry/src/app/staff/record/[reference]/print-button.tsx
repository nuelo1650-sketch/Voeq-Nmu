"use client";

// The print trigger — a client island on an otherwise server-rendered
// record. Prints via the browser (Ctrl+P prints too); "Save as PDF" in the
// same dialog is how a record becomes a local file.

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="bg-vq-forest px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 print:hidden"
    >
      ⎙ Print — or save as PDF
    </button>
  );
}
