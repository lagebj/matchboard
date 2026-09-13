# ARR-0047: Live projection has no persisted canonical order and a confirmed reversal-target defect

## State

Resolved

## Identified

2026-09-12

## Residue

`src/lib/live-match/live-match-projection.ts`'s `projectCanonicalLiveState` — the shared function
both `LiveMatchClient` (reporter) and `FollowLiveClient` derive observable state from
(ADR-0112) — has two confirmed, distinct defects, found by direct code audit against
`main`@`f6cd772a`:

1. **No persisted canonical order.** `CanonicalLiveEvent` (`realtime-messages.ts`) has no
   `sequence` field. The projection's merge/replay function
   (`mergeSnapshotWithRealtimeEvents`) orders events by string comparison of `createdAt`
   (`a.createdAt < b.createdAt ? -1 : ...`). This is consistent with there being no persisted
   sequence anywhere in the schema (see ARR-0045's evidence), but it is a separate, additional
   defect specifically in the *projection's own* replay logic: even once a sequence exists on
   disk, this function must be changed to use it, or it will keep silently reordering by wall
   clock.

2. **Reversal handling targets the wrong event id — goals are never actually un-counted in this
   projection.** The reversal-handling loop
   (`projectCanonicalLiveState`, lines ~105-114) does `reversedEventIds.add(event.id)` for each
   `EVENT_REVERSED` event it encounters — i.e. it records the *reversal* event's own id. The
   score-counting loop only excludes a `GOAL_FOR`/`GOAL_AGAINST` event whose *own* id is in
   `reversedEventIds`. Since a `GOAL_FOR` event's id is never added to that set (only
   `EVENT_REVERSED` event ids are), **a reversed goal is never excluded from this projection's
   score calculation** — the correct exclusion would require reading `correctsEventId` off the
   reversal event and adding *that* id to the set, and `CanonicalLiveEvent` does not currently
   carry `correctsEventId` at all (a related but distinct gap from ARR-0045/ADR-0138's Context
   finding 6).

This is a **second, independent** implementation of "which goals count" from the one that is
actually correct: `seedReportFromLiveSession()` (`src/lib/reports/report-mutations.ts`) queries
raw Neon rows directly and correctly filters by `correctsEventId`, excluding reversed goals as
intended. ADR-0133's own documented residual ("Follow Live can briefly show a reversed goal still
in the score until the next full reconcile... the reporter and the persisted report are correct")
describes a narrower, already-accepted timing gap on the realtime *wire* — this ARR documents that
the projection's *own replay logic*, independent of what the wire carries, cannot correctly
exclude a reversed goal even after a full snapshot reconcile, because it never looks at the right
id in the first place.

The projection also has no positions field at all: `POSITIONS_CHANGED` events fall through
`projectCanonicalLiveState`'s `switch` at its `default: break;` case, producing no observable
output for position state on either surface.

## Intended architecture

ADR-0138 (Decision, point 3) requires the canonical wire event to carry `sequence` and complete
correction metadata (`correctionType`, `correctsEventId`), and requires the projection to replay
by `sequence` and resolve corrections/reversals by target event id — one pure, exhaustive-switch
reducer producing score, clock, session status, on-field participants, position assignments, and
active/reversed event history, shared unmodified by both Live Reporting and Follow Live.

## Evidence

- `src/lib/live-match/live-match-projection.ts` — `projectCanonicalLiveState` (score/reversal
  logic, `default: break` for `POSITIONS_CHANGED`), `mergeSnapshotWithRealtimeEvents`
  (`createdAt`-based ordering).
- `src/lib/live-match/realtime/realtime-messages.ts` — `CanonicalLiveEvent` type: no `sequence`,
  no `correctsEventId`.
- `src/lib/reports/report-mutations.ts` (`seedReportFromLiveSession`, ~lines 193-271) — the
  correct, independent reversal-exclusion implementation, for contrast.
- `AGENTS.md`'s "Live Match Reporting" section — the already-documented, narrower wire-level
  residual this ARR's finding 2 goes beyond: "one documented residual: `CanonicalLiveEvent`
  carries no `correctsEventId` on the realtime wire, so a Follow-Live *viewer* can briefly show a
  reversed goal still in the score until the next full reconcile (the reporter and the persisted
  report are correct)." This ARR finds the persisted-report-side claim ("the reporter... [is]
  correct") does not extend to the shared *projection* itself in isolation — it is only correct in
  practice today because a full page reload re-derives the reporter's own score display from a
  source other than this projection in some contexts, not because this projection's own reversal
  logic is right.

## Impact

- Any surface relying solely on `projectCanonicalLiveState`'s own reversal handling (as ADR-0112
  intends both Live Reporting and Follow Live to, exclusively, going forward) would show a
  reversed goal as still counted, indefinitely — not merely "until the next full reconcile" as the
  existing documented residual describes.
- Wall-clock-based replay ordering cannot correctly handle a delayed offline operation (this
  programme's central scenario): an operation captured earlier in football time but accepted
  later in canonical order could be misplaced in the projection's own replay, independent of
  whatever the persistence layer eventually gets right.
- No position state is available to either Live Reporting's own pitch view or Follow Live from
  this projection today, which blocks this programme's requirement (ADR-0138 Decision point 3;
  `PROJECTIONS_AND_CONSUMERS.md` §8) that positions be part of canonical live truth.

## Containment

- Do not add a new consumer of `projectCanonicalLiveState`'s reversal/score output without first
  confirming this ARR's resolution status, or being aware the reversal exclusion is currently
  inert.
- Do not add a second, independent reversal-exclusion implementation elsewhere to work around this
  (as `seedReportFromLiveSession` already, necessarily, does) — fix the shared projection instead
  once `correctsEventId`/`sequence` exist on the wire type, per ADR-0138.

## Resolution criteria

- [x] `CanonicalLiveEvent` carries `sequence` and `correctsEventId`/`correctionType` (Bundle 2).
- [x] `projectCanonicalLiveState`'s replay/merge logic orders exclusively by `sequence`, never by
      `createdAt` comparison — `mergeSnapshotWithRealtimeEvents`'s `compareByCanonicalOrder`
      (Bundle 5), falling back to `createdAt`/`id` only for a legacy row with no `sequence` at
      all, matching the internal snapshot route's own ordering exactly.
- [x] The reversal-handling loop resolves `correctsEventId` and excludes the *targeted* event, not
      the reversal event's own id — the shared `reduceLiveEvents()` reducer
      (`live-match-projection.ts`, Bundle 5), proven by
      `live-match-projection.test.ts`'s "ARR-0047 fix" tests, independent of
      `report-mutations.ts`.
- [x] `POSITIONS_CHANGED` produces observable position-assignment output from the projection —
      `LiveMatchProjectionState.positions.byPlayerId` (Bundle 5). This required closing a deeper,
      previously-unverified plumbing gap discovered while implementing this criterion: neither
      `toCanonicalLiveEvent()` (the internal persist endpoint's response, which becomes the live
      `applyEvent` broadcast in the normal success path) nor the internal snapshot route ever
      selected/returned `period`/`matchSeconds`/`payload` from Neon at all, even though the
      columns were populated — so `matchClock`/positions were *missing* on every real live event
      reaching Follow Live, not merely computed incorrectly once they arrived. Both were fixed
      (`live-match-event-store.ts`'s `toCanonicalLiveEvent`, the internal snapshot route) as part
      of this same criterion, since the visible symptom and the wire-plumbing gap are one
      problem, not two.
- [x] A test proves the projection's own score output is correct for a reversed event stream,
      matching `seedReportFromLiveSession`'s independently-correct reversal-exclusion semantics
      (`correctsEventId`-based, not `report-mutations.ts`'s own raw-Neon-query mechanism, but the
      same result) — `live-match-projection.test.ts`.

Two further, previously-undocumented findings verified and fixed during Bundle 5, both squarely
within this ARR's own scope ("live projection... defect"):

- `canonicalEventToSummary()`'s `matchClock` formatting multiplied `event.matchSeconds` by 1000 a
  second time — `matchSeconds` is already milliseconds (the repo-wide legacy-naming convention
  documented on `LiveMatchEvent.matchSeconds`). This was latent rather than yet visible in
  production, precisely because the plumbing gap above meant `matchSeconds` almost never actually
  reached this function with a real value before this bundle's fix made it arrive correctly —
  fixing both together was necessary; fixing only the plumbing would have turned a "missing"
  display into a wildly wrong one.
- Bundle 3's `evaluateLineupPrecondition`'s `POSITIONS_CHANGED` branch (`workers/live-match/src/
  state.ts`) checked an unverified `{ assignments: Array<{ playerId }> }` payload shape — always
  disclosed at the time as provisional, deferred to this bundle. The real, confirmed shape is one
  event per moved player (`playerId` top-level, `{ fromPosition, toPosition }` on `payload`),
  discovered while building the positions projection above and fixed to match.

## Disposition

**Resolved.** ADR-0138 recorded the decision (Decision point 3: "canonical wire event becomes
replay-complete"); Bundle 2 added `sequence`/correction fields to the wire type and schema; Bundle
5 ("Authoritative projection") implemented and verified every resolution criterion above.

## Related decisions

- ADR-0138 (Canonical Live Operation Stream, Persisted Sequence, and Scoped Offline Continuation)
- ADR-0112 (Canonical live-match projection and per-PR Worker deployment) — established the shared
  projection this ARR finds a defect in.
- ADR-0133 (Live reporting durability and correctness hardening) — recorded the narrower, already-
  known wire-level `correctsEventId` gap this ARR's finding 2 sharpens and extends.

## Related implementation

- `src/lib/live-match/live-match-projection.ts` (`reduceLiveEvents`, `projectCanonicalLiveState`,
  `mergeSnapshotWithRealtimeEvents`, `canonicalEventToSummary`)
- `src/lib/live-match/live-match-reconciliation.ts` (`reconcileFromServerEvents`, now a thin
  adapter over the shared reducer; `reconcileFromCanonicalEvents` removed as dead/duplicate code)
- `src/lib/live-match/live-match-event-store.ts` (`toCanonicalLiveEvent`, `getMatchEvents`,
  `getRecentEvents`)
- `src/lib/live-match/live-match-domain.ts` (`derivePositionChangeFromPayload`)
- `src/app/api/internal/live-match/snapshot/route.ts`
- `workers/live-match/src/state.ts` (`derivePositionChange`, `evaluateLineupPrecondition`)
- `workers/live-match/src/match-session-object.ts`
- `src/lib/live-match/realtime/realtime-messages.ts`
- `src/lib/reports/report-mutations.ts`

## Supersedes

None.

## Superseded by

None.

## History

### 2026-09-12

Record created during Bundle 1 of the Canonical Live Operations & Delayed-Concurrency programme.
The reversal-target defect (finding 2) is a new, previously-undocumented finding beyond the
already-recorded ADR-0133 wire-level residual — confirmed by direct reading of
`projectCanonicalLiveState`'s reversal-handling code, not inferred from the wire-type gap alone.

### 2026-09-13

Resolved during Bundle 5. All five resolution criteria implemented and test-verified. Two further
findings verified and fixed in the same bundle (recorded above under "Resolution criteria"): a
latent `matchClock` unit doubling in `canonicalEventToSummary`, and a deeper wire-plumbing gap
(`toCanonicalLiveEvent`/the internal snapshot route never selected `period`/`matchSeconds`/
`payload` from Neon at all) that made the documented positions/matchClock gap worse than
originally described — data was missing, not merely miscomputed. Bundle 3's own disclosed
`POSITIONS_CHANGED` payload-shape placeholder was also corrected to the now-confirmed real shape.
