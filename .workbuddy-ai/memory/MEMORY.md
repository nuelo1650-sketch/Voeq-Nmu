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

- Design tokens live in `packages/design-system/src/tokens.css` — **two
  layers**: the marketplace layer (`--role-*`, `--color-*`, extracted verbatim
  from voeq.ng production CSS, never adjust) and the register layer (`--reg-*`,
  authored here). Never hardcode a hex in a component.
- The applicant experience is **mobile-first** — students apply on phones, often
  on expensive data. Client-side image compression before upload is a
  deliberate performance decision, not a nice-to-have.
- Money is never shown in minor units. Always format via `formatNaira()`.
- **Fraunces** is the display face, not Playfair. Playfair-on-cream is the
  generated look. **IBM Plex Mono** carries every number, reference, date and
  status label in the product.
- **Radius 0** on every control and block; chips are the one exception.
  **Rules, not shadows** — content sits in ruled blocks, never floating cards.
- Body copy sits at a **34–40ch measure**. The line length is the cheapest
  premium signal and the one most often skipped.
- The **fee split is not public.** No amounts on any public surface, no public
  API. One honest sentence on the landing; the breakdown only on the
  applicant's own authenticated status page.

## The direction: "The Register"

The registry is a **university business register set like a hydrographic chart
and a ship's log** — not a marketplace with different colours. Full rationale
and grammar: `docs/08-DESIGN-DIRECTION.md`.

- **Masthead**, not a nav bar: mono meta line over a serif lockup, 2px rule.
- **Folios** (mono numbers in the margin) and the **folio list** are the
  signature component.
- **The chart field** (`apps/prototype/chart.svg`) is the background
  phenomenon — bathymetric contours and soundings on `--marine-deep`. Bold,
  static, no ambient motion. Appears in exactly three places.
- The **ship's log** replaces the progress-bar timeline for applicants.
- The staff dashboard is the **register desk**: one dominant queue figure, a
  ruled work queue, one obvious next action per row, a dossier drawer, and
  the receivable strip visible.

## The user's standards

Very precise about UI design, UX, and exactly what changed. Wants explicit
reporting of every file touched and every decision made. Favours being asked
the right question over being given a guess. Treat creative latitude as
granted on design, but never on facts about their institution or data.

**When he says a design "feels basic", diagnose the cause rather than
swapping the palette.** The first pass failed because it was the top AI
cliché (cream + Playfair + amber + rounded cards + generic copy + stock
imagery) — not because of the colours. The Voeq repo's own
`DESIGN_HANDOFF.md` says the same thing: *"The palette is fine; the problem
is execution, not the colors."*

## Tooling

- `tooling/shot.sh` — screenshot a prototype screen. The Playwright browser
  session **does not survive between shell invocations** here, so every
  capture must chain open → resize → screenshot in one call. The script does
  that.
- `tooling/check-tokens.sh` — assert token values by **computed styles**.
  A CSS custom property that fails to parse is dropped silently and the page
  still renders, just wrong.
- Serve from the repo root: `python -m http.server 8902 --bind 127.0.0.1
  --directory <repo root>`. The `file:` protocol blocks both relative
  `@import`s and playwright-cli.
