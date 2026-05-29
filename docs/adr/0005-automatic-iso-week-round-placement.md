---
type: ADR
id: "0005"
title: Automatic ISO-week round placement on match rescheduling
status: active
date: 2026-05-29
supersedes: "0004"
superseded_by:
tags: [match-editing, scheduling, rounds, integrity]
---

## Context

ADR-0004 established that cross-round rescheduling requires explicit destination-round choice. In practice, Match Rounds are ISO-week planning containers and the coach only needs to change the fixture date. Requiring manual round selection adds unnecessary cognitive overhead for a decision that is deterministic from the new date.

Match creation already resolves the target ISO-week round automatically. Match rescheduling should use the same Phase-scoped resolver.

Moving a match between rounds must preserve referential integrity: Match, Selection and MovementLedger must not reference different rounds after a successful move.

Finalised selections represent committed plans that must not be silently relocated. Completed reports represent factual history that must not be casually rescheduled.

## Decision

1. **Automatic round placement**: When an unplayed match is rescheduled within its Phase, Matchboard resolves the correct round from the new match date using a shared Phase-scoped resolver. The coach no longer selects a destination round.

2. **Shared resolver**: Match creation and match rescheduling use the same `resolveOrCreateMatchRoundForDate` function. The resolver searches only within the current Phase and either reuses or creates the target-week round.

3. **Reuse existing round**: When one unique target-week round exists in the same Phase, reuse it. When no target-week round exists, create it automatically with the generated ISO-week label and NOT_GENERATED status.

4. **Ambiguity rejection**: When more than one round in the same Phase matches the target ISO week, reject the reschedule safely. Do not create additional rounds or choose arbitrarily.

5. **Same-week edit**: When the new date falls in the same ISO week as the current round, update date/time only. No round change, no new round creation.

6. **Cross-phase exclusion**: A matching week round from another Phase must never be reused. Outside-Phase dates are rejected without automatic Phase creation.

7. **Transactional draft-record movement**: When a match moves between rounds and has only DRAFT selections, update Match.matchRoundId, Selection.matchRoundId and draft MovementLedger.matchRoundId atomically in one transaction.

8. **Finalised-plan protection**: When any FINALIZED selection exists and the new date requires a different round, reject the move. Create no target round as a side effect. The coach must unfinalise first.

9. **Completed-report protection**: A match with a REPORTED or LOCKED post-match report cannot be rescheduled through normal editing.

10. **Integrity recalculation**: After a successful cross-round move, recalculate live plan integrity for both the old and new rounds using existing canonical integrity functions.

11. **Empty old rounds**: Moving a match that leaves its old round empty does not delete that round. Empty-round cleanup is separate work.

12. **No schema migration**: This workflow is derived from existing fields: Match.startsAt, Match.matchRoundId, MatchRound.planningPeriodId, PlanningPeriod.startDate/endDate, Selection.matchRoundId, MovementLedger.matchRoundId.

## Alternatives considered

- Retain manual round selection (ADR-0004 point 3) — rejected because it adds unnecessary coach overhead for a deterministic ISO-week decision
- Automatically delete empty old rounds — rejected because empty-round cleanup needs separate data-audit consideration
- Automatically unfinalise before moving — rejected because finalised squad plans represent committed decisions that must not be silently changed
- Add a persisted week-key field or unique constraint — rejected because uniqueness enforcement requires a data audit and migration first; ambiguous legacy data is handled by safe failure

## Consequences

- Positive: Coach workflow simplified to date change only; round management is automatic
- Positive: Match creation and rescheduling use the same resolver, reducing divergence
- Positive: Transactional integrity ensures Match, Selection and MovementLedger are never inconsistent
- Positive: Finalised plans and completed history are fully protected
- Negative: Ambiguous legacy round data blocks automatic placement until admin resolves duplicates
- Neutral: Empty rounds persist until separate cleanup work is done