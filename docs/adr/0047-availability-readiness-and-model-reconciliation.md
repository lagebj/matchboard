# ADR-0047: Availability, readiness and model reconciliation

## Status

Proposed

## Date

2026-08-01

## Context

Several domain models have dual writable representations or inconsistent state management:

1. **Availability**: `Availability.status` is stored as a plain String, not the `AvailabilityStatus` Prisma enum (ARR-0006). The model uses AVAILABLE/UNAVAILABLE/UNKNOWN/INJURED/SICK/AWAY/TENTATIVE but the spec requires AVAILABLE/UNAVAILABLE/UNKNOWN with an optional reason.

2. **Readiness**: `PlayerReadinessSignal` is the structured canonical model with enum types and values. But `Player.supportSuitability` and `Player.developmentReadiness` are scalar string fields that create a dual representation.

3. **Player positions**: Player string fields (`primaryPosition`/`secondaryPosition`/`tertiaryPosition`) and `PlayerPosition` table are both writable (ARR-0001).

4. **Selection explanations**: `Selection.explanation` JSON and `SelectionExplanation` table are both written by the engine (ARR-0002).

5. **Warning state**: `Warning` table rows can contradict `computeRoundPlanIntegrity()` live computation (ARR-0003). `Warning.resolved` is vestigial.

6. **String-typed enums**: Multiple fields store enum values as strings without database-level constraints (ARR-0006).

7. **Age-neutral language**: The feature contract preamble describes "youth football operations cockpit" but the product must support adult teams.

## Decision

### Availability model

1. Reduce `AvailabilityStatus` to three canonical values: `AVAILABLE`, `UNAVAILABLE`, `UNKNOWN`
2. Add `Availability.reason` (optional string) for context
3. Migrate existing `INJURED`, `SICK`, `AWAY`, `TENTATIVE` values to `UNAVAILABLE` with appropriate reason
4. Enforce `AvailabilityStatus` enum at the database level (check constraint or Prisma enum)

### Readiness model

1. `PlayerReadinessSignal` is the single canonical readiness model
2. `Player.supportSuitability` and `Player.developmentReadiness` become derived/compatibility fields or are removed
3. Readiness signals are coach-facing only and must not appear in parent-facing exports
4. Low readiness must not automatically exclude an eligible player
5. Readiness signals must be time-bound or reviewable

### Canonical player positions

1. `PlayerPosition` table becomes the single canonical writable representation
2. `Player.primaryPosition`, `Player.secondaryPosition`, `Player.tertiaryPosition` become derived fields or are removed
3. All reads migrate to `PlayerPosition`
4. All writes migrate to `PlayerPosition`
5. Prevent future drift

### Canonical selection explanations

1. `SelectionExplanation` table is the single canonical representation
2. `Selection.explanation` JSON becomes a read-only compatibility cache derived from `SelectionExplanation`
3. No independent writes to `Selection.explanation`

### Canonical warning state

1. `computeRoundPlanIntegrity()` remains the canonical source for current plan integrity
2. `Warning` table rows are persisted only for immutable historical or finalization snapshots
3. `Warning.resolved` field is deprecated — current state comes from computation, not persisted mutable state
4. Remove any code that updates `Warning.resolved` or treats it as authoritative for current state

### String-typed enums

1. Convert critical business-state fields to Prisma enums or database check constraints:
   - `MatchRound.status`
   - `Availability.status`
   - `EventSquad.status`
   - `EventSquadPlayer.source`
   - `EventMatchLineupAssignment.source`
   - `EventMatchLineup.status`
2. Lower-priority fields (event goal/assist types, post-match attendance) can be addressed incrementally

### Age-neutral language

1. Update feature contract preamble to "football operations workspace" instead of "youth football operations cockpit"
2. Ensure adult teams can operate without youth-specific fields
3. Retain youth-specific safeguards where context requires them (parent-export restrictions, child-safe language)

## Consequences

- One canonical writable representation per domain concept
- Database-level constraints prevent invalid enum values
- Warning state cannot contradict live computation
- Adult teams are first-class users
- Migration needed for availability values and position model

## Related

- ARR-0001 (player position dual representation)
- ARR-0002 (selection explanation dual storage)
- ARR-0003 (warning table conflicts)
- ARR-0006 (string-typed enum fields)
- 08-model-reconciliation.md (deferred work specification)
- MB-DW-022, MB-DW-023, MB-DW-024, MB-DW-025, MB-DW-026