# Gate B W1 — Interaction and State Audit

## A07 operation-state grammar reused (B01 only)

`FixtureOperationStatus = IDLE | PENDING | SUCCESS | PERMISSION_DENIED | CONFLICT |
PLANNING_CLOSED | SERVER_ERROR` (`src/app/dev/ui-lab/gate-a/shared/fixture-operation.ts`), via
`useFixtureOperation()` + a single predeclared `SUCCESS` outcome.

B01 is the only Gate B W1 scenario that demonstrates this grammar — its Edit Lineup interaction
exercises `IDLE → PENDING → SUCCESS` deterministically via the visible "Continue fixture
simulation →" control, never a timer. `PERMISSION_DENIED`/`CONFLICT`/`PLANNING_CLOSED`/
`SERVER_ERROR` are not exercised by any B01-B04 scenario — the register's B01 row only requires
"Edit Lineup opens local tactical editor," not a full re-run of A07's own S3-S6 denial/conflict
matrix. Covered by `b01-planned-ready/__tests__/page.test.tsx`.

B02-B04 have no fixture-operation interaction at all — they are static read-only renders of their
respective lifecycle/completeness state, which is itself the honest representation (there is
nothing to edit in an incomplete plan beyond "select players," which is out of this wave's scope;
a completed match's Overview is read-only in production too).

## Assistant Coach states exercised

| Scenario | `MatchInsightsStatus` | Insight count | `source` |
|---|---|---|---|
| B01 | `CURRENT` | 2 | both `DETERMINISTIC` |
| B02 | `CURRENT` | 0 (honest empty) | n/a |
| B03 | n/a — no `MatchInsights` rendered (focused on result/chronology only) | — | — |
| B04 | `CURRENT` | 1 | `AI` |

`UPDATING`/`STALE_AI_WITHHELD`/`AI_UNAVAILABLE` are not exercised in this wave — see
`THREE_PART_EXPERIENCE_CONTRACT.md`.

## Keyboard/focus/accessibility smoke coverage

- B01: Escape closes the lineup editor and restores focus to the "Edit lineup" trigger button
  (`b01-planned-ready/__tests__/page.test.tsx`, mirrors A07's own established test).
- B04: every rendered `button` has a non-empty accessible name; the Match Insights "Evidence"
  disclosure is a native `<details>/<summary>` element, keyboard-operable by default with no
  custom script.

## Context-local vs. non-actionable states

B01 is the only scenario with a legitimate action (Edit Lineup). B03/B04 render no decision
banner at all — a completed match has no outstanding coach decision.

**Design-audit correction (Phase 2)**: B01 and B02's first revision each added a `DecisionBanner`
here to restate the plan's readiness verdict ("complete"/"select the remaining squad") —
duplicate information, since `MatchPreparationWidget` already renders the exact same verdict as
its own "Ready for match" item. Both banners are removed. `MatchPreparationWidget` alone is now
the single real readiness/non-actionable-state surface for B01/B02; no replacement banner was
added, since nothing non-duplicative was missing.

## Match Flow reconciliation disclosure (B03 only — design-audit finding #2, PROPOSED_REFINEMENT)

B03 renders an additive note after `MatchFlowPanel` when `chronologyReconcilesWithFinalScore()`
(`src/app/dev/ui-lab/gate-b/shared/chronology-reconciliation.ts`) returns `false` — i.e. the
chronology is fully trustworthy (every goal has a known minute) but its cumulative tally still
disagrees with the real final score. This is a genuinely new state this wave demonstrates that the
real `match-flow-panel.tsx` does not disclose today; see `BLOCKERS.md` for the proposed real
change. B04 computes the same check and confirms it is `true` (nothing renders) — covered by test.
