# ARR-0006: String-typed enum fields lack database constraint enforcement

## State

Resolved (2026-08-22)

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

See source-of-truth register "String-typed enum fields" table. Re-verified directly against
`prisma/schema.prisma` 2026-08-20 (consolidation programme residue reconciliation pass) — 7 of
the original 8 fields remain genuinely open exactly as described; `Availability.status` is
already resolved (now a real `AvailabilityStatus` enum) and removed from this list:
- `MatchRound.status` — still `String @default("DRAFT")`, should be `MatchRoundStatus` enum.
  Confirmed as the concrete root cause of a real bug hit in production-adjacent testing this
  session (Playwright work, PR #310) — `deriveRoundStatus()`'s `NOT_GENERATED` branch is
  unreachable because nothing at the type level stops the column from being anything but
  `"DRAFT"`/`"FINALIZED"`. Highest-priority instance of this pattern.
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

Resolved. Maintainer decision: convert all remaining fields to real Postgres enums now, rather
than accept the risk via ADR.

## Resolution

Re-verification at implementation time found the "7 remaining fields" framing above was
imprecise: `MatchRound.status` turned out to already be a real `MatchRoundStatus` Prisma enum
(fixed in an earlier, undocumented pass — confirmed via direct schema read, not evidence of a
new bug). `EventPostMatchPlayer.role` was investigated and found to be genuine free text
interpolated at write time (`"Planned helper from {squad name}"` —
`src/app/(app)/events/event-post-match-actions.ts`), not a mis-typed enum, and was deliberately
left as `String?`. The actual scope was 8 fields across 6 models:

- `PostMatchPlayerActual.attendanceStatus` → `PostMatchAttendanceStatus` (PRESENT/NO_SHOW/UNKNOWN)
- `PostMatchPlayerActual.source` → `ParticipationSource` (6 values)
- `Goal.type` → `GoalType` (NORMAL/OWN_GOAL/PENALTY)
- `Assist.type` → `AssistType` (NORMAL/SECONDARY)
- `EventGoalEvent.type` → `GoalType` (shared with `Goal.type` — same vocabulary, separate table)
- `EventAssistEvent.type` → `AssistType` (shared with `Assist.type`)
- `EventPostMatchPlayer.attendanceStatus` → `EventPostMatchAttendanceStatus` (5 values, nullable)
- `EventMatchSupportAssignment.plannedRole` → `EventMatchSupportRole` (5 values, nullable)

Value sets were derived from the CHECK constraints already enforcing them since
`20260802120000_add_enum_check_constraints` — every existing row already satisfied the target
enum, making the `USING` casts in the new migration safe.

Two real, independent bugs were found and fixed as a direct result of this conversion (the
enum's stricter typing surfaced both at compile time — they were previously invisible runtime
risks):

1. **Dead code with an invalid literal.** `domain/assistant-manager/service.ts`'s
   `completePostMatchReport()`/`getPostMatchReport()` (and their action wrappers
   `finalizePostMatchReport`/`fetchPostMatchReport`) had zero callers anywhere in the app — a
   fully superseded post-match reporting path (the real one is
   `src/lib/reports/report-mutations.ts`, per AGENTS.md's "Direct post-match workflow"). Its
   input DTO type declared `attendanceStatus: AttendanceStatus` including `"LATE_CANCELLATION"`
   and `"ABSENT_CONFIRMED"` — values that were never in the CHECK constraint and would have
   thrown a Postgres constraint violation if ever actually written. Removed entirely (functions,
   action wrappers, types, tests) rather than patched, since it was unreachable.
2. **Live UI bug.** The event post-match report's attendance dropdown
   (`event-match-report-panel.tsx`) offered an `"ABSENT"` option that was never a valid stored
   value for `EventPostMatchPlayer.attendanceStatus` (not in the enum, not in the CHECK
   constraint) — selecting it would have thrown a database error. Removed the option (`"No
   show"` was already present as the correct equivalent). The migration includes a defensive
   `UPDATE ... SET attendanceStatus = 'NO_SHOW' WHERE attendanceStatus = 'ABSENT'` in case any
   legacy row predates the CHECK constraint.

`EventMatchSupportRole` was initially modeled with `@map("GK cover")`-style Prisma enum values
(preserving the exact human-readable strings already stored), but this was reverted: it's the
only `@map` on an enum value anywhere in this schema, and it would have forced app code to pass
the Prisma-facing key (`'GK_COVER'`) while the DB stored the mapped label (`'GK cover'`) — two
representations for no benefit. Switched to plain `SCREAMING_SNAKE_CASE` values (consistent with
every other enum in the schema) with a migration-time data conversion, plus a new
`formatEventMatchSupportRole()` / `EVENT_MATCH_SUPPORT_ROLE_LABELS` in
`src/lib/formatters/event-labels.ts` for display — matching the established formatter pattern
used by every other enum in that file.

Migration: `prisma/migrations/20260822160000_enum_fields_native_postgres_enums/` — applied to
local dev + test databases; production applies via the standard CI pipeline (ADR-0084).

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

### 2026-08-22

Resolved. Converted the 8 remaining string-typed fields to real Postgres enums; found and fixed
2 independent latent bugs along the way (dead code with an unreachable invalid literal, and a
live UI option that would have thrown a DB error). See `## Resolution` above.