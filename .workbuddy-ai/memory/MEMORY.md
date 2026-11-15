# voeq-registry — long-term project notes

## What this project is
A separate repo (this workspace) implementing the **Voeq × Nigeria Maritime
University** business registration, verification and management system, per the
NMU specification in `docs/spec/`. Planning complete 2026-11-15; build not
started.

## Non-obvious context that is expensive to rediscover

- **The marketplace repo is on a different machine.** voeq.ng source is NOT here.
  Integration work that touches voeq.ng's data model must be done there and
  coordinated separately.
- **NMU = Nigeria Maritime University**, campuses Okerenkoko and Kurutie
  (slugs `nmu-okerenkoko`, `nmu-kurutie`). The spec document mis-expands it as
  "Niger Delta University of Marine Studies" — a conflation with Niger Delta
  University (NDU, a different university). Still awaiting confirmation.
- **voeq.ng's `verified` boolean means "reviewed by Voeq"**, not "registered by
  the university". Never overload it for the NMU badge — use the separate
  `institutionalVerifications[]` field.
- voeq.ng is Next.js App Router + Tailwind v4 with `data-env` theming
  (`cream`/`deep`). The registry copies this stack deliberately so components
  port without translation.
- Public images on voeq.ng live on Cloudinary account `jq9gwigz`, folder
  `voeq/`. Approved business imagery should go there so it enters the existing
  marketplace pipeline.
- Money is stored as integer minor units (`priceMinor`, kobo) on voeq.ng. Match
  that convention.

## Conventions to keep

- Design tokens live in `packages/design-system/src/tokens.css`, extracted
  verbatim from production CSS. Never eyeball-adjust a token; never hardcode a
  hex in a component.
- The applicant experience is **mobile-first** — students apply on phones, often
  on expensive data. Client-side image compression before upload is a
  deliberate performance decision, not a nice-to-have.
- Playfair Display is for headings only. Never in form labels or table cells.
- Money is never shown in minor units. Always format via `formatNaira()`.

## The user's standards

Very precise about UI design, UX, and exactly what changed. Wants explicit
reporting of every file touched and every decision made. Favours being asked
the right question over being given a guess. Treat creative latitude as
granted on design, but never on facts about their institution or data.
