# ADR 0017: Policy Operationalization

## Status

Accepted

## Context

Stage 1 (ADR 0015) created the policy boundary: core invariants, default policy, and JSON DSL. Stage 2 (ADR 0016) added the OPA/Rego Wasm adapter. Stage 4 removed the JSON DSL (see ADR 0018). The policy pipeline is now wired into production flows: league match generation, plan integrity computation, event squad generation, event pool validation, and the assistant.

## Decision

Wire the policy pipeline into real application flows and add coach-facing visibility.

### Integration points

1. **League match generation** (`generate-round.ts`) — Phase 7 adds policy evaluation after pipeline validation. Policy warnings are appended to `roundWarnings`. Policy blocked players are surfaced as warnings. Generation always completes; policy is additive.

2. **Plan integrity computation** (`compute-plan-integrity.ts`) — After canonical signal computation (Phase 1-4), policy evaluation runs with `mode: "league"` and `phase: "post_selection"`. Policy-derived BLOCKED and DECISION_REQUIRED signals are merged into the canonical `PlanIntegritySignal[]`. Policy-derived PLANNING_NOTE signals are merged into `PlanningNote[]`. Policy evaluation failure is caught and does not block integrity computation.

3. **Event squad generation** (`actions.ts`) — Before calling `generateEventSquads()`, the server action evaluates policy with `mode: "event"` and `phase: "pre_selection"`. Blocked players are filtered from the eligible pool. Policy warnings are appended to the generation result warnings.

4. **Event pool validation** (`event-validation.ts`) — An exported `applyPolicyWarnings()` helper merges policy warnings into validation output. The caller evaluates policy and passes the result; `validateEventPool()` itself remains synchronous and policy-agnostic.

5. **Assistant** (`get-assistant-command-centre.ts`) — The assistant consumes `computeRoundPlanIntegrity()` which now includes policy-derived signals. No direct policy import is needed; policy signals flow through the existing integrity computation path.

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