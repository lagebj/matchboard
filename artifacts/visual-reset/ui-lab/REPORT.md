# Matchboard Visual Identity & Frontend Reset 1.0 ("Touchline") — Phases 0–3 report

**Date:** 2026-09-10 · **Version:** 0.84.7 → **0.85.0** (minor) · **Status:** Phases 0–3
complete, stopped at the hard human-approval gate (bundle `13_UI_LAB_AND_GOLDEN_GATE.md §8`).

No production route family has been migrated. The new system lives in `src/app/touchline.css`
+ `src/components/touchline/` and is exercised only at `/dev/ui-lab` (404 in production).

---

## 1. Files changed / created

### Docs & authority
| File | Change |
|---|---|
| `docs/adr/0130-product-surface-1-0.md` | Status amended → **superseded for visual design by ADR-0134**; retained domain/a11y concepts listed. |
| `docs/adr/0134-visual-identity-frontend-reset-touchline.md` | **New** — records adoption of the bundle, the durable Touchline rules, the UI-Lab gate, migration phases. |
| `AGENTS.md` | New concise **"Frontend visual authority — Touchline"** subsection under `## UI architecture` (theme support, token/grammar owners, migration status, PS 1.0 superseded warning). Nothing else removed. |
| `docs/product/adaptive-interaction-design.md` | Banner added: visual doctrine superseded by Touchline; retained principles listed; full rewrite deferred to Phase 11. |

### Theme foundation (Phase 1)
| File | Purpose |
|---|---|
| `src/app/touchline.css` | **New** — `--tl-*` token system (dark + light + system via `prefers-color-scheme`), `.touchline` activation scope, `.touchline-canvas` atmosphere, `.tl-*` sports-display classes, focus ring, reduced-motion, `.tl-bottom-nav` / `.tl-nav-clearance` / `.tl-sticky-actions`. |
| `src/lib/theme/theme.ts` | **New** — `AppearanceMode`, `THEME_STORAGE_KEY` (`matchboard-theme`), `THEME_INIT_SCRIPT` (pre-hydration initializer), `applyAppearance`, `readStoredAppearance`. |
| `src/lib/theme/theme-provider.tsx` | **New** — `<ThemeProvider>` + `useTheme()` (mode / resolved / setMode; tracks `prefers-color-scheme`). |
| `src/app/layout.tsx` | Adds `Barlow_Condensed` (`next/font/google`, weights 600/700, `--font-barlow-condensed`); inline pre-hydration `<script>`; `<ThemeProvider>` wrap; `suppressHydrationWarning`; appearance-aware `viewport.themeColor` (dark `#090b0f` / light `#f3f5f1`). |
| `src/app/globals.css` | Adds `--font-sport: var(--font-barlow-condensed)` to `@theme inline`. (No change to the Product Surface 1.0 `:root` tokens — production is untouched.) |

### Shell & primitives (Phase 2) — `src/components/touchline/`
`brand/touchline-mark.tsx`, `brand/touchline-wordmark.tsx`,
`controls/touchline-button.tsx`, `controls/status-text.tsx`,
`shell/nav-model.ts`, `shell/touchline-sidebar.tsx`, `shell/touchline-rail.tsx`,
`shell/touchline-bottom-nav.tsx`, `shell/touchline-top-bar.tsx`,
`shell/touchline-page-header.tsx`,
`nav/touchline-context-rail.tsx`,
`scorebook/scorebook-match-row.tsx`, `scorebook/scorebook-round-section.tsx`,
`match/operational-match-card.tsx`, `match/match-score-header.tsx`, `match/live-score-strip.tsx`,
`timeline/touchline-timeline.tsx`,
`evidence/evidence-story.tsx`, `evidence/phase-distribution.tsx`, `evidence/outcome-pair.tsx`,
`workbench/workbench-toolbar.tsx`, `workbench/roster-column.tsx`, `workbench/roster-row.tsx`,
`workbench/touchline-inspector.tsx`,
`overlay/touchline-bottom-sheet.tsx`,
`theme/appearance-control.tsx`,
`index.ts` (barrel).

### UI Lab (Phase 3) — `src/app/dev/ui-lab/`
`layout.tsx` (prod `notFound()` guard + `.touchline` scope), `ui-lab-frame.tsx` (`?theme=` /
`?frame=`), `ui-lab-shells.tsx` (adaptive shell), `fixtures.ts` (in-memory data), `page.tsx`
(index + appearance control), and `league/`, `today/`, `event-day/`, `round-board/`,
`follow-live/`, `insights/` page routes.

### Access & tooling
| File | Change |
|---|---|
| `src/lib/env.ts` | **New** `isDevToolingRoute(path)` — `!isProduction() && path.startsWith("/dev/")`. Not a `PUBLIC_ROUTES` entry (those are public in every env; `/dev/**` must be unreachable in production). |
| `src/proxy.ts` | Lets `/dev/**` through the session gate **outside production only** (defence-in-depth alongside the layout's `notFound()`). |
| `scripts/ui-lab-screenshots.ts` | **New** — standalone Playwright capture runner (not a `@playwright/test` spec), local-URL-only, hides the Next dev indicator, viewport-clipped at the golden sizes, dark + light. |
| `package.json` / `src/lib/version/index.ts` | Version bump 0.84.7 → 0.85.0. |

---

## 2. Components created / evolved

All new, under the `Touchline*` / grammar names in `12_COMPONENT_CONTRACTS.md`. Nothing in the
existing Product Surface 1.0 component tree (`src/components/ui/*`, `src/components/shell/*`,
`src/components/viz/*`) was modified — they keep serving production until Phase 5+ and are
deleted in Phase 10.

- **Navigation**: `TouchlineSidebar` (216 px, receding, 3 px accent leading marker),
  `TouchlineRail` (72 px medium tier), `TouchlineBottomNav` (floating 12 px inset / 62 px /
  16 px radius / safe-area / 24×3 px accent bar / opaque `backdrop-filter` fallback),
  `TouchlineTopBar`, one serializable `nav-model.ts`.
- **Match grammar** (all consume the canonical `MatchPresentation`): `ScorebookMatchRow`
  (divider-only, Barlow score lane, own-team 2 px accent, weight-not-colour outcome),
  `ScorebookRoundSection` (section not card, Barlow week marker), `OperationalMatchCard`
  (active-object only, 12 px), `MatchScoreHeader` (`framed` = Follow-Live scoreboard),
  `LiveScoreStrip` (Live Reporting only).
- **Temporal**: `TouchlineTimeline` / `TimelineItem` (time column + low-contrast rail + nodes;
  states legible without colour), `TouchlineContextRail` (tablist, scroll-snap, accent
  indicator bar — not a pill tab bar).
- **Evidence**: `EvidenceStory` (one question, Barlow anchor, sample + canonical confidence /
  insufficient-evidence state, correlational language), `PhaseDistribution`, `OutcomePair`
  (neutral + evidence-secondary, no good/bad colour, visually-hidden text equivalent).
- **Workbench**: `WorkbenchToolbar`, `RosterColumn` (no card), `RosterRow` (2–3 px accent +
  subtle surface for selection, no per-player card), `TouchlineInspector` + `InspectorFact`.
- **Controls / overlay / theme**: `TouchlineButton` (accent-fill primary, 8 px, no pill),
  `StatusText`, `TouchlineBottomSheet` (88vh / 16 px / control-layer / safe-area / visible
  close), `AppearanceControl` (System / Light / Dark segmented, wired to `useTheme`).

---

## 3. Old authority marked superseded

- **ADR-0130** — Status line amended to "**Superseded for visual design by ADR-0134**"; the
  specific superseded doctrines (dark-only `color-scheme`, muted-sage accent, no-light-mode,
  no-saturated-accent, nav material geometry, typography scale as final, score treatment as
  final, surface hierarchy where it blocks open canvas, fixed evidence-primitive inventory,
  page-width assumptions) are enumerated; retained domain/a11y concepts listed.
- **`docs/product/adaptive-interaction-design.md`** — banner marks the visual system below as
  superseded; retained principles listed; full rewrite is Phase 11.
- **AGENTS.md** — new authority subsection names Touchline as current and PS 1.0 as superseded;
  the existing PS 1.0 text is kept (append-only) and explicitly framed as the historical record.
- `src/app/globals.css` and its `:root` PS 1.0 tokens are **not** removed yet — they still
  drive every unmigrated production route. Phase 10 removes them and the `.touchline` activation
  class moves to the app-shell root.

---

## 4. Theme behaviour

- Three modes: `system` (default — omits `data-theme`, follows `prefers-color-scheme`),
  `light`, `dark` (stamp `data-theme` on `<html>` + pin `color-scheme`). Storage key
  `matchboard-theme`; only `system | light | dark` accepted.
- Pre-hydration `THEME_INIT_SCRIPT` in `<head>` applies an explicit stored theme before first
  paint → no flash to the wrong explicit appearance. Tolerates `localStorage` being
  unavailable. Leaves `system`/default untouched (production, which has no light palette, stays
  dark — no regression while unmigrated).
- `next-themes` was **not** added.
- `viewport.themeColor` is now appearance-aware for browser/PWA chrome.
- Within `.touchline`: `--tl-*` remap onto both the working token names and Touchline-only
  `--tl-c-*` names; `color-scheme` is set per mode; light overrides are defined for
  `:root[data-theme="light"]`, the `prefers-color-scheme: light` media query, and a
  `.touchline[data-theme="…"]` subtree (the UI Lab screenshot harness sets the theme on the
  `.touchline` wrapper).
- `AppearanceControl` exists and is rendered on the UI Lab index. Wiring it into the production
  Settings → Appearance surface is Phase 9 (Settings migration).

---

## 5. Icon / brand-asset inventory

**One canonical mark, no ambiguity.** `public/brand/logo.svg` and `public/brand/favicon.svg`
are byte-identical (MD5-verified) — a single-path monochrome trace (`viewBox 0 0 1495 1495`),
rendered app-side via CSS mask so it inherits `currentColor`. Vector source
`public/brand/logo.eps` present.

| Asset | Path | Role | Status |
|---|---|---|---|
| Monochrome mark (vector) | `public/brand/logo.svg` / `favicon.svg` | app mark, favicon | present, unchanged |
| Vector source | `public/brand/logo.eps` | archival source | present |
| Favicon (ICO) | `src/app/favicon.ico` | legacy favicon | present |
| App icon 32 | `src/app/icon.png` | opaque brand tile | present (ADR-0123) |
| Apple touch 180 | `src/app/apple-icon.png` | opaque brand tile | present (ADR-0123) |
| PWA `any` 192 / 512 | `public/brand/android-chrome-{192,512}.png` | opaque brand field, white mark | present |
| PWA `maskable` 192 / 512 | `public/brand/maskable-{192,512}.png` | mark inside centre-80% safe area | present |

**No derivative generation was required for Phases 0–3.** The mark is already
monochrome/`currentColor`-compatible (so light/dark and monochrome variants are the same asset,
recoloured in CSS), and the full PWA/apple/favicon/maskable size set already exists. Additional
theme-tile treatments, if wanted, are a Phase 11 polish item — the bundle's rule is "generate
only if required" (`14_IMPLEMENTATION_PHASES.md` Phase 1). The mark was **not** redesigned,
recut, or replaced.

---

## 6. Seven UI Lab screenshots

Captured to `artifacts/visual-reset/ui-lab/` (dark = primary deliverable; a `-light` set is
included as acceptance-gate B evidence):

| # | Golden screen | Route | Size | File |
|---|---|---|---|---|
| 1 | league-desktop | `/dev/ui-lab/league?viewport=desktop` | 1440×900 | `league-desktop.png` |
| 2 | league-mobile | `/dev/ui-lab/league?viewport=compact` | 390×844 | `league-mobile.png` |
| 3 | today-mobile | `/dev/ui-lab/today?viewport=compact` | 390×844 | `today-mobile.png` |
| 4 | event-day-mobile | `/dev/ui-lab/event-day?viewport=compact` | 390×844 | `event-day-mobile.png` |
| 5 | round-board-desktop | `/dev/ui-lab/round-board?viewport=desktop` | 1440×900 | `round-board-desktop.png` |
| 6 | follow-live-mobile | `/dev/ui-lab/follow-live?viewport=compact` | 390×844 | `follow-live-mobile.png` |
| 7 | insights-mobile | `/dev/ui-lab/insights?viewport=compact` | 390×844 | `insights-mobile.png` |

Plus: `league-desktop-light.png`, `league-mobile-light.png`, `today-mobile-light.png`,
`event-day-mobile-light.png`, `round-board-desktop-light.png`, `follow-live-mobile-light.png`,
`insights-mobile-light.png`.

Regenerate: `npx next dev -p 3334` then
`BASE_URL=http://localhost:3334 npx tsx scripts/ui-lab-screenshots.ts`.

---

## 7. Conformance self-check vs golden references

| Screen | Hierarchy | Density | Colour / material | Typography | Interaction affordance | Responsive fit |
|---|---|---|---|---|---|---|
| league-desktop | PASS | PASS | PASS | PASS | PASS | PASS |
| league-mobile | PASS | PASS | PASS | PASS | PASS | PASS |
| today-mobile | PASS | PASS | PASS | PASS | PASS | PASS |
| event-day-mobile | PASS | PASS | PASS | PASS | PASS | PASS |
| round-board-desktop | PASS | PASS | PASS | PASS | PASS | PASS |
| follow-live-mobile | PASS | PASS | PASS | PASS | PASS | PASS |
| insights-mobile | PASS | PASS | PASS | PASS | PASS | PASS |

Notes / deliberate deviations from the golden mock content (composition/hierarchy/typography/
material still conform — `13_UI_LAB_AND_GOLDEN_GATE.md §4`: "not literal domain-data fixtures"):

- **"Autumn" not "Fall"** — the goldens print "Fall 2026"; Matchboard's canonical season
  terminology is **Autumn** (enforced by `scripts/check-terminology.mjs`, part of `validate`).
  The implementation uses "Autumn 2026".
- **Bottom-nav item art** — the golden mock renders letter-in-a-box tiles; the spec text
  (`05 §2`) mandates a 20 px Lucide icon + label + 24×3 px accent bar with no pill. The
  implementation follows the spec text.
- **UI Lab shows more rows per viewport** than the golden mock on the mobile scorebook /
  insights feed — the acceptance target is "equal or better useful information per viewport"
  (`09 §9`, gate L), not fewer.
- Round Board compact composition (one match + selector) is stubbed; the deliverable screen is
  `round-board?viewport=desktop` and the compact fallback is minimal — full compact Round Board
  is Phase 6.

---

## 8. Test / validation results

| Check | Result |
|---|---|
| `npm run typecheck` | PASS (0) |
| `npm run typecheck:workers` | PASS (0) |
| `npm run lint` | PASS (0 errors; 3 pre-existing warnings in `compute-plan-integrity.ts`, unrelated) |
| `npm test` (unit + component) | PASS — 305+36 files, 3794+253 tests |
| `npm run build` | PASS — compiled in 2.4 min; `/dev/ui-lab/*` are `ƒ` (dynamic, on-demand), never prerendered |
| `npm run terminology:check` | PASS |
| `npm run architecture:check` | PASS (140 files, 5 domain dirs) |
| `npm run docs:check` | PASS |
| `src/test/security-audit.test.ts` + `src/lib/__tests__/env.test.ts` | PASS — 100 tests (proxy `/dev/**` carve-out + `PUBLIC_ROUTES` unchanged) |
| `npm run validate` (full gate) | see `scratchpad/validate.log` — running at report time; `policy:verify` may report the known advisory non-amd64 `DRIFT` (ARR-0037), not a regression |

Functional freeze (`17_FUNCTIONAL_FREEZE.md`): no domain, security, tenancy, audit, fairness,
positional, live-state, or evidence code path was touched. The only production-runtime change is
additive (pre-hydration theme script + Barlow font + `ThemeProvider` context + appearance-aware
`themeColor`); no production route was restyled.

---

## 9. Blocked ambiguity

**None.** Every product-visible decision needed for Phases 0–3 was resolved by the bundle. The
"Autumn/Fall" and bottom-nav-art items above are governed-terminology / spec-text precedence
calls, not unresolved product decisions.

---

## 10. Stop point

Phases 0–3 are complete. **Awaiting explicit human approval of the UI Lab before any
production-route migration (Phases 5–12).**
