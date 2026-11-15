# Design prototype

Static, clickable prototype of the NMU registration system. **No backend, no
build step** — plain HTML and one stylesheet, so the UI can be reviewed and
settled before any application code is written.

Every value shown is mock data. Nothing here talks to a database.

---

## Running it

The pages load a stylesheet from `packages/design-system`, so serve the repo
root rather than opening the files directly (the `file:` protocol blocks the
relative `@import`).

```bash
cd <repo root>
python -m http.server 8899 --bind 127.0.0.1
```

Then open:

| Screen | URL |
| --- | --- |
| Landing | http://127.0.0.1:8899/apps/prototype/index.html |
| Application form | http://127.0.0.1:8899/apps/prototype/apply.html |
| Applicant status + payment | http://127.0.0.1:8899/apps/prototype/status.html |
| Public directory | http://127.0.0.1:8899/apps/prototype/directory.html |
| Media dashboard | http://127.0.0.1:8899/apps/prototype/dashboard.html |
| Application review | http://127.0.0.1:8899/apps/prototype/review.html |
| Payment verification | http://127.0.0.1:8899/apps/prototype/payments.html |

---

## What's in each screen

### `index.html` — landing
Applicant-facing entry. Hero, how-it-works, what you'll need, the fee
breakdown, and the CTA. The fee band is the first place the NMU maritime-teal
layer appears.

### `apply.html` — the application form
The six-step form, **navigable**. Use *Continue* / *Back*, or the stepper, to
move between steps. Step 4 shows the upload state with compressed file sizes;
step 6 shows the declaration groups and the read-only review.

Also demonstrates: the conditional "Other" relationship field, the live
character count on the statement, and the mobile progress bar.

### `status.html` — applicant status
The state an applicant sees while waiting. The **`ApplicationTimeline`** is the
centrepiece: submitted → reviewed → approved → payment → registered. This
screen also shows the **separate** payment model — two components, two
receipts — and the receipt upload form.

### `directory.html` — public directory
The public NMU business directory. Cards match the voeq.ng marketplace card
pattern (image, gold category eyebrow, serif title, location) with the
**NMU Registered** badge added.

### `dashboard.html` — Media Department dashboard
`deep` (dark) environment. The eight metric tiles from spec §12.1, the
filter bar, the applications table with the §12.2 columns, recent decisions,
and the payments-waiting summary.

### `review.html` — application detail + review actions
The reviewer view: all six sections read-only, the review action panel, the
internal-notes field, and the "linked Voeq profile" card. The **Request
corrections** confirmation dialog is open, showing the applicant-facing reason
field and the helper chips.

### `payments.html` — payment verification
The separate queue for `payments.confirm` — deliberately not buried in the
applications table. Shows the queue, a rendered receipt, the automated
cross-checks (reference / amount / name), and the confirm-or-reject actions.

---

## Design rules this prototype follows

1. **Two environments only.** `cream` for the applicant portal and directory;
   `deep` for both dashboards.
2. **NMU teal is an accent, not a repaint.** The ground stays cream and the
   nav stays forest. Teal appears on actions, focus rings, tinted surfaces and
   the badge.
3. **No third typeface.** Playfair for headings, Inter for everything else,
   JetBrains Mono for references.
4. **Mobile-first.** Every screen is checked at 390px. The stepper collapses
   to a progress bar, choice cards go single-column, and two-column layouts
   stack.
5. **Every status has a plain-language line next to it**, not just a colour.

---

## Known prototype shortcuts

These are deliberate, and become real in the build:

- The form does not validate. Validation, error summaries and scroll-to-error
  are specified in `docs/04-DESIGN-SYSTEM.md` §6.4 and built in Phase 1.
- Uploads are simulated with static file rows, not real compression.
- The directory, dashboard and payment queue use hardcoded mock rows.
- The status timeline is one state (approved, awaiting payment). The
  requires-correction and registered states use the same component with
  different data.
- Buttons other than the form stepper do nothing.
