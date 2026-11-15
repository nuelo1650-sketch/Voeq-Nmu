# API & Integration Contract

Two sides:

- **Part A** — the registry's own HTTP surface (public portal + admin).
- **Part B** — the contract with voeq.ng.

Part B is the important one. Spec §2.4: *"A DNS CNAME configuration alone does
not provide this integration. The developer should specify how the new
application will communicate with the existing platform's backend and
database."* This document is that specification.

---

# Part A — Registry HTTP surface

Base: `https://register.voeq.ng`

## A.1 Public — applicant

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/public/institutions` | Institution name, campuses, categories (for the form) |
| `GET` | `/api/public/directory` | Published NMU businesses |
| `GET` | `/api/public/verify` | Verification check by reference |
| `POST` | `/api/public/drafts` | Create a draft, returns `draft_token` |
| `PATCH` | `/api/public/drafts/:token` | Autosave (§4.3 — no vendor account needed) |
| `POST` | `/api/public/applications` | Submit → returns reference |
| `POST` | `/api/public/applications/:reference/request-access` | Issue a magic link / OTP |
| `POST` | `/api/public/applications/:reference/verify-access` | Consume OTP |
| `POST` | `/api/public/applications/:reference/documents` | Upload flyer / images |
| `POST` | `/api/public/applications/:reference/payments` | Submit payment evidence |
| `GET` | `/api/public/applications/:reference/status` | Status + timeline (**requires access token**) |

### `GET /api/public/directory`

```jsonc
{
  "status": "success",
  "data": {
    "items": [
      {
        "reference": "NMU-2026-0001",
        "businessName": "Khim Culinary Institute",
        "category": { "slug": "pastries", "label": "Pastries & Bakes" },
        "description": "Cakes, pastries and food trays for campus events.",
        "campusSlugs": ["nmu-okerenkoko"],
        "campusNames": ["Okerenkoko"],
        "image": "https://res.cloudinary.com/.../voeq/xyz.jpg",
        "website": null,
        "socialLinks": [{ "kind": "instagram", "url": "https://instagram.com/..." }],
        "contact": { "phone": "0803...", "email": "..." },  // only if the applicant opted in
        "registeredAt": "2026-11-20T09:00:00.000Z"
      }
    ],
    "total": 21
  }
}
```

**Never present:** applicant name, relationship, phone/email unless explicitly
consented, receipts, internal notes, review history, or the declaration.

### `GET /api/public/verify?reference=NMU-2026-0001`

```jsonc
{
  "status": "success",
  "data": {
    "reference": "NMU-2026-0001",
    "businessName": "Khim Culinary Institute",
    "registrationStatus": "active",
    "publicationStatus": "published",
    "campusSlugs": ["nmu-okerenkoko"],
    "registeredAt": "2026-11-20T09:00:00.000Z",
    "institution": { "code": "NMU", "name": "Nigeria Maritime University" }
  }
}
```

Returns `registrationStatus: "suspended"` once a registration is suspended, so
the marketplace badge reflects it (spec §11.5).

## A.2 Admin — Media Department & Super Admin

All under `/api/admin/*`, all requiring an admin session, all institution-
scoped server-side. Reviewer-facing endpoints return `403` for any resource
outside the session's `institution_id` — **never** `404` only, so scope
violations are visible in the audit log.

| Method | Path | Permission |
| --- | --- | --- |
| `GET` | `/api/admin/applications` | `applications.view` — filters: status, category, campus, date range, `q` |
| `GET` | `/api/admin/applications/:id` | `applications.view` |
| `POST` | `/api/admin/applications/:id/review` | `applications.approve` / `.reject` / `.correct` |
| `POST` | `/api/admin/applications/:id/assign` | `applications.reassign` |
| `GET` | `/api/admin/payments` | `payments.view` |
| `POST` | `/api/admin/payments/:id/confirm` | `payments.confirm` |
| `POST` | `/api/admin/payments/:id/reject` | `payments.confirm` |
| `GET` | `/api/admin/registrations` | `registry.view` |
| `POST` | `/api/admin/registrations/:id/suspend` | `registry.suspend` |
| `POST` | `/api/admin/registrations/:id/close` | `registry.manage` |
| `GET` | `/api/admin/documents/:id` | Authorisation check → 302 presigned URL (60s) |
| `GET` | `/api/admin/metrics` | `reports.view` — the §12.1 dashboard counters |
| `GET` | `/api/admin/audit` | `audit.view` — Super Admin only |
| `GET/POST/PATCH` | `/api/admin/institutions/*` | `institutions.manage` — Super Admin only |
| `GET/POST/PATCH` | `/api/admin/users/*` | `reviewers.manage` — Super Admin only |
| `GET/PUT` | `/api/admin/roles/*` | `permissions.manage` — Super Admin only |

---

# Part B — The voeq.ng integration

## B.1 Facts established from production

Recovered from the live application on 2026-11-15:

| Fact | Value |
| --- | --- |
| Framework | Next.js App Router, Tailwind v4, `data-env` theming (`cream` / `deep`) |
| Campus API | `GET /api/campuses/list` → `[{ id, name, slug, region, city, state, lat, lng, status }]` |
| NMU campus slugs | `nmu-okerenkoko`, `nmu-kurutie` — both named **"Nigeria Maritime University"** |
| Explore API | `GET /api/explore?campus=<slug>` → `{ status, data: Listing[], trending }` |
| Listing shape | `id, vendorId, title, priceMinor, images[], categoryId, categorySlug, description, vendorName, verified, featured, trending, vendorRatingAvg, vendorRatingCount, saveCount, followerCount` |
| Money convention | `priceMinor` — integer minor units (kobo) |
| Identifiers | UUID v4 |
| Image host | Cloudinary, account `jq9gwigz`, folder `voeq/`, transforms `f_auto,q_auto,w_400` |
| Existing `verified` flag | Boolean on vendor/listing — currently means *"manually reviewed by Voeq"* |

Two consequences shape this contract:

1. **The institution code is `NMU` = Nigeria Maritime University.** The
   registry's `institutions.code` must be `NMU` so reference numbers match the
   existing campus slugs. See `docs/06-OPEN-QUESTIONS.md` §Q1.
2. **The existing `verified` boolean must not be reused** for institutional
   registration. See §B.6.

## B.2 Registry → Marketplace: link a vendor

Called when an application reaches `registered`.

```
POST https://voeq.ng/api/internal/vendors/link
Authorization: Bearer <VOEQ_SERVICE_TOKEN>
Content-Type: application/json
Idempotency-Key: {application_reference}
```

```jsonc
{
  "reference": "NMU-2026-0001",
  "institution": { "code": "NMU", "name": "Nigeria Maritime University" },
  "businessName": "Khim Culinary Institute",
  "category": "pastries",
  "description": "Cakes, pastries and food trays for campus events.",
  "location": "Beside the Main Gate",
  "campusSlugs": ["nmu-okerenkoko"],
  "website": null,
  "socialLinks": [{ "kind": "instagram", "url": "https://instagram.com/khim" }],
  "images": [{ "url": "https://res.cloudinary.com/.../voeq/xyz.jpg", "alt": "Khim Culinary Institute" }],
  "contact": { "phone": "0803...", "email": "hi@khim.test" },
  "publicationStatus": "published"
}
```

**Response**

```jsonc
{
  "status": "success",
  "data": {
    "vendorId": "c89278c3-a821-4a3c-9451-a9e383257f0b",
    "listingId": "ca4e0616-7871-45a2-97d1-f947b461cf6a",
    "action": "linked",          // "linked" | "created" | "updated"
    "alreadyExists": true
  }
}
```

**Behaviour contract**

| Rule | Detail |
| --- | --- |
| Idempotency | Keyed on `reference`. A second call returns the same `vendorId` — no duplicates (spec §19) |
| Link vs create | If an existing vendor matches on `businessName` + campus, **link** it. Never create a parallel account (spec §11.3, §19) |
| Onboarding | If no match, create a vendor profile and one initial listing (spec §11.4) |
| Never delete | The endpoint must not delete or overwrite unrelated vendor fields |
| Failure | Non-2xx → the registry records `vendor_links.state = 'failed'` with the error and the outbox retries with backoff |

## B.3 Registry → Marketplace: sync status

Called on register, suspend, close, and delist.

```
POST https://voeq.ng/api/internal/vendors/sync
Authorization: Bearer <VOEQ_SERVICE_TOKEN>
```

```jsonc
{
  "reference": "NMU-2026-0001",
  "vendorId": "c89278c3-a821-4a3c-9451-a9e383257f0b",
  "registrationStatus": "active",     // active | suspended | closed
  "publicationStatus": "published",   // published | unpublished | delisted
  "institutionalVerification": {
    "institution": "Nigeria Maritime University",
    "institutionCode": "NMU",
    "reference": "NMU-2026-0001",
    "registeredAt": "2026-11-20T09:00:00.000Z"
  }
}
```

## B.4 Marketplace → Registry: directory pull

The registry is the source of truth for institutional listings.

```
GET https://register.voeq.ng/api/public/directory?campus=nmu-okerenkoko&page=1&perPage=50
```

Unauthenticated and cacheable — it contains only public data. The marketplace
fetches it to render the NMU directory section, or to enrich vendors it already
has.

## B.5 Marketplace → Registry: candidate match (at application time)

While an applicant fills in the business name, the portal can suggest an
existing Voeq profile so the business links rather than duplicates (§11.3).

```
GET https://voeq.ng/api/internal/vendors/search?q=k culinary&campus=nmu-okerenkoko
Authorization: Bearer <VOEQ_SERVICE_TOKEN>
```

```jsonc
{
  "status": "success",
  "data": [
    { "vendorId": "c89278c3-...", "name": "Khim Culinary Institute", "campusSlugs": ["nmu-okerenkoko"], "matchScore": 0.93 }
  ]
}
```

Shown to the applicant as *"We already have a Voeq profile for this business —
link it instead of creating a new one."* The applicant confirms; the choice is
recorded on the application.

## B.6 The verification badge — required change in the marketplace repo

voeq.ng already has `verified: boolean` on vendors and listings, meaning
*"manually reviewed by Voeq"*. The NMU badge is a **different** fact, held by a
**different** authority.

**Do not set `verified: true` to mean "NMU registered".** Doing so would:

- conflate marketplace review with institutional registration;
- let a Voeq-side operator flip an institutional status without the Media
  Department;
- make the badge impossible to revoke correctly on suspension (§11.5).

**Recommended marketplace change** — add a separate field:

```ts
institutionalVerifications: {
  institutionCode: string   // "NMU"
  institutionName: string   // "Nigeria Maritime University"
  reference: string         // "NMU-2026-0001"
  registeredAt: string
  status: 'active' | 'suspended' | 'closed'
}[]
```

voeq.ng then renders a distinct badge, e.g. a small forest-green pill reading
**"NMU Registered"**, next to — not on top of — the existing `Verified` mark.

The badge renders only when `status === 'active'` **and** the marketplace has
not independently reviewed the vendor. A vendor can be Voeq-verified but not
NMU-registered, NMU-registered but not Voeq-verified, or both. Two independent
facts, two independent badges.

## B.7 What the registry will *not* do

| Guard | Reason |
| --- | --- |
| Never write to the marketplace database directly | ADR-001. The marketplace is a downstream consumer. |
| Never expose `applications` rows publicly | §11.2 — public profile ≠ institutional record |
| Never expose applicant identity publicly | §11.2, §17 |
| Never expose receipts or internal notes | §11.2, §19 |
| Never publish an unpublished record | §19 — publication status gates the directory query |
| Never auto-approve | §1.3 — the Media Department decides |
| Never mark registered without confirmed payment | §10.1, §19 |

## B.8 Authentication

| Caller | Mechanism |
| --- | --- |
| Registry → Marketplace | `Authorization: Bearer <VOEQ_SERVICE_TOKEN>` — a shared secret in the deployment environment, rotatable, never in the repository |
| Marketplace → Registry (public) | None — public data only |
| Marketplace → Registry (admin) | Separate admin token, read-only scope |
| Applicant → Registry | Magic-link token or OTP; never the reference number |

Service tokens live in the platform's secret store, are rotated on a schedule,
and are compared with a constant-time equality check.

## B.9 Versioning and ownership

| Item | Owner | Change control |
| --- | --- | --- |
| `vendor_links` + `vendor_sync` payload shape | voeq.ng repo | Additive-only within `/api/internal/vendors/v1` |
| `directory` + `verify` response shape | this repo | Additive-only within `/api/public/v1` |
| Idempotency on `reference` | both | Guaranteed by both sides |
| New institution onboarding | this repo | Adds a `institution_id`; no marketplace change |

Unknown fields in requests are ignored. Missing required fields are a `422`
with a machine-readable error body — never a silent partial write.
