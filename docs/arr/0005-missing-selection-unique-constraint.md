# ARR-0005: Selection unique constraint missing at database level

## State

Confirmed

## Identified

2026-07-29

## Residue

The domain invariant "one planned assignment per player per round" is enforced only in application logic. The database has no unique constraint preventing duplicate active selections for the same player in the same round.

The application logic in the selection engine correctly prevents duplicates, but the database can accept them if:
- A race condition occurs between two concurrent requests
- A direct database write bypasses the engine
- A migration or manual correction inserts duplicates

## Intended architecture

Per AGENTS.md: "A player must not be planned for two matches in the same round/week." The database should enforce this as a hard constraint, not just the application.

## Evidence

- `src/lib/selection/generate-selection.ts` — checks for existing selections before creating new ones
- `src/lib/selection/validate-generated-round-invariants.ts` — validates no duplicate planned assignments
- `prisma/schema.prisma` — Selection model has no unique constraint on (playerId, matchRoundId)
- AGENTS.md: "one planned assignment per player per round"

## Impact

- Race conditions during concurrent round generation could create duplicate planned assignments
- Manual edits via API could bypass the application check if validation is missed
- No database-level protection against data corruption
- This is the most critical missing constraint identified in the IMPROVE-0A assessment

## Containment

- Application logic must continue to check for duplicates before creating selections
- Manual edit validation must check same-round conflicts
- No new code paths should create selections without going through the validation layer

## Resolution criteria

- Partial unique index on `Selection(playerId, matchRoundId)` where `status = 'DRAFT'` is added to the database
- Or: application-level unique check is wrapped in a transaction with explicit conflict handling
- Reconciliation check confirms no existing duplicates
- Test verifies that concurrent selection creation fails gracefully

## Disposition

Pending. To be addressed in IMPROVE-0C (database integrity and write hardening).

## Related decisions

ADR-0029 (source-of-truth inventory and deprecation map) — identified as Critical priority
ADR-0030 (application boundaries and domain ownership)

## Related implementation

None yet.

## Supersedes

None

## Superseded by

None

## History

### 2026-07-29

Record created from IMPROVE-0A database assessment.