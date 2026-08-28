# ARR-0031: Transient opponent level population UI

## State

Identified

## Identified

2026-08-26

## Residue

A transient admin UI is being added under the More page to populate opponent sporting levels from existing historical match data. This UI calls `dryRunOpponentEvidence` in apply mode (not just dry-run) to backfill `OpponentSportingEvidence` and `OpponentAssessmentChange` records for matches that already have completed post-match reports but were recorded before the opponent engine was active.

This UI is transient: it exists only to migrate existing data for active users and must be removed once all active organisations have had their historical data populated.

## Intended architecture

The opponent engine runs automatically on every report completion — League's `completeReport()`
and, since ADR-0104, Event's `completeEventReport()` — via the shared
`recordOpponentSportingEvidenceForRef()`/`runPostMatchLearning()` pipeline. Historical data
population is a one-time migration, now covering League and Event history alike (see
"Event history extension" below). No permanent admin UI should exist for this purpose. Once all
organisations have been backfilled, the population page, its server action, and its API route
must be removed.

## Evidence

- `src/app/(app)/o/[orgSlug]/more/page.tsx` — contains the transient "Populate opponent levels" section (admin-only)
- `src/lib/evidence/opponent-replay.ts` — `dryRunOpponentEvidence()`/`applyOpponentEvidenceHistory()` discover and process both League (`db.match`) and Event (`db.eventMatch`) history
- `src/lib/opponents/sporting-level-recording.ts` — `recordOpponentSportingEvidenceForRef()` is the canonical recording function called on report completion (League and Event alike) and by the historical catch-up tool — one implementation, not two

## Impact

- If the transient UI is not removed, it becomes a permanent undocumented admin feature that could be misused (re-running population repeatedly).
- The dry-run/apply distinction must be clear to prevent accidental re-application.
- The `opponent-estimate.ts` parallel path (ARR-0032) is a separate residue, not touched by this work.

## Containment

- The population page must only be visible to admin-role users (`canAdmin(ctx)`).
- The apply action must be idempotent and safe to re-run (skip already-processed matches, per
  source-specific unique key — `matchId` or `eventMatchId`).
- The apply action must log what it does.
- Do not extend the population UI with additional migration capabilities beyond populating
  opponent levels from more of the organisation's actual match history. Widening its match-source
  coverage to include Event history (below) is within that existing purpose — it is not the kind
  of scope creep this containment rule was written to prevent (a second, unrelated migration
  capability bolted onto the same admin page would still be prohibited).
- Do not add scheduled/cron triggers for historical population.

## Event history extension (ADR-0104, 2026-08-28)

Originally League-only (`db.match`/`db.postMatchReport` exclusively — Event history was
invisible to this tool). Extended to also discover and process historical Event matches
(`db.eventMatch`/`db.eventPostMatchReport`), through the same generalized
`recordOpponentSportingEvidenceForRef()` — not a second opponent-rating algorithm. Both
`dryRunOpponentEvidence()`'s and `applyOpponentEvidenceHistory()`'s results now report a
`bySource: { league, event }` breakdown alongside the existing combined totals. `EventMatch` has
no `matchFit` field, so Event history has no auto-exclusion signal (documented limitation, same
as the automatic recording path). Idempotency is preserved per-source via the dual `@unique`
`matchId`/`eventMatchId` columns on `OpponentSportingEvidence` (Postgres allows multiple NULLs
per unique index, so each source's uniqueness is independent).

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
- `src/lib/evidence/adapters/league-evidence-adapter.ts`, `event-evidence-adapter.ts`
- `src/lib/evidence/football-match-ref.ts`, `post-match-learning.ts` (ADR-0104)

## Supersedes

None.

## Superseded by

None.

## History

### 2026-08-26

Record created. Transient population UI planned as part of Match Evidence Engine Phase 6.

### 2026-08-28

Extended to cover historical Event matches, through the same canonical
`recordOpponentSportingEvidenceForRef()` pipeline (Event Evidence Parity programme, ADR-0104).
Still transient, still pending removal once all active organisations are backfilled — this
extension widens what "backfilled" now means (League + Event), it does not change the
tool's disposition.