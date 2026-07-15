# ADR 0025: Visual Decision Review

## Metadata

- **type**: decision
- **id**: 0025
- **title**: Visual Decision Review and Coaching Insight Surfaces
- **status**: accepted
- **date**: 2026-07-15
- **supersedes**: none
- **superseded_by**: none

## Context

Stages 1–9 established the planning, policy, simulation, audit, and policy pack foundation. Coaches can generate, review, finalize, simulate, and audit squads. However, the existing surfaces are mostly text tables, text warnings, and detailed drill-down pages. There is no at-a-glance visual surface that answers:

- Who has had opportunity and who has not?
- Who is carrying high recent participation load?
- Where are squad coverage weaknesses (especially goalkeeper)?
- Where do planned and actual participation differ?
- Which policy warnings keep recurring?
- Where do league and event plans conflict?

The season overview (`/season`) provides a player-by-round matrix, but it does not aggregate load, coverage, conflict, or policy warning context in a scannable visual format.

This ADR decides how Matchboard adds visual decision review surfaces that help coaches inspect decisions at a glance — without creating player ranking, ability leaderboards, or shame/blame displays.

## Decision

Matchboard adds a `/insights` route with six visual review surfaces, backed by new service-layer functions that consume existing audit, simulation, policy, and season data:

1. **Opportunity Matrix** — planned and actual opportunity across a selected scope (round, period, event, full year)
2. **Load Timeline** — recent participation load over time per player
3. **Squad Coverage Matrix** — position and goalkeeper coverage by squad/team/event
4. **Policy Warning Review** — policy warnings grouped by code, scope, team, match, severity, source
5. **Planned vs Actual Delta Review** — compact deltas between planned and actual participation
6. **Conflict Review** — overlapping selections, helper conflicts, missing reports, missing opponents

Key constraints:

- Visual surfaces consume existing source-of-truth services (audit, simulation, policy, season, selection). No parallel analytics data model.
- No player ranking dashboard, no ability leaderboard, no shame/blame labels.
- All visual surfaces use neutral, youth-safe language as defined in AGENTS.md.
- Historical removed/inactive players remain visible in historical review contexts but are hidden by default in active planning contexts.
- Policy warnings show source (default policy, custom policy, solver validation) without exposing raw Rego internals in coach-facing views.
- Policy pack identity (pack id, version) is available in diagnostic detail views.
- All surfaces support filters: season year, Spring/Fall/full year, date range, league/event/all, team/squad, player status.
- No heavy charting library. Visuals use Tailwind CSS, small inline SVGs, tables, compact cards, matrix grids, and existing domain-specific UI primitives (RoleBadge, PlayerChip, IssueMarker, StatusPill, etc.).
- The Assistant can link to insight surfaces but must not duplicate insight calculation logic.

## Route structure

```
/insights                        → Insight overview with tabs/cards linking to each surface
/insights/opportunity            → Opportunity Matrix
/insights/load                    → Load Timeline
/insights/coverage                → Squad Coverage Matrix
/insights/policy-warnings         → Policy Warning Review
/insights/planned-vs-actual       → Planned vs Actual Delta Review
/insights/conflicts               → Conflict Review
```

`/insights` is a secondary destination, not a primary sidebar item. It is accessible from the Assistant, the Season page, and contextual links.

## Service layer

New service files under `src/lib/insights/`:

| File | Purpose |
|------|---------|
| `insights-types.ts` | Shared types for all insight surfaces |
| `opportunity-matrix.ts` | Opportunity matrix data computation |
| `load-timeline.ts` | Load timeline data computation |
| `coverage-matrix.ts` | Squad/position/GK coverage computation |
| `policy-warning-review.ts` | Policy warning aggregation and grouping |
| `planned-actual-delta.ts` | Planned vs actual delta computation |
| `conflict-review.ts` | Conflict detection and aggregation |

These services consume existing data from `src/lib/audit/`, `src/lib/simulation/`, `src/lib/selection/`, `src/lib/policies/`, `src/lib/assistant/`, and `src/lib/seasons/`. They do not create a parallel data model.

## Rejected alternatives

- **Generic analytics dashboard**: Would not answer specific coaching questions and would invite ranking.
- **Player leaderboard**: Explicitly rejected by product rules. No ranking, no ability score display.
- **Radar/spider charts ranking children**: Rejected as youth-unsafe and shame-inducing.
- **Raw policy logs only**: Not scannable. Coaches need grouped, filtered views, not raw JSON.
- **Duplicated insight logic in Assistant**: Assistant must link to insights, not recompute them.
- **Heavy charting library (Recharts, D3, etc.)**: Rejected in favor of CSS/SVG/tables to avoid dependency bloat and maintain design system consistency.

## Consequences

- New `/insights` route with 6 visual surfaces
- New service layer under `src/lib/insights/`
- New API endpoints under `/api/insights/`
- New anonymized test fixtures under `test/fixtures/insights/`
- New tests under `src/lib/insights/__tests__/`
- Assistant can surface insight links and brief summaries
- Season page and review pages can link to relevant insight surfaces
- Documentation updates to AGENTS.md, README, and docs/