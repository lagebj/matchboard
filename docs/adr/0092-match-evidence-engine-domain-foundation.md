# ADR-0092: Match Evidence Engine Domain Foundation

## Status

Accepted

## Context

The Match Evidence Engine programme replaces the manual Development observations workflow with a versioned, explainable evidence model for player attributes, opponent ratings, position progression, and assessment history.

Phase 0 audit identified:
- 12 mutable numeric player attributes with no evidence trail or audit history
- `PlayerDevelopmentObservation` uses free-form ATTRIBUTE/POSITION + POSITIVE/NEGATIVE vocabulary
- `MatchExecutionFeedback` uses 5 categories that partially overlap with the new vocabulary
- 6 parallel/duplicate calculation paths for player ratings and opponent sporting level
- No assessment change history, cutover mechanism, or manual rebase semantics
- No versioned mapping between observations and attribute targets

Programme principle: "Shared domain meaning has one owner" (DECISIONS.md §45). The current codebase violates this with duplicate rating calculations in `player-metrics.ts`, export routes, opponent sporting level recording, and event eligibility.

## Decision

Establish the domain foundation for the Match Evidence Engine:

### 1. Stable observation vocabulary

14 observation codes with positive/negative polarity and football-safe labels. The vocabulary is defined once in `src/lib/evidence/observation-vocabulary.ts` and must not be duplicated.

Codes: SECURE_ON_BALL, FIRST_TOUCH_EFFECTIVE, PASSING_EFFECTIVE, PLAYS_THROUGH_PRESSURE, ONE_V_ONE_ATTACKING_EFFECTIVE, POSITIONING_EFFECTIVE, ONE_V_ONE_DEFENDING_EFFECTIVE, DECISION_MAKING_EFFECTIVE, WORK_RATE_EFFECTIVE, TEAM_COMBINATION_EFFECTIVE, CONCENTRATION_EFFECTIVE, PACE_EFFECTIVE, PHYSICAL_DUELS_EFFECTIVE, GOALKEEPING_EFFECTIVE.

### 2. Versioned attribute mapping registry

Each observation code maps to DIRECT and SUPPORTING attribute targets. The mapping is versioned (`MAPPING_VERSION`) and stored in `src/lib/evidence/observation-mapping.ts`. A coverage assertion test proves every mutable numeric player attribute has at least one DIRECT observation source.

GOALKEEPING_EFFECTIVE maps to goalkeeper capability (3-value enum), not a numeric attribute. Assessment changes for goalkeeper capability use `targetType: "GOALKEEPER"`.

### 3. Evidence provenance and accumulator

Evidence carries full provenance: source type, observation code, match, player, target attribute, evidence class, polarity, weight, confidence, engine version, mapping version, timestamps. The accumulator separates DIRECT/SUPPORTING evidence and applies polarity weighting.

### 4. Assessment change history

New `AssessmentChange` model records every attribute value change: before/after values, source (AUTOMATIC/MANUAL_EDIT/MIGRATION/REBASE), reason, evidence references, engine version, mapping version, confidence. This provides the "Why did this change?" answer required by DECISIONS.md §33-37.

### 5. Explicit player evidence cutover

New `Player.evidenceCutoverAt` field. Evidence before the cutover date cannot mutate player attributes. The cutover is set per-player when evidence processing is enabled.

### 6. Manual rebase semantics

When a coach manually edits a player attribute, a `MANUAL_EDIT` AssessmentChange is recorded and the `evidenceCutoverAt` is updated. Pre-rebase evidence is marked as consumed and cannot immediately reverse the manual change.

### 7. Engine and mapping versioning

All assessment proposals carry `EVIDENCE_ENGINE_VERSION` and `MAPPING_VERSION`. Future engine versions must support comparison against current accepted behaviour before activation.

### 8. Parallel calculation consolidation

The following parallel calculation paths will be consolidated to canonical owners:
- `src/lib/player-metrics.ts` → consolidate into `src/lib/ratings/player-rating.ts`
- `src/app/(app)/events/[eventId]/export/route.ts` local `computeOverallLevel()` → use `getPlayerOverallRating()`
- `src/lib/opponents/sporting-level-recording.ts` inline average → use `getPlayerOverallRating()`
- `src/lib/opponent/opponent-estimate.ts` → consolidate into canonical `sporting-level-*.ts`
- `src/lib/events/event-lineup-assignment.ts` local `mapPositionCodeToBroad()` → use canonical `mapAnyPositionToBroad()`
- `src/lib/events/event-match-eligibility.ts` inline average → use `getPlayerOverallRating()`

Consolidation happens in Phase 1 (imports fixed) with dead code removal in Phase 7.

### 9. Opponent numeric rating

The `OpponentSportingEvidence.estimate` field already uses `Decimal(4,2)`. The `OpponentEncounterObservation.sportingLevel` legacy `Decimal(3,1)` (1-5 scale) is deprecated and will be migrated in Phase 4. Display uses one decimal.

## Consequences

- Player attribute changes become auditable with full provenance
- Observation vocabulary is stable and football-safe
- Full attribute coverage is verified by executable tests
- Duplicate rating calculations are consolidated to single owners
- Assessment change history enables "Why did this change?" coach-facing diagnostics
- Evidence cutover prevents pre-enabling historical data from mutating player profiles
- Manual rebase prevents evidence from immediately reversing a coach's explicit edit
- Phase 7 will remove the old `PlayerDevelopmentObservation` UI and `player-metrics.ts` duplicate

## Migration

- `AssessmentChange` model: new table with indexes on player, target, source, and organisation
- `Player.evidenceCutoverAt`: nullable timestamp, no default (null = cutover not yet set)
- Existing `PlayerDevelopmentObservation` data is preserved; UI removal happens in Phase 3

## Follow-up

- Phase 2: Live lineup state (composite transitions, position intervals)
- Phase 3: Human after-match feedback (remove Development observations UI)
- Phase 4: Opponent engine and historical replay — expanded and completed by ADR-0104
  (Canonical Post-Match Learning Pipeline), which also extends the opponent engine, player
  evidence, and combination evidence to Event matches (not only historical replay of League
  matches, as originally scoped here)
- Phase 5: Forward-only player evidence
- Phase 6: Assessment history UI
- Phase 7: Hardening and cleanup (remove dead code, parallel calculations)