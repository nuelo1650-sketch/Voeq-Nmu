# 08 — Design Direction

> **Status:** approved direction, 15 Nov 2026. Supersedes the first pass
> (`docs/04-DESIGN-SYSTEM.md` §3, the maritime-teal layer).
>
> This document replaces the "warm card grid on cream" approach. It answers a
> specific complaint — *the design reads as basic* — with a specific cause and
> a specific remedy.

---

## 1. Why the first pass read as basic

The first prototype was competent and wrong. It used the voeq.ng tokens
faithfully: cream ground, forest nav, amber accent, Playfair, white rounded
cards, pill buttons. It looked like the marketplace with the colours shifted.

Three reasons, in order of how much they cost it:

1. **It was the top AI cliché.** The Voeq creative exploration
   (`01-CREATIVE_DIRECTION_EXPLORATION.md` §1.2) already names this trap:
   *"cream background (~#F4F1EA) with a high-contrast serif display and a
   terracotta accent"* is the single most common generated look. Cream +
   Playfair + amber + rounded cards on white is that template. Adding a
   fourth hue (maritime teal) made it *more* generic, not less — it read as a
   template with a coat of paint.

2. **Cards instead of craft.** Every piece of content sat in a floating white
   rounded rectangle with a soft shadow. That is the default shape of every
   SaaS interface ever shipped. Nothing in it was set — it was *filled*.

3. **Copy that said nothing.** "Register your business. Properly." is a
   sentence that could sit on any university, in any country, for any service.
   "One application replaces the old paper-and-letter process" explains the
   feature, not the stakes.

There is a fourth reason that is not the designer's fault: **no art-directed
imagery.** Every exploration in the Voeq repo used Unsplash stock. The
handoff (`DESIGN_HANDOFF.md` §3.2) says it plainly — stock photography is the
fastest way to make a page look like a template.

The remedy is not a different palette. It is a different **material**.

---

## 2. The direction: **The Register**

> A university business register, set like a hydrographic chart and a ship's
> log — an official record that happens to be alive.

Three ideas, borrowed from the Voeq explorations that worked:

| Borrowed from | What |
| --- | --- |
| Direction A — *The Campus Broadsheet* | The editorial grammar: masthead, folios, rules, measured measure, asymmetric grid. It was the most "premium + editorial" of the four and it already said **"NMU EDITION · ISSUE 01"**. |
| BG-darkfield / D — *Contour Field* | The background as a real phenomenon — chart lines and plotted marks, **bold**, not timid texture. |
| §1.1 of the creative doc | *"Alive" comes from real data moving, never from decoration.* |

**What makes it NMU rather than a magazine:** the background phenomenon is a
**hydrographic chart** — bathymetric depth contours, soundings, plotted marks.
Nigeria Maritime University is a maritime institution. A registry of
campus businesses plotted on a chart is a genuinely specific idea, not a
texture, and it is the same contour concept the founder already loved, given
a reason.

**What makes it a register rather than a magazine:** the grammar is a ledger.
Numbered folios, ruled rows, monospace references, tabular figures, an
explicit audit trail. The applicant-facing pages are set like a **typeset
form**; the staff pages are set like a **ledger book**.

---

## 3. Materials

### 3.1 Palette

Three families and one signal. No fourth hue — the earlier maritime-teal layer
is **withdrawn**, because a fourth colour was the "basic" move. The maritime
identity is carried by the chart and the mark, not by a swatch.

| Token | Value | Role |
| --- | --- | --- |
| `--paper` | `#F4EFE2` | The page. Warmer and deeper than the marketplace cream — paper, not screen |
| `--paper-2` | `#EDE6D4` | Sunken panels, table headers, inset blocks |
| `--paper-3` | `#E4DCC6` | Deeper inset — quote blocks, code, specimen panels |
| `--ink` | `#1E3A29` | Printing ink, not black. All primary type, rules, fills |
| `--ink-soft` | `#33493B` | Secondary type |
| `--ink-faint` | `#6B7A6E` | Tertiary type, folios on paper |
| `--marine` | `#12333D` | **The NMU identity.** Deep water. Chart fields, the seal, NMU marks |
| `--marine-deep` | `#0B242B` | The chart field ground |
| `--marine-lift` | `#1E4E5C` | Chart lines on the field, marine panels |
| `--foil` | `#9C7A2E` | Muted gold — foil on the spine. Rules, folios, plot marks. **Never a body-text colour** |
| `--foil-light` | `#C9A227` | Foil on marine |
| `--rule` | `#C9BE9E` | Hairlines on paper |
| `--line` | `#D8CFB4` | Lighter hairlines, grid |
| `--signal` | `#A8492E` | Restrained rust — "action needed", rejection, overdue |
| `--seal` | `#2D5A3D` | Registered / verified |

Contrast checks: `--ink` on `--paper` is ≈ 11.8:1 (AAA). `--foil` on `--paper`
is ≈ 4.7:1 — acceptable for large text and non-text, **never** for body copy.
`--foil` is decorative and structural only. `--signal` on `--paper` is ≈ 5.9:1.

### 3.2 Type

| Role | Family | Weights | Use |
| --- | --- | --- | --- |
| Display | **Fraunces** | 300–600, optical size 9–144, italic 500 | Masthead, headlines, business names, big numerals |
| UI / body | **Inter** | 400–600 | Everything functional |
| Meta / folio | **IBM Plex Mono** | 400–500 | Folios, references, amounts, dates, status, labels, section meta |

**Fraunces, not Playfair.** The creative doc chose Fraunces for exactly this
reason — *"a characterful old-style optical serif with personality — not the
cliché Playfair."* Playfair on cream is the generated look. Fraunces has
optical sizing, so the same family sets a 72px masthead and a 20px business
name with different proportions, which is what makes a display face look
*set* rather than *scaled*.

**IBM Plex Mono for all data.** References, amounts, dates, ages, status
labels, folios, counts. One mono family for every number and label in the
product is what makes an admin feel like an instrument rather than a page.

### 3.3 Geometry

| Element | Geometry | Reasoning |
| --- | --- | --- |
| Buttons | `border-radius: 0`, 1px ink border or solid ink fill | Printed form language. A pill button is a consumer UI, not a registry |
| Inputs | `border-radius: 0`, 1px `--rule` border, paper fill | Ditto |
| Cards | **No cards.** Content sits in ruled blocks separated by hairlines | The single biggest change from the first pass. Rounded floating rectangles are the shape of every generated interface |
| Chips / filters | `border-radius: 999px` | The one deliberate exception — a physical chip |
| Radius elsewhere | 0 | |
| Elevation | Almost none. **Rules, not shadows** | Shadows say "floating"; rules say "in a register" |
| Motion | 160ms / 320ms, `cubic-bezier(.2,.6,.2,1)` | Unchanged |

### 3.4 The chart field

The background phenomenon, used in exactly three places: the landing hero, the
closing CTA band, and the public register's masthead panel.

- Concentric **bathymetric contours** in `--marine-lift` on `--marine-deep`,
  at 30–45% opacity — **bold**, not the timid 6–9% that the handoff rejected.
- **Soundings** (depth figures) in IBM Plex Mono, low opacity, scattered.
- **Plot marks**: small `--foil-light` dots with a hairline crosshair —
  registered businesses, plotted.
- **Static.** No ambient motion. The handoff's rule stands: motion is earned
  by real data or it is decoration.
- On paper, the same contour motif drops to a **hairline** at 8–12% opacity
  behind section content, where it reads as engraving rather than image.

---

## 4. Grammar

### 4.1 The masthead

Not a nav bar. A **masthead**, two lines, with a 2px ink rule under it:

```
NMU MEDIA DEPARTMENT · BUSINESS REGISTER · 2026          ← IBM Plex Mono, 11px, .18em tracking
Nigeria Maritime University           [Register] [Directory] [Track an entry]   ← Fraunces lockup + nav
─────────────────────────────────────────────────────────────────────────────────  ← 2px ink rule
```

A mono meta line above a serif lockup is the entire identity of a printed
publication. It costs one line and it changes what the page is.

### 4.2 Folios

Every section and every entry carries a **folio** — a mono number in the
margin. `01`, `02`, `03`. In the register, the folio list is the signature
component:

```
01   Khim Culinary Institute          Food and Drinks        NMU-2026-0042
02   Larus Graphics Ltd               Printing and Graphics   NMU-2026-0038
```

### 4.3 Rules over boxes

Section boundaries are a hairline rule plus a mono right-aligned section
meta:

```
────────────────────────────────────────────────────────  REGISTERED · 96 OF 96
```

That reads as a ledger. A row of rounded cards with drop shadows reads as a
template.

### 4.4 Measured measure

Body copy is set to **34–40ch**. Line length is the cheapest premium signal
there is, and it is the one most often skipped.

### 4.5 Asymmetry

12-column grid, deliberately unbalanced: 7/5 for the hero, 5/7 for the
register specimen, 8/4 for the fee band. Never centred by default.

---

## 5. Per-surface intent

### 5.1 Landing

The **chart field** carries the hero. Type sets itself; the rule wipes in.

**Copy register:** specific, confident, institutional. No feature-tour
language. The subject is the *business and its standing*, not the *software*.

| Element | Copy |
| --- | --- |
| Folio kicker | `NMU MEDIA DEPARTMENT · BUSINESS REGISTER · 2026` |
| Headline | **Put your business on the record.** |
| Standfirst | "Register your business with the Media Department in one sitting. A person reads every entry, and an approved business is listed in the campus register — and on voeq.ng, where students are already looking." |
| Primary action | `Register your business →` |
| Secondary action | `Look up an entry` |
| Live strip (mono) | `96 ENTERED · 23 IN REVIEW · 21 ON CAMPUS` |

The live strip is the "alive" principle: three real numbers, moving.

**Sections**

1. Hero — chart field, headline, standfirst, actions, live strip
2. `HOW AN ENTRY IS MADE` — a **numbered folio list**, not four cards
3. `WHAT AN ENTRY NEEDS` — a **ruled two-column list**, not four cards
4. `THE REGISTER` — a specimen of real entries, numbered, with references
5. `FEES` — one honest sentence, **no amounts, no split** (see §7)
6. Closing band — marine field, single action

### 5.2 Application form

The form is a **typeset document**, not a wizard of rounded boxes.

- A **margin-note column** on the right (desktop) carries "what you'll need"
  and a help link — set like a printed margin note, hairline-ruled.
- Section headings numbered `01 — About you`, in Fraunces with a mono folio.
- Choice controls are **ruled option rows** with a radio circle, not tiles.
- Inputs square, 1px rule, paper fill, ink focus ring at 2px.
- A **persistent mono save state** in the header: `SAVED 14:32`.
- The review step reads like a **typeset specimen** — the application set as a
  document, with hairline rules and mono field labels in the margin.
- File uploads are a **ruled list**, not a dropzone tile.

### 5.3 Applicant status

The `ApplicationTimeline` becomes a **ship's log** — dated entries in mono,
each with a rule and a left-margin mark. Reads as a record, not a progress bar.

### 5.4 Public register (directory)

A **numbered index**, not a card grid. The marketplace's card pattern is
replaced by a folio list: number, business name in Fraunces, category and
campus in mono, the NMU seal, and the reference. This is the component the
whole direction builds toward.

### 5.5 Media dashboard — the register desk

The current dashboard fails because it is a **poster**: eight metric tiles
above a table, none of which tell a reviewer what to do.

The rebuild is a **working instrument**:

- **A queue header, not a tile wall.** One dominant figure — the depth of the
  queue — with a compact ruled strip of the remaining counts beside it.
- **The work queue is the primary surface.** A dense ruled table, mono
  references, ages in mono (`3d`), status as an ink mark plus a label rather
  than a coloured pill.
- **One obvious next action per row.** Claim, open, decide.
- **Selection and bulk actions.** A bar appears with rows checked: assign,
  mark reviewed, export.
- **A dossier drawer, not a page.** Opening an application slides a panel from
  the right with the six sections and the decision actions. Triaging 23
  applications should not require 23 page loads.
- **Payment verification is a mode, not a sub-card.** It sits at the same
  level as the queue in the nav.
- **The receivable strip.** "₦1,000 receivable from NMU · last reconciled
  2 days ago" — the agency ledger made visible, because it is the thing that
  actually matters to the business.

### 5.6 Legal pages

Terms, Privacy and Cookie policy are **real documents** — a numbered clause
structure with a definitions section, set as a document with a measured
measure and a sticky clause index in the margin. Not a wall of text.

---

## 6. Motion

| Element | Motion | Duration |
| --- | --- | --- |
| Section rule | Wipes in left→right on enter | 320ms |
| Display headline | Words rise and fade, staggered 40ms | 600ms |
| Folio list rows | Fade up, staggered 30ms | 320ms |
| Links | Colour shifts to `--foil` | 160ms |
| Buttons | 1px lift, no scale | 160ms |
| Chart field | **None** | — |
| Everything else | **None** | — |

`prefers-reduced-motion` collapses all of it to instant. Already handled by
the shared token file.

---

## 7. The fee split is not public

**Decision.** The public landing page carries no amounts and no breakdown. The
split between the university fee and the Voeq platform fee is an internal
arrangement between Voeq and the institution, and publishing it invites the
wrong conversation with applicants and with the Department.

The public line is one sentence, and it is honest:

> Applying is free. If your entry is approved, a registration fee applies —
> the exact amount and where to pay it appear on your own status page.

**Where the breakdown does appear:** on the applicant's own authenticated
status page, in the payment block — because they must know how much to send
and where. That is necessary and private.

**Where it never appears:** the landing page, the public register, the
directory, the marketing copy, or any public API.

No announcement is made about the hiding. The line reads naturally; there is
nothing to explain.

---

## 8. Imagery

The single biggest premium lever, and the one the handoff identifies as the
thing that sank the previous attempts.

- **Art-directed, never stock.** Real campus businesses, real hands at work,
  warm and human. Never a smiling stock model, never a gradient.
- In the prototype, imagery is **crafted** — duotone treatment in ink/marine
  with the chart motif, so it reads as art direction rather than a missing
  file.
- The chart field replaces photography where photography would have been
  filler. It is the NMU-specific artefact.

---

## 9. What is explicitly dropped

| Dropped | Why |
| --- | --- |
| The maritime-teal `--nmu-*` layer | A fourth hue was the "basic" move. Identity comes from the chart, the seal and the register grammar |
| Rounded floating cards | Replaced by ruled blocks. Cards are the shape of a template |
| Pill buttons | Square. A pill is a consumer control |
| Playfair Display | The cliché. Fraunces has optical sizing and actual character |
| The eight metric tiles | A queue header and a ledger strip instead |
| "Start an application →" | Every SaaS site has this button. The register has its own voice |

---

## 10. Checking the work

Before any screen is called done:

1. **Grey-scale test.** Does it still have hierarchy? If it collapses, the
   hierarchy was colour, not structure.
2. **Remove all copy.** Do the rules, folios and grid still read as a
   register? If not, the structure is decoration.
3. **Squint test.** Is there one dominant thing per screen?
4. **Stock check.** Does any image look like Unsplash? Replace it.
5. **Adjacency check.** Would a stranger's logo sit here without a redesign?
   If yes, it is a template.
