# ADR-0096: Canonical Actual Position Timeline

## Status

Proposed

## Context

Matchboard records planned positions through `MatchLineupAssignment` (formation slot assignments) and `MatchRotation` (substitutions and position swaps). Live match events include a `POSITIONS_CHANGED` event type but nothing emits it. Post-match reports have `PostMatchPlayerActual.actualPositions` — a nullable JSON field that is never written.

The Evidence-Driven Coaching Loop programme (Phase 2) requires a canonical actual on-pitch position timeline for combination evidence, position exposure, and planned-vs-actual comparison. The factual starting lineup defines t=0 state; changes through substitutions, position-only swaps, and corrections rebuild downstream intervals.

Currently:
- `computePositionIntervals()` in `lineup-state.ts` computes intervals at runtime from starters + rotations + position changes, but has no persisted output
- `actualPositions` on `PostMatchPlayerActual` is always null
- `POSITIONS_CHANGED` events have no emitter
- No model persists actual position intervals

## Decision

1. **Persist actual position intervals as a derived projection, not a new event model.** The canonical actual timeline is computed from: finalized lineup starters + `MatchRotation` rows (substitutions and position swaps) + post-match corrections. It is stored as `ActualPositionInterval` rows derived after report completion or on-demand.

2. **The starting lineup is the t=0 source of truth.** When a post-match report is completed (LOCKED), the report's `MatchLineupAssignment` rows (or `PostMatchPlayerActual` with position data) define who was on the pitch and where at match start. This is the factual baseline.

3. **`MatchRotation` rows with `outPosition`/`inPosition` data are the primary change source.** Position swaps (`positionOnly: true`) and substitutions (`positionOnly: false`) both contribute to the timeline. `POSITIONS_CHANGED` live events may supplement this but are not the primary model.

4. **Actual position intervals are immutable once the report is LOCKED.** Corrections before locking rebuild affected intervals. After locking, the timeline is frozen.

5. **`PostMatchPlayerActual.actualPositions` becomes the simple list of positions a player occupied during the match.** It is populated from the computed intervals at report completion time, not maintained manually.

6. **Provenance is preserved.** Each interval records its source: `STARTING_LINEUP`, `SUBSTITUTION`, `POSITION_SWAP`, `POST_MATCH_CORRECTION`, or `LIVE_RECORDED`.

7. **Exact and approximate timing are distinct.** `matchSeconds` (integer) records known timing. `approximateTiming: true` marks intervals where the timestamp is estimated rather than recorded.

8. **Unknown stays unknown.** If position data is missing for a player, no interval is created. Missing data is not filled with planned data.

## Schema

```prisma
model ActualPositionInterval {
  id              String   @id @default(cuid())
  organisationId  String
  matchId         String
  playerId        String
  position        String
  startedAtMs     Int      // match seconds (0 = start of match)
  endedAtMs       Int?     // null = ongoing until end of match
  source          ActualIntervalSource
  approximateTiming Boolean @default(false)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  match    Match   @relation(fields: [matchId], references: [id], onDelete: Cascade)
  player   Player  @relation(fields: [playerId], references: [id], onDelete: Restrict)
  organisation Organisation? @relation(fields: [organisationId], references: [id], onDelete: Cascade)

  @@index([matchId, playerId])
  @@index([matchId, startedAtMs])
  @@index([organisationId])
}

enum ActualIntervalSource {
  STARTING_LINEUP
  SUBSTITUTION
  POSITION_SWAP
  POST_MATCH_CORRECTION
  LIVE_RECORDED
}
```

## Consequences

- The existing `computePositionIntervals()` function remains the runtime computation engine
- A new `rebuildActualTimeline(matchId)` function computes intervals and persists them
- `PostMatchPlayerActual.actualPositions` is populated from persisted intervals on report completion
- Combination evidence (Phase 3) consumes `ActualPositionInterval` rows, not `actualPositions` JSON
- The `POSITIONS_CHANGED` live event type is preserved for future use but not required for Phase 2
- Position exposure insights (I-004) migrate from reading `actualPositions` JSON to reading `ActualPositionInterval` rows

## Migration

1. Add `ActualPositionInterval` model and `ActualIntervalSource` enum
2. Create `rebuildActualTimeline()` domain function
3. Call `rebuildActualTimeline()` after report completion (`LOCKED`)
4. Populate `PostMatchPlayerActual.actualPositions` from computed intervals
5. Existing `actualPositions = null` rows are backfilled by running `rebuildActualTimeline()` for completed reports

## Supersedes

None (new capability)