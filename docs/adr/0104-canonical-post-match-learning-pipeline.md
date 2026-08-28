# ADR-0104: Canonical Post-Match Learning Pipeline (League/Event Evidence Parity)

## Status

Accepted

## Context

Matchboard has two independent match domains — League and Event — with two very different
levels of post-match "learning":

- **League** (`completeReport()` in `src/lib/reports/report-mutations.ts`) resolves opponent
  identity, records opponent sporting evidence (`recordOpponentSportingEvidence`), computes
  player evidence (`computeAndApplyPlayerEvidenceForMatch`), and — when a `leagueSeasonId` can
  be resolved from the match's round — rebuilds combination evidence
  (`rebuildMatchCombinationEvidence`).
- **Event** (`completeEventMatchReportAction()` in
  `src/app/(app)/events/event-post-match-actions.ts`) only resolves opponent *identity*
  (`resolveEventOpponentOnReportCompletion`). It records no opponent sporting evidence, computes
  no player evidence, and generates no combination evidence. Event matches currently contribute
  nothing to Matchboard's learning model, even though Event live-match reporting already
  produces comparable raw data (`EventLiveMatchEvent` rotations/position-changes,
  `EventMatchLineupAssignment` starting lineups, `EventPostMatchPlayer` attendance/minutes).
- `OpponentSportingEvidence`, `CombinationEvidence`, and `ActualPositionInterval` are hard-FK'd
  to League `Match` only. `PlayerDevelopmentObservation` already carries a `sourceType`
  discriminator with an `EVENT_MATCH` enum value (added speculatively), but only a single
  required `matchId → Match` FK — the enum value is currently dead/unusable.
- The "Populate opponent levels" transient catch-up tool (`src/lib/evidence/opponent-replay.ts`,
  ARR-0031) queries `db.match`/`db.postMatchReport` only — Event history is invisible to it.
- Separately, ADR-0096 ("Canonical Actual Position Timeline") already decided that
  `rebuildActualTimeline(matchId)` should run "after report completion (LOCKED)" (its Migration
  step 3), but this call was never actually wired into `completeReport()` — it is only invoked
  from a docs-seed script. In production, `ActualPositionInterval` rows are never created for
  real League matches, so combination evidence (which reads `ActualPositionInterval`) has never
  actually run against real data. This ADR completes that pre-existing decision as part of
  building the same wiring for Event matches.
- ADR-0092 ("Match Evidence Engine Domain Foundation") already named this exact gap as
  follow-up work: "Phase 4: Opponent engine and historical replay." This ADR is that phase,
  expanded to cover the full evidence surface (player, opponent, combination, actual timeline)
  rather than only the opponent engine, because the same architectural problem — League-only
  hard-coding — exists across all four.
- ARR-0030 documents that Event report completion is not domain-owned (inline lock-checks and
  writes in the server-action file, no `event-report-mutations.ts` equivalent of League's
  `completeReport()`). Fixing that is a precondition for giving Event report completion a single
  place to call into shared learning, exactly as League's `completeReport()` does today.

## Decision

**Introduce one canonical football-match evidence contract and one shared post-match learning
orchestrator, used by League and Event alike. League and Event become adapters into this
contract; they do not each own a copy of the learning algorithms.**

1. **`FootballMatchRef`** (`src/lib/evidence/football-match-ref.ts`) is a discriminated union
   identifying a match's source without exposing persistence details to algorithms:
   `{ kind: "LEAGUE_MATCH", matchId, leagueSeasonId }` |
   `{ kind: "EVENT_MATCH", eventMatchId, eventId, evidenceLeagueSeasonId? }`.

2. **Evidence algorithms take a `FootballMatchRef`, not a persistence-specific `matchId`.**
   League and Event each get one adapter (`src/lib/evidence/adapters/league-evidence-adapter.ts`,
   `.../event-evidence-adapter.ts`) that builds the ref, resolving each source's own
   evidence-season context. The generalized algorithms
   (`recordOpponentSportingEvidenceForRef`, `computeAndApplyPlayerEvidenceForMatch`,
   `rebuildMatchCombinationEvidence`, `rebuildActualTimelineForRef`) each resolve their own
   source-specific query internally (League vs. Event branch), branching only at the narrow
   persistence-write boundary (which unique column to upsert on, which relation to set) — not a
   single shared "canonical evidence" struct threaded through every function, since each
   algorithm needs a different slice of match data (observations for player evidence,
   score/participants for opponent evidence, position intervals for combination evidence). A
   speculative all-fields struct covering every algorithm's needs would mostly go unused by any
   one caller.

3. **One shared orchestrator, `runPostMatchLearning(ref)`**
   (`src/lib/evidence/post-match-learning.ts`), owns the sequence: rebuild actual timeline →
   record opponent sporting evidence → compute player evidence → rebuild combination evidence
   (skipped with a reason code when no evidence-season can be resolved). It returns a structured
   `APPLIED`/`SKIPPED`/`FAILED` result per evidence type with reason codes — no step's failure
   blocks report completion or another step.

4. **Persistence models generalize via nullable dual-FK + discriminator, not a generic
   entityType/entityId pattern** (matching the existing `PlayerDevelopmentObservation.sourceType`
   convention): `matchId String?` / `eventMatchId String?` with a `CHECK` constraint enforcing
   exactly one is set, plus a `sourceType` enum where useful for the discriminator. Applied to
   `PlayerDevelopmentObservation` (making its existing `EVENT_MATCH` enum value real),
   `OpponentSportingEvidence`, `CombinationEvidence`, `ActualPositionInterval`.

5. **Actual-timeline reconstruction generalizes without a new Event substitution table.** Event
   live-match reporting already emits `ROTATION_OUT`/`ROTATION_IN`/`POSITIONS_CHANGED` through
   the same shared `LiveMatchEventType` enum League uses (`EventLiveMatchEvent`). The Event
   adapter (`rebuildEventActualTimeline`) derives intervals from `EventMatchLineupAssignment`
   (t=0 state) plus `EventLiveMatchEvent` rows, reusing `computePositionIntervals()`'s existing
   runtime logic rather than duplicating it — completing ADR-0096's intended architecture for a
   second source instead of forking it.

6. **Event report completion becomes domain-owned** (resolving ARR-0030 as a precondition):
   `completeEventReport()` in `src/lib/reports/event-report-mutations.ts` mirrors League's
   `completeReport()` shape (lock-state check, unknown-attendance check, status write, then
   opponent-identity resolution + `runPostMatchLearning`). `completeEventMatchReportAction`
   becomes a thin wrapper, matching League's action/domain split.

7. **The transient "Populate opponent levels" tool (ARR-0031) extends to Event history using the
   same generalized `recordOpponentSportingEvidence`, not a second opponent-rating algorithm.**
   This is treated as within ARR-0031's existing purpose (populating opponent levels from more
   of the organisation's actual match history), not the "additional migration capabilities"
   its containment note cautions against — see the ARR-0031 update accompanying this work.

## Alternatives considered

- **Separate `EventPlayerEvidenceService`/`EventOpponentEvidenceService` copies of the League
  algorithms.** Rejected: guarantees the two paths drift (exactly the "6 parallel/duplicate
  calculation paths" problem ADR-0092 was written to stop), and directly contradicts the
  standing invariant "One business operation, one owning implementation, multiple adapters."
- **Generic polymorphic `entityType`/`entityId` columns instead of nullable dual-FK.** Rejected:
  loses real foreign-key referential integrity and query-planner index support, and AGENTS.md's
  "Prisma and database migration" guidance already prefers explicit `matchId?`/`eventMatchId?`
  fields over a generic reference pattern unless one is already established (none is).
- **Require Event matches to belong to a League season** (folding Event into League's existing
  `leagueSeasonId`-keyed combination-evidence model directly) so no new evidence-season
  resolution logic is needed. Rejected: Event matches are explicitly not League competition
  (product boundary in AGENTS.md); `evidenceLeagueSeasonId` is learning *context*, resolved
  automatically from football-group + date overlap, never a forced competition membership.

## Consequences

- League behavior is preserved (characterization tests assert this) while gaining a real fix:
  `ActualPositionInterval` rows actually get created on report completion for the first time in
  production, so combination evidence — previously silently starved of input — starts working.
- Event matches become first-class evidence sources for player, opponent, and combination
  learning, without a second algorithm to maintain.
- `OpponentEncounterObservation` (coach's manual qualitative assessment) and `TeamReflection`
  (structured rating model) are explicitly *not* generalized by this decision — they are not
  evidence-algorithm inputs (verified: `recordOpponentSportingEvidence` never reads
  `OpponentEncounterObservation`). Event keeps its existing free-text fields for these. Revisit
  as a separate decision if Event needs structured parity for coach-facing display, not evidence.
- `EventMatch` has no `matchFit` field; the Event opponent-evidence adapter has no auto-exclusion
  signal (League's CHAOTIC/SUPPORT_OVERPOWERED/SUPPORT_TOO_LOW check) and never excludes on that
  basis. Revisit only if Event acquires its own sporting-fit field — the existing `MatchFit` enum
  must be reused, not duplicated, if that happens (AGENTS.md).
- Historical opponent-learning catch-up (ARR-0031) can now honestly claim organisation-wide
  coverage instead of League-only coverage.

## Migration

- Additive-only Prisma migration: existing League rows keep their `matchId`, gain `eventMatchId
  = null`. No data loss, no destructive rewrite.
- `CHECK` constraints (exactly-one-of-matchId/eventMatchId) are hand-added to the generated
  migration SQL, since Prisma's schema DSL cannot express them.
- Evidence-algorithm signature changes (`recordOpponentSportingEvidence`,
  `computeAndApplyPlayerEvidenceForMatch`, `rebuildMatchCombinationEvidence`,
  `rebuildActualTimeline`/new `rebuildEventActualTimeline`) are internal to `src/lib/`; no public
  API/route contract changes.

## Follow-up

- Resolve ARR-0030 (Event report completion domain ownership) as part of this same programme —
  it is a precondition for step 6 above, not independent work.
- Update ARR-0031 once the transient tool covers Event history (own PR within this programme).
- ARR-0032 (legacy `opponent-estimate.ts` parallel calculation path) is a related but separate
  residue, explicitly out of scope here — this ADR does not touch that path.
- A future decision may generalize `OpponentEncounterObservation`/`TeamReflection` for Event
  structured parity; not required by this ADR.

## Supersedes

None (extends ADR-0092's Phase 4 and completes ADR-0096's intended wiring; does not change
either's decisions).
