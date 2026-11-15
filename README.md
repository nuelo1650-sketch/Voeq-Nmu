# voeq-registry

**Voeq × Nigeria Maritime University — Business Registration, Verification &
Management System.**

A registration and verification portal for businesses in the NMU community:
applicants apply online, the Media Department reviews and decides, approved
businesses receive payment instructions, evidence is verified, and registered
businesses land in the NMU business directory with a link to their Voeq
marketplace profile.

This is a **separate repository** from the voeq.ng marketplace — separate
deployment, separate database — connected by an explicit API contract rather
than a shared one.

---

## Status

**Design prototype built. Application code not started.**

| | |
| --- | --- |
| Specification | `docs/spec/Voeq_NMU_Business_Registration_System_Specification.docx` |
| **Design prototype** | `apps/prototype/` — 7 screens, clickable, no build step |
| Architecture | `docs/01-ARCHITECTURE.md` |
| Data model | `docs/02-DATA-MODEL.md` |
| API & integration contract | `docs/03-API-CONTRACT.md` |
| Design system | `docs/04-DESIGN-SYSTEM.md` |
| Roadmap | `docs/05-ROADMAP.md` |
| Open questions | `docs/06-OPEN-QUESTIONS.md` |

### Decisions taken

- **Institution: Nigeria Maritime University** (code `NMU`, campuses Okerenkoko
  and Kurutie). The spec's "Niger Delta University of Marine Studies" is a
  conflation with Niger Delta University and has been corrected throughout.
- **Design direction: warm hybrid.** voeq.ng's paper-and-forest foundation
  carries the product; a maritime-teal layer gives the NMU surfaces their own
  identity. Tokens live in `packages/design-system/src/tokens.css` under
  `--nmu-*`.
- **Payment model is not hardcoded.** Both separate and combined arrangements
  are supported by configuration; the default is a discussion item with the
  Media Department.

### Still open

- The **formal title of the reviewing authority** — the spec says "Media
  Department"; confirm the exact official name for correspondence and
  certificates.
- **Marketplace-repo agreement** on a new `institutionalVerifications` field
  rather than reusing voeq.ng's existing `verified` boolean (ADR-006).

---

## Running the design prototype

```bash
cd <repo root>
python -m http.server 8899 --bind 127.0.0.1
```

Then open http://127.0.0.1:8899/apps/prototype/index.html — or any of the
seven screens listed in `apps/prototype/README.md`. Serve from the repo root
so the prototype can resolve the shared token stylesheet.

---

## Repository layout

```
apps/
  prototype/           Design prototype — 7 screens, no build step
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

`packages/design-system/src/tokens.css` holds the **exact production tokens**
extracted from voeq.ng's compiled CSS on 2026-11-15 — cream and deep
environments, Playfair Display / Inter / JetBrains Mono, the forest-tinted
elevation ramp, the space scale.

Both repos consume the same package, so the registry cannot drift from the
marketplace's look. Read `docs/04-DESIGN-SYSTEM.md` before touching any UI.

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
