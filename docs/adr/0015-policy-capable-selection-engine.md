# ADR 0015: Policy-Capable Selection Engine

## Status

Accepted

## Context

Matchboard's selection engine has hardcoded eligibility rules, scoring adjustments, warning conditions, and explanations distributed across many files. Rules about who can be selected, what produces warnings, and how scores are adjusted are embedded directly in `generate-selection.ts`, `selection-eligibility.ts`, `selection-fairness.ts`, `readiness-scoring.ts`, `rotation-candidate-ranking.ts`, `compute-plan-integrity.ts`, `signal-category.ts`, and other files.

This makes it difficult to:
- Understand which rules apply where
- Adjust rules without changing engine code
- Explain why a particular decision was made
- Allow self-hosted instances to customize rules
- Guarantee that core safety invariants are never bypassed

## Decision

Separate deterministic squad/lineup solving from configurable policy evaluation.

### Architecture

```
Selection engine = deterministic Matchboard application solver
Policy layer    = configurable eligibility, constraints, warnings, scoring adjustments, and explanations
```

The app solver still owns squad generation, lineup generation, balancing, position coverage, fairness distribution, event helper selection, and deterministic output.

The policy layer decides what is allowed, blocked, warned, adjusted, and explained.

### Policy layers

1. **Core invariants** — non-overridable safety rules enforced in TypeScript (removed players cannot be selected, unavailable players are blocked, no duplicate lineup assignments, no overlapping helpers, etc.)
2. **Default Matchboard policy** — standard eligibility, warnings, score adjustments, and explanations that run for all instances
3. **Optional custom instance policy** — JSON DSL rules that may make rules stricter, add warnings, adjust scoring, or add explanations, but cannot override core invariants

### JSON policy DSL

The first implementation uses a safe JSON DSL with these effects: `deny`, `warning`, `score_adjustment`, `tag`. Rules evaluate over normalized policy input (player, team, squad, match, context). Operators: `eq`, `neq`, `lt`, `lte`, `gt`, `gte`, `in`, `not_in`, `exists`, `not_exists`, `contains`. Conditions combine with `all` (AND) or `any` (OR).

No arbitrary code execution. No eval. No Rego runtime in this version.

### Integration points

- Event squad generation: pre-filter blocked players, apply score adjustments, surface warnings
- Event helper selection: block overlapping helpers via core invariant
- Event match lineup: filter blocked players, warn on weak position coverage
- League match selection: apply pre/post policy evaluation
- Assistant: surface policy warnings and explanations

### Decision logging

A `PolicyDecisionLog` Prisma model stores decision type, policy pack ID, warning codes, blocked counts, and timestamps. No child/player personal data in logs.

## Consequences

- Selection rules become visible, configurable, and explainable
- Custom instances can add stricter rules without forking the engine
- Core invariants are guaranteed non-overridable
- JSON policy files are a stepping stone to OPA/Rego adapter later
- Existing engine behavior is preserved — default policy encodes current rules
- Policy evaluation adds a step to generation pipelines (negligible performance impact)

## Rejected alternatives

- **Hardcode all rules forever**: Current state, leads to scattered unmaintainable logic
- **Implement the whole solver in OPA/Rego**: Over-engineered for current needs, complex deployment, hard to debug
- **Database-only rule storage**: Too rigid for self-hosted customization, requires admin UI that doesn't exist yet