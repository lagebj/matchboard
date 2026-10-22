# Gate B W2 — Data Truth and Fixtures

## B5/R1 — the real production completion gate does NOT require goal-attribution reconciliation

Stated explicitly, because an earlier draft of this document's own framing could be read the
other way: `completeReport()`'s only real completion blocker is
`getTimingSubmissionBlockers()` (any period still needing timing review, or an out-of-range
event). The goal-attribution gap is **advisory only** — production has no rule that blocks
`complete()` while it is open, and this candidate deliberately does not invent one (that would be
a stricter, un-shipped rule, not a faithful simulation).

That means a report CAN legally reach `LOCKED` with the goal-attribution gap still open — a real,
reachable path, not a hypothetical. **Do not read "the report is LOCKED" as "the report has no
remaining discrepancy."** Those are two independent facts. The standard/golden B05-COMPLETED
fixture happens to also be reconciled (3 Goal rows, matching the 3 canonical `GOAL_FOR` events) —
but that is because `completed/fixtures.ts` was deliberately authored that way, not because
reaching `LOCKED` implies it. The interactive draft page's capture flow now demonstrates both real
outcomes from one page load: confirm timing only -> complete -> still-unresolved disclosure
(`completed-with-gap-transition`); then reopen -> add the real missing goal -> complete again ->
reconciled (`completed-transition`, matching `completed/fixtures.ts`). See
`SOURCE_RECONCILIATION.md`'s B5/R1 entry and `safe-post-match-report-shell.tsx`'s own doc comment
for the exact visual-correction scope (a candidate-only disclosure improvement, not a claimed
production fix — production's own `PostMatchReportPageShell` still hides this banner once locked).

## R8-1 — terminology and lifecycle-state correction (supersedes the B5/R1 fix above)

The B5/R1 fix above was itself incomplete: it kept reusing the real `GoalAttributionGapBanner`'s
own fixed wording ("Add the missing scorer... before completing this report"), which is wrong on
two counts. First, the instruction is invalid once the report is already `LOCKED` — there is
nothing left "before completing" at that point; the coach must reopen the report first. Second,
"missing scorer attribution" describes an existing Goal row with an unknown scorer, but the real
`computeGoalAttributionGap()` (`src/lib/reports/report-mutations.ts`) counts report Goal ROWS
(`db.goal.count()`), never filtered by scorer presence — in this fixture's own scenario the
discrepancy is a genuinely MISSING report Goal row, not an existing row with an unknown scorer.
"Goal record(s)" is the terminology that actually matches what is being counted.

Corrected: `shared/goal-discrepancy-disclosure.tsx`'s `GoalDiscrepancyDisclosure` component (no
longer `GoalAttributionGapBanner`) renders lifecycle-aware wording with dynamic counts:

- Editable: "`{N}` goal`{s}` `{was/were}` recorded during Live Reporting, but this report contains
  only `{M}` goal record`{s}`. Add the missing goal`{s}` to reconcile the report."
- Locked: "This completed report is missing `{K}` goal`{s}` recorded during Live Reporting. Reopen
  the report to add the missing goal`{s}`."

Both are a disclosed, candidate-only proposed correction — production's real
`GoalAttributionGapBanner` remains byte-for-byte unmodified by this PR (out of scope) and still
uses its own original wording/visibility rule when rendered in production today.

## fixtureVersion 2 — what actually changed (remediation)

The goal/timeline/gap model below is **superseded** by a corrected model — see
`SOURCE_RECONCILIATION.md`'s remediation section for the full finding list (B2-R2/R4/R7). The
corrected shape, in brief:

- **3 real synthetic canonical live events** now exist (`b05CanonicalLiveEvents`,
  `report-data.ts`) — 3 `GOAL_FOR` + 2 `GOAL_AGAINST`, with `SCORER_SET`/`ASSIST_SET` correction
  events paired by `correctsEventId` → the goal's own `clientEventId`, exactly the real
  production linkage `buildMatchTimelineFromLiveEvents()` uses. `afterData.timeline` is now
  sourced from these real events (via the real `buildMatchTimeline()`, "live events are primary
  whenever any exist") — identical in both lifecycle states, because the live record is a
  historical fact independent of how far along the coach's own report is.
- **The draft report genuinely has only 2 Goal rows**, not 3 rows with one left unattributed —
  `attributedGoals: 2` now follows from `b05Goals("draft").length`, matching the real
  `computeGoalAttributionGap()`'s plain row-count semantics. The completed state adds the third
  row (Sindre, 34', assisted by Vetle) — `b05Assists()` is also now `[]` in draft, since an
  assist can't exist as a report row before its goal does.
- **The official 3-2 final score never changes** and is never derived from counting Goal rows —
  `homeGoals`/`awayGoals` stay fixed in `b05InitialReport()` regardless of lifecycle state.
- **Combination evidence is `[]` in the draft fixture** (`b05AfterData("draft")`), matching the
  real `getMatchDetailAfterData()` gate (`report?.status === "LOCKED"` only).
- **Two reference-time constants replace the shared kickoff timestamp**: `B05_DRAFT_REFERENCE_AT`
  (kickoff + ~2h, before `B05_COMPLETED_AT`) and the existing `B05_NOW` (11 days later, now used
  for the completed state, after `B05_COMPLETED_AT`) — see `match-b-fixture.ts`.

## Original wave (fixtureVersion 1) — the rest of this file, superseded where noted above

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

This table describes the two STATIC fixture pages (`draft/`, `completed/`) only. It is not a
general claim that "Completed" always means "resolved" — see the B5/R1 section above for the real
completion gate's actual (narrower) contract and the interactive draft page's own two real
outcomes.

## The debrief is already `SUBMITTED` in both states — the real completion gate is genuinely satisfiable

ADR-0152 §3/§12: `completeReport()` requires `isDebriefSubmittedForReport` before locking. A
draft report whose debrief is still `DRAFT` would be the moment *before* this scenario (the real
`Complete report` button would exist but the real server action would reject it) — not what B05's
"finish/report actions" register language asks for. `isDebriefReadyToSubmit()` (the real
function) confirms the fixture's answers are genuinely complete — covered by test, not asserted
and left unverified.

## Combination evidence — real shape, real derivation, real filter, real participation (R8-3, R9-1)

`b05CombinationEvidence` (`shared/report-data.ts`) is a literal, but it is the real, unmodified
`deriveCombinationsFromSegments()`'s (`src/lib/evidence/combination-topology.ts`) own verified
output — not hand-picked, and not computed inline either (that pulls the server-only `db` client
into this client-bundled file; see that constant's own doc comment). It is derived against
`shared/combination-source-data.ts`'s own canonical positional segments and goal-attribution
events (the same real events as `b05CanonicalLiveEvents`, re-expressed in the shape the
derivation function consumes). That call produces many rows (every pairwise partnership, lines,
triangles, the full-configuration row) for the whole squad across every segment — this fixture
curates the result down to the single `PARTNERSHIP` row this scenario calls out (Noah + Sindre),
the same way the real `MatchCombinationEvidencePanel` itself already filters a larger derived set
down to what it displays (`MIN_MINUTES_TO_SHOW`/`MAX_ROWS_SHOWN`), not an invented narrowing.
`createdAt` is the one field overridden after derivation (the real function stamps
non-deterministic wall-clock `new Date()`; this fixture replaces it with the fixed
`B05_COMPLETED_AT` moment — a real-world fact, not a derivation input).

**R9-1 — the positional segments are real participation, not an invented 80-minute block.** This
match's real duration is 90 minutes (two 45' halves — `b05TimingReview`'s own real second-half
duration confirms this). Three chronological segments (0-68'/68-83'/83-90') represent: Kasper (CM)
substituted off at 68' for Elias (into the same CM slot); Noah (RCM) departing at 83' with no
replacement (team finishes with 6). Every one of `b05MinutesByParticipant`'s seven existing values
(unchanged by this correction) is exactly explained by this model — see
`combination-source-data.ts`'s own doc comment for the full reasoning. Noah and Sindre's own
shared presence is 0-83' (83 minutes, not the old unsupported 80), which is why the displayed
row's `minutesTogether` is `83`.

`shared/__tests__/combination-evidence.test.ts` imports the SAME source records and asserts the
fixture's own exported row equals the real function's own output field-for-field (except
`createdAt`) — never a second, hand-maintained synthetic model backing a separate test. A
dedicated participation-consistency suite in that same file verifies the positional segments
against `b05MinutesByParticipant` directly (not merely that the segments are internally
self-consistent), including a negative test proving a deliberately contradictory segment fails.

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
