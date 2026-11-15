// ---------------------------------------------------------------------------
// The register desk — Phase 0 placeholder. Proves the gate: OAuth-only
// sign-in resolves the staff account and its family. The working dashboard
// (queue, review workbench, fee ledger) arrives in Phases 1–2.
// ---------------------------------------------------------------------------

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function StaffHome() {
  const session = await auth();
  if (!session?.user) redirect("/staff/signin");

  const family = session.user.family;

  return (
    <main className="mx-auto max-w-2xl px-6 py-20">
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-vq-amber-dark">
        The register desk
      </p>
      <h1 className="mt-3 font-display text-3xl text-vq-forest-dark">
        Signed in as {session.user.email}
      </h1>
      <div className="mt-6 rounded-2xl border border-vq-forest/10 bg-white p-6 shadow-sm">
        <p className="text-sm text-vq-ink-muted">
          Admin family:{" "}
          <span className="font-semibold text-vq-forest">{family ?? "unresolved"}</span>
        </p>
        <p className="mt-2 text-sm text-vq-ink-muted">
          Account: <span className="font-mono text-xs">{session.user.staffAccountId ?? "pending"}</span>
        </p>
        <p className="mt-4 text-sm text-vq-ink-muted">
          Phase 0 gate satisfied: Google-OAuth-only sign-in, allowlist enforced,
          family resolved. The work queue, review workbench and fee ledger are
          built in Phases 1–2 — and {family === "register" ? "you will work them" : "you will administer them"}.
        </p>
      </div>
    </main>
  );
}
