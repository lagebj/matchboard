# ADR-0135: Touchline Finish & Visual Convergence follow-up

## Status

Accepted (2026-09-11). **Phases F0–F4 implemented; F5–F9 gated on human UI-Lab approval.**

This is a follow-up to ADR-0134 ("Matchboard Visual Identity & Frontend Reset 1.0" / Touchline),
not a new visual system. ADR-0134's Touchline foundation (theme system, accent, sports
typography, shell/scorebook/timeline/evidence/workbench grammar) is retained unchanged. This ADR
records the additional durable rules established by the
`.matchboard-work/matchboard_touchline_finish_followup_2026-09-11/` bundle and implemented in
this pass.

## Context

ADR-0134's Phases 10–12 completed the first Touchline migration: every production route runs on
one theme-aware token system, and the old Product Surface 1.0 palette/aliases are removed. A
second set of golden references (`shell-light-desktop.png`, `shell-mobile.png`,
`event-squad-mobile.png`, `lineup-mobile.png`, `live-reporting-mobile.png`,
`player-detail-mobile.png`) showed the intended end-state is visually richer than the first
implementation contract forced: coherent content widgets, a genuinely translucent floating
navigation layer, a football-specific pitch/player-token language, and richer live-reporting and
player-detail composition. This is a frontend convergence programme, not a new domain programme —
see the bundle's `00_EXECUTION_CONTRACT.md` and `02_VISUAL_CONVERGENCE_CONTRACT.md`.

## Decision

Evolve Touchline rather than replace it. Five durable additions:

1. **Coherent widgets are first-class on overview/detail surfaces.** A `TouchlineWidget` is
   justified only when it answers one user question or supports one coherent action cluster —
   this is not a return to dashboard tile soup. `WidgetHeader`, `MetricStrip`, `CapacityBar`, and
   `QuickActionGrid` are the shared composition primitives
   (`src/components/touchline/widget/`); route-specific composition (`NextActionWidget`-style)
   builds on top of them. Workbenches (Round Board, Lineup, Tactics, Rotations, Live Reporting)
   stay workbenches — widgets are used sparingly there, never turning a task workspace into a
   dashboard.
2. **Floating control layers use high-opacity glass, with a solid fallback.** The compact bottom
   nav (and, where used, a bottom sheet) use a `>=90%`-opaque background (`--tl-control-glass`)
   with `backdrop-filter` layered on top only inside an `@supports` guard
   (`--tl-control-blur: 18px`). This supersedes the first pass's fully opaque `.tl-bottom-nav`,
   whose own comment recorded that translucency was avoided over an unverified worry about
   automated contrast checking — the `>=90%` opacity value is exactly what makes the background
   deterministic enough for WCAG-AA contrast computation and the "floating" material at once, so
   nothing was actually traded away.
3. **Pitch has its own visual token system**, independent of generic UI surface tokens:
   `--tl-pitch` / `--tl-pitch-deep` / `--tl-pitch-line` / `--tl-pitch-border` /
   `--tl-pitch-selected` / `--tl-pitch-atmosphere`, applied via the `.tl-pitch-surface` utility
   class and consumed by `src/components/formations/tactics-board.tsx`.
4. **Lineup/tactics render players with `PitchPlayerToken`/`PitchEmptySlot`
   (`src/components/touchline/pitch/`), not generic role-coloured rectangles.** The formation
   builder's slot-type differentiation is restrained (border/text only, low-alpha background) —
   `ROLE_COLORS` in `tactics-board.tsx` no longer uses saturated Tailwind-500 fills. No
   role-colour rainbow anywhere in lineup/tactics assignment state.
5. **Golden-reference images are composition authority, not domain-data authority.** They define
   hierarchy, density, material, widget/pitch/sheet anatomy — never a licence to add player
   photos, a league table, drill/training features, new live-event types, or any other product
   concept the reference merely happens to illustrate. Every fixture and every production
   composition in this pass uses only already-canonical Matchboard data.

Existing mark derivatives (favicon/PWA/apple-icon using the Touchline launcher colours) are
**not** part of this decision yet — that is Phase F7, still pending the F4 gate below.

## What shipped in this pass (F0–F4)

- **F1 — token/material convergence**: `src/app/touchline.css` gained the widget / control-glass
  / pitch token blocks (dark + light + system-light-media), the new radii
  (`--tl-radius-widget: 14px`, `--tl-radius-control-layer: 22px`, `--tl-radius-sheet: 24px`), and
  the `.tl-feature-atmosphere` / `.tl-widget` / `.tl-widget-strong` / `.tl-control-glass` /
  `.tl-pitch-surface` utility classes. `.tl-bottom-nav` geometry moved to 16 px side inset, 74 px
  height, 22 px radius, `safe-area + 12px` bottom inset; `--nav-clearance`/`.tl-nav-clearance`
  recomputed to `108px + safe-area` to match.
- **F2 — core component convergence**: `TouchlineWidget`, `WidgetHeader`, `MetricStrip`,
  `CapacityBar`, `QuickActionGrid` (new); `TouchlineBrandTile` (new, used by `TouchlineWordmark`);
  `TouchlineBottomNav` (28×28 bordered active icon container), `TouchlineSidebar` (4 px row gap,
  42 px row height, `accent-subtle` active row background), `TouchlineTopBar` (search trigger
  field, inert until a caller wires a real search/command action — no second search surface
  invented); `TouchlineInspector` widened to 352 px with a `PlayerContextHeader` identity block;
  `TouchlineBottomSheet` widened anatomy (24 px top radius, 48×4 handle, 44×44 close target,
  optional `hero`/`tone` props, sticky footer); new workbench primitives `WorkbenchSummaryStrip`,
  `BenchRail`, `PositionFitList`, `PlayerContextHeader`; new pitch primitives `PitchPlayerToken` /
  `PitchEmptySlot`; new `LiveActionGrid` (pure presentation over caller-supplied action
  descriptors — defines no action type itself).
- **F3 — pitch renderer**: `tactics-board.tsx`'s lineup/tactics/selection-preview rendering now
  uses `PitchPlayerToken`/`PitchEmptySlot` instead of rectangular role-coloured buttons; the
  formation builder's slot buttons use the restrained `ROLE_COLORS` mapping; the pitch surface and
  markings use the new `--tl-pitch-*` tokens. `TacticsBoardPlayer` gained an optional
  `shirtNumber?: number | null` presentation field (not yet wired to any production data source —
  every existing caller passes nothing, which correctly falls back to initials; wiring real
  `Player.shirtNumber` through production call sites is F5 scope, not done here). No slot
  geometry, projection, or callback contract changed.
- **F4 — extended UI Lab gate**: seven new dev-only routes under `/dev/ui-lab/` (`shell-light`,
  `shell-mobile`, `event-squad`, `lineup`, `live-reporting`, `player-detail`, `tactics`), each
  built from the components above and in-memory fixtures
  (`src/app/dev/ui-lab/fixtures.ts`) — no database, no production route touched. See
  `artifacts/touchline-finish/ui-lab/REPORT.md` for the conformance report and required
  screenshots.

**Explicitly not done in this pass** (F5–F9, gated behind human approval of the F4 UI Lab):
production route migration (Today, Event squad, Player detail, Lineup, Tactics, Live Reporting,
Round Board, Insights, League/History untouched), brand-asset/favicon/PWA regeneration (F7),
deletion of superseded styles (F8), and full acceptance-gate verification / public-doc screenshot
regeneration (F9).

## One documented, deliberate domain gap

The golden `live-reporting-mobile.png` reference shows eight action types (Goal, Shot, Yellow,
Red, Substitution, Foul, Corner, Free kick). Matchboard's canonical `LiveMatchEventType` enum
supports only Goal (for/against), Rotation (substitution), Fair play (positive/concern), and
Moment marked — Shot/Yellow/Red/Foul/Corner/Free kick are not modelled anywhere in the live-match
domain today. Per this bundle's "no silent deviations" rule, `LiveActionGrid`'s UI Lab fixture
(`src/app/dev/ui-lab/fixtures.ts`'s `liveReportingActions`) uses only the six real action types;
no new `LiveMatchEventType` value was added. See the conformance report for the full record.

## Consequences

- Future work on shell/nav/workbench/pitch surfaces reads this ADR and ADR-0134 together; this
  ADR does not restate ADR-0134's still-valid rules (theme system, accent discipline, typography
  scale, breakpoints).
- `docs/product/adaptive-interaction-design.md` and this file's own AGENTS.md summary are updated
  in the same change to describe the widget/pitch/control-glass additions as current, not as a
  future idea — see the "Documentation" note below.
- No database schema changed. No selection/fairness/lineup/rotation/match-lifecycle/live-state/
  attendance/guest-player/evidence/permissions/audit behaviour changed — this is a presentation
  layer change only, verified by the unchanged domain test suite.
