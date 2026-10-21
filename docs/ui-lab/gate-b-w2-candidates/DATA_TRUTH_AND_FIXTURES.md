# Gate B W2 — Data Truth and Fixtures

Both candidates use deterministic, synthetic, in-memory fixtures — no database, no network call,
no production mutation. Fixed UTC clocks only (never `Date.now()`). Fixture source:
`src/app/dev/ui-lab/gate-b/shared/match-b-fixture.ts` (match identity, shared with B01-B04) plus
`b05-post-match-report/shared/report-data.ts` (raw attendance/goal/assist/debrief/combination
records, new to this wave) plus each scenario's own `fixtures.ts`.

## One match, one report, two real lifecycle moments

Unlike B01-B04 (four different matches), B05's register row is specifically about one report's
own lifecycle. `draft/` and `completed/` share: match id (`match-gate-b-05`), squad (8 players,
7 present + 1 real no-show), score (3-2, own team home, won), both assists, two of the three
goals, the combination evidence, and — importantly — **the same real `SUBMITTED` debrief**. They
genuinely differ only in: report status (`REPORTED` vs `LOCKED`), the third goal's attribution
(unattributed vs attributed to Sindre), the timing-review item (`needsReview: true` vs `false`),
and `completedBy`/`completedAt`.

## Real production pure functions compute the derived numbers, not this fixture

`summarizeMatchAttendance()`, `aggregateGoalScorers()`, `aggregateAssistProviders()`,
`buildMatchTimeline()`, `buildPlayerInvolvement()` (all `src/lib/matches/match-detail-view-model.ts`)
are called directly over the raw facts in `report-data.ts` — the rendered "7/8 present", "2 goals"
(draft) / "3 goals" (completed), and the Player highlights list are the real functions' own
output, not a number this fixture invents. `buildMatchTimeline()`'s own branch (no canonical live
events for this match → report-fallback timeline, same degraded path B03 already exercises) means
every goal is a standalone `GOAL_FOR` item, never paired to an assist — the same real
no-assist-pairing rule ADR-0147 §5/Gate B W1 already enforce.

## The one real unresolved item each, deliberately resolved by the time the report is locked

| Item | Draft | Completed |
|---|---|---|
| Goal attribution (`GoalAttributionGapBanner`) | `{liveGoalsRecorded: 3, attributedGoals: 2, hasGap: true}` — one real scorer missing | `{liveGoalsRecorded: 3, attributedGoals: 3, hasGap: false}` — resolved |
| Timing review (`RecoveredTimingCallout`) | one period `needsReview: true` | same period, `needsReview: false` |

Both are real view-model shapes the real components already render from (`GoalAttributionGap`,
`PostMatchReportTimingReviewRow`) — this fixture constructs them directly as already-computed
values (the same pattern Gate B W1's own `matchInsights` fixture used), not derived from a
synthetic live-event stream, since `computeGoalAttributionGap()`'s own real computation is a
server-only, DB-backed comparison out of scope for a fixture to reproduce.

## The debrief is already `SUBMITTED` in both states — the real completion gate is genuinely satisfiable

ADR-0152 §3/§12: `completeReport()` requires `isDebriefSubmittedForReport` before locking. A
draft report whose debrief is still `DRAFT` would be the moment *before* this scenario (the real
`Complete report` button would exist but the real server action would reject it) — not what B05's
"finish/report actions" register language asks for. `isDebriefReadyToSubmit()` (the real
function) confirms the fixture's answers are genuinely complete — covered by test, not asserted
and left unverified.

## Combination evidence — real shape, real filter

`b05CombinationEvidence` (2 rows: a Noah+Sindre partnership, a Noah+Sindre+Kasper triangle) is
exactly `CombinationEvidenceRow[]`, filtered by the real, unmodified
`MatchCombinationEvidencePanel` (family PARTNERSHIP/TRIANGLE, `minutesTogether >= 10`) — both
rows pass by construction, not because the panel's own filter was loosened.

## Forbidden fields — never present

Possession, expected goals (xG), shots, cards, numeric player ratings, and "Player of the Match"
appear nowhere in either B05 fixture or rendered page — enforced by a case-insensitive substring
test in both `fixtures.test.ts` files, matching Gate B W1's own convention.

## Why one real mid-level concern is NOT reused as a Vitest unit-test dependency (disclosed, not worked around)

`PostMatchPage` (and transitively `FootballObservationSection`/`ObservationSection`) statically
import real `"use server"` action modules that chain into `@/lib/auth/actor-context` → `next-auth`
— which fails to resolve (`Cannot find module '.../next/server'`) in this project's
Vitest+jsdom **component**-test environment specifically (confirmed by reproducing the exact
failure, not assumed). This is the same reason the real
`post-match-report-page-shell.test.tsx` already mocks `PostMatchPage` away — not a gap this wave
introduced. `PostMatchUnresolvedBanner` is mocked for an unrelated reason (it calls
`indexedDB.open()` directly on mount with no defensive guard; jsdom's IndexedDB support is not
configured for component tests in this project). Every one of these four components **is** real
and unmodified in the actual rendered page (both the live dev server and the CI capture script) —
only the Vitest unit tests substitute a stub for them, consistent with the existing shell test's
own precedent rather than a new boundary this wave invented. See `BLOCKERS.md`.
