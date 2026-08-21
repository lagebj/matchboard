# Brand Strategy and Naming Status

> **Status:** Canonical, but the naming/identity conclusion itself is explicitly **open**. This document records research and constraints; it does not conclude a final name, logo, or trademark clearance. See `docs/product/positioning.md` for product positioning and brand characteristics.

## Current working identity

The current product name is **Matchboard**. It remains the working identity for all implementation, documentation, and design work unless and until the owner explicitly approves a change.

Existing brand assets in active use:

- `public/brand/logo.svg`, `public/brand/logo.eps`
- `public/brand/favicon.svg`
- `public/brand/android-chrome-192x192.png`, `public/brand/android-chrome-512x512.png`
- `public/brand/site.webmanifest`
- `src/app/icon.png`, `src/app/apple-icon.png`, `src/app/favicon.ico`

## Name/trademark research on record

The following research has been conducted and is recorded here as-is. It is evidence for an owner/legal decision, not a conclusion of clearance or a conclusion that renaming is required.

- **NIPO** exact search for "Matchboard": 0 results.
- **TMview** search produced 8 results:
  - 5 ended/expired records.
  - 2 filed UK records: `GB500000004234848`, `GB500000004234882`.
  - 1 registered US record: `US500000090777554`.
- Other unrelated products/apps also use "MatchBoard"/"Matchboard" name variants in the market.

### What this research does **not** establish

- It does not establish that "Matchboard" is legally clear to use or register.
- It does not establish that a rename is required.
- No trademark counsel has reviewed these results as part of this programme.

Any further legal/trademark conclusion is out of scope for coding-agent work and must go through the owner and, where appropriate, actual trademark counsel.

## Owner approval gates

The following require **separate, explicit owner approval** before they can be treated as final. A coding agent must not conclude any of these autonomously:

1. **Final product name** — whether "Matchboard" is kept, or a rename occurs.
2. **Final logo / app icon** — the current logo/icon assets are a working identity, not a concluded final design.
3. **Final primary brand identity** — the complete visual identity (color, mark, typography pairing) beyond the current "calm cockpit" design-system direction (`docs/adr/0007-calm-cockpit-design-system.md`).

Until each gate above is explicitly approved, treat its current state as the working default, not as settled.

## Implementation rules while naming is open

- Preserve `Matchboard` as the working identity in code, copy, and documentation.
- Keep branding assets swappable: `public/brand/` is the current single location for logo/icon/manifest assets. Do not hardcode brand-specific values (name strings, colors, icon paths) outside of that asset location and the design tokens that reference it, so a future swap does not require an architecture change.
- Do not couple application architecture, routing, or data models to the current logo or name (e.g. no `matchboard`-prefixed database identifiers introduced purely for branding reasons beyond what already exists historically).
- Do not perform a rename, do not finalize a trademark conclusion, and do not select a final logo/app icon as part of ordinary feature or programme work.
