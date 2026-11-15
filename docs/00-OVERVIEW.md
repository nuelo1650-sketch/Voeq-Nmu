# Voeq Registry — NMU Business Registration, Verification & Management System

This repository is the implementation of the **Voeq × Nigeria Maritime University
(Media Department)** business registration system.

It is a **separate repository** from the `voeq.ng` marketplace, deployed
separately, with its own database — but bound to the same brand, the same design
tokens, and the same identity. It is *connected*, not *disconnected*: see
`docs/03-API-CONTRACT.md`.

---

## What it does

A business in the NMU community applies online. The Media Department reviews
the application and decides. Approved businesses receive payment instructions.
Applicants upload payment evidence. An authorised verifier confirms payment.
Registered businesses land in the NMU business directory and get linked to their
Voeq marketplace profile.

The Media Department retains **all** authority over who qualifies. This system
provides infrastructure and records decisions; it never makes them.

---

## Document map

| Document | Purpose |
| --- | --- |
| `docs/spec/` | The original specification (source of truth for requirements) |
| `docs/00-OVERVIEW.md` | Scope, actors, system rules (this file's long-form sibling) |
| `docs/01-ARCHITECTURE.md` | Topology, deployment, domains, security model |
| `docs/02-DATA-MODEL.md` | Entities, relationships, status state machines, guards |
| `docs/03-API-CONTRACT.md` | HTTP surface + the voeq.ng integration contract |
| `docs/04-DESIGN-SYSTEM.md` | Tokens, UI rules, component inventory |
| `docs/05-ROADMAP.md` | Phases, milestones, definition of done |
| `docs/06-OPEN-QUESTIONS.md` | Decisions needed before build (spec §21 + findings) |

---

## Repository layout

```
voeq-registry/
├── apps/
│   └── registry/              # Next.js 15 app — the single deployable unit
├── packages/
│   ├── design-system/         # @voeq/design-system — shared tokens & primitives
│   ├── db/                    # Prisma schema, migrations, seed
│   ├── core/                  # Domain: state machine, permissions, schemas
│   └── email/                 # React Email templates + send adapter
├── docs/                      # This documentation set
└── tooling/                   # Local scripts (seed, seed-mmu, import)
```

The `apps/registry` app hosts **all** surfaces behind one deployment:

| Host | Path | Audience |
| --- | --- | --- |
| `register.voeq.ng` | `/` | Public — apply, track, directory |
| `register.voeq.ng` | `/media` | Media Department reviewers |
| `register.voeq.ng` | `/admin` | Voeq Super Admin |
| `verify.voeq.ng` | `/media`, `/admin` | Alias of the above (see ADR-002) |

---

## Tech stack

| Concern | Choice | Why |
| --- | --- | --- |
| Framework | Next.js 15 (App Router), React 19, TypeScript strict | Identical to voeq.ng — shared components port without translation |
| Styling | Tailwind CSS v4 (`@theme`) | Identical to voeq.ng; `@theme` maps 1:1 onto the token package |
| Database | PostgreSQL 16 + Prisma | Relational integrity for application/audit/payment graphs; enums map cleanly onto the spec's status lists |
| Queue | `pg-boss` (Postgres-backed) | No new infrastructure; retries and cron out of the box; shares the transaction boundary with the DB |
| Email | Resend + React Email | Template-as-code, version-controlled, webhook for delivery status |
| Object storage (private) | Cloudflare R2 (S3-compatible) | Private bucket with presigned URLs; no egress cost |
| Image hosting (public) | Cloudinary (`voeq/` folder) | **The marketplace already uses this account** — approved business images land in the same pipeline |
| Auth | Custom (argon2id + TOTP) | Applicant access is magic-link/OTP, not password; a full auth framework adds weight without value |
| Validation | Zod | One schema, shared client + server |

---

## Non-negotiable system rules

These are encoded in `packages/core` as guards, not left to UI discipline.
They map to spec §19.

1. **Approval is not registration.** An application reaches `registered` only
   after every required payment component is `payment_confirmed`.
2. **Receipt upload is not payment confirmation.** Uploading evidence sets
   `payment_status` to `awaiting_confirmation` — never `payment_confirmed`.
3. **A reference number grants nothing.** Applicant access requires an opaque
   single-use token (or OTP). The reference is for humans, not for auth.
4. **Corrections reuse the application.** Same reference number, new revision,
   full history preserved. Corrections never create a second application.
5. **No duplicate business accounts.** Linking to an existing Voeq vendor is
   idempotent on `reference`.
6. **Reviewers see one institution.** Enforced in the data-access layer by
   scoping every query to the session's `institution_id` — never by trusting
   a filter from the client.
7. **Failed notifications never lose data.** All sends go through a
   transactional outbox; a mail outage cannot roll back or block an application.
8. **Private stays private.** Applicant identity, receipts and internal notes
   are never exposed on a public profile, and documents are never served from
   an unrestricted URL.
