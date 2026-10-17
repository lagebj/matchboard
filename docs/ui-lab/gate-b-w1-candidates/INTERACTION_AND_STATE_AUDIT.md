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

B01 is the only scenario with a legitimate action (Edit Lineup) — its `DecisionBanner` uses
`variant="note"` (not `"decision"`) because the plan is already complete; nothing is actually
blocking kickoff. B02's `DecisionBanner` correctly uses `variant="decision"` (amber, `role="alert"`)
because selecting the remaining squad and lineup is a genuine open requirement. B03/B04 render no
decision banner at all — a completed match has no outstanding coach decision, and a banner
implying one would be dishonest.
