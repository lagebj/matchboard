# ARR-0006: String-typed enum fields lack database constraint enforcement

## State

Confirmed

## Identified

2026-07-29

## Residue

Multiple fields in the Prisma schema store enum values as strings without database-level constraint enforcement. The application validates these through TypeScript enums and Zod schemas, but the database accepts any string value.

This means:
- Invalid enum values can be inserted directly into the database
- Data corruption from application bugs or direct database access goes undetected
- Migrations or scripts can bypass application validation

## Intended architecture

Enum fields should use Prisma enums where possible, and where string storage is required for flexibility, CHECK constraints or application-level validation must prevent invalid values.

## Evidence

See source-of-truth register "String-typed enum fields" table:
- `MatchRound.status` — should be `MatchRoundStatus` enum
- `Availability.status` — should be `AvailabilityStatus` enum
- `PostMatchPlayerActual.attendanceStatus` — should be `AttendanceStatusEnum`
- `PostMatchPlayerActual.source` — should be `ParticipationSourceEnum`
- `Goal.type`, `Assist.type` — should be `GoalTypeEnum`, `AssistTypeEnum`
- `EventGoalEvent.type`, `EventAssistEvent.type` — same
- `EventPostMatchPlayer.attendanceStatus`, `role` — should be enums
- `EventMatchSupportAssignment.plannedRole` — should be `SupportRoleEnum`

## Impact

- Data integrity depends entirely on application validation
- No database-level protection against invalid enum values
- Direct database writes or migrations can introduce invalid values
- Query filtering on enum values may miss invalid entries

## Containment

- All new code must use Zod validation for enum fields (SEC-1 schemas enforce this)
- No new string-typed enum fields should be added without a corresponding Zod schema
- Direct database writes must validate enum values before insertion

## Resolution criteria

- All enum fields have either Prisma enum types or CHECK constraints
- Existing data is migrated to valid enum values
- Zod schemas validate all enum inputs
- Reconciliation check reports any invalid enum values in the database

## Disposition

Pending. To be addressed in IMPROVE-0C (database integrity and write hardening).

## Related decisions

ADR-0029 (source-of-truth inventory and deprecation map)

## Related implementation

SEC-1 validation schemas already enforce enum values at the application level for API routes.

## Supersedes

None

## Superseded by

None

## History

### 2026-07-29

Record created from IMPROVE-0A schema assessment.