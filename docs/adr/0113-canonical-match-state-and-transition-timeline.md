# ADR-0113: Canonical Match-State and Transition Timeline

## Status

Accepted

## Context

The Evidence-Informed Match Planning programme (`.matchboard-work/evidence-informed-match-planning/`,
a temporary, gitignored implementation work bundle — see `PROGRAMME.md`/`PRINCIPLES.md`/
`DECISIONS.md` there) needs to derive historical patterns (match-phase tendencies, structural
rotation evidence, opponent response evidence) from what actually happened during completed
matches. Its Bundle 1 goal is "one reliable representation of actual on-field state through a
completed match, using existing timeline owners rather than creating a parallel history
subsystem."

Before this ADR, the closest existing structure was `MatchSegment` — a private type/function
(`buildSegmentsFromIntervals`) inside `combination-topology.ts` (ADR-0094) that splits
`ActualPositionInterval` rows (ADR-0096) into maximal windows of constant on-pitch composition,
used only to detect player/positional combinations. It carried no score state, no period/phase
classification, no opponent identity, and no notion of a "transition" between two segments — every
one of those is required by Bundle 1 and by every later bundle in the programme (opponent
tactical evidence, reactive scenario evaluation, rotation generation).

Separately, a real correctness gap was found while building this: `MatchRotation`/`LiveMatchEvent`/
`EventLiveMatchEvent` timestamps (`matchSeconds`) are recorded **relative to their own period** —
each period's live clock restarts at 0 (`match-clock.ts`'s `advancePeriod`). `actual-timeline.ts`'s
`getMatchRotations`/`getPositionChanges`/`getEventRotationsAndPositionChanges` ignored `period`
entirely and ordered purely by the raw per-period `matchSeconds` value. For any match with
recorded events in more than one period, a second-half substitution's small period-relative
timestamp could sort **before** a first-half substitution's larger one, corrupting
`ActualPositionInterval.startedAtMs`/`endedAtMs` ordering and everything derived from it
(combination evidence minutes, this ADR's own canonical intervals). Separately,
`rebuildEventActualTimeline` capped the final open-ended interval at the Event's single per-half
`matchDurationMinutes`, silently truncating the timeline at the end of the FIRST half for any
two-half Event match (`Event.numberOfHalves = 2`). Both were previously untested (no test covered
a multi-period match).

## Decision

1. **`buildSegmentsFromIntervals`/`MatchSegment`/`PlayerSlot` move to a new canonical module**,
   `src/lib/evidence/match-state-timeline.ts`, and `combination-topology.ts` imports/re-exports
   them from there. This is the same primitive combination evidence already used, generalized
   into one owner rather than duplicated (AGENTS.md "One business operation, one owning
   implementation, multiple adapters").

2. **A new `MatchStateInterval`/`MatchTransition` pair is the canonical representation of actual
   match state**, derived — never persisted (D-002: derive first, persist selectively; nothing in
   this ADR adds schema) — from the existing `ActualPositionInterval` timeline and goal-attribution
   events (`combination-goal-attribution.ts`), for both League and Event matches via the existing
   `FootballMatchRef` contract (ADR-0104).
   - `MatchStateInterval`: start/end/duration, resolved `MatchPeriod` and matching named phase
     windows (opening 5/10, immediately-after-restart, late period, final 10/5 — scaled down for
     short game formats rather than assuming senior-football minutes), on-field players with
     position/line/lane, a lightweight structural summary (counts by line/lane), cumulative score
     at start/end, goals for/against inside the interval, and a per-interval timing-quality flag
     (`EXACT`/`INFERRED`/`PARTIAL`).
   - `MatchTransition`: derived from exactly the boundary between two adjacent
     `MatchStateInterval`s — players off/on/remaining, position-only changes among remaining
     players, substitution count, the union of lines touched, a small documented set of structural
     descriptors (`SUBSTITUTION_ONLY`/`POSITION_ONLY`/`SUBSTITUTION_WITH_RESHUFFLE`,
     `SINGLE_LINE_CHANGE`/`MULTI_LINE_CHANGE`, `CENTRAL_AXIS_CHANGED`), score before/after, and
     whether it crosses a period boundary (`isAtNaturalBreak`). A transition is never invented at
     a period boundary with no recorded change — MIGRATION.md: "do not synthesize exact event
     timing that was never recorded."
   - `buildMatchStateTimeline(ref: FootballMatchRef)` is the one DB-bound orchestrator; the
     interval/transition derivation itself (`deriveMatchStateIntervals`/`deriveMatchTransitions`)
     is pure, so later bundles' scenario evaluators can reuse it against a hypothetical plan
     without touching the database (Bundle 4's requirement).

3. **Period-relative timestamps are converted to one continuous absolute match-clock value before
   any cross-period comparison.** `period-config.ts` gains
   `getCumulativePeriodOffsetsMs`/`toAbsoluteMatchMs`/`getTotalPeriodDurationMs`/
   `resolvePeriodForAbsoluteMs`. `actual-timeline.ts`'s rotation/position-change queries now select
   `period` alongside `matchSeconds` and convert before handing values to `computePositionIntervals`
   (whose own signature and existing tests are untouched — it already only ever received
   effectively-absolute values for the overwhelmingly common single-period case, since
   `FIRST_HALF`'s offset is always 0). `rebuildEventActualTimeline` now resolves the **effective
   per-squad** timing (`getEffectiveEventSquadMatchTiming`) and caps the final interval at the
   **total** period duration, not one half's `matchDurationMinutes` alone.

4. **Timing quality is a first-class output**, matching Bundle 1's requirement that a canonical
   interval says whether its timing is exact, inferred, partial, or unavailable — `UNAVAILABLE`
   for a match with no actual data at all, `PARTIAL` when a position is genuinely unknown,
   `INFERRED` when any contributing row already carries `approximateTiming: true`, `EXACT`
   otherwise.

## Consequences

- Every later programme bundle (historical pattern aggregation, observability, reactive scenario
  evaluation, rotation generation) builds on `MatchStateInterval`/`MatchTransition` rather than
  re-deriving segment/transition logic from raw `ActualPositionInterval` rows itself.
- Existing `ActualPositionInterval` rows written before this fix, for any match with recorded
  events spanning more than one period, have incorrect absolute ordering. They self-correct the
  next time `rebuildActualTimeline`/`rebuildEventActualTimeline` runs for that match (already
  idempotent — delete-then-recreate). No backfill script ships in this bundle; Bundle 2's
  historical rebuild/catch-up tool (MIGRATION.md) is the natural place to re-run this for existing
  organisations, since it already needs to reprocess every completed match through the canonical
  learning pipeline.
- `combination-topology.ts`'s public surface (`buildSegmentsFromIntervals`, `MatchSegment`,
  `PlayerSlot`) is unchanged for existing importers — only its implementation location moved.
- No new Prisma model, no new migration. Nothing here is persisted.

## Migration

None (additive, derive-only; see Consequences for the existing-data self-correction path).

## Supersedes

None (extends ADR-0096 and ADR-0104; does not change their decisions).
