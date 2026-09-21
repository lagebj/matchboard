# ARR-0052: Realised match positions have two persisted representations, with inconsistent consumers

## State

Identified

## Identified

2026-09-21

## Residue

Two separate persisted records both claim to represent "which position(s) a player actually
played in a given match":

- **`ActualPositionInterval`** (`prisma/schema.prisma:804-834`) — the canonical, time-aware
  record: one row per contiguous position interval, with `startedAtMs`/`endedAtMs`, `source`
  (`STARTING_LINEUP`/`SUBSTITUTION`), and `approximateTiming`. Covers both League (`matchId`) and
  Event (`eventMatchId`) matches.
- **`PostMatchPlayerActual.actualPositions`** (`prisma/schema.prisma:777-800`, `Json?`) — a
  denormalised, untimed string-array snapshot, League-only (`PostMatchPlayerActual` has no
  Event equivalent field; Events use a separate `EventPostMatchPlayer` model entirely).

`actualPositions` is written in exactly one place,
`populatePlayerActualPositions()` (`src/lib/evidence/actual-timeline.ts:655-683`), which derives
it from the just-rebuilt `ActualPositionInterval` rows and is called immediately after the
League interval rebuild (`src/lib/evidence/actual-timeline.ts:200-221`). In isolation this looks
like a same-transaction, kept-in-sync projection — but downstream consumers do not agree on
which of the two records to read, and the code explicitly documents this disagreement rather
than resolving it:

- `src/lib/player-development/position-usage-history.ts:9-10` states its data is "Derived
  directly from `ActualPositionInterval` ... — never from `PostMatchPlayerActual.actualPositions`".
- `src/lib/evidence/position-context-evidence.ts:15-27,223-245` also reads
  `ActualPositionInterval` as canonical.
- `src/lib/players/get-player-match-history.ts:47,135-137` calls
  `getPlayerActualPositionHistory()` (interval-derived, via `minutesByPosition`) and computes its
  own `actualPositions` display array from that — a **third**, independently-derived
  representation of the same fact, consumed by
  `src/lib/touchline/presentation/player-detail-production-adapter.ts:180`,
  `src/lib/touchline/presentation/player-matches-view-model.ts:14,45-46`, and
  `src/components/touchline/player/player-match-timeline.tsx:10,39`.
- `src/lib/insights/position-exposure.ts:12,69-72` instead reads
  `PostMatchPlayerActual.actualPositions` directly.
- `src/lib/opponents/sporting-level-recording.ts:43,72,95,147,267` also reads
  `PostMatchPlayerActual.actualPositions` directly.

So the same underlying fact ("what positions did this player actually play, this match") is
computed and consumed via three different code paths depending on which feature you're looking
at, two of which read from a stored JSON snapshot and one of which reads from the canonical
interval table live.

## Intended architecture

`ActualPositionInterval` is the documented canonical record (per the comment in
`position-usage-history.ts`, citing ADR-0096/ADR-0104/ADR-0113). `actualPositions` and any other
position-list derivation should either be eliminated in favour of reading intervals directly, or
be a strictly-defined, always-fresh projection with a single reconciliation point — not a field
some consumers read and others deliberately avoid.

## Evidence

- `prisma/schema.prisma:777-800` — `PostMatchPlayerActual.actualPositions Json?`.
- `prisma/schema.prisma:804-834` — `ActualPositionInterval` (canonical, timed, League + Event).
- `src/lib/evidence/actual-timeline.ts:655-683` — sole writer of `actualPositions`, derived from
  freshly-rebuilt intervals (League rebuild path only, `rebuildActualTimeline`,
  lines 180-221). The Event rebuild path (`rebuildEventActualTimeline`, lines ~270-345) does
  **not** call `populatePlayerActualPositions` at all — consistent with `actualPositions`
  existing only on the League-only `PostMatchPlayerActual` model, but confirming the field has
  no Event equivalent, so any consumer reading it is implicitly League-only even if the feature
  itself is meant to cover both.
- `src/lib/player-development/position-usage-history.ts:9-10` — explicit code comment stating
  intervals are used "never from `PostMatchPlayerActual.actualPositions`".
- `src/lib/insights/position-exposure.ts:69-72` and `src/lib/opponents/sporting-level-recording.ts:72,95,147,267`
  — direct reads of the JSON snapshot field.
- `src/lib/players/get-player-match-history.ts:47,135-137` — a third, independently-computed
  `actualPositions` array, sorted by total minutes-per-position and derived from
  `getPlayerActualPositionHistory()`'s interval-based `minutesByPosition`, not from either of the
  above two directly.

## Impact

- **Divergence risk:** `actualPositions` is only resynced when `rebuildActualTimeline` runs and
  reaches `populatePlayerActualPositions`. Any interval correction path that does not go through
  that exact function (none currently found — `actual-timeline.ts` is the sole writer of
  `ActualPositionInterval` today) would silently desynchronise the JSON snapshot from the
  canonical intervals; this is a latent risk if a future correction/edit feature is added against
  intervals directly.
- **Feature inconsistency today:** `position-exposure.ts` (position-exposure insight) and
  `sporting-level-recording.ts` (opponent sporting-level evidence) show whatever was last
  snapshotted into `actualPositions`, while `player-development` and the Touchline player-detail
  views show a value independently derived from live interval minutes. A player's position
  history can therefore legitimately look different across features even when reflecting "the
  same" underlying match, without any bug being introduced — this is a structural consequence of
  the split, not a one-off defect.
- **Event blind spot:** because `actualPositions` has no Event-side equivalent, any consumer that
  reads it directly (`position-exposure.ts`, `sporting-level-recording.ts`) is implicitly
  League-only for this signal, while `ActualPositionInterval` itself already supports Event
  matches — a further inconsistency in how completely each feature covers both match types.

## Containment

- Do not add a new consumer of `PostMatchPlayerActual.actualPositions`; new position-history
  reads should go through `ActualPositionInterval` (directly, or via
  `getPlayerActualPositionHistory()`/`position-usage-history.ts`'s existing helpers), matching
  the already-documented canonical-source rule.
- Do not add a fourth independent derivation of "positions actually played"; if a feature needs a
  cheap summary array, it should reuse `get-player-match-history.ts`'s or
  `position-usage-history.ts`'s existing interval-derived computation rather than inventing
  another one.
- Do not extend `actualPositions`-style JSON snapshotting to cover Event matches; Event position
  history should be read from `ActualPositionInterval` directly, consistent with how
  `position-usage-history.ts` already handles both match types uniformly.

## Resolution criteria

Not yet decided. Two plausible resolutions: (a) stop writing/reading
`PostMatchPlayerActual.actualPositions` entirely, migrating `position-exposure.ts` and
`sporting-level-recording.ts` onto the same interval-based helper the rest of the codebase uses,
or (b) formally document `actualPositions` as an intentional, League-only convenience cache with
one enforced reconciliation point and update its remaining two consumers' comments to say so
explicitly. Choosing between these (and handling any migration of historical data) needs its own
ADR; this ARR does not prescribe the outcome.

## Disposition

Pending.

## Resolution

Not yet resolved.

## Related decisions

None yet.

## Related implementation

None yet — this ARR is a documentation-only finding from a broader audit prompted by ARR-0051
(the `Selection`/`MatchLineup` competing-lineup-models finding); no code was changed for this
finding in this session.

## Supersedes

None.

## Superseded by

None.

## History

- 2026-09-21: Identified during a codebase-wide audit for competing/duplicated domain concepts,
  prompted by the `Selection`/`MatchLineup` finding (ARR-0051). Verified independently: writer
  (`actual-timeline.ts`), the three distinct consumer code paths, and the League-only Event
  coverage gap for `actualPositions`.
