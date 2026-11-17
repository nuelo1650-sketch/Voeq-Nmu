# Voeq × Nigeria Maritime University — Complete Session Handoff

_Last updated: 2026-11-17. All coding phases complete; production live at
`https://nmu.voeq.ng`._

> **Security note:** every secret value is intentionally **redacted** in this
> document. This file is safe to commit. The real values live in the two places
> named in section 2. Do not paste them into docs, chat, or tickets.

---

## 1. What this project is

A university business register for Nigeria Maritime University (campuses
**Okerenkoko** and **Kurutie**, slugs `nmu-okerenkoko` / `nmu-kurutie`), built
as a separate service for Voeq. Students apply on phones, a Media Unit officer
reviews, and approved businesses appear in a public directory with a verifiable
badge that the main voeq.ng site will consume later.

Design direction: **"The Register"** — a hydrographic chart and ship's log, not
a recoloured marketplace. Codified in `docs/08-DESIGN-DIRECTION.md`.

---

## 2. Where everything is placed

### Repositories and environments

| Thing | Location |
| --- | --- |
| Source repo | `C:\Users\owida\OneDrive\Documents\Voeq` → `github.com/nuelo1650-sketch/Voeq-Nmu`, branch `main` |
| Local runtime env | **`.env` at the repo root** (gitignored). Read by `npm run dev` via `node --env-file=../../.env` |
| Production host | Vercel project **`nmu-registry`**, id `prj_zIGUAMe51xQgFgAKgBYUa9eC5spm`, Vercel team `team_h7uVJ0BfGvyuPtiRjs9z0fJM` |
| Production URL | `https://nmu.voeq.ng` (custom domain, Cloudflare **CNAME grey-cloud / DNS-only**) and `https://nmu-registry.vercel.app` |
| Database | Supabase Postgres via Prisma pooler — `DATABASE_URL` in `.env` and in Vercel |
| Email | Separate Resend account for the registry; domain `nmu.voeq.ng` verified; sender `NMU Business Register <register@nmu.voeq.ng>` |
| Bot protection | Cloudflare Turnstile widget `nmu-registry` for `nmu.voeq.ng`; site key `0x4AAAAAAGFridZJpvuOoQYE` (public), secret in `.env` / Vercel |
| Image storage | Cloudinary account `jq9gwigz`, folder `voeq/`; R2 S3 credentials also stored for the Cloudflare side |
| OAuth | Google Cloud OAuth client `296084254850-0du7jshcqc14mhslt28jcprfrmtreslm.apps.googleusercontent.com` (client ID is not secret; secret is in `.env` / Vercel) |
| Auto-deploy | Hourly watcher automation id `21c0504a-cbc0-4847-bf11-d6e669af4b9f` (ACTIVE) — **not** native Git push-to-deploy yet |
| Last verified deploy | `dpl_aiwX612VA5r92Z9ge4EZWUqMWy2a` — READY, OAuth `invalid_client` fix |

### Environment variable map

All keys below exist in the root `.env`. Runtime keys were also pushed to
Vercel via the REST API. `VERCEL_DEPLOY_TOKEN` is a local-only management
credential and is **never** needed by the app at runtime.

| Variable | Purpose | Value status here |
| --- | --- | --- |
| `APP_URL` | Canonical app URL; currently `http://localhost:3000` locally | non-secret, shown |
| `AUTH_SECRET` | Auth.js session/JWT signing + magic-link HMAC | redacted |
| `DATABASE_URL` | Supabase pooler connection string | redacted |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | redacted here (client ID above) |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | redacted |
| `RESEND_API_KEY` | Registry-only Resend account | redacted |
| `EMAIL_FROM` | `NMU Business Register <register@nmu.voeq.ng>` | non-secret, shown |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Client widget key | non-secret, shown above |
| `TURNSTILE_SECRET_KEY` | Server-side `siteverify`; presence enforces Turnstile | redacted |
| `CLOUDFLARE_API_TOKEN` | Turnstile widget management / Cloudflare API | redacted |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account id | redacted |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Approved-photo pipeline | redacted |
| `R2_S3_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | Cloudflare R2 storage | redacted |
| `STAFF_ALLOWLIST_PLATFORM` | `owidavid2002@gmail.com` | non-secret, shown |
| `STAFF_ALLOWLIST_REGISTER` | Empty — register staff are added through the admin UI | non-secret, shown |
| `BANK_ACCOUNT_NAME`, `BANK_ACCOUNT_NUMBER`, `BANK_NAME`, `BANK_ACCOUNT_TYPE` | Test bank details for the fee-intent loop (Moniepoint) | redacted |
| `BANK_ALERT_INBOX`, `BANK_TEMPORARY` | Statement-import helpers | redacted |
| `VERCEL_DEPLOY_TOKEN` | Vercel REST API deployments | redacted — **rotate after launch; it appeared in chat** |

**Google-side prerequisites that cannot be set from code:** authorized
JavaScript origin `https://nmu.voeq.ng`; authorized redirect URI
`https://nmu.voeq.ng/api/auth/callback/google`; and, while the OAuth client is
in Testing mode, `owidavid2002@gmail.com` (and every future staff address)
must be added as a **Test user**.

---

## 3. What we built — chronological

### Roadmap phases

- **Phase 1 — application + review workbench.** Magic-link applicant access
  (`aa21ec2`), applicant status page, `/track` page rebuilt as a self-explaining
  page with the real Voeq logo (`17aa975`), full review workbench with complete
  dossier, consent record, decision history, private photos via signed URLs
  (`3aa168a`), no pills anywhere + clearly clickable decisions + full
  "Not provided" placeholders (`a0c611d`), two-tier decision checklist —
  photo check gates *all* decisions, correctness affirmations gate approval
  only (`69d6a04`), corrections/resubmission with side-by-side revisions
  (`5c28131`), staff notes and resubmission encounter signals (`3fb638a`),
  draft autosave (`f5a89c5`).
- **Phase 2 — the money loop** (`d160d78`). Fee intents issued at approval,
  applicant claim, bank statement CSV import, exact-match staging,
  maker–checker confirmation, registration and publication. Money stored in
  integer minor units (kobo); never displayed raw — always via `formatNaira()`.
- **Phase 3 — registry side** (`cf3d711`). Public directory, verify API, badge
  lifecycle (suspend / lift / close), and the vendor sync queue.
- **Phase 4 — super admin** (`69706ab`). Institutions, campuses, categories,
  staff accounts, `RoleGrant` management, audit browser, reports, integrations
  panel, and the first real hash-chained audit-log writers.
- **Phase 5 — hardening** (`ee7749e`). Rate limits, security headers/CSP,
  accessibility pass, privacy notice, health monitoring, backup/restore
  scripts, reviewer playbook, and 3G performance measurement.

### Post-build punch list

- Cloudflare Turnstile end to end (`a65ba83`): `lib/turnstile.ts` (fail-closed
  `siteverify`, skipped only when unset), `turnstile-widget.tsx`
  (`appearance: interaction-only`, single-use token reset), wired into apply
  submit and `/api/track/link`, CSP allowances for challenges, and gated forms.
- Resend **separated** from voeq.ng so the OTP pipeline's 100/day free quota is
  untouched. `nmu.voeq.ng` domain verified and a real test letter delivered.
- `docs/10-DEPLOYMENT-CHECKLIST.md` written; deployment decisions locked:
  **grey-cloud first**, **wipe all fixtures clean** before final verification.
- Vercel project created and configured via REST API. Build command
  `npx prisma generate --schema=../../packages/db/prisma/schema.prisma && next build`
  (Vercel blocks Prisma's install scripts, so generation must be explicit).
  Deployment protection disabled. Custom domain attached and live.
- Genuine `voeq.ng/favicon.ico` installed plus a matching
  `apple-touch-icon.png`; explicit metadata icons in `app/layout.tsx`.
- Brand/access pass (`f633c07`): skip link, discreet footer Staff sign-in link,
  `/dev/ledger` production guard, CSP `blob:` allowance, `no-store` on badge
  truth APIs, role-aware landing (`6e4f7f8`).
- First super-admin seeded for `owidavid2002@gmail.com` via
  `tooling/seed-superadmin.mjs` — `platform` family, all 11 permissions
  unrevoked, lands directly in `/admin`.
- OAuth `invalid_client` fix (`e9c4eda`): Auth.js v5 defaults to
  `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET`, so the Google provider now receives
  `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` explicitly.

---

## 4. Key files by area

| Area | Files |
| --- | --- |
| Core domain | `packages/core/src/permissions.ts`, `packages/core` audit hash-chain |
| Database | `packages/db/prisma/schema.prisma`, `packages/db/src/worker.ts` (outbox worker, separate process) |
| Email | `packages/email` — Resend adapter and seven templates |
| Design tokens | `packages/design-system/src/tokens.css` — marketplace layer (`--role-*`, `--color-*`, verbatim from voeq.ng, never adjust) + register layer (`--reg-*`) |
| Auth / admin | `apps/registry/src/lib/auth.ts`, `admin.ts`, `admin-actions.ts`, `audit-write.ts`, `reports.ts`, `rate-limit.ts`, `turnstile.ts`, `apply-schema.ts` |
| Admin UI | `apps/registry/src/components/admin/*`, `app/admin/page.tsx`, `app/staff/page.tsx`, `app/staff/signin/page.tsx` |
| Applicant | `app/apply/ApplyForm.tsx`, `app/track/*`, `components/turnstile-widget.tsx` |
| Public | `app/api/public/verify/route.ts`, `app/api/public/directory/route.ts`, `app/directory`, `app/privacy` |
| Monitoring | `app/health/route.ts`, `next.config.ts` (headers/CSP) |
| Tooling | `tooling/shot.sh`, `check-tokens.sh`, `backup.sh`, `restore-test.sh`, `seed-superadmin.mjs`, `tooling/e2e/*` |
| Docs | `docs/00`–`docs/10`, this file; long-term project notes in `.workbuddy-ai/memory/MEMORY.md`, daily logs alongside |

---

## 5. Design conventions that must survive

- **Fraunces** is the display face; **IBM Plex Mono** carries every number,
  reference, date and status label.
- Radius **0** on controls and blocks; chips are the only exception — and
  chips were removed site-wide. **Rules, not shadows.**
- Body copy at **34–40ch** measure.
- Mobile-first: applicants use phones on expensive data; client-side image
  compression is deliberate.
- The fee split is **not public** — no amounts on public surfaces or public
  APIs; the breakdown appears only on the applicant's own status page.
- `verified` on voeq.ng means "reviewed by Voeq" — never overload it for the
  institutional badge; use `institutionalVerifications[]`.

---

## 6. Verification already done

- Full E2E loop passed: apply → staff note → corrections → resubmit → approve
  → fee intent → claim → bank CSV import → staged match → fee confirm →
  register → publish → directory listing → verify API.
- Three real bugs found and fixed by E2E: React 19 `e.currentTarget` null after
  `await` in the ledger form; stale CDN cache on badge truth APIs (now
  `Cache-Control: no-store`); CSP blocking `blob:` photo previews.
- `/dev/ledger` production exposure closed (404).
- Fixtures wiped; register launch-empty; sequence reset.
- 3G production measurement: home 161 KB gzipped, 113 kB First Load JS,
  1.7s good 3G / 3.2s regular 3G.
- Live at handoff: `/health` 200, `db: true`, zero breaches, zero pending or
  failed outbox, zero failed syncs, zero unpromoted images. OAuth redirect
  carries the correct client ID, callback URI and PKCE S256.

---

## 7. Still pending

1. **Kai:** retry `https://nmu.voeq.ng/staff/signin`; if Google shows
   "Access blocked", add `owidavid2002@gmail.com` as a **Test user**.
2. **Native push-to-deploy:** Vercel GitHub App must be authorized on
   `nuelo1650-sketch/Voeq-Nmu` by the repo owner. Until then the hourly watcher
   deploys, and manual instant deploys are done through the Vercel REST API.
3. **Cloudflare WAF rate rule** on `nmu.voeq.ng` — deliberately deferred to
   phase two of the DNS plan, after initial verification.
4. **voeq.ng-side cross-repo work** (different machine): vendors/link sync
   endpoint, badge indicator on vendor profiles, onboarding for businesses not
   yet on Voeq.
5. **Final gate:** Kai's brother runs the entire workflow once, in one sitting,
   after everything above is stable.
6. **Rotate the Vercel token** that was pasted into chat, once launch settles.

---

## 8. Fast recipes

```bash
# Wipe stale .next BEFORE any build (PowerShell on Windows), then:
node --env-file=../../.env ../../node_modules/next/dist/bin/next dev -p 3000 -H 127.0.0.1

# Verify live production
curl -s https://nmu.voeq.ng/health
curl -s https://nmu.voeq.ng/api/auth/providers

# Outbox worker is a separate process and needs env explicitly
node --env-file=.env node_modules/tsx/dist/cli.mjs packages/db/src/worker.ts

# Serve prototype from the repo root (file: blocks @import and playwright-cli)
python -m http.server 8902 --bind 127.0.0.1 --directory <repo root>
```

`RoleGrant` has `revokedAt`, **not** an `active` field — filter on
`revokedAt: null` when checking permissions.
