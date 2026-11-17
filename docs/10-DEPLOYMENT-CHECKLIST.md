# 10 — Deployment checklist (nmu.voeq.ng)

Every step below is ordered. Nothing here needs code changes — the build is
complete (Phases 0–5). Steps marked **[KAI]** need your hands; the rest can
be executed by the agent given a Vercel access token.

---

## 0. Decisions already made

| Thing | Decision |
|---|---|
| Domain | `nmu.voeq.ng` (registered; subdomain of the main site) |
| Email | Resend account dedicated to the registry — domain **verified**, sender `register@nmu.voeq.ng` |
| Bot gate | Cloudflare Turnstile widget `nmu-registry` (domains already include nmu.voeq.ng + localhost) |
| Staff sign-in | Google OAuth client for nmu.voeq.ng, **Testing mode** — no verification needed, staff emails added as test users |
| Database | The existing Supabase project IS the production database (all migrations already applied there) |
| Super-admin | `owidavid2002@gmail.com` seeded (platform family, all permissions) |

## 1. Vercel project

- Import `github.com/nuelo1650-sketch/Voeq-Nmu`.
- **Root directory: `apps/registry`** (monorepo — Vercel must build the app, not the repo root). Framework: Next.js (auto-detected). Node 20+.
- Environment variables (Production + Preview) — values live in the local
  `.env`; copy them 1:1 except `APP_URL`:

| Variable | Value / note |
|---|---|
| `DATABASE_URL` | Supabase pooler URI (as in `.env`) |
| `APP_URL` | **`https://nmu.voeq.ng`** (not localhost) |
| `AUTH_SECRET` | Same value (HMAC access tokens + NextAuth sessions) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | nmu.voeq.ng's own client |
| `STAFF_ALLOWLIST_PLATFORM` | `owidavid2002@gmail.com` (add more, comma-separated) |
| `STAFF_ALLOWLIST_REGISTER` | Media Unit Google emails, comma-separated |
| `RESEND_API_KEY` | The registry's own key |
| `EMAIL_FROM` | `NMU Business Register <register@nmu.voeq.ng>` |
| `CLOUDINARY_CLOUD_NAME` / `_API_KEY` / `_API_SECRET` | as in `.env` |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | `0x4AAAAAAGFridZJpvuOoQYE` |
| `TURNSTILE_SECRET_KEY` | as in `.env` |
| `BANK_ACCOUNT_NAME` / `_NUMBER` / `_BANK_NAME` / `_ACCOUNT_TYPE` | school's dedicated account when it arrives; Kai's details until then |
| `BANK_TEMPORARY` | `1` until the school account lands (amber banner shows on the payment card) |
| `VOEQ_SYNC_URL` / `VOEQ_SYNC_TOKEN` | omit for now — vendor sync stays queued and honest until the voeq.ng machine work lands |

## 2. Google OAuth client **[KAI or agent with console access]**

- Authorized JavaScript origins: `https://nmu.voeq.ng` (and `http://localhost:3000` for dev).
- Authorized redirect URIs: `https://nmu.voeq.ng/api/auth/callback/google` (and `http://localhost:3000/api/auth/callback/google`).
- Keep the app in **Testing** mode. Add every staff Google email as a test user. Sign-in flow consumes the token immediately, so the testing-mode token expiry is irrelevant.

## 3. DNS + Cloudflare

- Add the domain in Vercel: `nmu.voeq.ng` → it shows the CNAME target (`cname.vercel-dns.com`).
- In Cloudflare DNS: create CNAME `nmu` → `cname.vercel-dns.com`.
  - **Phase A (launch day, simplest): DNS-only (grey cloud).** Vercel issues TLS directly; nothing can interfere. Verify the whole app end to end.
  - **Phase B (after launch verification): enable proxy (orange cloud)** with SSL mode `Full (strict)`, then add the WAF rate-limit rule below. Proxying through Cloudflare is what puts the outermost DDoS shield in front of Vercel.
- Cloudflare WAF rule (Phase B): rate-limit `> 30 requests / 10 seconds` per IP on `http.request.uri.path contains "/api/"` → Block. Turnstile + app-level limits handle the rest.

## 4. Resend — DONE

- Domain `nmu.voeq.ng` verified, sending enabled, key wired into `.env`.
- Free tier = 100 emails/day. Registry letters are human-scale (a few per application). The `/api/track/link` email budget is protected by rate limit (5/min) + Turnstile.

## 5. Monitoring

- Point any uptime monitor (UptimeRobot free tier is fine) at `https://nmu.voeq.ng/health`.
- Alert when: HTTP != 200, or the JSON contains `"status":"degraded"` / non-empty `breaches`. The endpoint watches outbox backlog, failed letters, vendor-sync failures, and evidence awaiting promotion.

## 6. Backups

- Schedule `tooling/backup.sh` (needs `pg_dump` on the machine that runs it; Supabase project settings show the direct connection string for dumping).
- Run `tooling/restore-test.sh` **once before launch** into a scratch database, then monthly. An untested backup is not a backup.

## 7. Pre-launch data note

The Supabase project carries the dev fixtures (`NMU-2026-0001` REGISTERED,
`NMU-2026-0002`, the demo RPA institution and demo account from Phase 4).
Decide before the brother's test: keep `NMU-2026-0001` (useful as the live
example in the directory + badge demo) and delete the rest from
`/dev/admin`; or wipe all fixtures for a clean launch. **[KAI]**

## 8. The one-sitting verification — LAST, after everything above

Kai's brother runs the full workflow once, start to finish:

1. Apply on the phone (photos from camera, draft save/resume, submit → letter #1).
2. Track: request access link → open the ship's log page.
3. Staff: sign in at `/staff/signin` → review dossier, open every photo, approve → fee intent issued, letter #4.
4. Applicant: claim payment → letter #5 with bank details → (brother sends real transfer of ₦2,000 narrated with the reference).
5. Finance: import the bank CSV/statement → match stages → confirm (maker ≠ checker) → REGISTERED + published + photos promoted.
6. Public: `/directory` shows the business with its photo; the verify URL returns valid; a Voeq badge check against `/api/public/verify`.
7. Corrections path: request corrections on a second application → resubmit → re-review.

## 9. Post-deploy smoke checks (first 10 minutes)

- `/` renders, Turnstile loads silently on the form.
- `/privacy`, `/directory`, `/track` all 200.
- `GET /health` → `status:"ok"`, empty breaches.
- One real application submitted from Kai's phone → letter #1 arrives **from nmu.voeq.ng**.
- Staff sign-in with `owidavid2002@gmail.com` works; `/admin` opens.
