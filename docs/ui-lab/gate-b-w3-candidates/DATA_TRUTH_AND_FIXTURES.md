# B06 — Data truth and fixtures

## Third remediation pass (R8-3) — Event · After only

`combinationEvidence` is no longer hand-written. It is COMPUTED by calling the real, unmodified
`deriveCombinationsFromSegments()` (`src/lib/evidence/combination-topology.ts`) against
`event/after/combination-source-data.ts`'s own canonical positional segment (reusing
`b06EventParticipants` directly for identity/position — William, the Guest Player, is excluded
entirely, never assigned a placeholder position) and goal-attribution events, curated down to the
Noah+Sindre `PARTNERSHIP` row this scenario calls out. `createdAt` is the one field overridden
after derivation (the real function's own wall-clock stamp is replaced with the fixed
`B06_EVENT_AFTER_REFERENCE_AT` moment). `__tests__/combination-evidence.test.ts` imports the SAME
source records and asserts field-for-field equality with the real derivation. See
`SOURCE_RECONCILIATION.md`.

## Retrospective remediation (B3-R3/R4/R7)

- Event · After's one football observation is assigned to Theodor (a real `PLAYER`-type
  participant), never William (the Guest Player) — production `createFootballObservations()`
  requires an active canonical `Player`; `PlayerDevelopmentObservation.playerId` has no
  `GuestPlayer` counterpart at all (ADR-0106 independently verifies this boundary). William's
  real lineup/report participation is unchanged.
- Both AFTER candidates' `fixedDateTimeUtc` now use a dedicated reference-time constant
  (`B06_LEAGUE_AFTER_REFERENCE_AT`, `B06_EVENT_AFTER_REFERENCE_AT`) set after the match actually
  ends/completes — never kickoff, and never the BEFORE page's own pre-kickoff "now".
- Event · After's combination evidence now follows the same real per-match derivation rules as
  B05's own B2-R4 fix: `opponentDiversity: 1` always, confidence capped below `ESTABLISHED`
  (`deriveConfidence` requires `matchCount >= 3`, hardcoded to `1` on the per-match path), and
  `createdAt` after real completion, not before kickoff.

## Original wave — the rest of this file, superseded where noted above

Deterministic, synthetic, in-memory fixtures only — no database, no network, fixed UTC clocks
(`B06_LEAGUE_NOW`/`B06_EVENT_NOW`, never `Date.now()`). Source files: `src/app/dev/ui-lab/gate-b/
shared/match-b-fixture.ts` (B06 section) and each scenario's own `fixtures.ts`.

## Two different matches, one shared football circumstance

League and Event matches are deliberately separate domain models (ADR-0011) — B06 does **not**
share one match identity across origins the way B01 shares identity across its own before/after.
Each origin gets its own identity (`B06_LEAGUE_MATCH_ID` / `B06_EVENT_MATCH_ID`), held stable
across its own before/after pair, matching B01's established pattern. Both are given the same
final score (3-1) and comparable opponent framing deliberately, so a reviewer comparing the two
AFTER pages is looking at a presentation difference, not a data difference.

## `buildMatchPresentation()`'s lifecycle vocabulary, reused generically for Event

`buildMatchPresentation()`'s `lifecycleStatus` parameter is League's own `MatchLifecycleStatus`
enum type, but the function itself only uses it for generic phase derivation (scheduled / live /
final / cancelled) via `matchPresentationPhase()` — it does not read anything League-schema-
specific. This wave passes `"planning_open"`/`"done"` for Event's identity presentation too,
reusing only that generic phase vocabulary. Event's own real lifecycle truth remains the
composite `EventMatch.status` + `EventLiveMatchSession.status` + `EventPostMatchReport.status` —
there is no 1:1 enum mapping between the two, and this fixture does not claim one.

## Real production pure functions/projections compute the derived numbers, not this fixture

- `buildPlanningPitchAssignments()` (`src/components/touchline/pitch/
  planning-pitch-assignment-projection.ts`) — called with `teamKitColor: null` for Event, exactly
  as `EventMatchLineupPanel` always does.
- `matchBPlanningPitchSlots()`/`matchBPlanningPitchAssignments()` (existing B01-B05 helpers,
  reused unmodified for League).
- The Event · After report's `PostMatchReportViewModel` fields (`players`/`goals`/`assists`) are
  hand-built directly in this fixture's own shape (not run through a production aggregation
  function) — unlike B05, which runs League's real `summarizeMatchAttendance`/
  `aggregateGoalScorers`/`buildMatchTimeline` over raw facts. `PostMatchReportShell` itself takes
  the final `PostMatchReportViewModel` as a plain prop and does no aggregation of its own, so
  there is no equivalent production aggregator to call for this shape — the fixture's own
  `report.ourScore`/`goals`/`assists` are written to be internally consistent by construction
  (3 goals, 3-1 final score) rather than independently derived and then checked.

## Event eligibility vocabulary — real labels, not invented ones

`MatchBEventParticipant.source`/`sourceSquadName`/`participantType` reproduce
`EligibleEventMatchPlayer`'s real field vocabulary (`src/lib/events/
event-match-eligibility.ts`) verbatim. The fixture includes one of each real category
`getEligibleEventMatchPlayers()` actually returns: a squad player, an approved helper borrowed
from another squad (`source: "helper"`, a genuinely different `sourceSquadName`), and a guest
player (`participantType: "GUEST_PLAYER"`) as the reserve.

## The one real unresolved item each origin's AFTER candidate carries

- League · After: none — the timeline reconciles exactly with the 3-1 result (every goal
  individually logged), matching B04's "rich evidence" shape rather than B03's sparse one, since
  B06's job is comparing lifecycle/navigation, not re-demonstrating sparse-evidence disclosure.
- Event · After: none either, by the same reasoning — this candidate is deliberately the
  **locked** state only (see "Why editable-vs-locked is out of scope" below), where an
  unresolved item wouldn't be visible anyway (all correction controls are hidden once locked).

## Why editable-vs-locked is out of scope for B06

B05 already candidates the editable-vs-locked distinction (draft → fixture-simulated completion)
for League. B06's job (per the register row) is lifecycle/navigation parity **across origins**,
not re-demonstrating that distinction a second time. The Event · After candidate is therefore
built LOCKED-only, which also sidesteps the one real design tension a draft-state Event candidate
would otherwise raise: `PostMatchReportShell`'s mutating actions (add goal, update attendance,
etc.) need genuinely working handlers to avoid AGENTS.md's "no fake editability" prohibition.
LOCKED hides every one of those controls in the real shell except "Reopen report," which this
fixture wires to an honest, inspectable failure (`"UI Lab candidate — not wired to a production
mutation."`) rather than a silent fake success — never a disabled-looking-but-secretly-clickable
control.

## Forbidden fields — never present

No possession, expected goals (xG), shots, cards, player rating, or "Player of the Match" value
anywhere in any of the four fixtures' `rawRecordsForHash` — enforced by each scenario's own
`fixtures.test.ts`.

## Why `EventMatchLineupPanel` and `EventMatchReportPanel` are NOT reused as direct dependencies

Both are `"use client"` components that self-fetch via server actions inside `useEffect`
(`getEventMatchLineup`, `getEligibleEventMatchPlayersAction`, `getEventFootballObservationsAction`,
etc.) — there is no fixture-injection seam, the same documented gap League's own
`MatchTacticsPanel` has (disclosed in B01's own `page.tsx`). This wave reuses their real
*projection logic* (`buildPlanningPitchAssignments`) and real *composition pattern*
(`PostMatchReportShell` + the same `extraSections` ordering) instead of copying either
component's markup or self-fetching behaviour.
