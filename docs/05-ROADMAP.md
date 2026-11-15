# Roadmap

Mapped to spec §20. The spec's four phases are correct in order; this document
adds the milestone gates, the sequencing dependencies between them, and the
work that the spec implies but doesn't name.

**Indicative, not a commitment.** Durations assume one engineer with design
support. The critical path runs through the §21 decisions — Phase 2 cannot
start until the payment model is agreed.

---

## Build standards (bind every phase)

These are not deliverables; they are constraints every deliverable must satisfy.

| Standard | Rule |
| --- | --- |
| **Mobile-first** | Every screen is authored at **390px first**, then expanded to desktop. No screen ships until it has been verified at 390px (no horizontal overflow, all touch targets ≥ 44px, forms usable one-handed). The applicant is on a phone, often on expensive data — desktop is the *expansion*, never the base. |
| **Design language** | voeq.ng's own grammar: cream environment, forest/amber tokens from `@voeq/design-tokens`, Playfair Display for display text only, real `Logo.png` via the BrandLogo CSS-mask technique. Components port without translation. |
| **No fabricated data** | The product ships with honest empty states. No invented counts, names or dates anywhere in UI or seed content. |
| **Staff access** | Staff sign-in lives at an unlinked `/staff` route. No staff entry point on any public page. |
| **Public fee sentence** | The only public statement of cost is: applying is free; if approved, a single transfer of ₦5,200 into the University's account completes registration. The ₦5,000/₦200 division appears only on the applicant's own status page and in the finance ledger. |

---

## The image pipeline — end to end

The spec names uploads (§4.4) and storage (§17) but doesn't join them into one
path. Here is the whole pipeline, every stage owned by a named deliverable.

```
 applicant's phone                registry server               storage
┌───────────────────┐   ┌───────────────────────────┐   ┌──────────────────┐
│ 1 SELECT          │   │ 4 VALIDATE                │   │ 6 R2 PRIVATE     │
│ camera / gallery  │──►│ magic bytes, dimensions,  │──►│ bucket (private, │
│ 2 COMPRESS        │   │ count per field, size cap │   │ no public URL)   │
│ canvas re-encode  │   │ 5 RECORD                  │   │ originals kept   │
│ ≤200KB JPEG, EXIF │   │ DB row + outbox event +   │   │ forever          │
│ stripped, dim cap │   │ audit row, one txn        │   └────────┬─────────┘
│ 3 UPLOAD          │   └───────────────────────────┘            │
│ presigned URL,    │                                            ▼
│ progress + retry  │                              ┌──────────────────────────┐
└───────────────────┘                              │ 7 ADMIN VIEW             │
                                                   │ short-lived signed URL,  │
                                                   │ full-size + zoom, inline │
                                                   │ in the review screen     │
                                                   └────────────┬─────────────┘
                                                                │ on approval only
                                                                ▼
                                                   ┌──────────────────────────┐
                                                   │ 8 PROMOTE                │
                                                   │ derivative (≤1200px,     │
                                                   │ compressed) → public     │
                                                   │ Cloudinary voeq/ folder  │
                                                   │ (account jq9gwigz) so it │
                                                   │ enters the marketplace   │
                                                   │ pipeline; original never │
                                                   │ leaves R2                │
                                                   └──────────────────────────┘
```

Stage-by-stage commitments:

1. **Select** — `capture="environment"` for camera, gallery fallback; no forced camera.
2. **Compress (client-side, before any bytes leave the phone)** — re-encode to
   JPEG via canvas: longest edge capped at 1600px, quality stepped down from
   0.85 until ≤ 200KB, EXIF orientation applied and then stripped (no GPS
   metadata ever uploaded). Target: a 3MB phone photo becomes ≤ 200KB.
3. **Upload** — presigned R2 PUT; progress bar; automatic retry on network
   failure; the draft keeps its state if the upload fails mid-way.
4. **Validate (server, before anything is stored)** — magic-byte sniff (no
   `Content-Type` trust), dimension check, per-field count limit, 10MB hard
   cap on the *original* upload payload.
5. **Record** — image row + outbox notification + audit event in the same DB
   transaction as the application state change (§19 outbox invariant).
6. **Store** — private R2 bucket, object key per application reference, no
   public URL ever constructed; originals retained per the retention policy.
7. **Admin view** — short-lived signed URLs (minutes, not days), full-size
   inline viewer with zoom in the review screen; reviewers always see the
   original, never a re-compressed copy.
8. **Promote (only on approval)** — the public directory needs a *display*
   image, not the applicant's original. A derivative is generated (≤1200px,
   compressed, stripped) and pushed to the existing public Cloudinary folder
   `voeq/` on account `jq9gwigz`, so marketplace components consume it with
   zero new plumbing. If the entry is later suspended, the public image is
   removed but the R2 original is kept for the audit trail.

Failure handling: every stage is idempotent and re-runnable. A failed promote
retries from the worker; a failed upload never corrupts the draft.

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
| 1.2 | Six-section form, five steps + review, autosave — authored mobile-first at 390px | §4 |
| 1.3 | Draft tokens — no vendor account needed | §5.3 |
| 1.4 | Reference generation `NMU-2026-0001` (per-institution sequence) | §5.2 |
| 1.5 | Applicant access: magic link + OTP fallback | §5.3 |
| 1.6 | Image pipeline stages 1–6: compress → upload → validate → store (see "The image pipeline") | §4.4, §17 |
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

**Gate:** an applicant applies **on a phone** (verified at 390px, images pass
through pipeline stages 1–6), the reviewer approves, the applicant receives
the approval email and sees the status change — end to end, with no payment
step involved.

### The review workbench (what "properly review" means)

The mock dossier demonstrated layout, not review craft. The real review
screen is built as a workbench and is not considered done until all of this
exists:

- **The applicant's evidence, full size.** Every uploaded image opens in the
  review screen at full resolution with zoom — signed URLs, the original
  file, never a squeezed thumbnail. Certificate, owner photo, business photo
  each in its own frame with its validation result attached.
- **Checklist before decision.** The reviewer steps through the required
  items (CAC status, photo legibility, category fit, campus correct, consent
  recorded) and each item is marked before an approve button unlocks. No
  one-click approvals without the checklist.
- **Side-by-side revisions.** When an application comes back after a
  correction request, the reviewer sees the previous revision next to the new
  one, with what changed highlighted — no re-reading from scratch.
- **Reasons that are written, not invented.** The correction composer ships
  with the reviewer playbook's reason templates (see 5.7), editable per case,
  so rejections are specific and kind by default.
- **One reference, whole history.** Every state change, email sent, note
  added and decision made is on one timeline visible while deciding.
- **Keyboard-fast, phone-capable.** Desktop review is keyboard-driven
  (shortcut to next-in-queue, checklist marks, decision keys); the same
  screen still passes at 390px because the Media Unit checks the queue on
  phones too.

---

## Phase 2 — Fees & the dedicated account (spec §20 Phase 2, as revised by `docs/07`)

*Model: one NMU-owned dedicated account; every ₦5,200 credit divides into
₦5,000 school (memorandum) + ₦200 Voeq (revenue). Blocked on Q-P1–Q-P8.*

| # | Deliverable | Spec / doc |
| --- | --- | --- |
| 2.1 | Fee intent issued on approval; payment instruction with the public sentence | §7.2, doc 07 §2 |
| 2.2 | Applicant payment submission (amount, date, reference, method) — no receipt image required at submit | §8.1, doc 07 §5.5 |
| 2.3 | Bank statement CSV import (primary feed); alerts as accelerator only | doc 07 §5.1 |
| 2.4 | Matching engine — credit ↔ fee intent, ambiguity queue for the unmatched | doc 07 §5.5 |
| 2.5 | **Allocation, not payment**: each confirmed credit posts Dr receivable / Cr revenue ₦200 + school memorandum ₦5000 | doc 07 §6.2 |
| 2.6 | The two balances, always visible: Voeq receivable + school share awaiting sweep | doc 07 §4 |
| 2.7 | Confirm-fee under maker-checker; write-off exception scoped separately | doc 07 §4.5 |
| 2.8 | Orphaned-credit handling with the 90-day window (policy per Q-P6) | doc 07 §5.5 |
| 2.9 | Settlement jobs: weekly sweep reminder, weekly remittance report, monthly signed reconciliation (cadence per Q-P1) | doc 07 §3 |
| 2.10 | Fee ledger screen — every credit, its ₦5,000/₦200 division, totals, per-entity audit chain | doc 07 §4 |
| 2.11 | Registration completion → `registered` status, guarded on confirmed credit | §10.1 |
| 2.12 | Confirmation email + downloadable confirmation document | §10.2 |
| 2.13 | Image pipeline stage 8: promote display derivative to public Cloudinary on approval | doc 07, §17 |

**Gate:** a real statement CSV reconciles — every credit matched, the two
balances correct to the naira, the maker-checker separation proven (a checker
cannot confirm their own match), and a registered business's public image is
promoted exactly once.

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
| Design system | Continuous — voeq.ng grammar, mobile-first verification every phase |
| Image pipeline | Stages 1–6 in Phase 1; stage 7 hardening in Phase 2; stage 8 promotion in Phase 2–3 |
| Audit logging | From Phase 0 — every phase adds events |
| Notifications | Templates added per phase; the outbox exists from Phase 0 |
| Copy & content | Content must be written **with** the Media Department, not for them |
| Marketplace-repo work | 3.6–3.8 need changes in the voeq.ng repo (separate machine, coordinated) |

---

## Sequencing dependencies

```
Phase 0 ──► Phase 1 ──► Phase 2 ──► Phase 3 ──► Phase 4 ──► Phase 5
                       │         │
                       │         └─ needs Q-P1…Q-P8 answered (doc 07 §6)
                       │
                       └─ needs §21 decision 8 (mandatory fields), 10 (suspension authority)
```

Phase 3 and Phase 4 are **independent** of each other and can run in
parallel. The critical path is 0 → 1 → 2 → 3 → 5.
