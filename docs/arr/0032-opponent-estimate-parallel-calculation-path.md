# ARR-0032: Opponent estimate parallel calculation path

## State

Identified

## Identified

2026-08-26

## Residue

The opponent estimate module (`src/lib/opponent/opponent-estimate.ts`) provides a legacy weighted-average calculation for opponent sporting levels (`calculateWeightedLevel`, `calculateConfidence`, `buildOpponentEstimate`). The opponent engine (`src/lib/evidence/opponent-engine.ts`) and aggregation module (`src/lib/opponents/sporting-level-aggregation.ts`) provide the canonical calculation path with engine versioning, data quality tiers, and significance-weighted blending.

Both paths coexist and `sporting-level-query.ts` uses both: it calls `aggregateSportingLevel()` from the new path for the estimate value, but also calls `buildOpponentEstimate()` from the legacy path for the `OpponentSportingEstimate` type shape and `historicalContext` field. The `opponent-context.ts` module uses types from `opponent-estimate.ts` but is not imported anywhere in production code.

The types `OpponentSportingEstimate`, `OpponentEncounterAssessment`, and constants `DEFAULT_CHALLENGE_MARGIN`, `MAX_SPORTING_LEVEL` are shared between the two paths. The legacy module's calculation logic (`calculateWeightedLevel`) diverges from the engine's significance-weighted blending.

## Intended architecture

One owning implementation for opponent sporting level calculation. The opponent engine (`opponent-engine.ts`) and aggregation (`sporting-level-aggregation.ts`) are the canonical path. Types and constants should live in a single location. The legacy weighted-average calculation should be removed once `sporting-level-query.ts` and the UI are migrated to use the engine/aggregation output directly.

## Evidence

- `src/lib/opponent/opponent-estimate.ts` — legacy calculation, types, and constants
- `src/lib/opponents/sporting-level-query.ts` — hybrid, uses both old and new paths
- `src/lib/opponent/opponent-context.ts` — uses legacy types, zero production importers
- `src/lib/evidence/opponent-engine.ts` — canonical calculation with versioning
- `src/lib/opponents/sporting-level-aggregation.ts` — canonical aggregation

## Impact

- Diverging calculations may produce different estimates for the same data.
- Types and constants duplicated across two modules.
- `opponent-context.ts` has zero production callers but is still maintained.
- New developers may be confused about which module to use.

## Containment

- Do not add new callers to `opponent-estimate.ts` calculation functions.
- Do not add new callers to `opponent-context.ts`.
- New opponent-related code must use `opponent-engine.ts` and `sporting-level-aggregation.ts`.
- The `OpponentSportingEstimate` type should gradually migrate to the engine's output type.

## Resolution criteria

- `opponent-estimate.ts` calculation functions (`calculateWeightedLevel`, `calculateConfidence`, `buildOpponentEstimate`) are removed.
- `opponent-context.ts` is either removed or migrated to use the canonical engine.
- `sporting-level-query.ts` uses only the canonical engine/aggregation path.
- Shared types and constants are in a single location.
- All opponent-related tests pass with the migrated code.

## Disposition

Pending. Migration deferred until Phase 7 cleanup is prioritised. The current parallel path is contained and functional.

## Related decisions

- ADR-0092: Match Evidence Engine domain foundation

## Related implementation

- `src/lib/opponent/opponent-estimate.ts`
- `src/lib/opponents/sporting-level-query.ts`
- `src/lib/opponent/opponent-context.ts`
- `src/lib/opponent/__tests__/opponent-estimate.test.ts`

## Supersedes

None.

## Superseded by

None.

## History

### 2026-08-26

Record created. Parallel path identified during Match Evidence Engine Phase 7 audit. Containment rules established. Migration deferred.