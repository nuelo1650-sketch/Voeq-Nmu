# @voeq/design-system

Shared design tokens and UI primitives for every Voeq surface (marketplace, NMU
registration portal, Media Department dashboard, Super Admin).

**Source of truth:** the production CSS served from `https://voeq.ng`
(`/_next/static/css/*.css`). Tokens here were extracted verbatim on 2026-11-15
and are not eyeballed approximations.

## Why this package exists

The NMU registration system is a **separate repository** from the marketplace.
The only thing that must not drift is how it *looks*. This package is the
single portable artifact that both repos consume, so a change to the brand
lands in both at once instead of being re-implemented twice.

## Consuming it

```jsonc
// package.json
"dependencies": {
  "@voeq/design-system": "file:../../packages/design-system"
}
```

```ts
// app/layout.tsx
import "@voeq/design-system/tokens.css";
```

Then set the environment per surface:

```html
<html data-env="cream">   <!-- applicant portal: light, warm -->
<html data-env="deep">    <!-- dashboards: dark, focused -->
```

## Environment tokens

| Token              | cream (light) | deep (dark)    | Used for                       |
| ------------------ | ------------- | -------------- | ------------------------------ |
| `--role-bg`        | `#f5f1e8`     | `#10231a`      | Page background                |
| `--role-surface`   | `#ffffff`     | `#173025`      | Cards, panels, tables          |
| `--role-text`      | `#0a0a0a`     | `#eef3ec`      | Primary text                   |
| `--role-text-muted`| `#4a4a4a`     | `#9fb3a4`      | Secondary text                 |
| `--role-accent`    | `#2d5a3d`     | `#6fcf97`      | Primary actions, links         |
| `--role-gold`      | `#e8a33d`     | `#e0b964`      | Accent, eyebrows, badges       |
| `--role-danger`    | `#b85c3e`     | `#e08a7a`      | Destructive, rejected          |

## Rules

1. **Never hardcode a hex in a component.** Use a `--role-*` or `--color-*`
   token so both environments stay correct.
2. **Never introduce a new colour** without adding it here first, so the
   marketplace and the portal never diverge.
3. `Playfair Display` is for headings only. Never in form labels, table cells,
   or body copy — serif at 13–14px is measurably harder to read on a phone.
4. Body copy is `Inter` at `16px / 1.35`, matching production.

See `docs/04-DESIGN-SYSTEM.md` in the repo root for the full UI rules.
