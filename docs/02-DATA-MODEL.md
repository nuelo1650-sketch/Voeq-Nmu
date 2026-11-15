# Data Model

PostgreSQL 16 + Prisma. Every table below is scoped by `institution_id` where
it holds institutional records, per spec §18.

---

## 1. Entity map

```
institutions ──┬── institution_campuses
               ├── institution_categories ──── category_map ──► (voeq category slug)
               ├── institution_payment_config
               ├── users (via user_roles)
               └── applications ──┬── application_submissions  (revision history)
                                  ├── corrections
                                  ├── reviews
                                  ├── documents
                                  ├── supporting_links
                                  ├── payments
                                  ├── registrations ── vendor_links ──► voeq.ng
                                  └── notifications (outbox)

audit_logs        append-only, institution_id scoped
access_tokens     applicant magic links
otp_codes         applicant OTP fallback
```

---

## 2. Core tables

### `institutions`
The tenant root. Spec §13.1 — the system must accommodate more institutions.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid pk | |
| `code` | text unique | `NMU` — used in reference numbers |
| `name` | text | `Nigeria Maritime University` |
| `slug` | text unique | |
| `settings` | jsonb | Institution-specific registration settings |
| `active` | boolean | |
| `created_at` / `updated_at` | timestamptz | |

### `institution_campuses`
Bridges to voeq.ng campus slugs. Seeded from the live
`GET /api/campuses/list` contract — `nmu-okerenkoko`, `nmu-kurutie`.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid pk | |
| `institution_id` | uuid fk | |
| `voeq_campus_slug` | text | `nmu-okerenkoko` |
| `name`, `city`, `state` | text | |
| `lat`, `lng` | numeric | |
| `sort_order` | int | |

### `institution_categories`
Spec §4.2 — the category list "should be configurable rather than permanently
hardcoded", so it is data, not an enum.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid pk | |
| `institution_id` | uuid fk | |
| `slug` | text | `food-and-drinks` |
| `label` | text | `Food and Drinks` |
| `voeq_category_slug` | text | `food-drinks` — the marketplace category it publishes as |
| `sort_order` | int | |
| `active` | boolean | |

**NMU → voeq.ng category mapping** (spec §4.2 list, resolved against live
voeq category slugs):

| Spec category | voeq slug | Note |
| --- | --- | --- |
| Food and Drinks | `food-drinks` | Direct |
| Fashion and Clothing | `fashion` | Direct |
| Technology | `tech-repairs` | Direct |
| Beauty and Personal Care | `beauty-care` | Direct |
| Laundry | `laundry` | Direct |
| Education and Tutoring | `tutorials` | `academic-services` also plausible — confirm |
| Printing and Graphics | `printing` | Direct |
| Accessories | `gadgets` | Confirm — `fashion` is also plausible |
| General Essentials | `home-essentials` | Direct |
| Professional Services | *(none)* | **Gap — no clean voeq equivalent.** Needs either a new voeq slug or mapping to `other` |
| Other | `other` | Direct |

> The mapping is seed data in `institution_categories`, editable by the Super
> Admin in Phase 4. Nothing in the application logic hardcodes a category.

### `institution_payment_config`
Spec §7.3 — "The developer must not hardcode either arrangement until the
parties have finalised it."

| Column | Type | Notes |
| --- | --- | --- |
| `institution_id` | uuid pk/fk | One active config per institution |
| `fee_model` | enum(`separate`, `combined`) | Spec §7.3 Option A / Option B |
| `university_fee_minor` | int | Kobo. ₦5,000 = `500000` (matches voeq's `priceMinor` convention) |
| `voeq_fee_minor` | int | ₦200 = `20000` |
| `currency` | text | `NGN` |
| `payment_deadline_days` | int | Null ⇒ no deadline (spec §21 #5) |
| `instructions` | text | Rich text shown on the payment page |
| `bank_details` | jsonb | Account name, bank, number — per fee component |
| `allow_receipt_rejection` | boolean | |
| `updated_at` | timestamptz | |

### `users`, `roles`, `user_roles`, `role_permissions`
Admin and reviewer accounts only — applicants never get an account (spec §5.3).

```
users:         id, email (unique), phone, full_name, password_hash,
               totp_secret, totp_enabled, status, last_login_at, created_at
roles:         id, name, scope (institution | global)
user_roles:    user_id, role_id, institution_id (null ⇒ global)
role_permissions: role_id, permission_key
```

Reviewer creation, editing, activation and permission assignment are Super
Admin functions (spec §13.2, §13.3). A reviewer assigned to NMU operates inside
the NMU environment without choosing an institution at login — the assignment
is on the role, not the session prompt.

### `applications`
The heart of the system.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid pk | |
| `institution_id` | uuid fk | **Tenant key. Never client-supplied.** |
| `reference` | text unique | `NMU-2026-0001`. Immutable for the life of the application (§5.2, §19) |
| `status` | enum | See §4 below |
| `payment_status` | enum | See §4 below |
| `applicant_name` | text | §4.1 |
| `applicant_email` | text | Nullable — email is "optional, strongly recommended" (§4.1) |
| `applicant_phone` | text | Required |
| `relationship` | enum(`owner`,`manager`,`authorised_representative`,`other`) | §4.1 |
| `relationship_detail` | text | Required when `relationship = other` |
| `business_name` | text | §4.2 |
| `category_id` | uuid fk → `institution_categories` | |
| `business_description` | text | §4.2 |
| `business_location` | text | §4.2 — where it operates |
| `campus_slugs` | text[] | §4.2 / §19 — `Kurutie`, `Okerenkoko`, or both |
| `purpose_statement` | text | §4.3 — replaces the formal letter |
| `has_online_presence` | boolean | §4.5 — Yes/No gate |
| `website`, `social_link`, `other_platform` | text | §4.5, conditional |
| `digital_explanation` | text | §4.5, conditional |
| `declaration_accepted` | boolean | §4.6 — mandatory before submit |
| `declaration_accepted_at`, `declaration_ip`, `declaration_user_agent` | | Evidence of consent |
| `assigned_reviewer_id` | uuid fk → `users` | |
| `revision_no` | int | Increments on each correction resubmission |
| `version` | int | Optimistic locking for concurrent reviewer edits |
| `submitted_at`, `approved_at`, `rejected_at`, `registered_at` | timestamptz | |
| `created_at`, `updated_at` | timestamptz | |

### `application_submissions`
Preserves every revision. Spec §19 — "Previous submissions and correction
history must be preserved."

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid pk | |
| `application_id` | uuid fk | |
| `revision_no` | int | |
| `payload` | jsonb | Full snapshot of the submitted fields |
| `submitted_by` | text | Applicant or reviewer, with the token identity |
| `created_at` | timestamptz | |

### `corrections`
| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid pk | |
| `application_id` | uuid fk | |
| `requested_by` | uuid fk → `users` | Reviewer |
| `reason` | text | Required — shown to applicant |
| `requested_at` | timestamptz | |
| `resolved_at` | timestamptz | Set on resubmission |
| `resolved_submission_id` | uuid fk → `application_submissions` | |

### `reviews`
Every approve / reject / correct decision, with identity and timestamp (spec §6).

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid pk | |
| `application_id` | uuid fk | |
| `reviewer_id` | uuid fk → `users` | |
| `action` | enum(`approved`,`rejected`,`correction_requested`,`reopened`,`suspended`,`closed`) | |
| `reason` | text | Required for reject and correction |
| `internal_notes` | text | **Never** exposed to applicant or marketplace |
| `created_at` | timestamptz | |

### `documents`
| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid pk | |
| `application_id` | uuid fk | |
| `kind` | enum(`flyer`,`image`,`receipt`,`identification`,`other`) | |
| `visibility` | enum(`private`,`public_approved`) | |
| `storage_provider` | enum(`r2`,`cloudinary`) | |
| `storage_key` | text | Not a public URL |
| `public_url` | text | Populated only for `public_approved` Cloudinary assets |
| `filename`, `mime_type`, `bytes`, `sha256` | | Validation evidence |
| `width`, `height` | int | Images only |
| `scan_status` | enum(`pending`,`clean`,`flagged`) | |
| `uploaded_at` | timestamptz | |

### `supporting_links`
§4.5 — "Submitted links should be stored and displayed so reviewers can open
them safely."

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid pk | |
| `application_id` | uuid fk | |
| `kind` | enum(`website`,`social`,`other`) | |
| `label` | text | |
| `url` | text | |
| `is_safe` | boolean | SSRF-checked at submit time |
| `created_at` | timestamptz | |

> Links are fetched **server-side with SSRF protection** (blocked private IP
> ranges, no redirects to internal hosts) and rendered to reviewers behind a
> safe-outbound redirect. Never render a raw anchor to an unvalidated URL.

### `payments`
One row **per fee component**. This is what lets the fee model stay
configurable (§7.3) instead of hardcoded.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid pk | |
| `application_id` | uuid fk | |
| `fee_component` | enum(`university`,`voeq`,`combined`) | Which block of the payment page |
| `amount_paid_minor` | int | §8.1 |
| `payment_date` | date | §8.1 |
| `payment_reference` | text | §8.1 — transaction reference |
| `method` | enum(`bank_transfer`,`other`) | §8.1 |
| `status` | enum(`awaiting_payment`,`submitted`,`awaiting_confirmation`,`confirmed`,`evidence_rejected`) | |
| `receipt_document_id` | uuid fk → `documents` | §8.1 |
| `submitted_at` | timestamptz | §8.2 |
| `confirmed_by` | uuid fk → `users` | §9.2 |
| `confirmed_at` | timestamptz | |
| `rejection_reason` | text | §9.2 |
| `attempts` | int | Resubmission counter |

**Deriving the application-level `payment_status`:**

| Application `payment_status` | Rule |
| --- | --- |
| `not_required_yet` | Application status ≠ `approved_awaiting_payment` |
| `awaiting_payment` | Approved, and no component has been submitted |
| `payment_submitted` | ≥1 component submitted, none confirmed, none rejected |
| `awaiting_confirmation` | ≥1 component awaiting confirmation, none rejected |
| `payment_evidence_rejected` | ≥1 component rejected (action required) |
| `payment_confirmed` | **All required components confirmed** |

### `registrations`
| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid pk | |
| `application_id` | uuid fk unique | |
| `institution_id` | uuid fk | |
| `reference` | text | Retained official reference (§10.1) |
| `registered_at` | timestamptz | |
| `status` | enum(`active`,`suspended`,`closed`) | §10, §12.5 |
| `publication_status` | enum(`unpublished`,`published`,`delisted`) | **Separate from registration status** (§19) |
| `voeq_vendor_id` | text | Set once linked |
| `voeq_listing_id` | text | Optional |
| `suspended_at`, `suspended_by`, `suspension_reason` | | §12.5 |
| `closed_at`, `closed_by`, `closure_reason` | | |

> `registration.status` and `publication_status` are deliberately separate
> fields — spec §19 requires registration status and marketplace publication
> status to be maintained independently.

### `vendor_links`
| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid pk | |
| `application_id` | uuid fk | |
| `voeq_vendor_id` | text | |
| `state` | enum(`pending`,`linked`,`created`,`failed`,`unlinked`) | |
| `last_synced_at` | timestamptz | |
| `last_error` | text | Surfaced to Super Admin |
| `attempts` | int | |

### `notifications` (transactional outbox)
| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid pk | |
| `institution_id` | uuid fk | |
| `application_id` | uuid fk nullable | |
| `event` | enum | See §5 |
| `channel` | enum(`email`,`sms`,`whatsapp`) | Email primary (§15) |
| `template` | text | React Email template key |
| `recipient` | text | |
| `subject`, `body` | text | Rendered at send time for auditability |
| `status` | enum(`queued`,`sending`,`sent`,`failed`,`dead`) | |
| `attempts`, `last_error`, `sent_at` | | |
| `created_at` | timestamptz | |

### `audit_logs` (append-only)
| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid pk | |
| `institution_id` | uuid fk | |
| `actor_id` | uuid fk nullable | Null = system |
| `actor_role` | text | |
| `action` | text | e.g. `application.approved` |
| `entity_type`, `entity_id` | text, uuid | |
| `before`, `after` | jsonb | Previous / new values |
| `ip`, `user_agent` | | |
| `created_at` | timestamptz | |

**Append-only enforced at the database level:** the application's DB role
receives `INSERT` and `SELECT` on this table and nothing else.

### `access_tokens`, `otp_codes`
| `access_tokens` | `id, application_id, token_hash (sha256), purpose, expires_at, used_at, created_at` |
| `otp_codes` | `id, application_id, channel, destination, code_hash, expires_at, attempts, consumed_at` |

Tokens are stored **hashed**. The raw token exists only in the email URL.

---

## 3. Reference numbers (§5.2)

Format: `{INST_CODE}-{YEAR}-{NNNN}` → `NMU-2026-0001`.

Generated by a per-institution, per-year sequence in Postgres so concurrent
submissions cannot collide:

```sql
CREATE SEQUENCE ref_nmu_2026 START 1;
```

The reference is assigned **once**, at first successful submission, and is
never regenerated — corrections, resubmissions, payment attempts and the final
registration all reuse the same reference (§5.2, §19).

---

## 4. State machines

### 4.1 Application status

```
                    ┌──────────────────────────────┐
                    │          submitted            │
                    └───────────────┬──────────────┘
                                    │ reviewer opens
                    ┌───────────────▼──────────────┐
                    │        under_review           │
                    └───┬──────────┬───────────┬────┘
        correction     │          │ approve   │ reject
   ┌────────────────────▼─┐   ┌────▼──────────┐  │
   │  requires_correction  │   │ approved_     │  │
   └──────────┬───────────┘   │ awaiting_     │  │
              │ resubmit      │ payment       │  │
              │ (same ref,    └────┬──────────┘  │
              │  new revision)      │ payment    │
              └──────────► submitted/under_review │ confirmed
                          (history preserved)     │            │
                                      ┌───────────▼────────┐   │
                                      │     registered      │◄──┘
                                      └────┬───────────┬───┘
                                           │ suspend  │ close
                                      ┌────▼─────┐ ┌───▼──────┐
                                      │suspended │ │  closed  │
                                      └──────────┘ └──────────┘
```

**Guards (enforced in `packages/core`, not in the UI):**

| Guard | Rule |
| --- | --- |
| `registered` | Requires `payment_status = payment_confirmed` **and** every required fee component `confirmed` |
| `rejected` | Requires a reason; terminal for payment |
| `requires_correction` | Makes the application editable; **does not** create a new application |
| `suspended` / `closed` | Requires `registry.manage` permission; always audited |
| any transition | Writes `audit_logs` and enqueues the notification in the same transaction |

### 4.2 Payment status

```
not_required_yet → awaiting_payment → payment_submitted → awaiting_confirmation
                                                                │
                                                      ┌─────────┴─────────┐
                                                      ▼                   ▼
                                              payment_confirmed   payment_evidence_rejected
                                                                          │
                                                                          ▼
                                                                 (resubmit, same application)
```

`payment_evidence_rejected` returns to `payment_submitted` on resubmission.
It never creates a new application (§9.2).

### 4.3 The two axes are separate

Spec §14 — "Application status and payment status should be logically
separated because business approval and payment confirmation are different
processes." They are separate columns, updated by separate transitions, and
neither derives the other implicitly. The only cross-axis rule is the
`registered` guard.

---

## 5. Notification events (§15)

| Event | Trigger | Recipient |
| --- | --- | --- |
| `application.submitted` | First successful submission | Applicant |
| `application.under_review` | Reviewer opens the application | Applicant (optional) |
| `application.correction_requested` | Reviewer requests corrections | Applicant |
| `application.resubmitted` | Applicant resubmits | Reviewer |
| `application.approved` | Reviewer approves | Applicant — **includes payment instructions** |
| `application.rejected` | Reviewer rejects | Applicant — **includes the reason** |
| `payment.submitted` | Applicant uploads evidence | Applicant |
| `payment.evidence_rejected` | Verifier rejects evidence | Applicant — includes resubmission instructions |
| `payment.confirmed` | Verifier confirms payment | Applicant |
| `registration.completed` | Registration finalised | Applicant — **includes reference and status** |
| `registration.suspended` | Registration suspended | Applicant |
| `vendor.linked` | Voeq vendor linked | Super Admin |

Each event maps to one React Email template. Templates are version-controlled
in `packages/email` and rendered with the reference, business name and a deep
link to the applicant's status page (§7.1 — the notification links directly
to the application).

---

## 6. Indexes

```sql
CREATE INDEX ON applications (institution_id, status, submitted_at DESC);
CREATE INDEX ON applications (institution_id, category_id);
CREATE INDEX ON applications (institution_id, submitted_at DESC);      -- date filter
CREATE INDEX ON applications (reference);                              -- unique, already indexed
CREATE INDEX ON payments (application_id, fee_component, status);
CREATE INDEX ON notifications (status, created_at) WHERE status IN ('queued','failed');
CREATE INDEX ON audit_logs (institution_id, created_at DESC);
CREATE INDEX ON audit_logs (entity_type, entity_id);
CREATE INDEX ON documents (application_id, kind);
```

Full-text search for the reviewer table (spec §12.2 — filter by business
name):

```sql
CREATE INDEX ON applications USING gin (
  to_tsvector('simple', business_name || ' ' || applicant_name || ' ' || reference)
);
```

---

## 7. Migration order

1. `institutions` + `institution_campuses` + `institution_categories`
2. `institution_payment_config`
3. `users` + `roles` + `user_roles` + `role_permissions`
4. `applications` + `application_submissions` + `corrections` + `reviews`
5. `documents` + `supporting_links`
6. `payments`
7. `registrations` + `vendor_links`
8. `notifications` + `audit_logs`
9. `access_tokens` + `otp_codes`

Each step ships with the Super Admin seed that creates the NMU institution,
its two campuses, its category list, the category mapping, and the initial
fee configuration (values pending spec §21 decisions).
