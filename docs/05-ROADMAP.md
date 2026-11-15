# Roadmap

Mapped to spec §20. The spec's four phases are correct in order; this document
adds the milestone gates, the sequencing dependencies between them, and the
work that the spec implies but doesn't name.

**Indicative, not a commitment.** Durations assume one engineer with design
support. The critical path runs through the §21 decisions — Phase 2 cannot
start until the payment model is agreed.

---

## Phase 0 — Foundation (before Phase 1)

Not in the spec. Necessary because the spec's Phase 1 assumes a platform
exists.

| # | Deliverable | Why |
| --- | --- | --- |
| 0.1 | Repo skeleton: `apps/registry`, `packages/{design-system,db,core,email}` | — |
| 0.2 | `@voeq/design-system` tokens + primitives, ported from voeq.ng | Visual continuity with the marketplace |
| 0.3 | Prisma schema + migrations for all 15 core tables | §18 |
| 0.4 | Auth foundation: argon2id, sessions, TOTP, RBAC + permission matrix | §3, §13.3 |
| 0.5 | Outbox + `pg-boss` worker + Resend adapter | §15, §19 |
| 0.6 | R2 private bucket, upload validation pipeline, signed-URL service | §17 |
| 0.7 | `packages/core`: state machines, guards, Zod schemas | §14, §19 |
| 0.8 | Audit log writer with append-only DB grants | §16 |
| 0.9 | Seed: NMU institution, 2 campuses, category list + mapping, fee config | §4.2, §7.3 |
| 0.10 | CI: lint, typecheck, unit tests, migration check, build | — |

**Gate:** an empty application runs locally, an admin can log in, the
permission matrix resolves, and an audit row can be written and cannot be
updated.

---

## Phase 1 — Core registration system (spec §20 Phase 1)

*Goal: a business can apply; the Media Department can review and decide.*

| # | Deliverable | Spec |
| --- | --- | --- |
| 1.1 | Public landing page (cream env) | §2.1 |
| 1.2 | Six-section form, five steps + review, autosave, client-side compression | §4 |
| 1.3 | Draft tokens — no vendor account needed | §5.3 |
| 1.4 | Reference generation `NMU-2026-0001` (per-institution sequence) | §5.2 |
| 1.5 | Applicant access: magic link + OTP fallback | §5.3 |
| 1.6 | File uploads: validation, progress, retry | §4.4 |
| 1.7 | Declaration + consent capture with evidence | §4.6 |
| 1.8 | Submission with server-side validation | §5.1 |
| 1.9 | Reviewer authentication + institution scoping | §3.2 |
| 1.10 | Dashboard overview metrics | §12.1 |
| 1.11 | Application table with filters | §12.2 |
| 1.12 | Application detail page | §12.3 |
| 1.13 | Approve / Reject / Request Corrections + confirmations | §12.4, §6 |
| 1.14 | Correction loop — same reference, new revision, history preserved | §6, §19 |
| 1.15 | Applicant status page + `ApplicationTimeline` | §15 |
| 1.16 | Reviewer history view | §3.2 |

**Gate:** an applicant applies on a phone, the reviewer approves, the applicant
receives the approval email and sees the status change — end to end, with no
payment step involved.

---

## Phase 2 — Payment workflow (spec §20 Phase 2)

*Blocked on §21 decisions 1–6.*

| # | Deliverable | Spec |
| --- | --- | --- |
| 2.1 | Configurable fee model per institution (`separate` / `combined`) | §7.3 |
| 2.2 | Payment instruction page with component breakdown | §7.2 |
| 2.3 | Payment submission form (amount, date, reference, method, receipt) | §8.1 |
| 2.4 | Per-component payment records | §8 |
| 2.5 | Payment verification queue with inline receipt viewing | §9.1 |
| 2.6 | Confirm payment / reject evidence with reason | §9.2 |
| 2.7 | `payments.confirm` permission, assignable independently | §9.3 |
| 2.8 | Resubmission without creating a new application | §9.2 |
| 2.9 | Payment notification emails | §15 |
| 2.10 | Registration completion → `registered` status | §10.1 |
| 2.11 | Registration confirmation + downloadable confirmation document | §10.2 |

**Gate:** an approved applicant pays, an authorised verifier confirms, the
business becomes `registered`, and the confirmation email arrives. The
`registered` guard is proven to reject an unconfirmed payment.

---

## Phase 3 — Business directory & marketplace integration (spec §20 Phase 3)

*Requires the marketplace-repo change in `docs/03-API-CONTRACT.md` §B.6.*

| # | Deliverable | Spec |
| --- | --- | --- |
| 3.1 | Institutional business records, distinct from public profiles | §11.1 |
| 3.2 | Public directory page — voeq-matched cards, NMU badge | §11.2 |
| 3.3 | `GET /api/public/directory` + `/api/public/verify` | — |
| 3.4 | Candidate match at application time → link existing vendor | §11.3 |
| 3.5 | Onboarding flow for businesses not yet on Voeq | §11.4 |
| 3.6 | `POST voeq.ng/api/internal/vendors/link` + `sync` | §2.4 |
| 3.7 | Verification indicator on the public profile | §11.5 |
| 3.8 | Badge reflects suspension / closure | §11.5 |
| 3.9 | Publication status kept separate from registration status | §19 |
| 3.10 | Registry-side registered-business management (suspend / close) | §12.5 |

**Gate:** a business registered through the Media Department appears in the
marketplace with the NMU badge, links to its existing vendor rather than
duplicating, and loses the badge when suspended.

---

## Phase 4 — Super Admin & institutional management (spec §20 Phase 4)

*The architecture supports this from Phase 0; only the UI arrives here.*

| # | Deliverable | Spec |
| --- | --- | --- |
| 4.1 | Institution CRUD, activate / deactivate | §13.1 |
| 4.2 | Per-institution settings, categories, campus list | §13.1 |
| 4.3 | Reviewer account CRUD, activation, reset | §13.2 |
| 4.4 | Reviewer → institution assignment (no institution picker at login) | §13.2 |
| 4.5 | Role + permission management UI | §13.3 |
| 4.6 | System monitoring across institutions | §13.4 |
| 4.7 | Audit log browser | §16 |
| 4.8 | Integration monitoring — vendor link failures, retry, manual re-link | §13.4 |
| 4.9 | Reports | §13.4 |

**Gate:** a second institution can be onboarded with its own categories, fee
config and reviewers, with no code change.

---

## Phase 5 — Hardening & launch (implied, not in the spec)

| # | Deliverable |
| --- | --- |
| 5.1 | Rate limiting, brute-force protection on OTP and auth |
| 5.2 | Backup + **restore test** (§17 asks for appropriate backups — an untested backup is not a backup) |
| 5.3 | CSP, security headers, dependency audit |
| 5.4 | Accessibility audit (keyboard, screen reader, contrast, 200% zoom) |
| 5.5 | Load test the submit + upload path on 3G |
| 5.6 | Monitoring and alerting on the outbox backlog, upload failures, vendor sync failures |
| 5.7 | Staff training session + reviewer playbook (what to approve, what to reject, how to word reasons) |
| 5.8 | DNS: `register.voeq.ng`, `verify.voeq.ng`, TLS |
| 5.9 | Privacy notice and data-retention policy |

> **5.7 is not optional.** The quality of a registration system is set by the
> reviewer's decisions and the wording of correction requests. The system can
> enforce that a reason was given; it cannot make the reason good. A
> one-hour session with the Media Department on how to reject constructively
> is worth more than any feature in Phase 4.

---

## Cross-phase work

| Area | Runs across |
| --- | --- |
| Design system | Continuous |
| Audit logging | From Phase 0 — every phase adds events |
| Notifications | Templates added per phase; the outbox exists from Phase 0 |
| Copy & content | Content must be written **with** the Media Department, not for them |
| Marketplace-repo work | 3.6–3.8 need changes in the voeq.ng repo |

---

## Sequencing dependencies

```
Phase 0 ──► Phase 1 ──► Phase 2 ──► Phase 3 ──► Phase 4
                       │         │         │
                       │         │         └─ needs marketplace-repo change (B.6)
                       │         │
                       │         └─ needs §21 decisions 1-6 (payment model)
                       │
                       └─ needs §21 decision 8 (mandatory fields), 10 (suspension authority)
```

Phase 3 and Phase 4 are **independent** of each other and can run in
parallel. The critical path is 0 → 1 → 2 → 3.
