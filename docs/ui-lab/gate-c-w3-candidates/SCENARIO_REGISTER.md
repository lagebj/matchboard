# Gate C W3 — Scenario Register

Two register rows (C07, C08), 8 fixture-driven display routes + 2 scenarios (C08-D/E) with no
fixture route at all, evidenced by real-DB integration tests only (see `BLOCKERS.md`). No scenario
in this wave has authenticated browser-level evidence — see `C08_OPERATIONAL_ACCEPTANCE.md`'s
evidence-tier disclosure.

## C07 — Today, Assistant Coach contextual fallback

| Scenario ID | Required state | Route | Viewports | Themes | Production components mounted |
|---|---|---|---|---|---|
| `GATE-C-W3-C07-OFF` | Capability unavailable | `/dev/ui-lab/gate-c/c07-assistant-coach-fallback/off` | desktop, mobile, narrow, 360, 430 | dark, light | `TodaySurface`, `TodayContextRail` |
| `GATE-C-W3-C07-ON` | Relevant contextual hypothesis | `/dev/ui-lab/gate-c/c07-assistant-coach-fallback/on` | desktop, mobile, narrow, 360, 430 | dark, light | `TodaySurface`, `TodayContextRail`, `TodayAssistantCoachPanel`, `AssistantCoachHypothesisPanel` (Promote/Dismiss wired to a fixture-safe simulated `actions` override — see `C07_PRODUCTION_INTEGRATION_GAP.md`; no Server Action is called) |
| `GATE-C-W3-C07-EMPTY` | No useful hypothesis | `/dev/ui-lab/gate-c/c07-assistant-coach-fallback/empty` | desktop, mobile, narrow, 360, 430 | dark, light | `TodaySurface`, `TodayContextRail` |
| `GATE-C-W3-C07-ERROR` | Capability failure | `/dev/ui-lab/gate-c/c07-assistant-coach-fallback/error` | desktop, mobile, narrow, 360, 430 | dark, light | `TodaySurface`, `TodayContextRail`, `TodayAssistantCoachPanel`, `AdvisorPanelUnavailable` |
| `GATE-C-W3-C07-STALE` | Outdated context | `/dev/ui-lab/gate-c/c07-assistant-coach-fallback/stale` | desktop, mobile, narrow, 360, 430 | dark, light | `TodaySurface`, `TodayContextRail`, `TodayAssistantCoachPanel`, `AdvisorPanelStale` |

All five share identical underlying Today facts (one genuine decision-day primary decision) —
only `assistantCoachContext` differs, so OFF/ON/EMPTY/ERROR/STALE comparison is apples-to-apples.

## C08 — Round Board + Today, same-day quick add

Every row's fixture route (where one exists) is **display-only** — a prop-driven presentation of
a state the real planner/action layer can produce, never itself a mutation. The evidence column
states exactly which tier of proof exists for each requirement; see
`C08_OPERATIONAL_ACCEPTANCE.md`'s evidence-tier disclosure for why no browser-level journey is
claimed anywhere in this wave.

| Scenario ID | Required state | Evidence | Production code/components exercised |
|---|---|---|---|
| `GATE-C-W3-C08-A` | Planning open | Display-only fixture `/dev/ui-lab/gate-c/c08-same-day-quick-add/planning-open` + real-DB integration test `today/__tests__/actions.test.ts` ("applies the mutation and revalidates..."). No browser-level journey. | `TodaySurface`, `TodayNextAction`/`TodayDecisionRow`, `applyTodaySelectionRecommendationAction`, `addPlayerToDraftMatch` |
| `GATE-C-W3-C08-B` | Tentative availability (supplementary only — the register's "after RSVP" state is **BLOCKED**, not satisfied; Matchboard has no RSVP-deadline mechanism) | Display-only fixture `.../after-availability-change` + real-DB integration test `today/__tests__/actions.test.ts` (new TENTATIVE test). | Same as above; `today-selection-recommendation-plan.ts`'s real TENTATIVE handling |
| `GATE-C-W3-C08-C` | Planning closed | Display-only fixture `.../planning-closed` + real-DB integration test `today/__tests__/actions.test.ts` ("rejects once the planning boundary is closed..."). No browser-level journey. | Same mutation path; `isMatchPlanningEditable()`/`isPlanningBoundaryClosed()` |
| `GATE-C-W3-C08-D` | Guest | No fixture route at all (see `BLOCKERS.md`) — real-DB integration tests only, `src/app/(app)/matches/__tests__/league-match-guest-actions.test.ts` (new file, 10 tests). No browser-level journey. | `AddPlayerDialog` Guest tab, `addLeagueMatchGuestAction`, `createAndAddMatchGuestAction`, `getEffectiveLeagueMatchRoster` |
| `GATE-C-W3-C08-E` | Late arrival | No fixture route — real-DB integration tests only, same file plus pre-existing `match-helper-actions.test.ts` (pre-kickoff/live coverage); cancelled-match guard added for the guest path. No browser-level journey. | `AddPlayerDialog` Player tab, `addLeagueMatchHelperAction` with `provenance: MATCH_DAY_ADDITION` |

C08's full PASS/PARTIAL/BLOCKED disposition per sub-requirement, and the live-reporting disclosed
gap (issue #842), are detailed in `C08_OPERATIONAL_ACCEPTANCE.md`.
