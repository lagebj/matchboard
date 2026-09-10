# ADR-0130: Product Surface 1.0 — visual system and surface families

## Status

**Superseded for visual design by ADR-0134 (Matchboard Visual Identity & Frontend Reset 1.0 —
"Touchline").** Product Surface 1.0's *visual* doctrine is no longer authoritative: the
dark-only `color-scheme`, the muted-sage primary accent, the prohibition on a light mode, the
prohibition on a saturated brand accent, the navigation material geometry, the typography scale
as final visual doctrine, the score visual treatment as final doctrine, the surface hierarchy
where it blocks open-canvas design, the exact evidence-visualization inventory as a permanent
constraint, and the page-width assumptions are all replaced by ADR-0134 and its bundle.

Still valid unless separately changed (carried forward by ADR-0134): same canonical domain
truth at every viewport; no colour-only meaning; visible focus; touch-target/accessibility
intent; no drag-only critical workflow; the canonical `MatchPresentation` / Operational
Timeline data ownership; positional safety; the Review vocabulary/semantics; live read/write
separation; PWA safe-area behaviour.

The rest of this ADR is retained as historical context for the Product Surface 1.0 programme.

Accepted (visual doctrine superseded 2026-09-10)

## Context

The Matchboard Productification and Decision Safety programme
(`.matchboard-work/matchboard_productification_programme_2026-09-09/`, a temporary gitignored
implementation bundle) has as its second primary outcome: **the application must look and behave
like one finished product in real coaching use** — the whole authenticated app, every viewport
class, not a first-class-pages facelift.

The adaptive-UI programme (ADR-0124) and reference-convergence programme (ADR-0125) established
load-bearing principles that remain correct — same canonical domain state at every viewport,
one canonical `MatchPresentation`, a canonical Operational Timeline, accessibility, no
drag-only workflow, safe-area handling, temporal/event composition. But several
implementation-level doctrines from those programmes became too rigid or are superseded by this
bundle's explicit product decisions:

- the "fixed set of seven" visualization primitives rule;
- the "exactly three" match render variants rule;
- result colouring that put a win in green and a loss close to a danger/error state;
- a repeating pitch-line background texture;
- warm-cream foreground and warm hairline borders;
- assorted fixed pixel measurements scattered through the ADR-0124 text.

The programme bundle supplies a normative token set (`data/product-surface-tokens.css`) and a
normative visual specification (`02_VISUAL_SYSTEM_AND_MATCH_GRAMMAR.md`) that this ADR adopts.

## Decision

### 1. Product Surface 1.0 supersedes conflicting presentation doctrine

Where this ADR / the programme bundle conflicts with ADR-0124 or ADR-0125 presentation
guidance, **Product Surface 1.0 wins** and the old guidance is replaced (not left alongside).
What is *retained* from ADR-0124/0125: same-domain-truth across viewports; one canonical
`MatchPresentation` and Operational Timeline as the sole owners of their concepts; the five
breakpoint tokens (`--breakpoint-medium/expanded/large/xlarge`, compact = unprefixed base);
accessibility (WCAG AA, visible focus, ~44px touch targets, no colour-only state); no
drag-only workflow; installed-PWA / safe-area handling; temporal Today/Events composition.

### 2. Normative token set (`src/app/globals.css` `:root`)

The token *values* are the programme bundle's `data/product-surface-tokens.css` set:

- **Canvas / surfaces** — `--background #0b0f17`, `--foreground #f2f5f7`; solid surface
  hierarchy `--surface-base #101722` → `--surface-raised #151e2c` → `--surface-strong #1a2535`
  → `--surface-hover #1c2838`; `--surface-overlay rgba(8,12,18,0.94)` for nav / sticky-action
  bars over content.
- **Borders** — cool hairlines `--border-soft rgba(226,232,240,0.08)`,
  `--border-strong …0.14`.
- **Text** — `--text-soft #b8c1cd`, `--text-muted #7f8b9c`, `--text-disabled #566171`.
- **Semantic** — `--accent #8fb49a` / `--accent-strong` / `--accent-subtle` (own-team identity
  only, never an outcome); `--info`, `--warning`; `--danger` is **only**
  destructive/error/blocking, never a loss colour; `--live #ef6464` is a distinct explicit
  colour, not danger; `--success` is workflow/action success, never a win colour; `--dev`;
  `--focus #93b7ff` for the focus ring.
- **Radius** — `--radius-micro 6px` (status chips) / `--radius-control 8px` (buttons, inputs) /
  `--radius-object 12px` (coherent object card) / `--radius-overlay 16px` (modal, sheet).
  Circular only for avatars / round icon controls / indicators. No pills for ordinary labels.
- **Motion** — `--motion-fast 150ms` (state/hover) / `--motion-standard 200ms` (local
  panel/row) / `--motion-overlay 260ms` (sheet/drawer); `--motion-ease
  cubic-bezier(0.2,0.8,0.2,1)`. Animation is for spatial continuity only — no celebratory
  score animation, list-entrance cascade, or perpetual non-live pulse; `prefers-reduced-motion`
  respected.
- **Spacing** — `--space-1…--space-12` = `4 8 12 16 20 24 32 40 48`.
- **Typography** — `--text-title` 22/24, `--text-section` 17/18, `--text-row-title` 15/16,
  `--text-body` 15, `--text-meta` 12–13, `--text-micro` ≥11 (floor — reduce density, not font
  size), `--text-value` 22/24 (dense list score), `--text-score-header` 34/40 (match-header
  score). Geist Sans for UI, Geist Mono only for real code/technical values, tabular numerals
  for scores/clocks/times/minutes/comparisons.

Older token names (`--surface-tactical`, `--surface-hero`, `--surface-muted`, `--radius-xs…lg`,
`--transition-fast/smooth/lift`, `--blocking`, `--border-pitch`, `--text-primary/strong/error`,
`--surface`, `--surface-default`, `--accent-hover/soft`, `--surface-muted`) are kept as
**compatibility aliases** mapped to the Product Surface 1.0 values, so the many existing
`var(--…)` consumers keep resolving while surfaces migrate phase by phase. New and migrated code
uses the names above. Do not mass-replace class strings without owning the component.

### 3. Background

Solid canvas plus **one** very subtle radial atmosphere (`background-attachment: fixed`). No
repeating pitch-line texture, no ordinary-card gradients, no glows.

### 4. Surface families and card usage

The product has five surface families (temporal flow; match/result scan; planning workspace;
evidence/story; reference/configuration). The same design system does not imply identical cards
everywhere. Scan lists use one parent surface (or the canvas) with dividers and **no card per
row**. Cards are reserved for: the dominant next-action object; a selected match/decision; an
evidence story; a modal/sheet; one coherent interactive event object when a row is
insufficient. Avoid nested bordered cards; no routine desktop shadows. One visually dominant
primary action per operational context; status chips only when they aid scanning, max two
visible before disclosure.

### 5. Match render variants and visualization primitives are reopened

The "exactly three match variants" and "fixed set of seven visualization primitives" rules from
ADR-0124/0125 are **removed as permanent doctrine**. This programme allows the four match render
variants (`MatchRow`, `MatchCard`, `MatchHeader`, `MatchLiveStrip`) and the nine visualization
primitives listed in `02_VISUAL_SYSTEM_AND_MATCH_GRAMMAR.md` §16, and states that neither list
is declared permanent future doctrine. No additional primitive or variant may be introduced
during this programme without a specification change; a large charting dependency must not be
added for it.

### 6. Scope of this ADR vs the phased migration

This ADR + the Phase 3 change establish the **token / background / typography / focus /
motion foundation** only. Migrating each surface family to the new system, the canonical
`MatchPresentation` grammar and the League vertical slice, temporal surfaces, planning
workspaces, trust surfaces, evidence/historical surfaces, review semantics and utility
surfaces are Phases 4–10 of the programme; the canonical design-reference doc rewrite
(`docs/product/adaptive-interaction-design.md`) and screenshot regeneration are Phase 11.

## Consequences

- The app's overall appearance shifts: cooler near-white foreground, cool hairlines, solid
  (not translucent-over-texture) surfaces, no pitch-line background, a blue focus ring. This is
  the intended Product Surface 1.0 look; per-surface polish follows in later phases.
- No pixel-diff / visual-regression CI exists (screenshots are content assets, per
  `AGENTS.md` "Screenshots"), so this change is not gated by image comparison; `build`,
  component tests and the compact-viewport E2E suite must still pass.
- ADR-0124 and ADR-0125 remain the record of their programmes; their still-valid principles are
  restated in §1 above and their superseded implementation-level doctrines are replaced here.

## Migration

None (CSS token values + one ADR). No schema change. Compatibility aliases mean no coordinated
component change is required to land the foundation.

## Supersedes

Supersedes, in part, ADR-0124 (adaptive contextual UI composition) and ADR-0125
(reference-convergence) — specifically their result-colour treatment, fixed match-variant
count, fixed visualization-primitive count, pitch-line background, warm palette, and scattered
fixed pixel measurements. Their same-domain-truth, canonical-`MatchPresentation`,
Operational-Timeline, accessibility and temporal-composition principles are retained.
