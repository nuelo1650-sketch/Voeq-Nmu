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

**Planning complete. Build not started.**

| | |
| --- | --- |
| Specification | `docs/spec/Voeq_NMU_Business_Registration_System_Specification.docx` |
| Architecture | `docs/01-ARCHITECTURE.md` |
| Data model | `docs/02-DATA-MODEL.md` |
| API & integration contract | `docs/03-API-CONTRACT.md` |
| Design system | `docs/04-DESIGN-SYSTEM.md` |
| Roadmap | `docs/05-ROADMAP.md` |
| Open questions | `docs/06-OPEN-QUESTIONS.md` |

Three decisions are **blocking** — see `docs/06-OPEN-QUESTIONS.md` §A:

1. The institution's legal name (the spec says "Niger Delta University of
   Marine Studies"; production voeq.ng says "Nigeria Maritime University").
2. The exact formal title of the reviewing authority.
3. Whether the marketplace gets a new `institutionalVerifications` field
   rather than reusing the existing `verified` boolean.

---

## Layout

```
apps/
  registry/            Next.js 15 app — the single deployable unit
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
