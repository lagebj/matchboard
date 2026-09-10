# ADR-0134: Matchboard Visual Identity & Frontend Reset 1.0 ("Touchline")

## Status

Accepted (2026-09-10). Implementation in progress:

- **Phases 0–3** delivered (theme foundation + `/dev/ui-lab` with the seven golden screens),
  PR #489.
- **UI Lab approved** (2026-09-10) — production-surface migration authorised.
- **Phase 5 (high-identity surfaces)** in progress: the `(app)` shell now activates the
  `.touchline` scope and its navigation (sidebar / rail / floating bottom nav) + top context
  bar use the Touchline visual system; **League** (`/fixtures`) is migrated to the scorebook
  grammar. Remaining Phase 5 surfaces (Today, Events, match detail + Follow Live, Insights) and
  Phases 6–12 follow. Unmigrated production surfaces render transitionally on the new palette
  until their phase; Phase 10 removes the Product Surface 1.0 token layer.

## Context

Product Surface 1.0 (ADR-0130) improved consistency but stayed too close to the previous
visual language — dark-only surfaces, a muted-sage accent, restrained cards, incremental
layout change. The maintainer commissioned a **visual reset**, not another refinement pass:
a completed, frozen design direction delivered as the normative bundle
`.matchboard-work/matchboard_visual_identity_frontend_reset_2026-09-10/` (gitignored working
bundle). This ADR records the decision to adopt it and the durable rules that outlast the
bundle.

The internal codename for the visual language is **Touchline**. It is not shown to users; the
product remains **Matchboard**.

## Decision

### 1. The bundle is the visual authority

`.matchboard-work/matchboard_visual_identity_frontend_reset_2026-09-10/` supersedes ADR-0130's
visual doctrine (see ADR-0130's amended Status). Its frozen decisions
(`01_DECISION_FREEZE_MANIFEST.md`) and exact specifications are authoritative over the current
implementation. Existing domain / security / tenancy / audit / fairness / live-state /
evidence / positional-safety behaviour is **not** changed by this programme
(`17_FUNCTIONAL_FREEZE.md`).

### 2. Brand identity

The existing Matchboard mark (`public/brand/logo.svg`, a monochrome single-path trace;
`logo.eps` vector source) is retained and must not be redesigned. New identity comes from
colour, typography, score/time treatment, spacing, materials, motion, and recurring
match/timeline/evidence compositions — not from the mark. Missing PWA/favicon/monochrome/
maskable derivatives may be generated from the existing mark without changing its geometry.

### 3. Appearance modes

Matchboard supports `system`, `light`, and `dark`. Default is `system`. Storage key
`matchboard-theme`; explicit choice stamps `data-theme="light" | "dark"` on `<html>`; system
omits the attribute and follows `prefers-color-scheme`. A minimal inline pre-hydration
initializer prevents a flash to the wrong explicit theme. `next-themes` is **not** added — the
behaviour is small enough to own locally (`src/lib/theme/`).

Dark remains the primary brand/reference appearance; light is a first-class production theme
(a real sideline mode, not an inverted dark palette).

### 4. Tokens

The normative token set is `data/touchline-tokens.css` in the bundle, mirrored into
`src/app/touchline.css`. Primary dark accent is luminous yellow-green `#C7F54A`
(`#587400` as light-theme text/control colour). Accent is **sparse** — identity, current
selection, primary action, own-team emphasis, selected data — never routine surface fill.
Football outcome is never `--danger` (loss) or `--success` (win); `--live` is its own colour.

Geometry: 8 px controls, 10 px objects, 12 px feature/selected objects, 16 px overlays,
6 px status markers. Routine pill shapes are prohibited. Repeating pitch-line background
graphics are prohibited.

### 5. Typography

Geist Sans remains the UI typeface (body, labels, player names, team names, navigation,
forms, ordinary metadata). **Barlow Condensed** (weights 600/700, `next/font/google`) is added
**only** for sports/numeric display roles: hero score, list score, prominent live clock,
week/round marker, major evidence number. Names are never set in condensed type.

### 6. Materials

Two layers. **Content layer**: opaque/crisp — canvas, flat surface, dividers, alignment,
typography. **Control layer**: may use translucency/blur/subtle border/separation shadow —
compact bottom navigation, floating desktop nav shell, bottom sheets, popovers, sticky
action bars, floating local selectors. Glass is prohibited on match rows, player rows,
evidence stories, settings sections, and routine cards. Cards are exceptional, not the
default grouping device — content defaults to open canvas.

### 7. Product-area grammar (durable owners)

| Area | Grammar | Component owners |
|---|---|---|
| Today | Editorial + temporal | `Timeline`, `OperationalMatchCard`, `ContextRail` |
| League / History | Sports scorebook | `ScorebookRoundSection`, `ScorebookMatchRow` |
| Match / Follow Live | Scoreboard | `MatchScoreHeader`, `LiveScoreboard`, `LiveScoreStrip` |
| Events | Timeline-first temporal | `Timeline`, `TimelineMatchNode`, `ContextRail` |
| Round Board / planning | Calm dense workbench | `WorkbenchToolbar`, `RosterColumn`, `RosterRow`, `Inspector` |
| Insights / evidence | Authored data story | `EvidenceStory` + approved visual primitives |
| Settings / Rules / Groups | Quiet utility | conventional grouped forms |

The canonical normalized `MatchPresentation` projection (ADR-0125) remains the sole owner of
home/away, score orientation, own-team side, lifecycle, result outcome, clock, cancellation,
and planning/report attention. Presentation components consume it; they never re-derive it.

Approved evidence visual primitives: `PhaseDistribution`, `OutcomePair`, `TrendLine`,
`RangeBand`, `SequenceStrip`, `DotComparison`, `ExposureMap`, `CombinationTimeline`. Pie
charts, gauges, speedometers, radar charts, and player-ranking bars are prohibited. Evidence
answers one question per story; confidence and sample size stay explicit; interpretation is
correlational, never causal.

### 8. Navigation

Compact (`<600px`): floating translucent bottom nav (62 px, 16 px radius, 12 px side inset,
safe-area aware, 24×3 px accent indicator bar — never a pill). Medium (600–839): 72 px rail.
Expanded (`≥840`): 216 px sidebar that recedes behind content (3 px accent leading marker on
the active item, no large pill). Five destinations unchanged: Today, League, Events, Players,
More.

### 9. Motion

Existing `motion` package only; no new animation framework. Motion communicates
continuity/state — active-nav indicator travel, selected sibling indicator travel, sheet
rise/fall, adjacent day/event shift, local evidence expand, one restrained score-value
transition, workbench inspector slide/fade. Decorative animation (celebratory score,
confetti, perpetual pulse beyond a live dot, entrance cascades, bouncing buttons,
input-blocking route animation, parallax) is prohibited. `prefers-reduced-motion` and reduced
transparency are respected; nav stays legible without `backdrop-filter`.

### 10. Process — UI Lab is a hard human gate

The previous visual programme migrated the whole app before the visual target was proven.
This programme reverses that: a development-only `/dev/ui-lab` (404 in production) renders the
seven golden reference screens (league desktop/compact, today compact, event-day compact,
round-board desktop, follow-live compact, insights compact) from representative in-memory
fixture data. Screenshots are captured to `artifacts/visual-reset/ui-lab/`. **No production
route family is migrated until a human approves the UI Lab.** After approval, UI Lab
components become the production primitives and migration proceeds in the phases of
`14_IMPLEMENTATION_PHASES.md`. This UI Lab / golden-gate process is the required procedure for
any future major visual change.

### 11. Documentation

`docs/product/adaptive-interaction-design.md` is rewritten as the current frontend design
reference on approval; ADRs are append-only and superseded via a new ADR (this one). AGENTS.md
carries a concise frontend-authority pointer, not duplicated visual measurements. The product
is never called "Touchline" in user-facing or public documentation.

## Consequences

- A second visual token layer (`src/app/touchline.css`, activation class `.touchline`) and a
  `src/components/touchline/` primitive namespace coexist with the Product Surface 1.0 system
  during Phases 5–9. Phase 10 removes the old tokens, compat aliases, and obsolete components;
  no `Old`/`V2`/`Legacy` visual component families remain in production.
- The final production app must look materially different from Product Surface 1.0 at first
  glance. An incremental token swap does not satisfy this programme.
- Icon derivatives generated: dark/light tile treatments, monochrome variant, favicon sizes,
  Apple touch icon, PWA 192/512, maskable 192/512 — all from the unchanged mark geometry.
