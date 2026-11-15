# Open Questions & Decisions

Two groups: the spec's own §21 list, and findings from reading the spec
against production voeq.ng.

**Status:** Q1 is **resolved** (institution = Nigeria Maritime University).
Q2 and Q3 remain open. The payment model is deliberately **not hardcoded** —
it is per-institution configuration, and the default arrangement is a
discussion item rather than an assumption.

Owner column: **MD** = Media Department · **VO** = Voeq · **ENG** = this repo.

---

## A. Blocking — resolve before Phase 1

### Q1 — What is the institution's legal name? ✅ RESOLVED

**Finding.** The spec names the institution *"Niger Delta University of Marine
Studies (NMU)"*. Production voeq.ng names it **"Nigeria Maritime University"**,
with two campuses — `nmu-okerenkoko` and `nmu-kurutie` — both under that one
name. The API returns those slugs directly. The spec's two campuses (Kurutie,
Okerenkoko) match the live data exactly.

There is no institution called "Niger Delta University of Marine Studies".
It appears to conflate **Niger Delta University** (NDU — a different, real
university in Bayelsa State) with **Nigeria Maritime University** (NMU —
Okerenkoko, Delta State).

**Decision (confirmed 15 Nov 2026):** the institution is **Nigeria Maritime
University**. Code `NMU`. Campuses Okerenkoko and Kurutie. The registry's
`institutions.code` is `NMU`, so reference numbers read `NMU-2026-0001` and
match the existing campus slugs.

**Follow-up:** the specification document's title page still says "Niger Delta
University of Marine Studies". Correct it before it is circulated as the
signed-off requirement, and before it is used to produce any official
registration record. The registry seed and all copy use "Nigeria Maritime
University".

---

### Q2 — Does NMU have a "Media Department", and which one? 🔴

**Finding.** The spec calls the reviewing body the "NMU Media Department". At
Nigeria Maritime University this may be a unit within a Mass Communication
department rather than a standalone department, and its formal title will
appear on official correspondence.

**Why it blocks.** The reviewer-facing copy, the approval emails, the
certificate of registration, and the public directory all name the authority
approving registrations.

**Recommendation.** Use the department's **exact official title** once
confirmed. Until then, use "NMU Media Department" as a working name and mark
it as provisional in the copy deck.

**Decision:** ______________________ · **Owner:** MD · **Needed by:** Phase 1

---

### Q3 — Which `verified` flag carries the NMU badge? 🔴

**Finding.** voeq.ng already has `verified: boolean` on vendors and listings,
meaning *"manually reviewed by Voeq"*. Institutional registration is a
different fact held by a different authority.

**Recommendation.** Add a separate `institutionalVerifications[]` field on the
voeq.ng side rather than reusing `verified`. Full detail in
`docs/03-API-CONTRACT.md` §B.6.

**Why it blocks.** This is a change in the **marketplace** repo, which is on
another machine. It needs to be agreed and scheduled before Phase 3, and it
affects the marketplace's own data model.

**Decision:** ______________________ · **Owner:** VO (marketplace repo) · **Needed by:** Phase 3

---

## B. From the spec's §21 list

| # | Decision | Impact | Owner | Needed by |
| --- | --- | --- | --- | --- |
| 4 | Separate (₦5,000 + ₦200) or combined payment? | Payment model, instructions, receipts, confirmation flow | MD | Phase 2 || 5 | Who confirms the university's fee? | `payments.confirm` permission assignment | MD | Phase 2 |
| 6 | Official payment details and channels | Payment instruction page content | MD | Phase 2 |
| 7 | Payment-confirmation procedure | Is a receipt screenshot enough, or a bank statement match? | MD | Phase 2 |
| 8 | Is there a payment deadline? | Expiry logic, reminders, expired applications | MD | Phase 2 |
| 9 | What if an approved applicant never pays? | Auto-expiry, reminders, staff chase list | MD | Phase 2 |
| 10 | Additional physical verification for some businesses? | Review checklist, extra status, checklist fields | MD | Phase 1 |
| 11 | Which applicant fields and documents are mandatory? | Final form validation rules | MD | Phase 1 |
| 12 | Must every registered business maintain a public Voeq profile? | Whether onboarding is mandatory or optional | MD + VO | Phase 3 |
| 13 | Who may suspend or withdraw a registration? | `registry.suspend` permission, audit semantics | MD | Phase 3 |

> The fee amounts in §21 (₦5,000 university fee, ₦200 Voeq fee) are used as
> **seed values only**. Everything downstream reads from
> `institution_payment_config`, so a change is a config edit, not a release.

> **Both arrangements are already built for.** The prototype currently shows
> the **separate** model — two payment blocks, one receipt each, confirmed
> independently — because it is the stricter case: if separate works, combined
> works too (it is the same machinery with one fee component instead of two).
> Nothing needs re-architecting whichever way the Media Department decides.
> The default arrangement is a discussion item, not an assumption.

---

## C. Findings — no decision needed, but worth confirming

| # | Finding | Proposed handling |
| --- | --- | --- |
| 14 | The spec's 11 business categories are much coarser than voeq.ng's 28 live slugs, and **"Professional Services" has no clean voeq equivalent** | Map in `institution_categories` as seed data; map Professional Services → `other` for now, or add a voeq slug. Confirmed with the Super Admin in Phase 4. |
| 15 | Both NMU campuses carry **identical lat/lng** (`5.62449, 5.39038`) and both are tagged "Delta State" — Kurutie is in Bayelsa State | Seed the registry from correct geography and raise the data error on the marketplace side. Cosmetic for Phase 1; matters for "Near me" filtering. |
| 16 | Applicant **email is optional** (§4.1) but email is the primary notification channel (§15) and the primary access method (§5.3) | Make the email field strongly prominent but not blocking. When absent, the status page (via a reference + phone OTP) becomes the primary channel, and the copy must say so. |
| 17 | The spec assumes a single reviewer, but §3.2 and §13.2 imply a team with per-user attribution | Built from the start: `assigned_reviewer_id`, plus a "claim" action so two reviewers don't duplicate effort. |
| 18 | The spec says corrections make the application editable, but not whether **previously uploaded documents are retained** | Retain all prior documents; new uploads supersede by `kind`. Reviewers see the full version history. |
| 19 | No notification is specified for an applicant who **misses the payment deadline** | Out of scope until decision 8 is answered; the outbox makes it a template + schedule rather than new machinery. |
| 20 | The spec gives no guidance on **data retention** for rejected or withdrawn applications | Proposed: retain rejected applications and their audit trail for 3 years (institutional record-keeping), then anonymise. Needs MD confirmation. |
| 21 | The spec expects a **downloadable registration confirmation** (§10.2) but does not specify whether it must be stamped or signed | Start with a clean PDF generated from the reference; add a signature/stamp once the Department's format is supplied. |

---

## D. Explicitly out of scope (recorded so it isn't re-litigated)

| Item | Why |
| --- | --- |
| Fully configurable multi-institution enterprise platform | §18 — not required before the first institution goes live. The architecture supports it; the UI ships in Phase 4. |
| SMS and WhatsApp notification channels | §15 — later. The notification table already carries a `channel` column so adding them is a new adapter. |
| In-app payment processing | The spec describes **manual** bank transfer with evidence upload (§8). No gateway is implied. |
| A general-purpose form builder | The form is defined by the spec and the Department. Configurable categories and settings are enough. |
| Native mobile apps | The portal is a responsive web app. Students apply on a phone browser. |

---

## How these get closed

Every item above is a **question with an owner and a date**, not a task to
discover later. The mechanism:

1. This document is walked with the Media Department in one sitting.
2. Answers are written into `institution_payment_config`,
   `institution_categories`, and the copy deck — as **data**, not code.
3. Anything that must be reflected in the code (Q1, Q2, Q3) becomes a
   configuration change or a small, isolated commit, then the document is
   updated to match.

The intent is that after this review, the build proceeds without anyone
stopping to ask what the fee is or who the institution is called.
