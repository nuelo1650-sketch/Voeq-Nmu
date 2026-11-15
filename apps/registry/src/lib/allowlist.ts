// ---------------------------------------------------------------------------
// Staff allowlist (doc 07 §4.7). Admin access = Google OAuth ONLY, and the
// Google email must be on one of these two lists. The lists are the families:
// platform emails become Voeq-side accounts; register emails become Media
// Unit accounts. An email on neither list cannot sign in. An email on both
// is rejected — the families are mutually exclusive (doc 07 §4.6).
// ---------------------------------------------------------------------------

import type { AdminFamily } from "@voeq/core";

function parseList(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function familyForEmail(email: string): AdminFamily | null {
  const e = email.trim().toLowerCase();
  const platform = parseList(process.env.STAFF_ALLOWLIST_PLATFORM);
  const register = parseList(process.env.STAFF_ALLOWLIST_REGISTER);

  const inPlatform = platform.has(e);
  const inRegister = register.has(e);

  if (inPlatform && inRegister) return null; // never both families
  if (inPlatform) return "platform";
  if (inRegister) return "register";
  return null;
}

export function allowlistConfigured(): boolean {
  return Boolean(
    (process.env.STAFF_ALLOWLIST_PLATFORM ?? "").trim() ||
      (process.env.STAFF_ALLOWLIST_REGISTER ?? "").trim(),
  );
}
