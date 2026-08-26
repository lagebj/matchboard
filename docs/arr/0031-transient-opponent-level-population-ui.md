# ARR-0031: Transient opponent level population UI

## State

Identified

## Identified

2026-08-26

## Residue

A transient admin UI is being added under the More page to populate opponent sporting levels from existing historical match data. This UI calls `dryRunOpponentEvidence` in apply mode (not just dry-run) to backfill `OpponentSportingEvidence` and `OpponentAssessmentChange` records for matches that already have completed post-match reports but were recorded before the opponent engine was active.

This UI is transient: it exists only to migrate existing data for active users and must be removed once all active organisations have had their historical data populated.

## Intended architecture

The opponent engine runs automatically on every report completion via `recordOpponentSportingEvidence()`. Historical data population is a one-time migration. No permanent admin UI should exist for this purpose. Once all organisations have been backfilled, the population page, its server action, and its API route must be removed.

## Evidence

- `src/app/(app)/o/[orgSlug]/more/page.tsx` — will contain a transient "Populate opponent levels" section (admin-only)
- `src/lib/evidence/opponent-replay.ts` — `dryRunOpponentEvidence()` already supports replay but does not persist; the apply mode will be added
- `src/lib/opponents/sporting-level-recording.ts` — `recordOpponentSportingEvidence()` is the canonical recording function called on report completion

## Impact

- If the transient UI is not removed, it becomes a permanent undocumented admin feature that could be misused (re-running population repeatedly).
- The dry-run/apply distinction must be clear to prevent accidental re-application.
- The `opponent-estimate.ts` parallel path (ARR-0032, to be created) is a separate residue.

## Containment

- The population page must only be visible to admin-role users (`canAdmin(ctx)`).
- The apply action must be idempotent and safe to re-run (skip already-processed matches).
- The apply action must log what it does.
- Do not extend the population UI with additional migration capabilities.
- Do not add scheduled/cron triggers for historical population.

## Resolution criteria

- All active organisations have had their historical opponent evidence populated.
- The population page, server action, and API route are removed from the codebase.
- No remaining imports or references to the removed code exist.
- The automatic `recordOpponentSportingEvidence()` on report completion remains as the only recording mechanism.

## Disposition

Pending.

## Related decisions

- ADR-0092: Match Evidence Engine domain foundation
- ADR-0086: Live Match Realtime (opponent engine integration)

## Related implementation

- `src/lib/evidence/opponent-replay.ts`
- `src/lib/opponents/sporting-level-recording.ts`
- `src/lib/opponents/sporting-level-query.ts`

## Supersedes

None.

## Superseded by

None.

## History

### 2026-08-26

Record created. Transient population UI planned as part of Match Evidence Engine Phase 6.