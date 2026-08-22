# ADR-0029: Source-of-truth inventory and deprecation map

## Status

Accepted

## Date

2026-07-29

## Context

IMPROVE-0A requires identifying duplicate or overlapping concepts, documenting current representations, and choosing an authority for each before making schema or code changes.

The security inventory (SEC-0) revealed that the codebase has several overlapping data representations, inconsistent enum storage, and missing database constraints.

## Decision

### Canonical source-of-truth assignments

| Concept | Canonical source | Deprecation target | Removal condition |
|---------|-----------------|-------------------|-----------------|
| Player position | `Player.primaryPosition/secondaryPosition/tertiaryPosition` | `PlayerPosition` table (write-only, never read) | Remove `PlayerPosition` writes and table when no code path reads it |
| Selection explanation | `SelectionExplanation` table | `Selection.explanation` JSON field (convenience cache) | When all consumers read from `SelectionExplanation` and `Selection.explanation` field is no longer needed |
| Plan integrity signals | `computeRoundPlanIntegrity()` (live computed) | `Warning` table rows (derived projection) | When `Warning.resolved` boolean is removed and all consumers read from live computation |
| Opponent identity | `OpponentTeam` canonical record | `Match.opponent` and `EventMatch.opponentName` (display snapshots) | Never remove snapshots; they are historical records. New matches always set both. |
| Player availability | `Availability` table (per-round) | `Player.currentAvailability` (denormalized snapshot) | When selection engine reads only from `Availability` table |
| Goals and assists | `Goal` and `Assist` event models | `MatchReportPlayerStat.goals/assists` (compatibility fields) | When all display code reads from event models |
| Match status | `MatchStatus` enum (SCHEDULED, CANCELLED) | N/A | Already canonical |
| Selection role | `SelectionRole` enum | `BACKFILL` value (legacy, read-only) | When all historical BACKFILL data is migrated to SUPPORT with explanation code |
| Controlled double load | Legacy concept, no new true values | `Selection.controlledDoubleLoad` and `MovementLedger.controlledDoubleLoad` | When all existing true values are migrated and field is no longer read for operational logic |

### String fields that should be enums

| Model | Field | Current | Target |
|-------|-------|---------|--------|
| MatchRound | status | String "DRAFT" | Enum: NOT_GENERATED, DRAFT, BLOCKED, READY, FINALIZED |
| Availability | status | String | AvailabilityStatus enum |
| PostMatchPlayerActual | attendanceStatus | String "UNKNOWN" | Enum |
| PostMatchPlayerActual | source | String "PLANNED" | Enum: PLANNED, UNPLANNED |
| Goal | type | String "NORMAL" | Enum |
| Assist | type | String "NORMAL" | Enum |
| EventGoalEvent | type | String "NORMAL" | Enum |
| EventAssistEvent | type | String "NORMAL" | Enum |
| EventPostMatchPlayer | attendanceStatus | String "UNKNOWN" | Enum |
| EventPostMatchPlayer | role | String? | Enum |
| EventMatchSupportAssignment | plannedRole | String? | Enum |

### Missing database constraints to add

| Model | Constraint | Type |
|-------|-----------|------|
| Selection | (playerId, matchRoundId, status) | Unique — one planned assignment per player per round |
| Availability | (playerId, matchRoundId) | Unique — one availability per player per round |
| RotationPath | (fromTeamId, toTeamId, role) | Unique — one path per direction and role |
| Player rating fields | 1-10 range (nullable) | CHECK constraint |
| LeagueSeason | endDate > startDate | CHECK constraint |
| Team | targetSquadSize >= minAcceptedSquadSize, maxSquadSize > targetSquadSize | CHECK constraint |

### Parallel models to document (not merge yet)

League and Event post-match reporting models are intentionally separate per AGENTS.md. Shared utility types may be extracted for common concepts (attendance status, goal types, position IDs) but the aggregate roots remain distinct.

### CoachingIntentScopeType.PLANNING_PERIOD rename

Rename `PLANNING_PERIOD` to `LEAGUE_SEASON` in the enum and update all code references. This is a code-only change; the database enum will be migrated.

## Consequences

- No immediate schema changes in this ADR — changes require staged migrations
- Player position sync logic (`syncPlayerPositions`) can be simplified since `PlayerPosition` table is never read
- `Warning.resolved` boolean is vestigial and can be marked deprecated
- String-typed enum fields will be migrated to proper enums in a later stage
- The `Selection` unique constraint on `(playerId, matchRoundId)` is the most critical missing constraint — enforcement currently relies entirely on application logic
- This inventory forms the basis for the IMPROVE-0B reconciliation and IMPROVE-0C constraint hardening stages

## Alternatives considered

- **Merge league and event post-match models now**: Rejected — AGENTS.md explicitly states they are separate. Shared types may be extracted later.
- **Remove PlayerPosition table immediately**: Deferred — verify no code path reads it first (assessment shows none, but migration should be staged). Done 2026-08-22 — see ARR-0001's `## Resolution`.
- **Remove Warning table immediately**: Deferred — still actively written by generation pipeline. Must migrate to live computation first.

## Related

- ADR-0028 (security baseline and threat model)
- ADR-0013 (opponent team registry and encounter observations)
- ADR-0014 (per-match finalization and unfinalization)
- Source-of-truth register: `docs/domain/source-of-truth-register.md`
- Threat model: `docs/security/threat-model.md`
- ASVS matrix: `docs/security/asvs-matrix.md`