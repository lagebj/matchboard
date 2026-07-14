# ADR 0017: Policy Operationalization

## Status

Accepted

## Context

Stage 1 (ADR 0015) created the policy boundary: core invariants, default policy, and JSON DSL. Stage 2 (ADR 0016) added the OPA/Rego Wasm adapter. The policy module exists but zero production code calls any policy function. The entire module is an island not wired into any flow.

Inline eligibility logic in `generate-selection.ts`, `compute-plan-integrity.ts`, `event-squad-generation.ts`, and `event-validation.ts` duplicates what the policy pipeline should provide. Policy warnings have no bridge to Matchboard's plan integrity signal model. There is no coach-facing visibility into policy results.

## Decision

Wire the policy pipeline into real application flows and add coach-facing visibility.

### Integration points

1. **League match generation** (`generate-round.ts`) — pre-filter blocked players, apply score adjustments, merge policy signals
2. **Plan integrity computation** (`compute-plan-integrity.ts`) — merge policy warnings into plan integrity signals
3. **Event squad generation** (`event-squad-generation.ts`) — filter blocked players, apply score adjustments
4. **Event pool validation** (`event-validation.ts`) — add policy warnings to validation notes
5. **Assistant** (`get-assistant-command-centre.ts`) — surface policy explanations in work items

### New files

| File | Purpose |
|------|---------|
| `src/lib/policies/policy-evaluation.ts` | `evaluateSelectionPolicy()`, `filterBlockedPlayerIds()`, `applyScoreAdjustments()`, coach-facing reason formatters |
| `src/lib/policies/policy-signal-mapper.ts` | `policyBlockedToSignals()`, `policyWarningsToSignals()`, `mergePolicySignals()` — bridge policy results to plan integrity signals |
| `src/lib/policies/policy-version.ts` | `getPolicyArtifactHash()`, `getPolicyVersion()` — audit and diagnostics |
| `src/lib/policies/policy-decision-log.ts` | `buildDecisionSummary()` — structured audit summary |
| `src/app/api/admin/policy/route.ts` | Admin diagnostics endpoint |

### Signal mapping

Policy warnings map to Matchboard's plan integrity signal model:

- `severity: "blocking"` → Blocked condition (`BLOCKED`)
- `severity: "warning"` → Decision required (`DECISION_REQUIRED`)
- `severity: "info"` → Planning note (`PLANNING_NOTE`)

Policy blocked entries always produce `BLOCKED` signals.

### Coach-facing language

All policy output visible to coaches follows Matchboard's child-safe language rules. Raw Rego internals, policy codes, and internal severity levels do not appear in coach-facing UI. Coach-facing formatters in `policy-evaluation.ts` translate internal codes to neutral, observable-behavior language.

## Consequences

### Positive

- Policy pipeline now affects real selection flows instead of being an isolated module
- Policy warnings flow into the existing plan integrity signal model
- Coaches can see policy-derived explanations without seeing internal codes
- Admin diagnostics provide visibility into policy runtime status
- Decision logging supports audit without storing personal data

### Negative

- Policy evaluation adds a step to generation pipelines (negligible performance impact)
- Signal merging must be careful not to duplicate existing signals
- Coach-facing formatters must be kept in sync with domain language rules

## Rejected alternatives

- **Duplicate all eligibility logic in policy**: Would create two sources of truth. Instead, policy augments existing engine logic without replacing it.
- **Replace existing warnings with policy signals**: Would break backward compatibility. Instead, policy signals merge with existing signals.
- **Store policy codes in coach-facing UI**: Would expose internal terminology. Instead, coach-facing formatters translate codes to neutral language.