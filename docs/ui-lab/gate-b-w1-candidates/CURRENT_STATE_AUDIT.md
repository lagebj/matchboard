# Gate B W1 — Current State Audit

## Route and data ownership (League Match Details)

- Canonical owner: `src/app/(app)/o/[orgSlug]/matches/[matchId]/page.tsx`.
- `src/app/(app)/matches/[matchId]/page.tsx` is confirmed a pure `redirectToOrgSlug` redirect —
  not a second implementation.
- Post-Match Report: canonical owner `src/app/(app)/o/[orgSlug]/matches/[matchId]/post-match/page.tsx`;
  `src/app/(app)/matches/[matchId]/post-match/page.tsx` is the equivalent redirect.

## Route and data ownership (Event Match Details) — gap relevant to deferred B06

- Canonical owner: `src/app/(app)/o/[orgSlug]/events/[eventId]/matches/[eventMatchId]/live/page.tsx`
  (and `.../live/follow/page.tsx`).
- **No plain (non-live) Event Match Details route exists today.** `event-matches-tab.tsx` links
  event matches directly to `/live` and `/live/follow`, never to a separate before/after details
  page analogous to League's. This means B06 (League/Event parity, deferred) may not have a
  symmetric target on the Event side yet — flagged here and in `BLOCKERS.md` for whoever picks up
  B06, not investigated further in this wave since B06 is out of scope.

## Component inventory (real, current production — what this wave reuses or deliberately doesn't)

| Component | File | Reused in this wave? |
|---|---|---|
| `MatchIdentityCard` | `src/components/matches/match-detail/match-identity-card.tsx` | Yes — pure, prop-driven |
| `MatchPreparationWidget` | `src/components/matches/match-detail/match-preparation-widget.tsx` | Yes — pure, over `buildMatchPreparationDisplayItems()` |
| `MatchOpponentMemory` | `src/components/matches/match-detail/match-opponent-memory.tsx` | Yes — pure, returns `null` on no history (B02's honest empty state) |
| `MatchInsights` / `MatchInsightCard` | `src/components/matches/match-insights/{match-insights,match-insight-card}.tsx` | Yes — confirmed real/deterministic/prop-driven in `PRODUCTION_OWNER_AND_GATE_B_HANDOFF.md` |
| `MatchTimelineList` | `src/components/matches/match-detail/match-timeline-list.tsx` | Yes — pure |
| `MatchFlowPanel` | `src/components/matches/match-detail/match-flow-panel.tsx` | Yes — pure, over `buildMatchFlowChronology()` |
| `WhatThisMatchAddedPanel` | `src/components/matches/match-detail/what-this-match-added-panel.tsx` | Yes — pure, over `buildWhatThisMatchAddedRows()` |
| `DecisionBanner` | `src/components/ui/decision-banner.tsx` | **No (Phase 2)** — an earlier revision used it on B01/B02 to restate `MatchPreparationWidget`'s own readiness verdict; removed as duplicate information. See `VISUAL_VS_CURRENT.md` design-audit finding #1. |
| A07's `useFixtureOperation`/`useDirtyCloseGuard`/`LineupSlotInspector`/`LineupSlotSheet` | `src/app/dev/ui-lab/gate-a/{shared/fixture-operation.ts,a07-match-details-edit-lineup/shared/lineup-slot-editor.tsx}` | Yes — B01's Edit Lineup demo imports these directly rather than duplicating them |
| `MatchTacticsPanel` | `src/components/matches/match-tactics-panel.tsx` | **No** — self-fetches lineup + Match Insights client-side and mutates via server actions; not fixture-injectable (same gap class as A05/A08's `AssistantCoachHypothesisPanel`, W4-BLK-10) |
| `PlanVsRealityPanel` | `src/components/matches/match-detail/plan-vs-reality-panel.tsx` | **No** — self-fetches via `getRotationVsActualAction` server action |
| `PlannedPlayingTimePanel` | `src/components/matches/match-detail/planned-playing-time-panel.tsx` | **No** — self-fetches via `getPlannedPlayingTimeAction` server action |
| `CoachingIntentSelector` / `MatchFormatOverrideControls` | `src/components/matches/{coaching-intent-selector,match-format-override-controls}.tsx` | **No** — mutating, not needed to satisfy B01-B04's normative requirements |
| `CompletedMatchAdvisorPanel` | `src/components/ai/completed-match-advisor-panel.tsx` | **No** — requires `useOrgSlug()` context and wires real mutating server actions for clarification/development-suggestion cards; `MatchInsights`/`MatchInsightCard` already satisfies B01/B04's "earned finding with source drilldown" requirement without this dependency. B07 (Assistant Coach longitudinal, deferred) is this panel's real territory. |

See `DATA_TRUTH_AND_FIXTURES.md` for why each "No" is a real constraint, not a shortcut.

## ADRs and ARRs consulted

`docs/adr/0147-match-details-and-post-match-report-lifecycle-surfaces.md`,
`0149-match-insights-consolidation-and-tactics-layout-rebalance.md`,
`0152-coach-learning-loop.md`, `0154-canonical-tactical-position-model.md`,
`0157-contextual-coach-workspace-convergence.md`,
`0158-convergence-bundle-residue-after-adr-0157.md` — all read, all directly cited by the B01-B08
register rows. No new ADR is proposed by this wave; it reuses the existing lifecycle/evidence
grammar rather than introducing a new one.
