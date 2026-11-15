# voeq-registry

**Voeq × Nigeria Maritime University — Business Registration, Verification &
Management System.**

A registration and verification portal for businesses in the NMU community:
applicants apply online, the Media Department reviews and decides, approved
businesses receive payment instructions, evidence is verified, and registered
businesses land in the NMU business register with a link to their Voeq
marketplace profile.

This is a **separate repository** from the voeq.ng marketplace — separate
deployment, separate database — connected by an explicit API contract rather
than a shared one.

---

## Status

**Design prototype rebuilt on the new direction. Application code not started.**

| | |
| --- | --- |
| Specification | `docs/spec/Voeq_NMU_Business_Registration_System_Specification.docx` |
| **Design prototype** | `apps/prototype/` — 10 screens, clickable, no build step |
| Architecture | `docs/01-ARCHITECTURE.md` |
| Data model | `docs/02-DATA-MODEL.md` |
| API & integration contract | `docs/03-API-CONTRACT.md` |
| Design system | `docs/04-DESIGN-SYSTEM.md` *(partly superseded)* |
| Roadmap | `docs/05-ROADMAP.md` |
| Open questions | `docs/06-OPEN-QUESTIONS.md` |
| **Payment pipeline** | `docs/07-PAYMENT-PIPELINE.md` |
| **Design direction** | `docs/08-DESIGN-DIRECTION.md` |

### Decisions taken

- **Institution: Nigeria Maritime University** (code `NMU`, campuses Okerenkoko
  and Kurutie). The spec's "Niger Delta University of Marine Studies" is a
  conflation with Niger Delta University and has been corrected throughout.
- **Design direction: "The Register."** A university business register set
  like a hydrographic chart and a ship's log. Fraunces / Inter / IBM Plex Mono,
  radius 0, ruled blocks instead of cards, a bathymetric chart field as the
  background phenomenon, folios and a measured measure as the grammar.
  See `docs/08-DESIGN-DIRECTION.md`.
- **The fee split is not public.** No amounts on any public surface; one
  honest sentence on the landing; the breakdown appears only on the
  applicant's own authenticated status page; never in a public API.
- **Payment: school-owned account, no custody.** Students transfer directly to
  the University; Voeq tracks, verifies, reconciles and records. Agency /
  receivable ledger mode, not custody. See `docs/07-PAYMENT-PIPELINE.md`.

### Still open

- **The one question that blocks the payment build** — is the student asked for
  ₦5,200 in one transfer, or ₦5,000 with the Department paying the ₦200
  separately? (`docs/07-PAYMENT-PIPELINE.md` §2, Q-P1)
- The **formal title of the reviewing authority** — the spec says "Media
  Department"; confirm the exact official name for correspondence and
  certificates.
- **Marketplace-repo agreement** on a new `institutionalVerifications` field
  rather than reusing voeq.ng's existing `verified` boolean (ADR-006).
- The **specification document's title page** still says "Niger Delta University
  of Marine Studies" and needs correcting before circulation.

---

## Running the design prototype

```bash
cd <repo root>
python -m http.server 8899 --bind 127.0.0.1
```

Then open http://127.0.0.1:8899/apps/prototype/index.html — or any of the ten
screens listed in `apps/prototype/README.md`. Serve from the repo root so the
prototype can resolve its own assets.

Screenshots, for design review:

```bash
tooling/shot.sh apps/prototype/index.html /tmp/shots/landing.png 1440 900
```

---

## Repository layout

```
apps/
  prototype/           Design prototype — 10 screens, no build step
  registry/            Next.js 15 app (Phase 0 onward)
packages/
  design-system/       @voeq/design-system — tokens & primitives shared with voeq.ng
  db/                  Prisma schema, migrations, seed
  core/                Domain logic: state machines, permissions, schemas
  email/               React Email templates
docs/                  Specification + architecture set
tooling/               Local scripts
```

---

## The design system

`packages/design-system/src/tokens.css` holds **two layers**:

1. The **marketplace layer** (`--role-*`, `--color-*`) — the exact production
   tokens extracted from voeq.ng's compiled CSS on 2026-11-15. Do not adjust
   them; they are the portability contract.
2. The **register layer** (`--reg-*`) — authored for this registry per
   `docs/08-DESIGN-DIRECTION.md`. The register's paper, ink and seal are the
   marketplace's cream / forest / forest-mid deepened and re-specified; the
   marine is the NMU's own identity; the foil is a muted version of the
   marketplace amber.

The register is a *deliberate second material*, not a recoloured copy: radius
0 rather than rounded cards, rules rather than shadows, Fraunces rather than
Playfair, and a bathymetric chart field rather than stock photography.

Read `docs/08-DESIGN-DIRECTION.md` before touching any UI. It supersedes the
visual direction in `docs/04-DESIGN-SYSTEM.md`, whose token-extraction and
accessibility sections still apply.

---

## Local development

```bash
# install
npm install

# database
cd packages/db && npx prisma migrate dev && npx prisma db seed

# app
cd apps/registry && npm run dev
```

Required environment variables are listed in `.env.example` (to be added in
Phase 0).

---

## The design rules that matter

1. Approval is not registration — registration requires confirmed payment.
2. A receipt upload is not payment confirmation.
3. A reference number grants no access — applicants need a token or OTP.
4. Corrections reuse the application; the reference never changes.
5. No duplicate business accounts — linking is idempotent on the reference.
6. Reviewers see exactly one institution, enforced in the data layer.
7. Notification failure never loses an application — transactional outbox.
8. Private stays private — no public URLs for receipts or personal data.
9. The fee split is internal — it appears on the applicant's own status page
   and nowhere else.
10. No custody — Voeq never holds a student's money.
