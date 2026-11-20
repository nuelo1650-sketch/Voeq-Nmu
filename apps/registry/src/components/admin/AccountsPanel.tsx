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
  // The one-flow creation: the role card IS the setup. It decides the desk
  // (full/admin → platform, workbench/money → register), the grant set and
  // the active state — one server op, one audit row.
  const [role, setRole] = useState<"full" | "admin" | "workbench" | "money">("workbench");
  const [institutionId, setInstitutionId] = useState<string>(
    institutions[0]?.id ?? "",
  );

  const [grantsFor, setGrantsFor] = useState<string | null>(null);

  const canCreate = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) && (role === "full" || role === "admin" || institutionId !== "");

  const ROLE_NAMES: Record<"full" | "admin" | "workbench" | "money", string> = {
    full: "full access — admin and workbench",
    admin: "admin only",
    workbench: "workbench",
    money: "see the money only",
  };

  // The four plain-language roles (Kai: "I want easy stuffs"). One click
  // sets a coherent, complete grant set — no key-hunting. Fine-tuning stays
  // below under "Advanced", closed by default.
  const WORKBENCH_KEYS = [
    "applications.read",
    "applications.decide",
    "applications.request-corrections",
    "ledger.read",
    "ledger.import",
    "ledger.stage-match",
    "ledger.confirm-fee",
    "ledger.write-off",
    "directory.read",
  ];
  const MONEY_KEYS = ["applications.read", "ledger.read", "directory.read"];

  function roleLabel(acc: AdminAccount): string {
    const held = acc.grants.filter((g) => !g.revokedAt).map((g) => g.permissionKey);
    if (held.length === 0) return "no powers yet";
    const hasPlatform = held.some((k) => k !== "directory.read" && !WORKBENCH_KEYS.includes(k));
    const hasDesk = held.some(
      (k) =>
        k === "applications.decide" ||
        k === "ledger.import" ||
        k === "ledger.stage-match" ||
        k === "ledger.confirm-fee" ||
        k === "ledger.write-off",
    );
    if (hasPlatform && hasDesk) return "full access";
    if (hasPlatform) return "admin";
    if (held.includes("applications.decide")) return "workbench";
    if (MONEY_KEYS.every((k) => held.includes(k))) return "see the money only";
    return "custom set";
  }

  async function applyRole(
    acc: AdminAccount,
    role: "full" | "admin" | "workbench" | "money" | "none",
  ) {
    // An admin-shaped role on a register-family account first MOVES the
    // account to the platform desk (Kai: the role cards must never be a
    // dead-end — the email is unique, so "create another account" was
    // impossible advice). Moving up is always safe; the institution
    // assignment falls away with the desk.
    const needsPlatform = (role === "full" || role === "admin") && acc.family !== "platform";
    const targetFamily = role === "full" || role === "admin" ? "platform" : acc.family;
    const holdable = permissions.filter(
      (p) => targetFamily === "platform" || p.family !== "platform",
    );
    const targets: string[] =
      role === "workbench"
        ? WORKBENCH_KEYS
        : role === "money"
          ? MONEY_KEYS
          : role === "admin"
            ? permissions.filter((p) => p.family === "platform").map((p) => p.key)
            : role === "full"
              ? holdable.map((p) => p.key)
              : [];
    const current = acc.grants.filter((g) => !g.revokedAt).map((g) => g.permissionKey);
    const toGrant = targets.filter((k) => !current.includes(k));
    const toRevoke =
      role === "none"
        ? current
        : current.filter((k) => !targets.includes(k) && holdable.some((p) => p.key === k));

    if (needsPlatform) {
      const moved = await run(
        { op: "account.update", id: acc.id, family: "platform", institutionId: null },
        "",
      );
      if (!moved) return;
    }
    for (const key of toGrant) {
      await run({ op: "grant.set", accountId: acc.id, permissionKey: key, granted: true }, "");
    }
    for (const key of toRevoke) {
      await run({ op: "grant.set", accountId: acc.id, permissionKey: key, granted: false }, "");
    }
    const label =
      role === "none"
        ? "all permissions cleared"
        : role === "full"
          ? "full access — admin and workbench"
          : role === "admin"
            ? "admin only"
            : role === "workbench"
              ? "workbench"
              : "see the money only";
    const moveNote = needsPlatform ? " Desk moved to Voeq platform." : "";
    await run(
      { op: "account.update", id: acc.id, status: acc.status },
      `${acc.email}: now ${label}.${moveNote} Every step audited.`,
    );
  }

  return (
    <div className="space-y-8">
      <ActionFeedback error={error} flash={flash} />

      <section>
        <SectionHeading note={`${accounts.length} account(s)`}>
          Staff accounts — Google emails, never passwords
        </SectionHeading>

        <p className="mt-2 border border-vq-forest/20 bg-white px-4 py-2.5 text-sm leading-relaxed text-vq-ink-muted">
          <b className="text-vq-forest-dark">Adding someone takes one step, here:</b>{" "}
          their Google email, then a role card below. The account is created powered and
          active — they just sign in with that email and start. No server settings, no
          permission hunting.
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
                2 · What will they do? One card, that&apos;s the whole setup.
              </span>
              <div className="grid gap-2 sm:grid-cols-2">
                {(
                  [
                    {
                      key: "full" as const,
                      title: "Full access — admin + workbench",
                      desc: "Everything: the admin console AND the register desk. For a trusted co-owner.",
                    },
                    {
                      key: "admin" as const,
                      title: "Admin only",
                      desc: "The admin console: institutions, accounts, audit. No application decisions.",
                    },
                    {
                      key: "workbench" as const,
                      title: "Workbench only",
                      desc: "The register desk: review, decide, request corrections, confirm fees.",
                    },
                    {
                      key: "money" as const,
                      title: "See the money only",
                      desc: "Read the queue and the ledger. Cannot decide, promote, or demote anyone.",
                    },
                  ] as const
                ).map((r) => (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => setRole(r.key)}
                    className={`border px-3 py-2.5 text-left transition ${
                      role === r.key
                        ? "border-vq-forest bg-vq-forest text-white"
                        : "border-vq-forest/25 bg-white text-vq-ink hover:border-vq-forest"
                    }`}
                  >
                    <span className="block text-sm font-bold">{r.title}</span>
                    <span
                      className={`mt-0.5 block text-xs leading-snug ${
                        role === r.key ? "text-white/80" : "text-vq-ink-muted"
                      }`}
                    >
                      {r.desc}
                    </span>
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-vq-ink-subtle">
                {role === "full" || role === "admin"
                  ? "This role sits at the Voeq platform desk — no institution assignment needed."
                  : "This role sits at the Media Unit desk — pick their institution below."}
              </p>
            </div>
            {(role === "workbench" || role === "money") && institutions.length > 0 && (
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
                      role,
                      institutionId: role === "workbench" || role === "money" ? institutionId : null,
                      activate: true,
                    },
                    `${email.trim()} is live with the "${ROLE_NAMES[role]}" role — they can sign in now.`,
                  );
                  if (ok) {
                    setShowCreate(false);
                    setEmail("");
                    setAccName("");
                  }
                }}
              >
                {busyOp === "account.create" ? "Creating…" : "Create — powered and active"}
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
                      <b className="text-vq-forest-dark">{roleLabel(acc)}</b>
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
                      Set role
                    </MonoButton>
                  </div>
                </div>

                {showGrants && (
                  <div className="border-t border-vq-forest/10 px-4 py-3">
                    <SectionHeading note={`now: ${roleLabel(acc)}`}>
                      Set a role — one click, done
                    </SectionHeading>

                    {/* The four plain-language roles. The current one is lit;
                        clicking any card replaces ALL grants with that role.
                        Kai: "full access, workbench, admin, or both" — exactly. */}
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {(
                        [
                          {
                            key: "full" as const,
                            title: "Full access — admin + workbench",
                            desc: "Everything: the admin console AND the register desk. For a trusted co-owner.",
                            adminShaped: true,
                          },
                          {
                            key: "admin" as const,
                            title: "Admin only",
                            desc: "The admin console: institutions, accounts, audit. No application decisions.",
                            adminShaped: true,
                          },
                          {
                            key: "workbench" as const,
                            title: "Workbench only",
                            desc: "The register desk: review, decide, request corrections, confirm fees.",
                            adminShaped: false,
                          },
                          {
                            key: "money" as const,
                            title: "See the money only",
                            desc: "Read the queue and the ledger. Cannot decide, promote, or demote anyone.",
                            adminShaped: false,
                          },
                        ]
                      ).map((r) => {
                        const current = roleLabel(acc);
                        const isCurrent =
                          (r.key === "full" && current === "full access") ||
                          (r.key === "admin" && current === "admin") ||
                          (r.key === "workbench" && current === "workbench") ||
                          (r.key === "money" && current === "see the money only");
                        const desc =
                          r.adminShaped && acc.family !== "platform"
                            ? "Clicking moves this account to the platform desk first, then applies the role."
                            : r.desc;
                        return (
                          <button
                            key={r.key}
                            type="button"
                            disabled={busyOp !== null}
                            onClick={() => applyRole(acc, r.key)}
                            className={`border px-3 py-2.5 text-left transition ${
                              isCurrent
                                ? "border-vq-forest bg-vq-forest text-white"
                                : "border-vq-forest/25 bg-white text-vq-ink hover:border-vq-forest"
                            }`}
                          >
                            <span className="block text-sm font-bold">{r.title}</span>
                            <span
                              className={`mt-0.5 block text-xs leading-snug ${
                                isCurrent ? "text-white/80" : "text-vq-ink-muted"
                              }`}
                            >
                              {desc}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <p className="text-xs leading-relaxed text-vq-ink-subtle">
                        Clicking a card <b>replaces</b> the account&apos;s whole permission set with that role.
                        Every change is audited.
                      </p>
                      <MonoButton
                        tone="danger"
                        disabled={busyOp !== null || openGrants.length === 0}
                        onClick={() => applyRole(acc, "none")}
                      >
                        Remove all powers
                      </MonoButton>
                    </div>

                    {/* fine-tuning stays for the odd case; closed by default */}
                    <details className="mt-3 border border-vq-forest/10 bg-white/70">
                      <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-vq-forest">
                        Advanced — hand out individual permissions
                      </summary>
                      <ul className="divide-y divide-vq-forest/10 border-t border-vq-forest/10">
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
                    </details>
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
