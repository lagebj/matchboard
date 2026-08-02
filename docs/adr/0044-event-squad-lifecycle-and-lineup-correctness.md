# ADR-0044: Event-squad lifecycle and event-lineup correctness

## Status

Proposed

## Date

2026-08-01

## Context

The event-squad planning feature uses a DRAFT/CONFIRMED status model (`EventSquadStatus`). The current implementation requires squads to be confirmed before certain operations, and generates "squads need review" Assistant work items.

Per the deferred work specification, event squads are operational planning units. They do not require a generic confirmation or review state. Confirmation is an optional advisory review action, not a mandatory gate.

Additionally:
- Player movement between squads must be atomic and same-event-contained
- Event-lineup eligibility must be server-enforced
- Helper provenance (`BASE_SQUAD` / `HELPER`) must be server-derived, not client-supplied
- Stale assignments must be explicitly detected and surfaced

## Decision

### Event-squad confirmation

1. Remove the `CONFIRMED` status from the user-facing workflow
2. Rename `EventSquadStatus.CONFIRMED` to `EventSquadStatus.LOCKED` for backward compatibility of historical data
3. Remove "squads need review" from Assistant work items
4. Allow optional advisory review through the Review domain (separate ADR)
5. Squads in DRAFT status are fully operational for lineup planning, helper assignment, and movement

### Same-event atomic movement

1. Add a database-level unique constraint `[eventId, playerId]` across `EventSquadPlayer` to prevent duplicate assignment at the database level
2. Ensure all squad movement operations use database transactions
3. Reject cross-event movement at the service level

### Event-lineup eligibility

1. Implement `getEligibleEventMatchPlayers()` as a canonical service
2. Implement `assertEligibleEventMatchPlayer()` for server-side validation
3. Set `EventMatchLineupAssignment.source` to `HELPER` when the player is a support assignment, not always `BASE_SQUAD`
4. Surface stale assignments explicitly with reason and replacement suggestion

### Helper provenance

1. `EventMatchSupportAssignment.sourceEventSquadId` is already server-derived — preserve this
2. `EventMatchLineupAssignment.source` must be set based on whether the player is in the match's squad or is a helper
3. Never trust client-supplied provenance values

## Consequences

- Event squads are immediately usable without confirmation
- Same-event movement is enforced at both application and database level
- Lineup assignments correctly reflect helper provenance
- Stale assignments are visible to coaches

## Related

- ADR-0008 (Event squad planning)
- 03-event-correctness.md (deferred work specification)
- MB-DW-004, MB-DW-005, MB-DW-006, MB-DW-007