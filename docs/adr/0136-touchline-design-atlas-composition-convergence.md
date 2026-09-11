# ADR-0136: Touchline Design Atlas & Composition Convergence

## Status

Accepted (2026-09-11). **Phases 0–3 implemented (inventory/provenance, presentation view
models, semantic widget/viz library, route-complete UI Lab), followed by two rounds of Hard Gate
A review feedback (pitch-line markings, GK kit colour + opt-in perspective tilt, shirt-shaped
tokens, vertical pitch orientation — see `docs/domain/touchline-atlas-provenance.md` §12–§13),
each verified with a full `npm run validate` pass and merged (#519, #520).

**Hard Gate A: approved 2026-09-11.** The human reviewer confirmed the Phase 3 UI Lab
(`/dev/ui-lab/atlas`, including both feedback rounds) matches expectations — information
hierarchy, component composition, visual fidelity, and data-story quality all accepted. Per
`13_IMPLEMENTATION_PHASES_AND_GATES.md`, this unblocks **Phase 4 — High-identity routes** (Today,
League, Events, Event detail, Match detail, Players, Player detail, Insights), which stops again
at **Human Gate B** before Phase 5 (the football work surfaces: Round Board, Lineup, Tactics,
Rotations, Live Reporting, Follow Live, Post-match). Phases 6–10 (historical/intelligence routes,
utility/config/collaboration routes, brand asset convergence, transitional-design removal, full
validation and final sign-off) remain unstarted and ungated until their own turn.

This is a follow-up to ADR-0134 (Touchline) and ADR-0135 (Touchline Finish & Visual Convergence
follow-up). It does not replace either — Touchline's tokens/theme system and the Finish
programme's widget/pitch/control-glass primitives are the foundation this bundle builds
composition on top of. This ADR records the durable rules established by the
`.matchboard-work/matchboard_touchline_design_atlas_implementation_followup_2026-09-11/` bundle
and implemented in this pass.

## Context

Where ADR-0134/0135 converged Matchboard's visual *material* (tokens, typography, widget/pitch
anatomy), the Design Atlas bundle is a composition/information-architecture convergence: it
supplies a golden-reference atlas and per-route composition specs for 31 routes (Today, League,
History, Round Board, match-detail sub-tabs, Events, Players, Insights, Opponents, Teams, Season,
Formations, Groups, Rules, Settings, More, Peer reviews, Invitation, and a shared system-states
gallery) and requires an agent implementing it to act strictly as an *implementer*, not a
designer: no product-shape decisions, no page-hierarchy decisions, no widget-selection decisions
beyond what the bundle specifies. The bundle's own execution sequence is a 14-step pipeline with
three hard human-approval gates (A, B, C); this ADR covers Phases 0–3, ending at Gate A.

## Decision

1. **Golden reference images are composition authority (hierarchy, density, widget anatomy,
   grouping), never domain-data or navigation-structure authority.** Where a golden image implies
   a product-shape change unsupported by canonical Matchboard data or by a standing,
   repeatedly-reinforced product decision, the standing decision wins and the conflict is recorded
   rather than silently resolved either way. The single most consequential instance: the golden
   atlas boards' sidebars show more items than the real navigation; the 5-item Today/League/
   Events/Players/More primary navigation (AGENTS.md "Canonical routes", Phase 2.4) is unchanged.
   See `docs/domain/touchline-atlas-provenance.md §0` for the full register of 17 such
   corrections (opponent-tendency vocabulary, no percentage strength scores, no external
   standings table, no invented accent-color picker, no photos, no map, no fabricated player
   attributes, etc.).
2. **Every new field flows through one classified provenance path**: canonical domain data →
   a pure, DB-free, unit-tested presentation view-model builder in `src/lib/touchline/presentation/`
   → a semantic Touchline widget → route composition. Fifteen view-model modules exist (Today,
   League, History, Insights overview, Player list, Player detail, Event list/detail, Event
   squad, Match detail/planning-hub, Opponents list/detail, Teams overview/detail, Season,
   Round Board, Peer reviews), each carrying a `Sources:`/`Derived:` provenance comment
   classifying every field as `EXISTING_DIRECT` / `EXISTING_QUERYABLE` / `DERIVED_PRESENTATION` /
   `CONDITIONAL`, with 33 passing unit tests. No field is invented data to fill a screenshot; a
   full `PROHIBITED_ILLUSTRATIVE` register (`docs/domain/touchline-atlas-provenance.md §10`)
   names golden-image details with no real data owner (team logos, shot/possession tracking,
   opponent player names, cooperating-club lists, work-rate/style attributes, notification
   preferences) that were deliberately not built.
3. **A widget/viz library extends, not duplicates, the existing Touchline Finish primitives.**
   Thirteen new named widgets (`src/components/touchline/widgets/`) and ten viz primitives
   (`src/components/touchline/viz/`, including `DotComparison` — ADR-0125's originally
   spec-approved-but-unbuilt ninth evidence primitive) either wrap an existing production
   component (`NextMatchHero` over `OperationalMatchCard`; lineup/tactics/formations composition
   reuses the existing production `TacticsBoard`/`PitchPlayerToken`/`BenchRail`/
   `PositionFitList`/`TouchlineInspector` directly, never a second pitch) or compose the shared
   `TouchlineWidget` primitive, which gained five new tone values (`hero`/`feature`/`support`/
   `scan`/... — see `touchline-widget.tsx`) reconciled with its three original tone names as
   aliases. `PitchExposure` reuses the existing `POSITION_GRID` lookup (now exported from
   `position-map.tsx`) rather than a second hard-coded position map.
4. **Phase 3's UI Lab is route-complete**: all 31 matrix routes plus the Phase 2 widget/viz
   gallery render under `/dev/ui-lab/atlas/` (dev-only, unauthenticated tooling route, unchanged
   security boundary from ADR-0123/existing `PUBLIC_ROUTES` treatment of `/dev/**`), each backed
   by realistic, explicitly-fictional fixture data typed against the real view-model input
   contracts. No production route was migrated, touched, or restyled.
5. **Hard Gate A is a stop condition, not a formality.** Per the bundle's own contract, the
   implementing agent must never self-certify visual fidelity. Phases 4 onward (high-identity
   route migration, football work-surface migration, remaining routes, brand/PWA, transitional
   Product-Surface-1.0 removal, full regression, final approval) do not begin until a human
   reviews the Phase 3 UI Lab and explicitly approves it.

## What shipped in this pass (Phases 0–3)

- **Phase 0 — inventory & provenance**: `docs/domain/touchline-atlas-provenance.md`, covering 17
  golden-reference corrections, per-route-family provenance tables for all 9 route families, the
  `PROHIBITED_ILLUSTRATIVE` register, and the navigation-scope decision restatement.
- **Phase 1 — presentation view models**: 15 modules under `src/lib/touchline/presentation/`
  (see Decision §2), each with unit tests under `__tests__/` (33 tests, 6 suites).
- **Phase 2 — widget/viz library**: 13 widgets (`src/components/touchline/widgets/`), 10 viz
  primitives (`src/components/touchline/viz/`), the `TouchlineWidget` tone extension, and the
  `/dev/ui-lab/atlas/components` gallery page demonstrating all of them against fixture data.
- **Phase 3 — route-complete UI Lab**: `src/app/dev/ui-lab/atlas/fixtures.ts` (one shared,
  realistic, explicitly-fictional fixture set across every route) and 30 route-composition pages
  under `src/app/dev/ui-lab/atlas/routes/`, plus an `/dev/ui-lab/atlas` index page enumerating all
  of them. Screenshots for every route at desktop (1440×900) and mobile (390×844) viewports were
  captured against the running dev server and archived outside the repository (development
  evidence, not a committed baseline — see "Screenshots" in the accompanying report).

**Explicitly not done in this pass** (Phases 4–10, per `13_IMPLEMENTATION_PHASES_AND_GATES.md` —
Hard Gate A has since been approved, see Status above): any production route migration, brand
mark/icon/PWA regeneration, removal of Product Surface 1.0 residue, and full acceptance-gate
verification / public-doc screenshot regeneration. These begin in a follow-up ADR/PR sequence
starting with Phase 4.

## Consequences

- Future Design Atlas work (Phases 4+) has a settled, tested provenance/composition foundation to
  build production migration on, rather than re-deriving field sourcing or widget contracts
  per-route.
- The 17-item golden-vs-domain correction register and the `PROHIBITED_ILLUSTRATIVE` register are
  now durable references — a future phase must not silently reopen a decision already recorded
  there without a new explicit maintainer decision.
- No behavioural, security, or production-visible change occurred in this pass; standard
  production verification gates (`npm run validate`) still apply and passed clean on this branch.

## References

- `.matchboard-work/matchboard_touchline_design_atlas_implementation_followup_2026-09-11/` (the
  full bundle: `CODING_AGENT_PROMPT.md`, `00`–`14` spec documents, golden reference images,
  `data/route-composition-matrix.json`)
- `docs/domain/touchline-atlas-provenance.md`
- ADR-0134 (Touchline), ADR-0135 (Touchline Finish & Visual Convergence follow-up)
- ADR-0125 (Reference Convergence: Match Presentation / Timeline / Evidence Story), ADR-0129
  (Exact positional semantics), ADR-0130 (Product Surface 1.0)
