# Design prototype

Static, clickable prototype of the NMU Business Register. **No backend, no
build step** — plain HTML, one stylesheet and one small script — so the UI can
be reviewed and settled before any application code is written.

Every value shown is mock data. Nothing here talks to a database.

Direction: **"The Register"** — see `docs/08-DESIGN-DIRECTION.md`.

---

## Running it

```bash
cd <repo root>
python -m http.server 8899 --bind 127.0.0.1
```

Then open:

| Screen | File |
| --- | --- |
| Landing | `index.html` |
| Application form | `apply.html` |
| Applicant status + fee | `status.html` |
| The public register | `directory.html` |
| Register desk (staff) | `dashboard.html` |
| Entry record (staff) | `review.html` |
| Fee ledger (staff) | `payments.html` |
| Terms of Service | `terms.html` |
| Privacy Policy | `privacy.html` |
| Cookie Policy | `cookies.html` |

Base URL: `http://127.0.0.1:8899/apps/prototype/`

Screenshots for design review:

```bash
tooling/shot.sh apps/prototype/index.html /tmp/shots/landing.png 1440 900
tooling/shot.sh apps/prototype/apply.html  /tmp/shots/apply.png  390 844
```

---

## What's in each screen

### `index.html` — landing
The chart field carries the hero. Headline **"Put your business on the record."**
A live count of the register in the right column, a numbered folio list for
*How an entry is made*, a ruled list for *What an entry needs*, a specimen of
*The register*, and a **Fees** section carrying one honest sentence — **no
amounts and no split**. Closing marine band with a single action.

### `apply.html` — the application form
A typeset document, not a wizard of rounded boxes. A ruled step strip across
the top, numbered section headings (`01 — About you`), ruled option rows
instead of tiles, a **margin-note column** on the right carrying "what you'll
need" and help, and a live mono save state in the masthead.

Navigable with *Continue* / *Back*. Step 6 carries the declaration groups, the
**four consent checkboxes** (declaration, Terms, Privacy, public listing) and a
read-only review set as a specimen.

Also demonstrates: the conditional "Other" relationship field and the live
character count on the statement.

### `status.html` — applicant status
The state an applicant sees while waiting. The centrepiece is the **ship's log**:
dated entries in mono, each with a rule and a margin mark — a record, not a
progress bar.

This is also the **only** place the fee breakdown appears: one transfer, the
total due, and the composition of it, because the applicant needs to know how
much to send. Private, behind the sign-in link.

### `directory.html` — the public register
The component the whole direction builds toward. A numbered index, not a card
grid: folio number, business name in Fraunces, category and campus in mono, the
**NMU registered stamp**, and the reference.

### `dashboard.html` — the register desk
A working instrument, not a poster. One dominant figure — the depth of the
queue — in a dark ledger header, with a ruled strip of the remaining counts
beside it. The **work queue** is the primary surface: a dense ruled table, mono
references, ages in mono, status as an ink mark plus a label rather than a
coloured pill, and **one obvious next action per row** (Claim, Decide, Open,
Remind, Verify).

Interactive: tick rows for the bulk-action bar; *Open* slides the **dossier
drawer** in from the right, so triaging 23 entries does not need 23 page loads.

The **receivable strip** at the top makes the agency ledger visible — the thing
that actually matters to the business.

### `review.html` — entry record
The full record, reached from the drawer. All six sections set as a document
with margin labels, the applicant history as a ship's log, the decision panel,
and the *Request corrections* dialog open, showing the applicant-facing reason
field and the helper chips.

### `payments.html` — the fee ledger
Payment verification as a **mode at the same level as the queue**, not a
sub-card. The same ledger header, the queue of fees awaiting confirmation, the
rendered bank receipt, the match checks, the reconciliation detail, the
confirm-or-reject decision, and the audit history.

### `terms.html` / `privacy.html` / `cookies.html`
Real documents, not walls of text: numbered clause structure, a definitions
section, and a **sticky clause index in the margin**. All three are marked
*Version 1.0 · Draft for review* — they are working documents for legal review,
not binding texts.

---

## Design rules this prototype follows

1. **Radius 0.** Printed-form language. Chips are the one deliberate exception.
2. **Rules, not shadows.** Section boundaries are a hairline plus mono meta.
   No floating rounded cards anywhere.
3. **Three typefaces, each with one job.** Fraunces for display, Inter for
   everything functional, IBM Plex Mono for every number and label.
4. **A measured measure.** Body copy sits at 34–40 characters.
5. **The chart field is static.** Motion is earned by real data or it is
   decoration. The only motion is the section rule wipe and the headline rise.
6. **Mobile-first.** Checked at 390px: the step strip scrolls rather than
   crushing six labels, the masthead lockup wraps, choice rows go single-column.
7. **Every status has a plain-language line next to it**, not just a colour.
8. **The cookie banner is customised** — it names the Department, lists the
   cookies, offers *Manage* / *Essential only* / *Accept all*, and honours
   Global Privacy Control.

---

## Known prototype shortcuts

These are deliberate, and become real in the build:

- The form does not validate. Validation, error summaries and scroll-to-error
  are specified in `docs/04-DESIGN-SYSTEM.md` §6.4 and built in Phase 1.
- Uploads are simulated with static file rows, not real compression.
- The register, queue and fee ledger use hardcoded mock rows.
- The status page shows one state (approved, awaiting fee). The
  requires-correction and registered states use the same component with
  different data.
- Buttons other than the form stepper, the drawer and the bulk bar do nothing.
- The legal documents are drafts, not legal advice.
