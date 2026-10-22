# Gate B W2 — Data Truth and Fixtures

## R11-1 — on-field player-count validation, closing a real gap in structural validation

`validateSegmentSequence()`'s structural checks (duplicate occupancy, duplicate position,
non-positive duration, chronological/non-overlapping ordering) never enforced any ceiling on how
many players can occupy the pitch at once — an 8-player segment with 8 distinct ids and 8 distinct
positions passes it cleanly, since none of those checks are about COUNT. R10-1's own negative test
for exactly this case asserted the 8-player segment PASSED and mischaracterized that as proof it
was rejected (see `BLOCKERS.md`'s "sixth retrospective remediation" section for the full history).

Two new pure functions in `combination-source-data.ts` close the gap, deliberately kept separate
because they encode two different kinds of rule:

- `validateOnFieldCount(segments, format)` — the GENERAL 7v7 format ceiling (`B05_MATCH_FORMAT`'s
  new `maxOnFieldPlayers: 7` field; the goalkeeper counts toward it). This is a MAXIMUM-only check:
  a segment with fewer than 7 players is not itself flagged, since a card, injury, or
  late-arriving squad are all legitimate situations a general format rule must never reject.
- `validateExactParticipantCount(segments, expectedCount)` — B05's own SCENARIO-SPECIFIC rule.
  This fixture's source model explicitly declares 7 eligible present participants, no
  substitutions, no withdrawals, and no disciplinary reductions, so its one real segment must
  contain EXACTLY 7 — never fewer. This function must never be reused as a general football rule;
  it only applies to a scenario that has, like B05, explicitly declared it has no such exception.

The current B05 segment passes both checks. New negative tests prove: an 8-player segment fails
`validateOnFieldCount` with `TOO_MANY_ON_FIELD`; a duplicate player occupying two slots fails
`validateSegmentSequence` with `DUPLICATE_OCCUPANCY`; two participants sharing one tactical
position fail it with `DUPLICATE_POSITION`; a six-player segment does NOT fail the general
ceiling (6 <= 7); that SAME six-player segment DOES fail B05's own exact-count rule with
`UNEXPECTED_ON_FIELD_COUNT`. A final test confirms the validator module still imports only TYPES
from `combination-topology.ts` (never its server-only `db`-adjacent value exports), preserving the
client-bundle safety established in R8-3/R10-1.

## R11-2 — match narrative corrected to agree with the canonical chronology

The canonical score progression (`b05CanonicalLiveEvents`) is 1-0, 1-1, 2-1, 2-2, 3-2: Slemmestad
leads after every one of its own goals and is tied — never behind — after each Kongsberg
equalizer; neither team is ever two goals apart. The positional record
(`combination-source-data.ts`'s single, unchanged 0-60' segment) has no formation change at all.

Four retained narrative statements contradicted this record, not as subjective framing but as
factual claims about events that did not happen: `b05Reflection.note`/`b05DebriefAnswers.
team_execution.note` said Slemmestad went "behind twice"; `b05OpponentObservation.
factualSummary` said Kongsberg sat deeper "trailing by two"; `b05DebriefAnswers.match_changes`
said the team "moved to a back three"; `opponent_memory.note` said Kongsberg was "harder to break
down in the final 15 minutes" (directly contradicted by their own 50' equalizer, inside that exact
window). All four are corrected to describe what the record actually shows (two real equalizers,
a lead regained each time, no formation change) rather than inventing a canonical event to justify
the original wording — the one approach these corrections deliberately avoid.

`match_changes.option` moves from `WE_CHANGED` to the schema's own `NO_MEANINGFUL_CHANGE`
(`src/lib/post-match/debrief/v1.ts`'s own `MATCH_CHANGE_OPTIONS` — never an invented enum value),
matching `b05ShapeChangeRows`'s own empty record exactly. Its `description` field is retained, but
rewritten as a clearly qualitative observation (pressing intensity) that does not claim any
positional/formation transition the record does not support.

Genuinely subjective coaching observations not tied to a specific observable event — effort/
cohesion/positional-shape/recovery ratings, "winning the ball back high led directly to the first
goal," "conceded twice from turnovers in our own half" — are left untouched; none of them assert
a fact (a score state, a formation, a substitution) that the canonical record contradicts.

New tests verify the score progression itself, that Slemmestad never trails, that neither team
ever leads by two, that `b05ShapeChangeRows` stays empty, that `match_changes.option` agrees with
the single-segment positional history, that none of the known contradictory phrases ("back
three," "going behind twice," "trailing by two," "sat deeper") remain anywhere in the narrative,
that the submitted debrief still validates against `debriefAnswersSchema`, and that draft and
completed submit the identical debrief object (one real coach-authored document, not two).

## R11-3 — match format and rotation records now participate in fixture hashing

`B05_MATCH_FORMAT` and `b05RotationEvents` are both authoritative for this scenario — the format
establishes age group/squad format/period count/durations; the (explicitly empty) rotation record
establishes that no substitutions occurred — but neither was included in `rawRecordsForHash` in
either `draft/fixtures.ts` or `completed/fixtures.ts`. A future change to either would silently
not change the fixture's own provenance hash, exactly the class of gap that let R9-1's own
unverified positional segment go unnoticed for a full remediation pass.

Corrected: both fixtures now include `matchFormat: B05_MATCH_FORMAT` and
`rotationEvents: b05RotationEvents` under those stable keys. New regression tests prove that
changing the format (period duration, age group), the rotation events, the positional segments, or
player minutes each independently changes the recomputed hash, and that an unchanged copy of the
raw records reproduces the identical hash — determinism, not just sensitivity, is tested. Draft
and completed are confirmed to reference the exact same `matchFormat`/`rotationEvents` objects
(one coherent match history) while still retaining separate fixture identities (different
hashes, since report status/completedBy/etc. differ between the two lifecycle states).

`fixtureVersion` bumped 5 -> 6 for both B05 candidates as a direct consequence of this hash-input
change; new `fixtureSha256` for both. See `SOURCE_RECONCILIATION.md`'s own "sixth remediation
pass" section for the full record.

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

## Combination evidence — real shape, real derivation, real filter, real participation (R8-3, R9-1, R10-1, R11-1, R11-3)

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

**R10-1 — a real, NFF-supported match format, not an invented duration or an inferred
substitution.** Slemmestad Rød's squad plays NFF Akershus G11 — 7-a-side, 2x30-minute halves, 60
minutes regulation (`report-data.ts`'s own `B05_MATCH_FORMAT`, citing NFF's own published rules
directly; R9-1's own "90 minutes" had no such support — see `BLOCKERS.md`). All 7 present players
start and play the entire real 60-minute match: zero substitutions, zero inferred departures,
every one of the 7 real formation slots (including CF, previously vacant) filled by a real
present player. Noah and Sindre's own shared presence is therefore the full 60 minutes — not the
R9-1 pass's own inferred 83 — which is why the displayed row's `minutesTogether` is `60`.

The canonical goal chronology (`b05CanonicalLiveEvents`) uses production's own real, verified
contract: `matchSeconds` is PERIOD-RELATIVE (confirmed directly against
`src/lib/live-match/period-config.ts`'s own documented contract — it resets to 0 at the start of
each period, it is never global elapsed time), and `period` is the real 1/2 index. A new
`globalMinuteToPeriodRelative()` helper (`report-data.ts`) independently cross-checks every
event's `period`/`matchSeconds` against its own human-facing `minuteLabel` in a dedicated test —
not trusted by construction. The final goal's global minute moved 61' -> 55' (the old 61' falls
outside this match's own 60-minute regulation time); every other event's global minute is
unchanged.

`shared/__tests__/combination-evidence.test.ts` imports the SAME source records and asserts the
fixture's own exported row equals the real function's own output field-for-field (except
`createdAt`) — never a second, hand-maintained synthetic model backing a separate test. Dedicated
suites in that same file verify: the match format itself (age class/format/duration/period
count/formation-slot coverage); the positional segments against `b05MinutesByParticipant`
directly (not merely internal self-consistency); and the canonical event chronology against the
real period-conversion helper — including negative tests proving a 90-minute segment sequence, an
8-player on-field count, overlapping segments, and the original R9-1-shaped minute mismatch are
all rejected.

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
