# Gate B W1 — Data Truth and Fixtures

All four candidates use deterministic, synthetic, in-memory fixtures — no database, no network
call, no production mutation. Fixed UTC clocks only (never `Date.now()`). Fixture source:
`src/app/dev/ui-lab/gate-b/shared/match-b-fixture.ts` plus each scenario's own `fixtures.ts`.

## Per-scenario fixture summary

| Scenario | Fixture ID | What's deliberately true about the data |
|---|---|---|
| B01 | `gate-b-w1-b01-planned-ready` | 8-player squad, 7 of 7 tactical slots filled, 1 genuine bench reserve (Vetle). `MatchPreparationInput` reports real complete booleans (`squadSelectedCount: 8`, `squadTarget: 8`, `hasLineup: true`). 2 real-shaped Match Insights (`DETERMINISTIC`), one `OPPONENT_HISTORY`, one `CURRENT_PLAN`. |
| B02 | `gate-b-w1-b02-planned-incomplete` | 5 of 8 target squad slots selected, 0 tactical positions assigned, `hasLineup: false`, `hasPlannedRotation: false` — all real booleans from `buildMatchPreparationDisplayItems()`, never an invented percentage. `opponentMemory: null` and `matchInsights.totalCount: 0` are the real components' own honest "nothing here" states. |
| B03 | `gate-b-w1-b03-completed-sparse` | Final score 6-4 (own win), exactly **one** `MatchTimelineItem` logged (`GOAL_FOR`, minute `23'`, `assistPlayerName: null`). The score and the chronology are intentionally inconsistent in completeness — the real-world rule this exercises. The single goal has a known minute, so `buildMatchFlowChronology()` is `trustworthy: true`, but its cumulative tally ends at "1-0" — genuinely different from 6-4. This specific case is the design-audit finding #2 PROPOSED_REFINEMENT demonstrates (see `VISUAL_VS_CURRENT.md`/`BLOCKERS.md`), computed by the new `chronologyReconcilesWithFinalScore()` helper. |
| B04 | `gate-b-w1-b04-completed-rich` | Final score 4-1, **seven** timeline items (4 `GOAL_FOR`, 1 `GOAL_AGAINST`, 1 `ROTATION`, 1 `MATCH_END`) that reconcile exactly with the score. Two goals carry `assistPlayerName` + `sourceIsCanonicalLiveEvent: true` (the only condition under which a real assist pairing is ever shown); the other two goals are un-paired, exactly like B03's, because they're report-fallback rows. One `AI`-sourced, `HIGH`-confidence Match Insight with 3 `evidenceRefs`. |

## The no-assist-pairing rule (ADR-0147 §5)

> "a real annotation event's `correctsEventId` references the goal's `clientEventId`... the
> Prisma schema has no `Goal.assistId`/`Assist.goalId` linkage, so no such pairing can ever be
> proven from report data alone."

Enforced by test (`b03-completed-sparse/__tests__/fixtures.test.ts` and
`b04-completed-rich/__tests__/fixtures.test.ts`): `assistPlayerName` is only ever non-null on a
`sourceIsCanonicalLiveEvent: true` item.

## Forbidden fields — never present

Possession, expected goals (xG), shots, cards, numeric player ratings, opponent history beyond
what `OpponentMemoryViewModel` already supports, and "Player of the Match" appear nowhere in any
Gate B fixture or rendered page. Enforced by a case-insensitive substring test in every
`fixtures.test.ts` file.

## Why four real mid-level components are NOT reused (disclosed, not worked around)

- **`MatchTacticsPanel`** — self-fetches the lineup and Match Insights client-side and mutates via
  real server actions (`assignPlayerToSlot`, absence/add-player actions) when `planningEditable`.
  Not fixture-injectable today — the same class of gap Gate A's W4 disclosed for
  `AssistantCoachHypothesisPanel` (W4-BLK-10). B01/B04 instead compose `TouchlinePlanningPitch`
  (read-only) directly, the same pattern Gate A's A07 already established for exactly this
  reason.
- **`PlanVsRealityPanel`** — calls `getRotationVsActualAction(matchId, teamId)`, a real server
  action, on mount. No production equivalent exists that renders from a plain `RotationVsActualSummary`
  prop. Omitted from B04 rather than re-implemented with a parallel, divergent presentation.
- **`PlannedPlayingTimePanel`** — same shape of gap, via `getPlannedPlayingTimeAction`. Omitted
  from B01.
- **`CoachingIntentSelector`/`MatchFormatOverrideControls`** — real mutating form controls, not
  required to satisfy any B01-B04 register requirement. Omitted entirely; no coaching intent is
  shown in this wave's candidates (an earlier revision tried to compensate with a `DecisionBanner`,
  which duplicated `MatchPreparationWidget` instead of adding real coaching-intent content — see
  `VISUAL_VS_CURRENT.md` design-audit finding #1 — so it was removed rather than kept).

None of these omissions reduce B01-B04's register requirements to something untrue — they are
scope reductions, explicitly logged here and in `BLOCKERS.md`, not silent gaps.
