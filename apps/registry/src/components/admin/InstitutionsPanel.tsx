"use client";

// Institutions + campuses + categories management (4.1 / 4.2). One client
// component owning the whole section: create, rename, activate / deactivate,
// and the per-institution taxonomy. Guards the UI mirrors from the server:
// a campus or category with applications can never be deleted (the server
// refuses; the UI explains), only deactivated.

import { useState } from "react";
import {
  ActionFeedback,
  MonoButton,
  SectionHeading,
  StatusWord,
  TextInput,
  useAdminAction,
} from "./admin-client";

export interface AdminCampus {
  id: string;
  name: string;
  slug: string;
  isDefault: boolean;
  applicationCount: number;
}

export interface AdminCategory {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  active: boolean;
  applicationCount: number;
}

export interface AdminInstitution {
  id: string;
  name: string;
  slug: string;
  prefix: string;
  status: string;
  applicationCount: number;
  campuses: AdminCampus[];
  categories: AdminCategory[];
}

export function InstitutionsPanel({
  institutions,
  dev,
}: {
  institutions: AdminInstitution[];
  dev: boolean;
}) {
  const { run, busyOp, error, flash } = useAdminAction(dev);

  // create-institution form
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [prefix, setPrefix] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrefix, setEditPrefix] = useState("");

  // per-institution taxonomy forms
  const [campusFormFor, setCampusFormFor] = useState<string | null>(null);
  const [campusName, setCampusName] = useState("");
  const [campusSlug, setCampusSlug] = useState("");
  const [categoryFormFor, setCategoryFormFor] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [categorySlug, setCategorySlug] = useState("");

  const canCreate = name.trim().length >= 2 && /^[a-z0-9-]{2,40}$/.test(slug) && /^[A-Z0-9]{2,8}$/.test(prefix);

  return (
    <div className="space-y-8">
      <ActionFeedback error={error} flash={flash} />

      <section>
        <SectionHeading note={`${institutions.length} institution(s)`}>
          Institutions — the tenants
        </SectionHeading>

        {!showCreate ? (
          <div className="mt-3">
            <MonoButton onClick={() => setShowCreate(true)}>+ Add institution</MonoButton>
          </div>
        ) : (
          <div className="mt-3 border border-vq-forest/15 bg-white/70 px-4 py-3">
            <p className="text-sm text-vq-ink-muted">
              The prefix lands in every reference the institution ever issues —
              NMU-2026-0001. Choose it once, choose it well.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <TextInput value={name} onChange={setName} placeholder="Full name — e.g. Nigeria Maritime University" />
              <TextInput value={slug} onChange={setSlug} placeholder="slug — e.g. nmu" mono />
              <TextInput value={prefix} onChange={setPrefix} placeholder="reference prefix — e.g. NMU" mono />
            </div>
            <div className="mt-3 flex gap-2">
              <MonoButton
                tone="confirm"
                disabled={!canCreate || busyOp !== null}
                onClick={async () => {
                  const ok = await run(
                    { op: "institution.create", name: name.trim(), slug: slug.trim(), prefix: prefix.trim() },
                    "Institution created — add its campuses and categories below.",
                  );
                  if (ok) {
                    setShowCreate(false);
                    setName("");
                    setSlug("");
                    setPrefix("");
                  }
                }}
              >
                {busyOp === "institution.create" ? "Creating…" : "Create institution"}
              </MonoButton>
              <MonoButton onClick={() => setShowCreate(false)}>Cancel</MonoButton>
            </div>
          </div>
        )}

        <ul className="mt-4 space-y-6">
          {institutions.map((inst) => (
            <li key={inst.id} className="border border-vq-forest/15 bg-white/60">
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-vq-forest/10 px-4 py-3">
                <div>
                  <p className="font-display text-lg text-vq-forest-dark">{inst.name}</p>
                  <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-vq-ink-subtle">
                    slug {inst.slug} · prefix {inst.prefix} · {inst.applicationCount} applications
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusWord status={inst.status} />
                  {inst.status === "active" ? (
                    <MonoButton
                      tone="danger"
                      disabled={busyOp !== null}
                      onClick={() =>
                        run(
                          { op: "institution.update", id: inst.id, status: "suspended" },
                          "Deactivated — the application front door closes; the desk keeps working.",
                        )
                      }
                    >
                      Deactivate
                    </MonoButton>
                  ) : (
                    <MonoButton
                      tone="confirm"
                      disabled={busyOp !== null}
                      onClick={() =>
                        run(
                          { op: "institution.update", id: inst.id, status: "active" },
                          "Activated — applications open again.",
                        )
                      }
                    >
                      Activate
                    </MonoButton>
                  )}
                  <MonoButton
                    onClick={() => {
                      setEditingId(editingId === inst.id ? null : inst.id);
                      setEditName(inst.name);
                      setEditPrefix(inst.prefix);
                    }}
                  >
                    Rename
                  </MonoButton>
                </div>
              </div>

              {editingId === inst.id && (
                <div className="border-b border-vq-forest/10 bg-white/80 px-4 py-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <TextInput value={editName} onChange={setEditName} placeholder="Institution name" />
                    <TextInput value={editPrefix} onChange={setEditPrefix} placeholder="Reference prefix" mono />
                  </div>
                  <div className="mt-2">
                    <MonoButton
                      tone="confirm"
                      disabled={busyOp !== null || editName.trim().length < 2}
                      onClick={async () => {
                        const ok = await run(
                          {
                            op: "institution.update",
                            id: inst.id,
                            name: editName.trim(),
                            prefix: editPrefix.trim(),
                          },
                          "Institution updated.",
                        );
                        if (ok) setEditingId(null);
                      }}
                    >
                      Save
                    </MonoButton>
                  </div>
                </div>
              )}

              {/* campuses */}
              <div className="px-4 py-3">
                <SectionHeading note="the applicant's campus choice">Campuses</SectionHeading>
                <ul className="mt-2 divide-y divide-vq-forest/10 border border-vq-forest/10">
                  {inst.campuses.map((c) => (
                    <li key={c.id} className="flex items-baseline justify-between px-3 py-2">
                      <span className="text-sm text-vq-ink">
                        {c.name}{" "}
                        <span className="font-mono text-[11px] text-vq-ink-subtle">
                          {c.slug}
                          {c.isDefault ? " · default" : ""}
                        </span>
                      </span>
                      <span className="flex items-center gap-3">
                        <span className="font-mono text-[11px] text-vq-ink-subtle">{c.applicationCount}</span>
                        {!c.isDefault && (
                          <MonoButton
                            disabled={busyOp !== null}
                            onClick={() =>
                              run(
                                { op: "campus.update", id: c.id, isDefault: true },
                                `${c.name} is now the default campus.`,
                              )
                            }
                          >
                            Make default
                          </MonoButton>
                        )}
                        {c.applicationCount === 0 ? (
                          <MonoButton
                            tone="danger"
                            disabled={busyOp !== null}
                            onClick={() => run({ op: "campus.delete", id: c.id }, "Campus removed.")}
                          >
                            Remove
                          </MonoButton>
                        ) : (
                          <span
                            className="font-mono text-[10px] uppercase tracking-[0.1em] text-vq-ink-subtle"
                            title="Carries applications — history is never deleted"
                          >
                            locked
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
                {campusFormFor === inst.id ? (
                  <div className="mt-2 border border-vq-forest/15 bg-white/80 px-3 py-2">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <TextInput value={campusName} onChange={setCampusName} placeholder="Campus name — e.g. Okerenkoko" />
                      <TextInput value={campusSlug} onChange={setCampusSlug} placeholder="slug — e.g. nmu-okerenkoko" mono />
                    </div>
                    <div className="mt-2">
                      <MonoButton
                        tone="confirm"
                        disabled={busyOp !== null || campusName.trim().length < 2 || !/^[a-z0-9-]{2,40}$/.test(campusSlug)}
                        onClick={async () => {
                          const ok = await run(
                            {
                              op: "campus.create",
                              institutionId: inst.id,
                              name: campusName.trim(),
                              slug: campusSlug.trim(),
                            },
                            "Campus added.",
                          );
                          if (ok) {
                            setCampusFormFor(null);
                            setCampusName("");
                            setCampusSlug("");
                          }
                        }}
                      >
                        Add campus
                      </MonoButton>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2">
                    <MonoButton
                      onClick={() =>
                        setCampusFormFor(campusFormFor === inst.id ? null : inst.id)
                      }
                    >
                      + Add campus
                    </MonoButton>
                  </div>
                )}
              </div>

              {/* categories */}
              <div className="border-t border-vq-forest/10 px-4 py-3">
                <SectionHeading note="drives /apply and the voeq mapping">
                  Categories
                </SectionHeading>
                <ul className="mt-2 divide-y divide-vq-forest/10 border border-vq-forest/10">
                  {inst.categories.map((cat) => (
                    <li key={cat.id} className="flex items-baseline justify-between px-3 py-2">
                      <span className="text-sm text-vq-ink">
                        {cat.name}{" "}
                        <span className="font-mono text-[11px] text-vq-ink-subtle">
                          {cat.slug} · order {cat.sortOrder}
                        </span>
                      </span>
                      <span className="flex items-center gap-3">
                        <span className="font-mono text-[11px] text-vq-ink-subtle">{cat.applicationCount}</span>
                        <MonoButton
                          disabled={busyOp !== null}
                          onClick={() =>
                            run(
                              { op: "category.update", id: cat.id, active: !cat.active },
                              cat.active ? `${cat.name} hidden from the form.` : `${cat.name} is back on the form.`,
                            )
                          }
                        >
                          {cat.active ? "Hide" : "Show"}
                        </MonoButton>
                        {cat.applicationCount === 0 && (
                          <MonoButton
                            tone="danger"
                            disabled={busyOp !== null}
                            onClick={() => run({ op: "category.delete", id: cat.id }, "Category removed.")}
                          >
                            Remove
                          </MonoButton>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
                {categoryFormFor === inst.id ? (
                  <div className="mt-2 border border-vq-forest/15 bg-white/80 px-3 py-2">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <TextInput value={categoryName} onChange={setCategoryName} placeholder="Category name — e.g. Food and Drinks" />
                      <TextInput value={categorySlug} onChange={setCategorySlug} placeholder="slug — e.g. food-and-drinks" mono />
                    </div>
                    <div className="mt-2">
                      <MonoButton
                        tone="confirm"
                        disabled={busyOp !== null || categoryName.trim().length < 2 || !/^[a-z0-9-]{2,40}$/.test(categorySlug)}
                        onClick={async () => {
                          const ok = await run(
                            {
                              op: "category.create",
                              institutionId: inst.id,
                              name: categoryName.trim(),
                              slug: categorySlug.trim(),
                            },
                            "Category added.",
                          );
                          if (ok) {
                            setCategoryFormFor(null);
                            setCategoryName("");
                            setCategorySlug("");
                          }
                        }}
                      >
                        Add category
                      </MonoButton>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2">
                    <MonoButton
                      onClick={() =>
                        setCategoryFormFor(categoryFormFor === inst.id ? null : inst.id)
                      }
                    >
                      + Add category
                    </MonoButton>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
