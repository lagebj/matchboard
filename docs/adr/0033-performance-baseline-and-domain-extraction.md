# ADR-0033: Performance baseline and domain extraction (IMPROVE-0C/0D)

## Status

Accepted

## Date

2026-07-29

## Context

IMPROVE-0C and IMPROVE-0D identified performance bottlenecks and domain logic leaks in the Matchboard codebase:

1. **N+1 queries**: `compute-plan-integrity` made per-player database queries in a loop, causing O(N) and O(N×R) query patterns on the assistant page load path.
2. **Unscoped queries**: `get-consecutive-support-count` loaded ALL completed reports globally instead of scoping to relevant matches.
3. **Duplicate queries**: The assistant command centre made two identical post-match report queries where one would suffice.
4. **Missing indexes**: The Selection table had no indexes for the most common query patterns (matchRoundId+status, matchId+status, playerId+matchRoundId, playerId).
5. **Non-transactional warning creation**: Warning records were created outside the finalization transaction, risking orphaned data on transaction failure.
6. **Domain logic leaks**: Post-match report business logic (status transitions, lock guards, valid reason lists) was embedded in server action files rather than owned domain modules.

## Decision

1. **Fix N+1 queries**: Replace per-player `availability.findFirst` loop with bulk query lookup in `compute-plan-integrity`. Replace quadratic per-player-per-round queries with batched queries.
2. **Scope unscoped queries**: Add `matchId: { in: matchIds }` filter to `get-consecutive-support-count`.
3. **Merge duplicate queries**: Consolidate two `postMatchReport.findMany` calls into one in `get-assistant-command-centre`.
4. **Add database indexes**: Create migration with indexes on Selection(matchRoundId, status), Selection(matchId, status), Selection(playerId, matchRoundId), Selection(playerId).
5. **Move warning creation inside transactions**: Move `db.warning.create` calls inside `db.$transaction` blocks in `finalize-match-round` and `finalize-single-match`.
6. **Extract report domain logic**: Create `src/lib/reports/report-domain.ts` with status transition machine, lock guards, valid reason lists, and attendance validation. Import domain constants in server actions.

## Consequences

- Faster page loads for assistant and round board (fewer database roundtrips).
- No orphaned warnings if finalization transaction fails.
- Database-level enforcement of common query patterns.
- Clear domain ownership for post-match report business rules.
- Known remaining optimization: `getLeagueSeasonFairness` called per match instead of cached per round; per-candidate history queries; season overview full-league-season scans.
- Known remaining extraction: post-match actions still delegate minimally to domain module; full extraction of all business logic from actions remains a follow-up.

## References

- IMPROVE-0C database constraints migration (20260729120000)
- IMPROVE-0D performance baseline recording
- ARR-0004 (domain logic leaks)
- ADR-0030 (application boundaries and domain ownership)