# Design System

The registry must feel like **the same product** as voeq.ng — not a
government form bolted onto a marketplace. This document is the contract for
that.

Tokens live in `packages/design-system/src/tokens.css` and were extracted
verbatim from production CSS on 2026-11-15.

---

## 1. Brand read

voeq.ng is not a typical SaaS marketplace. It reads **warm, editorial,
craft-oriented** — closer to a well-made print magazine than to a startup
landing page. The palette is warm (cream paper, forest ink, antique gold),
the headline face is a Didone-adjacent serif, and the UI is quiet: white
cards floating on cream, thin borders, soft forest-tinted shadows, pill
buttons.

The registry should inherit that warmth while adding the **clarity and
reassurance of an official process**. The tension to hold: *official but
welcoming* — not *bureaucratic*. Concretely: this is a university Media
Department the applicant already knows by name, and it should feel like a
competent institution that is also pleasant to deal with.

---

## 2. Tokens

### 2.1 Colour

| Role token | Cream (light) | Deep (dark) |
| --- | --- | --- |
| `--role-bg` | `#f5f1e8` | `#10231a` |
| `--role-surface` | `#ffffff` | `#173025` |
| `--role-surface-sunken` | `#faf6ec` | `#0c1b13` |
| `--role-text` | `#0a0a0a` | `#eef3ec` |
| `--role-text-muted` | `#4a4a4a` | `#9fb3a4` |
| `--role-border` | `rgba(15,42,29,.12)` | `#2a463a` |
| `--role-accent` | `#2d5a3d` | `#6fcf97` |
| `--role-accent-strong` | `#0f2a1d` | `#8fe3b0` |
| `--role-gold` | `#e8a33d` | `#e0b964` |
| `--role-danger` | `#b85c3e` | `#e08a7a` |

Supporting palette: `--color-forest` `#0f2a1d`, `--color-forest-mid`
`#2d5a3d`, `--color-amber` `#e8a33d`, `--color-cream` `#faf6ec`,
`--color-ink` `#0a0a0a`.

Semantic sets already exist and should be reused:
`--role-success-bg/-border/-text` (`#e8f5e9` / `#c8e6c9` / `#2e7d32`),
`--role-error-bg/-text` (`#fee2e2` / `#991b1b`), `--role-warning`
(`#d4922a`).

**Rules**

- Never hardcode a hex in a component. If a new colour is genuinely needed, it
  is added to `tokens.css` first and reused everywhere.
- Never introduce a third background colour. Two environments, one system.
- Status colours are chosen once, in one map, and used by every surface:

| Application status | Token | Rationale |
| --- | --- | --- |
| Submitted | `--role-text-muted` | Neutral — nothing decided yet |
| Under Review | `--role-accent` | In progress, live |
| Requires Correction | `--role-warning` | Action needed |
| Approved – Awaiting Payment | `--role-gold` | Positive but incomplete |
| Rejected | `--role-danger` | Terminal negative |
| Registered / Verified | `--role-success-text` (+ `--role-success-bg`) | Done, verified |
| Suspended | `--role-warning` | Paused |
| Closed | `--role-text-muted` | Inactive, neutral not alarming |

### 2.2 Typography

| Role | Family | Use |
| --- | --- | --- |
| Display | Playfair Display | Page titles, the hero, section headings, the reference number |
| UI / body | Inter | Everything else — labels, inputs, tables, buttons, help text |
| Mono | JetBrains Mono | Reference numbers, payment references, transaction IDs |

Rules:

- Playfair is for headings **only**. Never in form labels, table cells, help
  text, or body copy. Serif at 13–14px is measurably harder to read on a
  phone, and this portal is read on phones.
- Body copy: `Inter 16px / 1.35` — exactly as production.
- Hero on the landing page: `clamp(2rem, 5vw, 3.5rem)` (76px at desktop),
  weight 560, letter-spacing `-0.02em`, line-height 1.3.
- Production detail worth keeping: the word **"Grow."** is set in Playfair
  *italic* with a hand-drawn gold underline. The registry can reuse this
  device once — for its own word, not as decoration everywhere.

### 2.3 Space, radius, elevation, motion

- Space: `4 / 8 / 16 / 24 / 40 / 64 / 96`.
- Radius: `8 / 12 / 16 / 24 / 999`. Buttons and chips are `--radius-pill`.
- Elevation is **forest-tinted**, never neutral black — `0 1px 2px
  rgba(15,42,29,.06)` up to `0 8px 24px rgba(15,42,29,.12)`. Cards on cream
  read as paper on paper, not as floating plastic.
- Motion: `160ms` fast / `320ms` medium, easing `cubic-bezier(.2,.6,.2,1)`.
- Layout: `--container-max: 1200px`, `--nav-height: 56px`, `--section-gap:
  96px` (48px on mobile).

---

## 3. The NMU institutional layer

**Direction confirmed 15 Nov 2026: warm hybrid.** voeq.ng's paper-and-forest
foundation carries the product; a **maritime-teal layer** gives the NMU
surfaces their own institutional identity. The registry is recognisably Voeq,
and recognisably *the university's*, not a generic government form.

Tokens live in `packages/design-system/src/tokens.css` under `--nmu-*`.

| Token | Cream | Deep | Used for |
| --- | --- | --- | --- |
| `--nmu-deep` | `#0b3543` | `#0a2c37` | Masthead ground, NMU badge, seals |
| `--nmu-deep-strong` | `#07252f` | `#071f28` | Hover / pressed states |
| `--nmu-tide` | `#12586b` | `#6fc3d8` | NMU interactive accent — links, primary buttons, focus rings |
| `--nmu-tide-soft` | `#e6eff1` | `#10333d` | Tinted surfaces (selected cards, callouts) |
| `--nmu-tide-line` | `#b9d4da` | `#24596a` | Borders on tinted surfaces |
| `--nmu-badge-bg` | `#0b3543` | `#0b3543` | The **NMU Registered** badge ground |
| `--nmu-badge-ink` | `#f5f1e8` | `#9fe1cb` | Badge text |
| `--nmu-badge-dot` | `#e8a33d` | `#e8a33d` | Badge dot — the shared gold |

### 3.1 Division of labour

| Surface | Colour voice |
| --- | --- |
| Marketplace (voeq.ng) | forest + gold + cream. **No NMU teal.** |
| NMU applicant portal | cream ground, forest nav, **tide** for actions and focus |
| NMU institutional bands (fees, masthead, footer) | `--nmu-deep` ground with cream and gold |
| NMU dashboard | `deep` environment, tide as the interactive accent |
| The NMU badge | `--nmu-badge-bg` with a gold dot — on **any** surface |

The teal never appears on a marketplace surface unless it is part of the NMU
badge. The gold is shared across both products; it is the connective tissue.

### 3.2 The NMU badge

```
┌────────────────────────────────┐
│  ●  NMU Registered             │   --nmu-badge-bg, --nmu-badge-ink, gold dot
└────────────────────────────────┘
```

Distinct from the marketplace's existing `Verified` badge, which stays
forest-on-cream and means something different. A business can be Voeq-verified
but not NMU-registered, NMU-registered but not Voeq-verified, or both. Two
independent facts, two independent badges.

Render it on: the public directory card, the marketplace vendor profile, and
the applicant's status page once registration completes.

### 3.3 Typography in the NMU layer

Unchanged from the shared system — Playfair Display for headings, Inter for
everything else, JetBrains Mono for references. The NMU identity is carried by
**colour and the badge**, not by introducing a third typeface. A third family
would make the portal drift from the marketplace.

The one typographic device the prototype establishes: the landing headline sets
the final word in Playfair *italic* in `--nmu-tide`, echoing voeq.ng's
"Find. Connect. **Grow.**" treatment. Use it once, on the landing page.

---

## 4. Surface plan

| Surface | `data-env` | Why |
| --- | --- | --- |
| Public landing / apply / status / directory | `cream` | Warm, high legibility for long-form reading on a phone |
| Media Department dashboard | `deep` | Reviewers sit in it for hours; dark reduces glare and makes data tables pop |
| Voeq Super Admin | `deep` | Same reasons; consistent with the reviewer surface |

One dark mode, one light mode — no per-component theming.

---

## 5. Component inventory

### 5.1 Shared (from voeq.ng — port, don't reinvent)

| Component | Notes |
| --- | --- |
| `Button` | Variants: `primary` (forest fill), `gold` (amber fill), `ghost`, `outline`. Pill radius. `translateY(-1px)` on hover. |
| `Input`, `Textarea`, `Select` | Cream surface, 1px `--role-border`, `--radius-md`, focus ring in `--role-accent` |
| `Card` | White surface, `--radius-lg`, `--shadow-sm`, forest-tinted border |
| `Badge` / `Pill` | For statuses and metadata. Status colours from the map above |
| `Chip` | Category filters, the way the marketplace does them (icon + label) |
| `Eyebrow` | Uppercase, letterspaced, gold dot + label. Production pattern: `● THE CAMPUS MARKETPLACE` |
| `Nav` | Forest bar, 56px, glass blur when scrolled |
| `Footer` | Forest, multi-column, newsletter-style link groups |
| `EmptyState` | Illustration + one line + one action |

### 5.2 New — built for this system

| Component | Purpose |
| --- | --- |
| `StepProgress` | The 6-section application progress rail. Numbered, with a completed / current / locked state |
| `ApplicationTimeline` | **The signature component.** Vertical timeline of the application's journey: Submitted → Under review → Decision → Payment → Registered. Shows completed, current, and upcoming steps. This single component does more to reduce applicant anxiety than any other screen |
| `ReviewTimeline` | The reviewer-facing equivalent: every action, who did it, when, and why |
| `StatusBanner` | Full-width contextual banner — correction required, approved, payment due, registered |
| `FileDropzone` | Tap-or-drag upload with client-side compression, per-file progress, retry, and a preview grid |
| `MoneyAmount` | Always renders kobo as `₦5,000.00`. Never raw minor units |
| `ReferenceBadge` | The reference number in mono, with copy-to-clipboard |
| `FilterBar` | The §12.2 filters (status, category, campus, date, name) as a single sticky bar |
| `DataTable` | Virtualised, sortable, with a saved-view concept per reviewer |
| `EmptyQueue` | "No applications waiting" — the dashboard's zero state, with the application count still shown |
| `ConfirmDialog` | Required for Approve and Reject (§12.4 — "Approval and rejection actions should require confirmation") |

---

## 6. The applicant experience

### 6.1 Flow

```
Landing  →  Start application  →  6 sections (5 steps + review)  →  Submitted
                                          ↑                          ↓
                                    corrections                Status page
                                                                     ↓
                                                              Payment instructions
                                                                     ↓
                                                              Registered
```

The applicant **never** creates a vendor account to apply (§5.3). No login
wall before the form. A draft token is issued on first keystroke so the form
can be abandoned and resumed.

### 6.2 The form — six sections, six steps

The spec defines six sections. Six long screens is where applications die, so
they become five steps plus a review step, with a persistent progress rail:

| Step | Sections | Key fields |
| --- | --- | --- |
| 1 | About you | Name, phone, email, relationship (+ conditional "other" explanation) |
| 2 | Your business | Name, category, description, location, campus (multi-select) |
| 3 | Business statement | The free-text purpose statement (§4.3) — with a live character count and a "what makes a good statement" hint |
| 4 | Promotional materials | Flyer + additional images (drag-drop, client-compressed) |
| 5 | Online presence | The Yes/No gate (§4.5); conditional website / social / other / explanation fields |
| 6 | Declaration & review | The three declaration groups (§4.6), the mandatory checkbox, then a full read-only review of everything before submit |

### 6.3 Mobile-first, because it has to be

Applicants are students on phones, often on expensive data. Specific rules:

- **Client-side image compression before upload.** Target ≤200KB and ≤1600px on
  the long edge. A 4MB phone photo becomes ~150KB. This is the single
  highest-value performance decision in the product.
- **Autosave.** Draft autosaves on blur and every ~3s. The applicant can close
  the tab mid-section and resume on any device via the magic link.
- **"Save & finish later"** is a first-class button, not a hidden link. It
  states plainly that nothing is lost.
- **One column.** Steps stack; the progress rail collapses to a compact
  `Step 2 of 6` + thin progress bar under 640px.
- **48px minimum tap targets** on all controls.
- **Never validate on every keystroke.** Validate on blur and on step
  advance. Live validation while typing produces error flashes while the
  applicant is still mid-thought.

### 6.4 Validation & error handling

- Zod schemas shared between client and server — the server is authoritative.
- Inline error under the field, `aria-invalid`, `aria-describedby`.
- On submit failure: an **error summary** at the top listing every problem as
  a link, plus scroll-to-first-error and focus moved to it.
- Errors say what to do: *"Enter a phone number we can reach you on — e.g.
  0803 123 4567"*, never *"Invalid input"*.

### 6.5 The status page

The emotional centre of the product. When an applicant is waiting, this is
what they open.

- **Reference number** in mono, prominent, copyable.
- **`ApplicationTimeline`** — where they are, what's done, what's next.
- **"What happens next"** — plain language, specific, written by the Media
  Department, not by us. E.g. *"The Media Department reviews applications
  within 5 working days. You'll get an email either way."*
- **Messages** from the reviewer, verbatim, when corrections are requested.
- **Payment instructions**, rendered from the configured fee model, when
  approved.
- **A contact route** if something is wrong.

### 6.6 The public directory

- Cards that match voeq.ng's marketplace cards exactly: image, gold category
  eyebrow, Playfair title, location, **NMU Registered** badge.
- Search + filter by category and campus.
- Empty state: *"No registered businesses yet."*

---

## 7. The Media Department dashboard

### 7.1 Overview

A row of metric tiles, matching the §12.1 list exactly:

```
Total applications · Awaiting review · Under review · Needs correction
Approved awaiting payment · Payment awaiting confirmation · Registered · Rejected
```

Tiles are `--role-surface` cards on the `deep` background, with the count in
Playfair at `--text-h1` and the label in `--role-text-muted` uppercase.

### 7.2 Application table

Columns exactly as §12.2 specifies:

```
Reference · Business · Applicant · Category · Campus · Submitted · Status · Payment · Action
```

- Reference in mono.
- Status and payment as separate badges — they are separate axes (§14).
- Sticky header, sticky action column.
- Filters: status, category, campus, date range, business name — one sticky
  bar, reflected in the URL so a reviewer can share a filtered view.
- Row click opens the application drawer; the full detail page remains
  available.

### 7.3 Application detail

Left column: the application, in the same six sections the applicant saw,
read-only, with links and files openable. Right column: the review actions,
pinned.

**Approve / Reject / Request Corrections** each open a `ConfirmDialog` (§12.4):

- **Approve** — shows the applicant, business, and what approval means
  ("Approve → payment instructions are sent to the applicant"). Requires a
  click on a primary button.
- **Reject** — requires a reason. The reason goes to the applicant, so the
  dialog says so, in those words.
- **Request corrections** — requires a reason, and offers a list of common
  requests ("Flyer missing business name", "Statement too short", "Social link
  does not resolve") as *starting points*, not a closed list.

Internal notes are a separate field from the applicant-facing reason, and are
visibly marked **"Not visible to applicant"** — so a reviewer never
accidentally sends an internal note.

### 7.4 Payment verification

A distinct queue — not buried in the application table, because payment
confirmation is a different job with a different permission.

- Shows the application, the amount submitted, the date, the reference, and
  **the receipt rendered inline** (images preview, PDFs open in a secure
  viewer).
- **Confirm payment** and **Reject evidence** — the latter requires a reason
  and shows the applicant exactly how to resubmit.
- The reviewer sees the fee component clearly: `University registration fee —
  ₦5,000` vs `Voeq platform fee — ₦200`. Never an ambiguous total.

---

## 8. Accessibility

Non-negotiable, and the standard we hold the marketplace to as well.

- **Contrast** — body text ≥ 4.5:1, large text and UI boundaries ≥ 3:1, in
  both environments. The cream/forest/amber palette passes; the amber
  `--role-gold` on cream does **not** pass for small text — gold is used for
  large text, icons, and fills, never for 14px body copy.
- **Focus visible** on every interactive element — 2px `--role-accent` ring,
  2px offset. Never `outline: none` without a replacement.
- **Keyboard** — the whole application form and every dashboard action is
  operable by keyboard, including drag-and-drop upload (which has a
  file-picker fallback).
- **Screen readers** — every input has a `<label>`; errors are associated via
  `aria-describedby`; the progress rail is a `<nav>` with `aria-current`;
  status changes are announced through a polite live region.
- **Motion** — respects `prefers-reduced-motion`.
- **Zoom** — usable at 200% without horizontal scrolling.

---

## 9. Content & voice

The product writes in plain, Nigerian-English register — direct, warm, never
bureaucratic. The spec's own suggested copy is the right register; the
"Customer Success" filler is not.

| Instead of | Write |
| --- | --- |
| "Please complete all mandatory fields" | "We need a few details before we can send your application." |
| "Invalid phone number" | "Enter a phone number we can reach you on — e.g. 0803 123 4567" |
| "Your application has been rejected" | "We can't register this business — here's why, and what you can do next." |
| "Payment evidence rejected" | "We couldn't match this receipt. Check the details below and upload it again." |

Reference numbers are always shown in mono and always copyable. Statuses always
have a one-line plain-language explanation next to the badge.

---

## 10. Rules of engagement

1. **Extract, don't eyeball.** Tokens come from production CSS. If a value
   looks wrong, it is probably a deliberate choice in voeq.ng — check before
   changing it.
2. **Two environments only.** `cream` and `deep`. No third.
3. **No hex in components.** Everything goes through `--role-*`.
4. **Playfair for headings only.**
5. **Mobile-first.** If it doesn't work at 390px, it isn't done.
6. **The applicant is a student on a phone.** Optimise for their data
   budget and their attention, not for a desktop demo.
