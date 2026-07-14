# Selection Rule Migration Inventory

This document catalogs every selection rule found in the Matchboard codebase and classifies each rule's target layer after the policy migration (ADR 0015, 0016, 0017, 0018).

## Classification layers

| Layer | Description | Owner |
|-------|-------------|-------|
| `CORE_INVARIANT` | Non-overridable safety rules enforced in TypeScript. Cannot be bypassed by custom policies. | `core-invariants.ts` |
| `DEFAULT_TYPESCRIPT_POLICY` | Standard eligibility, warnings, score adjustments, and explanations that run for all instances. Can be made stricter by custom policies. | `default-matchboard-policy.ts` |
| `REGO_POLICY` | Optional custom Rego/Wasm policies that add stricter rules, warnings, scoring adjustments, or explanations. Cannot override core invariants. | `policies/rego/` |
| `SOLVER_LOGIC` | Deterministic squad generation, balancing, position coverage, fairness distribution, and conflict resolution. Not a policy concern. | `generate-selection.ts`, `generate-round.ts`, `resolve-round-support.ts`, etc. |
| `ASSISTANT_LOGIC` | Work item derivation from live database state. Not a policy concern. | `get-assistant-command-centre.ts` |
| `REPORTING_LOGIC` | Plan integrity signal computation, canonical signal derivation, and signal-to-UI mapping. Not a policy concern. | `compute-plan-integrity.ts`, `signal-category.ts` |
| `SNAPSHOT_LOGIC` | Finalization, unfinalization, and historical snapshot integrity. Not a policy concern. | `finalize-match-round.ts`, `unfinalize-match-round.ts` |
| `OBSOLETE` | Rule removed or superseded during migration. | — |
| `FOLLOW_UP` | Rule documented in AGENTS.md or feature file but not yet implemented. Needs a future task. | — |

## Core invariants (CORE_INVARIANT)

| # | Rule | Source | Current status | Target layer | Implementation file | Test coverage | Notes |
|---|------|--------|----------------|---------------|---------------------|---------------|-------|
| C1 | Removed players cannot be selected for active planning | `core-invariants.ts`, AGENTS.md | Implemented in code | `CORE_INVARIANT` | `src/lib/policies/core-invariants.ts` | Yes | `removed_player_cannot_be_selected` |
| C2 | Inactive players cannot be selected | `core-invariants.ts`, AGENTS.md | Implemented in code | `CORE_INVARIANT` | `src/lib/policies/core-invariants.ts` | Yes | `inactive_player_cannot_be_selected` |
| C3 | Unavailable/declined players cannot be selected for specific match/date | `core-invariants.ts`, AGENTS.md, `generate-selection.ts` | Implemented in code | `CORE_INVARIANT` | `src/lib/policies/core-invariants.ts` | Yes | `unavailable_player_cannot_be_selected`. Also enforced per-match in generate-selection with context-specific reason. |
| C4 | Player cannot appear twice in same lineup | `core-invariants.ts`, AGENTS.md | Implemented in code | `CORE_INVARIANT` | `src/lib/policies/core-invariants.ts` | Yes | `duplicate_player_in_squad` |
| C5 | Player cannot be assigned to overlapping event matches | `event-match-time.ts`, `event-match-support.ts`, AGENTS.md | Implemented in code | `CORE_INVARIANT` | `src/lib/events/event-match-time.ts` | Yes | Overlap check via `eventMatchWindowsOverlap()`. Same-round conflict in league is a solver-level invariant (see S12). |
| C6 | Helper cannot be selected if own squad has overlapping match | `event-match-time.ts`, AGENTS.md | Implemented in code | `CORE_INVARIANT` | `src/lib/events/event-match-time.ts` | Yes | `isPlayerAvailableForSupport()` returns `{ available: false, reason: 'Own squad has overlapping match' }` |
| C7 | Lineup starter count cannot exceed tactic/game format slots | AGENTS.md (event rules) | Implemented in code | `CORE_INVARIANT` | `src/lib/formations/validate.ts` | Yes | Formation validation |
| C8 | Future matches cannot request post-match report | `match-date-utils.ts`, AGENTS.md | Implemented in code | `CORE_INVARIANT` | `src/lib/match-date-utils.ts` | Yes | `hasMatchPassed()` / `hasLeagueMatchPassed()` |
| C9 | Undated matches cannot request post-match report | `match-date-utils.ts`, AGENTS.md | Implemented in code | `CORE_INVARIANT` | `src/lib/match-date-utils.ts` | Yes | `!match.startsAt` returns false |
| C10 | Historical snapshots cannot be mutated by current roster changes | AGENTS.md (canonical data truth) | Implemented in code | `CORE_INVARIANT` | `src/lib/selection/finalize-match-round.ts`, `src/lib/selection/unfinalize-match-round.ts` | Partial | Finalization flips isDraft; unfinalization reverts. No silent mutation of finalized selections. |
| C11 | Historical participation cannot be deleted by player lifecycle change | AGENTS.md (canonical data truth) | Implemented in code | `CORE_INVARIANT` | Post-match report models | Partial | Actual participation is separate from planned selection. |
| C12 | One planned assignment per player per round (no planned double load) | `resolve-round-conflicts.ts`, `validate-generated-round-invariants.ts`, AGENTS.md | Implemented in code | `CORE_INVARIANT` | `src/lib/selection/resolve-round-conflicts.ts`, `src/lib/selection/validate-generated-round-invariants.ts` | Yes | `player_in_multiple_matches` and `invariant_duplicate_player_in_match` |
| C13 | Cancelled match cannot be finalized or included in planning | `generate-round.ts` (excludes cancelled matches), AGENTS.md | Implemented in code | `CORE_INVARIANT` | `src/lib/selection/generate-round.ts` | Partial | Cancelled matches filtered from generation and plan integrity |

## Default policy rules (DEFAULT_TYPESCRIPT_POLICY)

| # | Rule | Source | Current status | Target layer | Implementation file | Test coverage | Notes |
|---|------|--------|----------------|---------------|---------------------|---------------|-------|
| D1 | Warn on no goalkeeper coverage | `default-matchboard-policy.ts` | Implemented in code | `DEFAULT_TYPESCRIPT_POLICY` | `src/lib/policies/default-matchboard-policy.ts` | Yes | `no_goalkeeper_coverage` (blocking severity) |
| D2 | Warn on tertiary-only goalkeeper coverage | `default-matchboard-policy.ts` | Implemented in code | `DEFAULT_TYPESCRIPT_POLICY` | `src/lib/policies/default-matchboard-policy.ts` | Yes | `no_primary_goalkeeper_tertiary_only` (warning severity) |
| D3 | Warn on squad below minimum | `default-matchboard-policy.ts` | Implemented in code | `DEFAULT_TYPESCRIPT_POLICY` | `src/lib/policies/default-matchboard-policy.ts` | Yes | `squad_below_minimum` (blocking severity) |
| D4 | Explain eligible active available players | `default-matchboard-policy.ts` | Implemented in code | `DEFAULT_TYPESCRIPT_POLICY` | `src/lib/policies/default-matchboard-policy.ts` | Yes | `eligible_active_available` |
| D5 | Increase priority for low recent match count | `default-matchboard-policy.ts` | Implemented in code | `DEFAULT_TYPESCRIPT_POLICY` | `src/lib/policies/default-matchboard-policy.ts` | Yes | `low_recent_match_count` (+5 delta) |
| D6 | Increase priority for low period match count | `default-matchboard-policy.ts` | Implemented in code | `DEFAULT_TYPESCRIPT_POLICY` | `src/lib/policies/default-matchboard-policy.ts` | Yes | `low_period_match_count` (+3 delta) |
| D7 | Increase priority for low season match count | `default-matchboard-policy.ts` | Implemented in code | `DEFAULT_TYPESCRIPT_POLICY` | `src/lib/policies/default-matchboard-policy.ts` | Yes | `low_season_match_count` (+2 delta) |
| D8 | Info note on cancelled match | `default-matchboard-policy.ts` | Implemented in code | `DEFAULT_TYPESCRIPT_POLICY` | `src/lib/policies/default-matchboard-policy.ts` | Yes | `match_cancelled` (info severity) |

## Solver logic rules (SOLVER_LOGIC)

These rules are deterministic generation/solver logic, not policy concerns. They stay in their current files.

| # | Rule | Source | Current status | Target layer | Implementation file | Test coverage | Notes |
|---|------|--------|----------------|---------------|---------------------|---------------|-------|
| S1 | Core selection fills minCorePlayers before rotation | `generate-selection.ts` | Implemented in code | `SOLVER_LOGIC` | `src/lib/selection/generate-selection.ts` | Yes | deferRotation mode fills only core; rotation fills support then development then remaining core |
| S2 | Support slots filled before development slots | `generate-selection.ts`, AGENTS.md | Implemented in code | `SOLVER_LOGIC` | `src/lib/selection/generate-selection.ts` | Yes | Team support is priority 1 |
| S3 | Rotation path role matching (SUPPORT path → SUPPORT movement, etc.) | `rotation-path-policy.ts`, AGENTS.md | Implemented in code | `SOLVER_LOGIC` | `src/lib/selection/rotation-path-policy.ts` | Yes | `pathRoleMatchesCategory()` includes BACKFILL→SUPPORT and CONFIDENCE_REBUILD→DEVELOPMENT compatibility |
| S4 | Non-rotatable players blocked from automatic non-core movement | `selection-eligibility.ts`, `rotation-path-policy.ts`, AGENTS.md | Implemented in code | `SOLVER_LOGIC` | `src/lib/selection/rotation-path-policy.ts` | Yes | `canMoveForRole()` returns invalid if `nonRotatable` |
| S5 | Development readiness gate (not_ready blocks automatic development) | `selection-eligibility.ts` | Implemented in code | `SOLVER_LOGIC` | `src/lib/selection/selection-eligibility.ts` | Yes | `isDevelopmentBlocked()` |
| S6 | Support suitability scoring (strong → +15, avoid → -25) | `selection-eligibility.ts` | Implemented in code | `SOLVER_LOGIC` | `src/lib/selection/selection-eligibility.ts` | Yes | `getSuitabilityAndReadinessScore()` |
| S7 | Path cooldown blocks consecutive movement on same path | `selection-eligibility.ts` | Implemented in code | `SOLVER_LOGIC` | `src/lib/selection/selection-eligibility.ts` | Yes | `checkPathCooldown()` |
| S8 | Consecutive support rotation penalty (-6 per consecutive round beyond first) | `get-consecutive-support-count.ts`, AGENTS.md | Implemented in code | `SOLVER_LOGIC` | `src/lib/selection/get-consecutive-support-count.ts` | Yes | Applied in ranking via `getRankedRotationCandidates()` |
| S9 | League season fairness bonus/penalty | `selection-fairness.ts` | Implemented in code | `SOLVER_LOGIC` | `src/lib/selection/selection-fairness.ts` | Yes | `getLeagueSeasonFairnessBonus()` — support without core = -8, more support than core = -6, per-support = -2, per-development = -2, per-core = -1 |
| S10 | Readiness scoring modifier | `readiness-scoring.ts` | Implemented in code | `SOLVER_LOGIC` | `src/lib/selection/readiness-scoring.ts` | Partial | Applied in rotation candidate ranking |
| S11 | Movement candidate scoring bonus (+12 for active candidates) | `generate-selection.ts`, AGENTS.md | Implemented in code | `SOLVER_LOGIC` | `src/lib/selection/generate-selection.ts` | Partial | `isMovementCandidateForRole()` checks |
| S12 | Same-round conflict resolution (player assigned to only one match per round) | `resolve-round-conflicts.ts` | Implemented in code | `SOLVER_LOGIC` | `src/lib/selection/resolve-round-conflicts.ts` | Yes | SUPPORT > DEVELOPMENT > BACKFILL > CONFIDENCE_REBUILD > CORE priority |
| S13 | Round-level support resolution (support priority ordering) | `resolve-round-support.ts`, AGENTS.md | Implemented in code | `SOLVER_LOGIC` | `src/lib/selection/resolve-round-support.ts` | Yes | Teams sorted by `supportPriority ASC` |
| S14 | Squad repair priority: own core player → path player → any other path player | `resolve-round-support.ts`, AGENTS.md | Implemented in code | `SOLVER_LOGIC` | `src/lib/selection/resolve-round-support.ts` | Yes | `resolveSquadRepair()` priority 1/2/3 |
| S15 | Self-squad-repair: re-include own core players dropped by support movement | `generate-round.ts`, AGENTS.md | Implemented in code | `SOLVER_LOGIC` | `src/lib/selection/generate-round.ts` | Yes | `selfSquadRepairBelowTarget()` |
| S16 | Core match drop routing (surplus core → development elsewhere) | `route-core-match-drops.ts`, `generate-round.ts` | Implemented in code | `SOLVER_LOGIC` | `src/lib/selection/route-core-match-drops.ts` | Partial | Phase 4 of round pipeline |
| S17 | Position-based candidate scoring and ranking | `rotation-candidate-ranking.ts` | Implemented in code | `SOLVER_LOGIC` | `src/lib/selection/rotation-candidate-ranking.ts` | Partial | `getRankedRotationCandidates()` |
| S18 | Target/min/max squad size enforcement | `generate-selection.ts`, `resolve-round-support.ts` | Implemented in code | `SOLVER_LOGIC` | `src/lib/selection/generate-selection.ts` | Yes | Hard ceiling on maxSquadSize; target and min as planning targets |
| S19 | Unknown availability exclusion with support-path warning | `generate-selection.ts` | Implemented in code | `SOLVER_LOGIC` | `src/lib/selection/generate-selection.ts` | Yes | UNKNOWN availability blocks selection but warns if on support path |
| S20 | Tentative availability warning | `generate-selection.ts` | Implemented in code | `SOLVER_LOGIC` | `src/lib/selection/generate-selection.ts` | Partial | `tentative_availability` |
| S21 | Player locked out exclusion | `generate-selection.ts` | Implemented in code | `SOLVER_LOGIC` | `src/lib/selection/generate-selection.ts` | Partial | `player_locked_out` |
| S22 | Position mismatch warning during rotation selection | `generate-selection.ts` | Implemented in code | `SOLVER_LOGIC` | `src/lib/selection/generate-selection.ts` | Partial | `position_mismatch`, `position_secondary_match`, `position_tertiary_match` |
| S23 | Support avoid suitability warning | `generate-selection.ts` | Implemented in code | `SOLVER_LOGIC` | `src/lib/selection/generate-selection.ts` | Partial | `support_avoid_suitability` |
| S24 | Support no-show history warning | `generate-selection.ts` | Implemented in code | `SOLVER_LOGIC` | `src/lib/selection/generate-selection.ts` | Partial | `support_no_show_history` |
| S25 | Core player overflow warning (eligible core exceeds core limit) | `generate-selection.ts` | Implemented in code | `SOLVER_LOGIC` | `src/lib/selection/generate-selection.ts` | Yes | `core_player_overflow` |
| S26 | Support shortfall warnings | `generate-selection.ts`, `resolve-round-support.ts` | Implemented in code | `SOLVER_LOGIC` | `src/lib/selection/generate-selection.ts`, `src/lib/selection/resolve-round-support.ts` | Yes | `support_shortfall_after_resolution`, `support_below_target` |
| S27 | Squad repair shortfall warnings | `resolve-round-support.ts` | Implemented in code | `SOLVER_LOGIC` | `src/lib/selection/resolve-round-support.ts` | Yes | `squad_repair_shortfall_after_resolution` (HARD_BLOCK), `squad_repair_below_target` (WARNING), `squad_repair_no_path_available` |
| S28 | Support backfill priority note | `generate-selection.ts` | Implemented in code | `SOLVER_LOGIC` | `src/lib/selection/generate-selection.ts` | Partial | `support_backfill_priority` (SCORING_PREFERENCE) |
| S29 | Higher-priority opportunity detection (support/development takes core player) | `rotation-candidate-evaluation.ts`, `generate-selection.ts` | Implemented in code | `SOLVER_LOGIC` | `src/lib/selection/rotation-candidate-evaluation.ts` | Partial | `findHigherPriorityOpportunity()` |
| S30 | Same-week missed core match priority for rotation | `rotation-candidate-evaluation.ts` | Implemented in code | `SOLVER_LOGIC` | `src/lib/selection/rotation-candidate-evaluation.ts` | Partial | `findMissedCoreMatchThisWeek()` |
| S31 | Registered match conflict detection | `rotation-candidate-evaluation.ts` | Implemented in code | `SOLVER_LOGIC` | `src/lib/selection/rotation-candidate-evaluation.ts` | Partial | `buildRegisteredMatchConflict()` |
| S32 | Repeat rotation block (same role in consecutive round) | `rotation-candidate-evaluation.ts` | Implemented in code | `SOLVER_LOGIC` | `src/lib/selection/rotation-candidate-evaluation.ts` | Partial | `getRepeatRotationBlockCode()` |
| S33 | Reduced match load drop rule | `generate-selection.ts` | Implemented in code | `SOLVER_LOGIC` | `src/lib/selection/generate-selection.ts` | Partial | Players marked `reducedMatchLoadAllowed` get priority for core-match drops |
| S34 | Event squad balanced generation | `event-squad-generation.ts`, AGENTS.md | Implemented in code | `SOLVER_LOGIC` | `src/lib/events/event-squad-generation.ts` | Yes | ALL_BALANCED mode |
| S35 | Event squad competitive + balanced remainder generation | `event-squad-generation.ts`, AGENTS.md | Implemented in code | `SOLVER_LOGIC` | `src/lib/events/event-squad-generation.ts` | Yes | ONE_COMPETITIVE_BALANCED_REMAINDER mode |
| S36 | Event squad manual seed + auto-balance | `event-squad-generation.ts`, AGENTS.md | Implemented in code | `SOLVER_LOGIC` | `src/lib/events/event-squad-generation.ts` | Partial | MANUAL_SEED_AUTO_BALANCE mode |
| S37 | Event position/formation slot assignment | `event-squad-generation.ts`, AGENTS.md | Implemented in code | `SOLVER_LOGIC` | `src/lib/events/event-squad-generation.ts` | Yes | Fills formation slots first, then optimizes |
| S38 | Event starter/substitute split | `event-squad-generation.ts` | Implemented in code | `SOLVER_LOGIC` | `src/lib/events/event-squad-generation.ts` | Partial | Based on formation slot requirements |
| S39 | Event match support overlap detection | `event-match-time.ts`, `event-match-support.ts` | Implemented in code | `SOLVER_LOGIC` | `src/lib/events/event-match-time.ts`, `src/lib/events/event-match-support.ts` | Yes | Time window overlap check |
| S40 | Event match support: duplicate assignment rejection | `event-match-support.ts` | Implemented in code | `SOLVER_LOGIC` | `src/lib/events/event-match-support.ts` | Yes | Same player, same match check |
| S41 | Event match support: player removed from source squad conflict | `event-match-support.ts` | Implemented in code | `SOLVER_LOGIC` | `src/lib/events/event-match-support.ts` | Yes | `isPlayerAvailableForSupport()` |
| S42 | Event pool validation (player count, GK coverage, position coverage, ratings) | `event-validation.ts`, AGENTS.md | Implemented in code | `SOLVER_LOGIC` | `src/lib/events/event-validation.ts` | Yes | `validateEventPool()` |

## Reporting logic rules (REPORTING_LOGIC)

These rules derive plan integrity signals from current draft state. They are read-only computations, not generation logic.

| # | Rule | Source | Current status | Target layer | Implementation file | Test coverage | Notes |
|---|------|--------|----------------|---------------|---------------------|---------------|-------|
| R1 | Squad below minimum → Blocked condition | `compute-plan-integrity.ts`, AGENTS.md | Implemented in code | `REPORTING_LOGIC` | `src/lib/selection/compute-plan-integrity.ts` | Yes | `SQUAD_BELOW_MINIMUM` |
| R2 | Selected unavailable player → Blocked condition | `compute-plan-integrity.ts`, AGENTS.md | Implemented in code | `REPORTING_LOGIC` | `src/lib/selection/compute-plan-integrity.ts` | Yes | `SELECTED_PLAYER_UNAVAILABLE` |
| R3 | Duplicate planned assignment → Blocked condition | `compute-plan-integrity.ts`, AGENTS.md | Implemented in code | `REPORTING_LOGIC` | `src/lib/selection/compute-plan-integrity.ts` | Yes | `DUPLICATE_PLANNED_ASSIGNMENT_INTEGRITY_FAILURE` |
| R4 | Available eligible player without planned opportunity → Decision required | `compute-plan-integrity.ts`, AGENTS.md | Implemented in code | `REPORTING_LOGIC` | `src/lib/selection/compute-plan-integrity.ts` | Yes | `AVAILABLE_PLAYER_WITHOUT_PLANNED_OPPORTUNITY` |
| R5 | Below target but above minimum → Planning note | `compute-plan-integrity.ts`, AGENTS.md | Implemented in code | `REPORTING_LOGIC` | `src/lib/selection/compute-plan-integrity.ts` | Yes | `BELOW_TARGET_BUT_PLAYABLE` |
| R6 | Preferred support not met → Planning note | `signal-category.ts`, AGENTS.md | Implemented in code | `REPORTING_LOGIC` | `src/lib/selection/signal-category.ts` | Yes | `PREFERRED_SUPPORT_NOT_MET` |
| R7 | Squad repair below preferred target → Planning note | `signal-category.ts`, AGENTS.md | Implemented in code | `REPORTING_LOGIC` | `src/lib/selection/signal-category.ts` | Yes | `SQUAD_REPAIR_BELOW_PREFERRED_TARGET` |
| R8 | Fallback position used → Planning note | `signal-category.ts`, AGENTS.md | Documented only | `REPORTING_LOGIC` | — | No | Not yet generated; AGENTS.md lists it as a valid planning note code |
| R9 | Signal category mapping (code → severity/category) | `signal-category.ts` | Implemented in code | `REPORTING_LOGIC` | `src/lib/selection/signal-category.ts` | Yes | Maps warning codes to BLOCKED/DECISION_REQUIRED/PLANNING_NOTE |
| R10 | Policy-derived signals merged into canonical signals | `compute-plan-integrity.ts`, `policy-signal-mapper.ts` | Implemented in code | `REPORTING_LOGIC` | `src/lib/selection/compute-plan-integrity.ts`, `src/lib/policies/policy-signal-mapper.ts` | Yes | Policy BLOCKED → signal BLOCKED, policy blocking → BLOCKED, policy warning → DECISION_REQUIRED, policy info → PLANNING_NOTE |
| R11 | Repeated missed opportunity context on Decision required signals | `compute-plan-integrity.ts` | Implemented in code | `REPORTING_LOGIC` | `src/lib/selection/compute-plan-integrity.ts` | Partial | `repeatedContext` with `earlierMissedRoundCount` and `roundLabels` |

## Snapshot logic rules (SNAPSHOT_LOGIC)

| # | Rule | Source | Current status | Target layer | Implementation file | Test coverage | Notes |
|---|------|--------|----------------|---------------|---------------------|---------------|-------|
| N1 | Finalization flips Selection.status DRAFT → FINALIZED | `finalize-match-round.ts` | Implemented in code | `SNAPSHOT_LOGIC` | `src/lib/selection/finalize-match-round.ts` | Yes | Also sets ruleConfigVersion and overrideReason |
| N2 | Finalization flips MovementLedger.isDraft true → false | `finalize-match-round.ts` | Implemented in code | `SNAPSHOT_LOGIC` | `src/lib/selection/finalize-match-round.ts` | Yes | |
| N3 | Un-finalization reverts Selection.status FINALIZED → DRAFT | `unfinalize-match-round.ts`, `unfinalize-single-match.ts` | Implemented in code | `SNAPSHOT_LOGIC` | `src/lib/selection/unfinalize-match-round.ts`, `src/lib/selection/unfinalize-single-match.ts` | Yes | |
| N4 | Un-finalization clears ruleConfigVersion and overrideReason | `unfinalize-match-round.ts` | Implemented in code | `SNAPSHOT_LOGIC` | `src/lib/selection/unfinalize-match-round.ts` | Yes | |
| N5 | Un-finalization reverts MovementLedger.isDraft false → true | `unfinalize-match-round.ts` | Implemented in code | `SNAPSHOT_LOGIC` | `src/lib/selection/unfinalize-match-round.ts` | Yes | |
| N6 | Per-match finalization locks DRAFT selections for one match | `finalize-single-match.ts`, AGENTS.md | Implemented in code | `SNAPSHOT_LOGIC` | `src/lib/selection/finalize-single-match.ts` | Yes | |
| N7 | Per-match unfinalization reverts single match selections to DRAFT | `unfinalize-single-match.ts`, AGENTS.md | Implemented in code | `SNAPSHOT_LOGIC` | `src/lib/selection/unfinalize-single-match.ts` | Yes | |
| N8 | Missing movement ledger entry creates warning during finalization | `finalize-match-round.ts` | Implemented in code | `SNAPSHOT_LOGIC` | `src/lib/selection/finalize-match-round.ts` | Partial | `missing_movement_ledger` warning |
| N9 | Override reason required for hard blocks and decision-required conditions | `finalize-match-round.ts`, AGENTS.md | Implemented in code | `SNAPSHOT_LOGIC` | `src/lib/selection/finalize-match-round.ts` | Yes | `overrideReasonCategory` + `overrideReasonDetail` |
| N10 | Rule config version stamping during finalization | `finalize-match-round.ts` | Implemented in code | `SNAPSHOT_LOGIC` | `src/lib/selection/finalize-match-round.ts` | Partial | `ruleConfigVersion` |

## Rules documented but not yet fully implemented (FOLLOW_UP)

| # | Rule | Source | Current status | Target layer | Implementation file | Test coverage | Notes |
|---|------|--------|----------------|---------------|---------------------|---------------|-------|
| F1 | Warn when generated event squads are heavily imbalanced | AGENTS.md | Documented only | `DEFAULT_TYPESCRIPT_POLICY` | — | No | Event generation produces planning notes for imbalance, but no default policy warning yet |
| F2 | Warn when selected event pool is too small | AGENTS.md | Documented only | `DEFAULT_TYPESCRIPT_POLICY` | — | No | `validateEventPool()` warns but no policy-level warning |
| F3 | Warn when many event players lack ratings | AGENTS.md | Documented only | `DEFAULT_TYPESCRIPT_POLICY` | — | No | `validateEventPool()` produces notes but no policy adjustment |
| F4 | Fallback position used planning note | AGENTS.md, `signal-category.ts` | Code lists code but no generation | `REPORTING_LOGIC` | — | No | `FALLBACK_POSITION_USED` listed in signal category but not generated |
| F5 | Event lineup starter count cannot exceed formation slot count | AGENTS.md | Partially implemented | `CORE_INVARIANT` | `src/lib/formations/validate.ts` | Partial | Formation validation exists but not wired as invariant in policy pipeline |

## Removed in this stage (OBSOLETE)

These artifacts were removed or superseded as part of the policy migration.

| # | Artifact | Type | Notes |
|---|-----------|------|-------|
| O1 | `src/lib/policies/json-policy-dsl.ts` | Code | Removed. JSON DSL runtime evaluation engine. Functionality migrated to default TypeScript policy and Rego. |
| O2 | `src/lib/policies/json-policy-loader.ts` | Code | Removed. JSON policy pack loader and validator. |
| O3 | JSON policy DSL types (`PolicyPack`, `PolicyRule`, `PolicyConditionGroup`, etc.) | Code | Removed. Type definitions for JSON DSL rule format. |
| O4 | `JsonPolicyAdapter` class | Code | Removed from `selection-policy-adapter.ts` composite pipeline. Was the fourth layer in the pipeline (after Rego). |
| O5 | `policies/default/matchboard.default.policy.json` | Config | Removed. Default policy rules now in `default-matchboard-policy.ts`. |
| O6 | `policies/examples/stricter-goalkeeper-coverage.policy.json` | Config | Removed. Example JSON DSL policy superseded by Rego examples. |
| O7 | `policies/examples/equal-opportunity.policy.json` | Config | Removed. Example JSON DSL policy superseded by Rego examples. |
| O8 | JSON DSL test files | Tests | Removed. Tests for the JSON policy DSL runtime. |

## Summary

| Layer | Count | Description |
|-------|-------|-------------|
| `CORE_INVARIANT` | 13 | Non-overridable safety rules |
| `DEFAULT_TYPESCRIPT_POLICY` | 8 | Standard policy rules that always run |
| `REGO_POLICY` | 0 | No custom Rego policies yet (infrastructure in place) |
| `SOLVER_LOGIC` | 42 | Deterministic generation/solver rules |
| `REPORTING_LOGIC` | 11 | Plan integrity signal derivation |
| `SNAPSHOT_LOGIC` | 10 | Finalization/unfinalization rules |
| `OBSOLETE` | 8 | Removed JSON DSL artifacts |
| `FOLLOW_UP` | 5 | Documented but not yet fully implemented |
| **Total** | **97** | |