# ADR 0018: Selection Rule Ownership After Policy Migration

## Status

Accepted

## Context

Stages 1–3 established the policy-capable selection engine (ADR 0015), the OPA/Rego Wasm adapter (ADR 0016), and operationalized the policy pipeline (ADR 0017). The JSON DSL runtime has been removed. Rules are now spread across core invariants, default TypeScript policy, Rego adapter infrastructure, solver logic, reporting logic, snapshot logic, and the assistant. There was no single document that mapped each rule to its owning layer.

Without explicit rule ownership, future changes risk:
- Duplicating rules across layers (solver and policy doing the same check)
- Putting policy concerns into solver code (making rules unconfigurable)
- Putting solver concerns into policy code (making deterministic generation unpredictable)
- Losing track of which rules are tested, documented, or still pending

## Decision

Each selection rule has exactly one owning layer. A rule must not be duplicated across layers. The layers and their ownership are:

### 1. CORE_INVARIANT — `src/lib/policies/core-invariants.ts`

Non-overridable safety rules that always run first and cannot be bypassed by any custom policy.

| Rule | Code |
|------|------|
| Removed players cannot be selected | `removed_player_cannot_be_selected` |
| Inactive players cannot be selected | `inactive_player_cannot_be_selected` |
| Unavailable players cannot be selected | `unavailable_player_cannot_be_selected` |
| Duplicate player in squad | `duplicate_player_in_squad` |

These four rules are the only selection rules that belong in core invariants. All other eligibility, warning, and scoring logic belongs in lower layers.

Additional invariants enforced outside the policy pipeline (in solver, validation, and helper code) are documented in the rule inventory but are not in `core-invariants.ts` because they require context the policy pipeline does not have (match dates, event overlap, formation slots, historical data). These include:
- Overlapping event match assignment checks
- Helper overlap checks
- Formation slot count limits
- Post-match report date restrictions
- Finalized snapshot immutability
- One planned assignment per player per round
- Cancelled match exclusion

### 2. DEFAULT_TYPESCRIPT_POLICY — `src/lib/policies/default-matchboard-policy.ts`

Standard eligibility, warning, score adjustment, and explanation rules that always run after core invariants. Custom Rego policies can make these stricter or add new rules but cannot override core invariants.

| Rule | Code | Type |
|------|------|------|
| No goalkeeper coverage | `no_goalkeeper_coverage` | Warning (blocking) |
| Tertiary-only goalkeeper coverage | `no_primary_goalkeeper_tertiary_only` | Warning |
| Squad below minimum | `squad_below_minimum` | Warning (blocking) |
| Eligible active available explanation | `eligible_active_available` | Explanation |
| Low recent match count priority | `low_recent_match_count` | Score adjustment (+5) |
| Low period match count priority | `low_period_match_count` | Score adjustment (+3) |
| Low season match count priority | `low_season_match_count` | Score adjustment (+2) |
| Cancelled match note | `match_cancelled` | Info |

New default policy rules should be added to `default-matchboard-policy.ts`, not embedded in solver code. When a solver file produces a warning that logically belongs in the default policy, it should be migrated.

### 3. REGO_POLICY — `policies/rego/`

Optional custom policies compiled to Wasm and evaluated server-side. Rego policies:
- May add blocked player reasons, warnings, score adjustments (bounded ±20), explanations, and tags
- May not override core invariants
- May not replace squad generation, lineup generation, or historical snapshots
- Are additive: results merge with core and default policy results

No custom Rego policies exist yet. The infrastructure is in place (`rego-policy-adapter.ts`, `createPolicyPipeline()`, build/test/dry-run scripts).

### 4. SOLVER_LOGIC — `src/lib/selection/`, `src/lib/events/`

Deterministic generation and solver rules that produce squad assignments, not policy decisions. These include:
- Squad generation algorithms (core selection, support resolution, development routing, squad repair, self-squad-repair, core-match-drop routing)
- Rotation path policy (role matching, cooldown, candidate scoring)
- Fairness scoring (consecutive support penalty, league season fairness)
- Conflict resolution (same-round player conflict, round-level priority)
- Position-based candidate ranking and scoring
- Event squad generation (balanced, competitive, manual-seed modes)
- Event match time overlap detection
- Readiness scoring modifier

Solver logic is never a substitute for policy rules. If a solver file produces a warning that is semantically a policy concern (e.g., "squad below minimum", "no goalkeeper coverage"), that rule should be migrated to the default policy layer over time. The solver should focus on producing assignments and explanations, not policy judgments.

### 5. REPORTING_LOGIC — `src/lib/selection/compute-plan-integrity.ts`, `src/lib/selection/signal-category.ts`

Plan integrity signal derivation from current draft state. These are read-only computations that categorize existing conditions:
- Blocked conditions (squad below minimum, selected player unavailable, duplicate assignment)
- Decision required conditions (available player without opportunity)
- Planning notes (below target but playable, preferred support not met, squad repair below preferred target, fallback position used)

Reporting logic also merges policy-derived signals into the canonical signal model. Policy evaluation failure must not block integrity computation.

### 6. SNAPSHOT_LOGIC — `src/lib/selection/finalize-match-round.ts`, `src/lib/selection/unfinalize-*.ts`

Finalization and unfinalization rules that lock/unlock selection state:
- DRAFT → FINALIZED status transition
- FINALIZED → DRAFT status reversion
- Rule config version stamping
- Override reason persistence
- Movement ledger draft flag transitions
- Per-match finalization and unfinalization

### 7. ASSISTANT_LOGIC — `src/lib/assistant/get-assistant-command-centre.ts`

Work item derivation from live database state. The assistant does not define rules — it reads signals produced by other layers and presents actionable work items. No selection rules belong in the assistant.

## Consequences

### Positive

- Every rule has exactly one owner, making it clear where to add, change, or remove rules
- Policy rules (eligibility, warnings, scoring) are separate from solver logic (generation, balancing)
- Custom Rego policies can make rules stricter without touching TypeScript code
- Core invariants are guaranteed non-overridable
- The rule inventory provides a single source of truth for test coverage gaps
- Future rule additions have a clear placement decision: safety rule → core invariant, policy concern → default policy, generation concern → solver, signal concern → reporting

### Negative

- The rule inventory requires maintenance when rules are added, changed, or removed
- Some solver code still produces policy-like warnings (e.g., `squad_repair_shortfall_after_resolution`, `support_avoid_suitability`) that ideally belong in the default policy layer — full migration is a follow-up task
- The distinction between "solver explanation" and "policy warning" can be subtle — explanations are always informational; warnings affect plan integrity signals

## Migration follow-ups

The following solver-produced warnings are candidates for migration to the default TypeScript policy layer over time:

| Current location | Warning code | Target |
|-------------------|-------------|--------|
| `generate-selection.ts` | `position_mismatch` | `default-matchboard-policy.ts` |
| `generate-selection.ts` | `support_avoid_suitability` | `default-matchboard-policy.ts` |
| `generate-selection.ts` | `support_no_show_history` | `default-matchboard-policy.ts` |
| `generate-selection.ts` | `tentative_availability` | `default-matchboard-policy.ts` |
| `generate-selection.ts` | `unknown_availability_support` | `default-matchboard-policy.ts` |
| `resolve-round-support.ts` | `squad_repair_shortfall_after_resolution` | `default-matchboard-policy.ts` |
| `resolve-round-support.ts` | `squad_repair_below_target` | `default-matchboard-policy.ts` |
| `resolve-round-support.ts` | `squad_repair_no_path_available` | `default-matchboard-policy.ts` |
| `resolve-round-support.ts` | `support_shortfall_after_resolution` | `default-matchboard-policy.ts` |
| `resolve-round-support.ts` | `support_below_target` | `default-matchboard-policy.ts` |

These remain in solver code for now because they require context (squad state, team configuration, match relationships) that the current `SelectionPolicyInput` does not carry. Migrating them requires extending the policy input schema and is a separate task.

## Rejected alternatives

- **Keeping the JSON DSL runtime**: The JSON DSL was a stepping stone (ADR 0015) that has been superseded by the Rego adapter (ADR 0016). Retaining two policy engines adds maintenance cost with no benefit. Rego is more capable, better tested, and has a clear build/test/deploy pipeline.

- **Moving the solver into Rego**: The solver owns deterministic squad generation, balancing, and position coverage. Expressing this in Rego would be over-engineered, hard to debug, and would violate the separation between "what is allowed" (policy) and "what to select" (solver).

- **Duplicating rules in assistant/UI**: The assistant derives work items from signals produced by other layers. It does not define new rules. UI components display engine output and record coach decisions. Duplicating rule logic in either would create divergent truth.

- **Putting all rules in the policy pipeline**: Rules that require rich context (match relationships, rotation path graphs, historical data) cannot be expressed through the current flat `SelectionPolicyInput`. Forcing them into the policy pipeline would bloat the input schema and make the pipeline fragile. Solver-embedded rules with rich context stay in the solver; their output (warnings, explanations) feeds into the signal model.

## Stage 5 addendum

Stage 5 added `PolicyDecisionType` and `PolicyFairnessScope` to the policy context (`SelectionPolicyInput.context`). The default TypeScript policy now branches by `context.mode` — league mode applies fairness score adjustments, event mode does not. Custom Rego policies should use `input.context.mode` and `input.context.decisionType` for conditional logic. Core invariants continue to apply in all modes. See ADR 0019 for full details on the generation-drafts and league-event policy context separation.