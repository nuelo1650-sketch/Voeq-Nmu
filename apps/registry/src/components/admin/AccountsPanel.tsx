"use client";

// Staff accounts + the permission matrix (4.3 / 4.4 / 4.5). Accounts are
// Google emails — never passwords. A register-family account is born assigned
// to one institution (no picker at login, spec §13.2); platform accounts
// belong to Voeq. Grants follow the family rule from @voeq/core: an account
// never holds a permission its family cannot hold, and the server refuses
// before the UI is even consulted.

import { useState } from "react";
import {
  ActionFeedback,
  MonoButton,
  SectionHeading,
  StatusWord,
  TextInput,
  useAdminAction,
} from "./admin-client";

export interface AdminGrant {
  permissionKey: string;
  grantedAt: string;
  grantedByEmail: string;
  revokedAt: string | null;
}

export interface AdminAccount {
  id: string;
  email: string;
  name: string | null;
  family: "platform" | "register";
  status: string;
  institutionName: string | null;
  lastLoginAt: string | null;
  grants: AdminGrant[];
}

export interface PermissionMeta {
  key: string;
  family: "platform" | "register" | "shared";
}

const PERMISSION_NOTES: Record<string, string> = {
  "institutions.manage": "create and edit institutions, campuses, activation",
  "institutions.read": "see the institution list",
  "categories.manage": "edit the category lists applicants choose from",
  "fee-schedule.manage": "version the ₦5,000 / ₦200 split",
  "staff.grant": "create accounts and hand out permissions",
  "staff.revoke": "take permissions back",
  "integrations.manage": "retry vendor sync, manage the voeq.ng link",
  "monitoring.read": "see the system-health strip and reports",
  "audit.read": "read the audit chain",
  "periods.close": "close a reporting period",
  "applications.read": "see the work queue and dossiers",
  "applications.decide": "approve / reject / suspend / close",
  "applications.request-corrections": "request corrections from applicants",
  "ledger.import": "import bank statement CSVs",
  "ledger.stage-match": "stage a match for the checker",
  "ledger.confirm-fee": "confirm a staged fee — the checker's action",
  "ledger.write-off": "write off a staged allocation",
  "ledger.read": "read the fee ledger",
  "directory.read": "see the public register",
};

export function AccountsPanel({
  accounts,
  permissions,
  institutions,
  dev,
}: {
  accounts: AdminAccount[];
  permissions: PermissionMeta[];
  institutions: { id: string; name: string }[];
  dev: boolean;
}) {
  const { run, busyOp, error, flash } = useAdminAction(dev);

  const [showCreate, setShowCreate] = useState(false);
  const [email, setEmail] = useState("");
  const [accName, setAccName] = useState("");
  const [family, setFamily] = useState<"platform" | "register">("register");
  const [institutionId, setInstitutionId] = useState<string>(
    institutions[0]?.id ?? "",
  );

  const [grantsFor, setGrantsFor] = useState<string | null>(null);

  const canCreate = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) && (family === "platform" || institutionId !== "");

  async function applyPreset(
    acc: AdminAccount,
    preset: "reviewer" | "money" | "full" | "none",
  ) {
    const holdable = permissions.filter(
      (p) => acc.family === "platform" || p.family !== "platform",
    );
    const targets: string[] =
      preset === "reviewer"
        ? ["applications.read", "applications.decide", "applications.request-corrections", "ledger.read", "directory.read"]
        : preset === "money"
          ? ["applications.read", "ledger.read", "directory.read"]
          : preset === "full"
            ? holdable.map((p) => p.key)
            : [];
    const current = acc.grants.filter((g) => !g.revokedAt).map((g) => g.permissionKey);
    const toGrant = targets.filter((k) => !current.includes(k));
    const toRevoke =
      preset === "none"
        ? current
        : current.filter((k) => !targets.includes(k) && holdable.some((p) => p.key === k));

    for (const key of toGrant) {
      await run({ op: "grant.set", accountId: acc.id, permissionKey: key, granted: true }, "");
    }
    for (const key of toRevoke) {
      await run({ op: "grant.set", accountId: acc.id, permissionKey: key, granted: false }, "");
    }
    const label =
      preset === "none" ? "all permissions cleared" : `preset applied — ${targets.length} permissions`;
    await run({ op: "account.update", id: acc.id, status: acc.status }, `${acc.email}: ${label}.`);
  }

  return (
    <div className="space-y-8">
      <ActionFeedback error={error} flash={flash} />

      <section>
        <SectionHeading note={`${accounts.length} account(s)`}>
          Staff accounts — Google emails, never passwords
        </SectionHeading>

        <p className="mt-2 border border-vq-forest/20 bg-white px-4 py-2.5 text-sm leading-relaxed text-vq-ink-muted">
          <b className="text-vq-forest-dark">Adding someone takes three steps, all here:</b>{" "}
          1 · create their account below · 2 · open <b>Permissions</b> and hand out exactly what
          their role needs · 3 · <b>Activate</b>. Then they just sign in with that Google email —
          no server settings to touch.
        </p>

        {!showCreate ? (
          <div className="mt-3">
            <MonoButton onClick={() => setShowCreate(true)}>+ Add account</MonoButton>
          </div>
        ) : (
          <div className="mt-3 border border-vq-forest/15 bg-white/70 px-4 py-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-vq-ink-subtle">
                  1 · Their Google email
                </span>
                <TextInput value={email} onChange={setEmail} placeholder="name@gmail.com" mono />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-vq-ink-subtle">
                  Their name (optional)
                </span>
                <TextInput value={accName} onChange={setAccName} placeholder="e.g. Daniel Owi" />
              </label>
            </div>
            <div className="mt-3">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-vq-ink-subtle">
                2 · Which desk do they sit at?
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {(["register", "platform"] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFamily(f)}
                    className={`px-4 py-2 text-xs font-bold transition ${
                      family === f
                        ? "bg-vq-forest text-white"
                        : "border border-vq-forest/20 bg-white text-vq-forest hover:border-vq-forest/50"
                    }`}
                  >
                    {f === "register" ? "Media Unit desk (workbench)" : "Platform console (admin)"}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-vq-ink-subtle">
                {family === "register"
                  ? "The daily register work: review queue, decisions, the fee ledger."
                  : "Governance: institutions, accounts, audit chain. A platform account can also be given workbench powers below."}
              </p>
            </div>
            {family === "register" && institutions.length > 0 && (
              <label className="mt-3 block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-vq-ink-subtle">
                  Their institution
                </span>
                <select
                  value={institutionId}
                  onChange={(e) => setInstitutionId(e.target.value)}
                  className="border border-vq-forest/20 bg-white px-3 py-2 text-sm text-vq-ink focus:border-vq-forest focus:outline-none"
                >
                  {institutions.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <p className="mt-3 text-xs text-vq-ink-subtle">
              New accounts start suspended — nothing moves until you Activate. After creating, open
              <b> Permissions</b> to hand out exactly what they need.
            </p>
            <div className="mt-3 flex gap-2">
              <MonoButton
                tone="confirm"
                disabled={!canCreate || busyOp !== null}
                onClick={async () => {
                  const ok = await run(
                    {
                      op: "account.create",
                      email: email.trim(),
                      name: accName.trim() || undefined,
                      family,
                      institutionId: family === "register" ? institutionId : null,
                    },
                    "Account created, suspended. Open Permissions to give them their powers, then Activate.",
                  );
                  if (ok) {
                    setShowCreate(false);
                    setEmail("");
                    setAccName("");
                  }
                }}
              >
                {busyOp === "account.create" ? "Creating…" : "Create account"}
              </MonoButton>
              <MonoButton onClick={() => setShowCreate(false)}>Cancel</MonoButton>
            </div>
          </div>
        )}

        <ul className="mt-4 space-y-4">
          {accounts.map((acc) => {
            const openGrants = acc.grants.filter((g) => !g.revokedAt);
            const showGrants = grantsFor === acc.id;
            return (
              <li key={acc.id} className="border border-vq-forest/15 bg-white/60">
                <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3">
                  <div>
                    <p className="text-sm text-vq-ink">
                      {acc.email}
                      {acc.name ? ` — ${acc.name}` : ""}
                    </p>
                    <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-vq-ink-subtle">
                      {acc.family === "platform"
                        ? "Voeq platform"
                        : `register · ${acc.institutionName ?? "unassigned"}`}
                      {" · "}
                      {openGrants.length} permission{openGrants.length === 1 ? "" : "s"}
                      {acc.lastLoginAt
                        ? ` · last sign-in ${new Date(acc.lastLoginAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`
                        : " · never signed in"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusWord status={acc.status} />
                    {acc.status !== "active" ? (
                      <MonoButton
                        tone="confirm"
                        disabled={busyOp !== null}
                        onClick={() => run({ op: "account.update", id: acc.id, status: "active" }, `${acc.email} activated.`)}
                      >
                        Activate
                      </MonoButton>
                    ) : (
                      <MonoButton
                        tone="danger"
                        disabled={busyOp !== null}
                        onClick={() =>
                          run(
                            { op: "account.update", id: acc.id, status: "disabled" },
                            `${acc.email} disabled — every permission is now dead weight.`,
                          )
                        }
                      >
                        Disable
                      </MonoButton>
                    )}
                    <MonoButton onClick={() => setGrantsFor(showGrants ? null : acc.id)}>
                      Permissions
                    </MonoButton>
                  </div>
                </div>

                {showGrants && (
                  <div className="border-t border-vq-forest/10 px-4 py-3">
                    <SectionHeading note="one-way wall: platform may hold everything, register never touches platform">
                      Permission matrix — hand out exactly the role
                    </SectionHeading>

                    {/* role presets — one click sets a coherent set of grants.
                        Kai: promoting someone to "workbench or admin" only was
                        too coarse; these cover the real shapes of a role. */}
                    <div className="mt-2 flex flex-wrap gap-2">
                      <MonoButton
                        disabled={busyOp !== null}
                        onClick={() => applyPreset(acc, "reviewer")}
                      >
                        Preset · Reviewer (full desk)
                      </MonoButton>
                      <MonoButton
                        disabled={busyOp !== null}
                        onClick={() => applyPreset(acc, "money")}
                      >
                        Preset · See the money only
                      </MonoButton>
                      <MonoButton
                        disabled={busyOp !== null}
                        onClick={() => applyPreset(acc, "full")}
                      >
                        Preset · Everything
                      </MonoButton>
                      <MonoButton
                        tone="danger"
                        disabled={busyOp !== null || openGrants.length === 0}
                        onClick={() => applyPreset(acc, "none")}
                      >
                        Clear all
                      </MonoButton>
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-vq-ink-subtle">
                      Reviewer = read the queue, decide, request corrections. See the money only = the
                      ledger and the directory, nothing else — cannot promote, demote, or decide. Every
                      change here is audited.
                    </p>

                    <ul className="mt-3 divide-y divide-vq-forest/10 border border-vq-forest/10">
                      {permissions.map((perm) => {
                        const holds = !!(openGrants.find((g) => g.permissionKey === perm.key));
                        // One-way wall (Kai's superuser model): platform accounts
                        // may hold every permission; register accounts never hold
                        // platform keys.
                        const canHoldThis = acc.family === "platform" || perm.family !== "platform";
                        return (
                          <li
                            key={perm.key}
                            className={`flex items-baseline justify-between gap-2 px-3 py-2 ${
                              canHoldThis ? "" : "opacity-40"
                            }`}
                          >
                            <span>
                              <span className="font-mono text-xs text-vq-ink">{perm.key}</span>
                              <span className="ml-2 text-xs text-vq-ink-subtle">
                                {PERMISSION_NOTES[perm.key] ?? ""}
                              </span>
                            </span>
                            {holds ? (
                              <MonoButton
                                tone="danger"
                                disabled={busyOp !== null}
                                onClick={() =>
                                  run(
                                    { op: "grant.set", accountId: acc.id, permissionKey: perm.key, granted: false },
                                    `${perm.key} taken back from ${acc.email}.`,
                                  )
                                }
                              >
                                Revoke
                              </MonoButton>
                            ) : (
                              <MonoButton
                                disabled={busyOp !== null || !canHoldThis}
                                title={canHoldThis ? undefined : "Register accounts never hold platform powers"}
                                onClick={() =>
                                  run(
                                    { op: "grant.set", accountId: acc.id, permissionKey: perm.key, granted: true },
                                    `${perm.key} granted to ${acc.email}.`,
                                  )
                                }
                              >
                                Grant
                              </MonoButton>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
