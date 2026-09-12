# ARR-0047: Live projection has no persisted canonical order and a confirmed reversal-target defect

## State

Dispositioned

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

- [ ] `CanonicalLiveEvent` carries `sequence` and `correctsEventId`/`correctionType`.
- [ ] `projectCanonicalLiveState`'s replay/merge logic orders exclusively by `sequence`, never by
      `createdAt` comparison.
- [ ] The reversal-handling loop resolves `correctsEventId` and excludes the *targeted* event, not
      the reversal event's own id — proven by a unit test asserting a reversed goal is excluded
      from the projection's own score output, independent of `report-mutations.ts`.
- [ ] `POSITIONS_CHANGED` produces observable position-assignment output from the projection.
- [ ] A test proves the projection's own score output matches `seedReportFromLiveSession`'s
      independently-correct output for the same event stream, including at least one reversal.

## Disposition

**Dispositioned.** ADR-0138 records the decision (Decision point 3: "canonical wire event becomes
replay-complete") and this residue's fix is scoped to Bundle 5 ("Authoritative projection") of the
Canonical Live Operations & Delayed-Concurrency programme, after Bundle 2 adds the necessary
`sequence`/correction fields to the wire type and schema.

## Related decisions

- ADR-0138 (Canonical Live Operation Stream, Persisted Sequence, and Scoped Offline Continuation)
- ADR-0112 (Canonical live-match projection and per-PR Worker deployment) — established the shared
  projection this ARR finds a defect in.
- ADR-0133 (Live reporting durability and correctness hardening) — recorded the narrower, already-
  known wire-level `correctsEventId` gap this ARR's finding 2 sharpens and extends.

## Related implementation

- `src/lib/live-match/live-match-projection.ts`
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
