# Architecture

## 1. Topology

```
                        ┌───────────────────────────────┐
   applicant (phone)    │      voeq.ng  (marketplace)  │   Media Dept
                        │      Next.js + Postgres       │   reviewers
                        │                               │
              browse    │  GET /api/explore?campus=…   │  review apps
           directory ◄──┤  GET /api/campuses/list      │  approve/reject
                        └──────────────┬────────────────┘  confirm payment
                                       │
                        ┌──────────────┴────────────────┐
                        │   @voeq integration seam       │
                        │  (HTTP + service token)        │
                        └──────────────┬────────────────┘
                                       │
             ┌─────────────────────────┴──────────────────────────┐
             │            register.voeq.ng  (this repo)          │
             │            Next.js 15 + Postgres (own DB)         │
             │                                                  │
             │  /            applicant portal                    │
             │  /apply       6-section application              │
             │  /status      applicant status + payments        │
             │  /directory   public NMU business directory      │
             │  /media       Media Department dashboard         │
             │  /admin       Voeq Super Admin                   │
             │                                                  │
             │  outbox worker → Resend (email)                  │
             │  outbox worker → voeq.ng (vendor link / badge)   │
             │  presigned URLs → R2 (private) / Cloudinary (public)
             └──────────────────────────────────────────────────┘
```

## 2. Why a separate database, and how it still integrates

Spec §2.4 requires separation to reduce risk to the marketplace, **and**
requires genuine integration. A CNAME alone gives neither. The resolution:

- **Physical separation.** The registry owns its own Postgres instance. A bug in
  the registry cannot corrupt marketplace rows, and institutional records
  (which contain personal data and payment receipts) sit behind a separate
  trust boundary rather than sharing a table namespace with public listings.
- **Logical integration.** All coupling happens over HTTP with an explicit,
  versioned contract and a service token. No cross-database joins, no shared
  ORM models, no shared session.

This is the "separate deployment ≠ disconnected functionality" requirement,
satisfied by an API contract rather than by a shared database.

## 3. Deployment

| Component | Host | Notes |
| --- | --- | --- |
| `apps/registry` | Vercel (or any Node 22 host) | Single deployable unit for all surfaces |
| Postgres | Neon / Supabase / RDS | Private network, PITR enabled |
| R2 bucket | Cloudflare | Private, versioned, lifecycle rules on drafts |
| Outbox worker | Same Vercel project, `pg-boss` consumer | Or a small always-on Node worker |
| Cloudinary | Existing Voeq account | `voeq/` folder, reused for approved public imagery |

### 3.1 Domains

```dns
register.voeq.ng.   CNAME  cname.vercel-dns.com.     # public portal
verify.voeq.ng.     CNAME  cname.vercel-dns.com.     # admin surfaces (same app)
```

Both hostnames point at the **same** deployment. The app routes by `Host`
header in middleware:

- `verify.voeq.ng/*` → force `data-env="deep"`, force admin auth, noindex
- `register.voeq.ng/*` → public routing, `data-env="cream"`

This gives the Media Department a clean, memorable URL without a second
deployment, and leaves room for the university to add IP allow-listing on
`verify.voeq.ng` at the edge later without touching application code.

**CNAME records alone do not constitute integration.** The functional coupling
lives in `docs/03-API-CONTRACT.md`.

## 4. Request routing

```
middleware.ts
├─ host == verify.voeq.ng  → require admin session, strip public routes
├─ path starts /media|admin → require admin session, set data-env=deep
├─ path starts /status     → require valid applicant access token
└─ everything else         → public
```

Applicant access tokens are **not** cookies scoped to the whole site. They are
presented in the URL path as a high-entropy secret (`/status/<token>`), are
hashed at rest, are single-use where the flow allows it, and expire.

## 5. Security model

### 5.1 Roles and scoping

```
users ──< user_roles >── roles ──< role_permissions >── permissions
              │
              └── institution_id (nullable ⇒ global/Super Admin)
```

`institution_id` on the session is the **only** accepted source of tenancy
scoping. The repository layer injects it into every query. A reviewer cannot
construct a request that reads another institution's data, because the filter
is not in user-controllable input.

Permission keys are fine-grained and separately assignable, because the spec
requires them to be (§9.3, §13.3):

```
applications.view      applications.review     applications.approve
applications.reject    applications.correct     applications.reassign
payments.view          payments.confirm         payments.reject
registry.view          registry.manage          registry.suspend
reports.view           institutions.manage       reviewers.manage
permissions.manage     audit.view                settings.manage
```

`payments.confirm` is deliberately independent of `applications.approve`, so
the university can put a finance officer on payment confirmation while the
Media Department retains approval authority.

### 5.2 Applicant access (§5.3, §17)

- **Primary:** magic link. A 32-byte random token, SHA-256 hashed at rest,
  single-use, 30-day TTL, revocable. Delivered by email to the address on the
  application.
- **Fallback:** OTP to the registered phone or email, 6 digits, 10-minute TTL,
  5-attempt lockout, rate limited.
- **Never:** the reference number alone. It is a human-facing label, and the
  spec forbids it granting access.

### 5.3 File handling (§17)

| Class | Examples | Storage | Access |
| --- | --- | --- | --- |
| Public | Approved flyer, product images | Cloudinary `voeq/` | Public URL |
| Private | Original flyer, payment receipts, any ID document | R2, private bucket | Short-lived presigned URL, minted only after an authorisation check |

Upload pipeline: extension check → MIME check → **magic-byte check** → size
limit → re-encode through `sharp` (strips EXIF, neutralises embedded payloads)
→ store. Downloads route through `/api/documents/:id`, which authorises then
302s to a 60-second presigned URL. **No document is ever reachable by
guessing a path.**

### 5.4 Audit logging (§16)

`audit_logs` is append-only. The application role holds `INSERT` and `SELECT`
only — no `UPDATE`, no `DELETE`. Every administrative action records actor,
action, timestamp, entity, and before/after values.

## 6. The transactional outbox (§15, §19)

Every state change writes an outbox row **in the same database transaction** as
the state change itself:

```
BEGIN
  UPDATE applications SET status = 'approved_awaiting_payment' WHERE id = …
  INSERT INTO notifications (…, status = 'queued') VALUES (…)
  INSERT INTO audit_logs (…) VALUES (…)
COMMIT
          ↓ (separate worker)
   pg-boss picks up → Resend / voeq.ng → retry with backoff
```

This is what makes rule 7 real rather than aspirational: if Resend is down, the
application is still approved, the audit entry is still written, and the email
goes out when the provider recovers. Notification failure cannot roll back or
block a business's application.

## 7. Integration seam

Directional, versioned, authenticated by service token. Full specification in
`docs/03-API-CONTRACT.md`.

| Direction | Mechanism | When |
| --- | --- | --- |
| Registry → Marketplace | `POST voeq.ng/api/internal/vendors/link` | On `registered` — link or create the Voeq vendor profile |
| Registry → Marketplace | `POST voeq.ng/api/internal/vendors/sync` | On register / suspend / close — refresh the NMU badge |
| Marketplace → Registry | `GET register.voeq.ng/api/public/directory?campus=…` | Pull — directory listings |
| Marketplace → Registry | `GET register.voeq.ng/api/public/verify?reference=…` | Pull — verification badge check |
| Registry → Marketplace | `GET voeq.ng/api/internal/vendors/search?q=…&campus=…` | At application time — suggest a matching existing vendor to link |

The registry treats the marketplace as a **downstream consumer**. The
marketplace never writes into the registry. This keeps the blast radius of a
registry bug at zero marketplace rows.

### 7.1 The `verified` flag collision — important

voeq.ng already exposes a `verified: boolean` on vendors and listings. On the
marketplace it currently means *"manually reviewed by Voeq"* ("Every vendor is
manually reviewed before listing").

NMU Media Department registration is a **different** kind of verification by a
**different** authority. Overloading the existing boolean would conflate
"Voeq reviewed this listing" with "the NMU Media Department registered this
business", and would let a Voeq-side operator silently flip an institutional
status.

**Recommendation:** voeq.ng adds a *separate* field —
`institutionalVerifications: [{ institution, reference, registeredAt, status }]`
— and renders an explicit NMU badge from it. The registry's
`sync` endpoint writes only that field. The pre-existing `verified` boolean
stays under Voeq's control.

This is a change in the **marketplace** repo and must be coordinated there.

## 8. Architecture decisions

| ID | Decision | Rationale | Status |
| --- | --- | --- | --- |
| ADR-001 | Separate repo, separate database, API-only integration | Spec §2.4 — isolation without disconnection | Accepted |
| ADR-002 | One deployment, two hostnames (`register.` / `verify.`) | One deployable unit, two trust surfaces, room for IP allow-listing | Proposed |
| ADR-003 | Custom auth for admin, magic-link/OTP for applicants | Different access models; a password for every applicant contradicts §5.3 | Proposed |
| ADR-004 | Transactional outbox for all notifications | Makes §15/§19 "notification failure must not lose applications" enforceable | Proposed |
| ADR-005 | Two-tier media: private R2 + public Cloudinary | Receipts must be private; public imagery should reuse the marketplace pipeline | Proposed |
| ADR-006 | `institutionalVerifications` separate from `verified` | Prevents conflating marketplace review with institutional registration | **Needs marketplace-repo agreement** |
| ADR-007 | Fee model is per-institution configuration, not a constant | Spec §7.3 forbids hardcoding Option A vs B | Proposed |
| ADR-008 | Category list is per-institution data, not an enum | Spec §4.2 — "should be configurable rather than permanently hardcoded" | Proposed |
