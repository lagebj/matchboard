# Gate C W3 — Scenario Register

Two register rows (C07, C08), 8 fixture-driven display routes + 2 real-workflow scenarios
evidenced by Playwright/integration tests instead of a display route (see `BLOCKERS.md`).

## C07 — Today, Assistant Coach contextual fallback

| Scenario ID | Required state | Route | Viewports | Themes | Production components mounted |
|---|---|---|---|---|---|
| `GATE-C-W3-C07-OFF` | Capability unavailable | `/dev/ui-lab/gate-c/c07-assistant-coach-fallback/off` | desktop, mobile, narrow, 360, 430 | dark, light | `TodaySurface`, `TodayContextRail` |
| `GATE-C-W3-C07-ON` | Relevant contextual hypothesis | `/dev/ui-lab/gate-c/c07-assistant-coach-fallback/on` | desktop, mobile, narrow, 360, 430 | dark, light | `TodaySurface`, `TodayContextRail`, `TodayAssistantCoachPanel`, `AssistantCoachHypothesisPanel` |
| `GATE-C-W3-C07-EMPTY` | No useful hypothesis | `/dev/ui-lab/gate-c/c07-assistant-coach-fallback/empty` | desktop, mobile, narrow, 360, 430 | dark, light | `TodaySurface`, `TodayContextRail` |
| `GATE-C-W3-C07-ERROR` | Capability failure | `/dev/ui-lab/gate-c/c07-assistant-coach-fallback/error` | desktop, mobile, narrow, 360, 430 | dark, light | `TodaySurface`, `TodayContextRail`, `TodayAssistantCoachPanel`, `AdvisorPanelUnavailable` |
| `GATE-C-W3-C07-STALE` | Outdated context | `/dev/ui-lab/gate-c/c07-assistant-coach-fallback/stale` | desktop, mobile, narrow, 360, 430 | dark, light | `TodaySurface`, `TodayContextRail`, `TodayAssistantCoachPanel`, `AdvisorPanelStale` |

All five share identical underlying Today facts (one genuine decision-day primary decision) —
only `assistantCoachContext` differs, so OFF/ON/EMPTY/ERROR/STALE comparison is apples-to-apples.

## C08 — Round Board + Today, same-day quick add

| Scenario ID | Required state | Evidence | Production code/components exercised |
|---|---|---|---|
| `GATE-C-W3-C08-A` | Planning open | Fixture route `/dev/ui-lab/gate-c/c08-same-day-quick-add/planning-open` (display) + real-DB integration test `today/__tests__/actions.test.ts` ("applies the mutation and revalidates...") | `TodaySurface`, `TodayNextAction`/`TodayDecisionRow`, `applyTodaySelectionRecommendationAction`, `addPlayerToDraftMatch` |
| `GATE-C-W3-C08-B` | After RSVP (real mechanism: tentative availability) | Fixture route `.../after-availability-change` (display) + real-DB integration test `today/__tests__/actions.test.ts` (new TENTATIVE test, register C08-B) | Same as above; `today-selection-recommendation-plan.ts`'s real TENTATIVE handling |
| `GATE-C-W3-C08-C` | Planning closed | Fixture route `.../planning-closed` (display) + real-DB integration test `today/__tests__/actions.test.ts` ("rejects once the planning boundary is closed...") | Same mutation path; `isMatchPlanningEditable()`/`isPlanningBoundaryClosed()` |
| `GATE-C-W3-C08-D` | Guest | No fixture route (see `BLOCKERS.md`) — real-DB integration tests, `src/app/(app)/matches/__tests__/league-match-guest-actions.test.ts` (new file, 10 tests) | `AddPlayerDialog` Guest tab, `addLeagueMatchGuestAction`, `createAndAddMatchGuestAction`, `getEffectiveLeagueMatchRoster` |
| `GATE-C-W3-C08-E` | Late arrival | No fixture route — real-DB integration tests, same file (`addLeagueMatchHelperAction`'s pre-existing `match-helper-actions.test.ts` coverage for pre-kickoff/live; cancelled-match guard added for guest path) | `AddPlayerDialog` Player tab, `addLeagueMatchHelperAction` with `provenance: MATCH_DAY_ADDITION` |

C08-D/E's acceptance disposition and the live-reporting disclosed gap are detailed in
`C08_OPERATIONAL_ACCEPTANCE.md`.
