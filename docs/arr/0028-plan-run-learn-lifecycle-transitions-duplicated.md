# ARR-0028: Plan/Run/Learn lifecycle transitions are independently reimplemented, not owned by one function

## State

Resolved

## Identified

2026-08-24 (Architecture Integrity Programme, AIP-0 baseline)

## Residue

Matchboard's coach workflow spans three macro-phases (AGENTS.md: Setup -> Define intent ->
Populate all -> Review -> Adjust -> Finalize -> Reflect -> Learn, collapsing to Plan -> Run ->
Learn). No single module owns the transition logic for any of the three phase boundaries;
instead each transition is reimplemented independently at each call site.

**Plan phase** — `MatchRound.status` DRAFT<->FINALIZED is written independently in four places,
not decided by one function:

- `finalizeMatchRound()` (`src/lib/selection/finalize-match-round.ts:135-138`) writes
  `matchRound.status = "FINALIZED"` inline inside its own transaction.
- `finalizeSingleMatch()` (`src/lib/selection/finalize-single-match.ts:165-167`) independently
  reimplements the same selection/movementLedger/matchRound/ruleConfig update sequence, gated
  only by a local `remainingDraftSelections === 0` check.
- `unfinalizeMatchRound()` (`src/lib/selection/unfinalize-match-round.ts:86-88`) independently
  reverts the same field to `"DRAFT"`.
- `unfinalizeSingleMatch()` (`src/lib/selection/unfinalize-single-match.ts:92-94`) independently
  reimplements the same revert.

The live/derived states (BLOCKED/READY/NOT_GENERATED) are computed separately again by
`deriveRoundStatus()` (`src/lib/round-status.ts`), and Blocked/Decision-required detection lives
in a fourth module, `compute-plan-integrity.ts`. No one function decides "this round transitions
from DRAFT to FINALIZED" — each of the four callers reimplements the same Prisma writes.

**Run -> Learn handoff** — the transition from a live/finalized match to the first DRAFT
post-match report is independently implemented twice:

- `seedReportFromFinalizedSquad()` (`src/lib/reports/report-mutations.ts:17-79`, the "direct
  post-match" path) seeds `playerActuals` at `UNKNOWN` attendance from FINALIZED selections plus
  helpers.
- `endLiveSessionAndCreateReportAction()`
  (`src/app/(app)/matches/[matchId]/live/live-report-handoff.ts:80-223`) is an independent inline
  reimplementation that seeds `playerActuals` at `PRESENT` and derives goals/assists/fair-play/
  rotations from `LiveMatchEvent` rows — it never calls `seedReportFromFinalizedSquad()`.

Additionally, `endLiveSessionAndCreateReportAction()` performs its own inline
`db.liveMatchSession.update({ status: "ENDED" ... })` (`live-report-handoff.ts:75-78`) instead of
calling `endLiveSession()` in `src/lib/live-match/live-match-session.ts` — a third, undocumented
duplicate write path for the same `LiveMatchSession.status` field within the Neon side alone (this
is separate from, and in addition to, the already-ADR-documented Neon-vs-Durable-Object dual
tracking of live-session end state in ADR-0086, which is a deliberate design, not residue).

Each duplicate guards locally against re-creating an existing report or re-finalizing an
already-finalized round, so the pairs cannot literally race today — but the transition logic
itself is maintained in two-to-four independent places per boundary, with no shared contract, so
a future change to one (e.g. a new required field on finalization, or a new report-seeding rule)
can easily be applied to only one of the duplicates.

The Learn-phase internal transitions (DRAFT -> REPORTED -> LOCKED) are, by contrast, already
correctly centralised in `src/lib/reports/report-mutations.ts` (`submitReport`, `lockReport`,
`completeReport`, `reopenReport`) — this ARR is scoped to the phase-boundary transitions above,
not to Learn-phase-internal transitions, which are not residue.

## Intended architecture

Programme outcome #4 (`.matchboard-work/matchboard-architecture-integrity/PROGRAMME.md` §2): "The
Plan -> Run -> Learn lifecycle has one documented transition model with explicit ownership,
mutability, and correction rules." Programme outcome #5: "Lifecycle invariants are enforced in
domain/application code, not only in UI flows." No existing ADR defines a shared Plan -> Run ->
Learn contract; the per-phase ADRs that exist (ADR-0083 round-status enum, ADR-0086 live-match
realtime) are each scoped to one phase and do not address cross-phase transition ownership.

## Evidence

- `src/lib/selection/finalize-match-round.ts:135-138`, `finalize-single-match.ts:165-167`,
  `unfinalize-match-round.ts:86-88`, `unfinalize-single-match.ts:92-94` — four independent writers
  of `MatchRound.status`.
- `src/lib/round-status.ts` (`deriveRoundStatus`) and `src/lib/selection/compute-plan-integrity.ts`
  — separate, non-overlapping computation of the display-only derived states.
- `src/lib/reports/report-mutations.ts:17-79` (`seedReportFromFinalizedSquad`) vs.
  `src/app/(app)/matches/[matchId]/live/live-report-handoff.ts:80-223`
  (`endLiveSessionAndCreateReportAction`) — two independent DRAFT-report creation
  implementations for the same Run -> Learn handoff.
- `src/app/(app)/matches/[matchId]/live/live-report-handoff.ts:75-78` — inline
  `db.liveMatchSession.update({ status: "ENDED" })`, bypassing `endLiveSession()` in
  `src/lib/live-match/live-match-session.ts`.
- Searched `docs/adr/` for "lifecycle": only phase-local usages exist (event-squad lifecycle,
  opponent lifecycle); no cross-phase Plan -> Run -> Learn contract ADR exists.

## Impact

- Violates AGENTS.md's own "One business operation, one owning implementation, multiple
  adapters" invariant (Security rules section) at three separate phase boundaries.
- A correction to finalization behaviour (e.g. a new invariant check, an additional audit-log
  call, a new override-reason requirement) applied to `finalizeMatchRound()` but not
  `finalizeSingleMatch()` (or vice versa) would silently create divergent finalization behaviour
  between round-level and per-match finalization — a real, plausible defect class given the
  current structure, not a hypothetical one.
- A correction to post-match report seeding (e.g. a new required field, a new
  `unplannedAppearanceReason`, an eligibility check) applied to `seedReportFromFinalizedSquad()`
  but not `endLiveSessionAndCreateReportAction()` (or vice versa) would silently create two
  different "first report state" outcomes depending on whether a coach used the live-reporting
  handoff or the direct post-match entry path.

## Containment

- Do not add a fifth independent writer of `MatchRound.status`; any new finalize/un-finalize
  variant (e.g. a future bulk-finalize action) must call one of the four existing functions or a
  shared helper extracted from them, not reimplement the Prisma write again.
- Do not add a third independent DRAFT-report-creation implementation; any new report-seeding
  entry point must call `seedReportFromFinalizedSquad()` or an explicitly shared helper, not
  reimplement `playerActuals` seeding inline.
- `endLiveSessionAndCreateReportAction()` must not gain further independent `LiveMatchSession`
  field writes beyond the one already present; new live-session field writes should go through
  `src/lib/live-match/live-match-session.ts`.

## Resolution criteria

- A single documented lifecycle contract exists (type/enum/module) that each phase-boundary
  transition (Plan finalize/un-finalize, Run session end, Run->Learn report seeding) is
  implemented against, with each of the four `MatchRound.status` writers and the two DRAFT-report
  creators either merged into one owning function per boundary or explicitly justified as
  distinct adapters over one shared owning function.
- `endLiveSessionAndCreateReportAction()`'s inline `LiveMatchSession.status` write is replaced
  with a call to `endLiveSession()` (or an equivalent shared function), or the duplication is
  explicitly accepted with a linked ADR.
- Tests exist asserting that round-level and per-match finalize/un-finalize produce identical
  side effects for the fields they share, and that both DRAFT-report creation paths produce a
  report satisfying the same invariants (required fields, valid attendance enum values).

## Disposition

Resolved by ADR-0088 (AIP-3, Architecture Integrity Programme). `src/lib/selection/round-finalization-transitions.ts`
now owns the shared Plan-phase writes (`finalizeSelectionsForScope`/`unfinalizeSelectionsForScope`,
`finalizeRoundRecord`/`unfinalizeRoundRecord`), called by all four of
`finalize-match-round.ts`/`finalize-single-match.ts`/`unfinalize-match-round.ts`/`unfinalize-single-match.ts`
instead of each reimplementing the writes. `seedReportFromLiveSession()`
(`src/lib/reports/report-mutations.ts`) and `seedEventReportFromLiveSession()` (new
`src/lib/reports/event-report-mutations.ts`) now own the Run->Learn report-seeding logic
previously inlined in `live-report-handoff.ts`/`event-live-report-handoff.ts`, which are now thin
adapters. Both handoff actions now call `endLiveSession()`/`endEventLiveSession()` instead of
writing `LiveMatchSession`/`EventLiveMatchSession.status` inline. New tests:
`src/lib/selection/__tests__/round-finalization-transitions.test.ts`,
`src/lib/reports/__tests__/report-mutations.test.ts`.

A related, lower-severity finding surfaced during this investigation — Event report *completion*
(DRAFT->LOCKED) is still reimplemented inline in `event-post-match-actions.ts`, unlike League's
already-centralized `report-mutations.ts`/`report-domain.ts` — is explicitly **not** resolved
here; recorded separately as ARR-0030 since it needs its own Event-report state-machine
investigation rather than reusing this fix.

## History

### 2026-08-24

Resolved. See ADR-0088. Related deferred finding: ARR-0030.
