# Matchboard Policy-Capable Selection Engine

## What policies are

Policies control eligibility, warnings, score adjustments, and explanations for selection decisions. Policies do **not** replace the Matchboard squad/lineup solver. The solver owns squad generation, lineup generation, balancing, position coverage, fairness distribution, event helper selection, and deterministic output. The policy layer decides what is allowed, blocked, warned, adjusted, and explained.

## Policy layers

1. **Core invariants** — non-overridable safety rules enforced in TypeScript. Custom policies cannot override these.
2. **Default Matchboard policy** — standard eligibility, warnings, score adjustments, and explanations that run for all instances.
3. **Optional custom instance policy** — JSON DSL rules that may make rules stricter, add warnings, adjust scoring, or add explanations. Cannot override core invariants.

## Core invariants (non-overridable)

These rules are always enforced and cannot be disabled by custom policies:

- Removed players cannot be selected for active planning
- Inactive players cannot be selected
- Unavailable players cannot be selected unless an explicit override flow exists
- Players cannot appear twice in the same squad lineup
- Historical snapshots must not be mutated by current roster changes
- Historical participation must not be deleted when player status changes

## Where policies run

| Context | Pre-selection | Post-selection |
|---------|-------------|---------------|
| Event squad generation | Filter blocked players, apply score adjustments, surface warnings | Validate generated squads, warn on weak coverage |
| Event helper selection | Block overlapping helpers | Validate helpers still eligible |
| Event match lineup planning | Filter blocked players, warn on weak position coverage | Validate no duplicates, validate formation slots |
| League match selection | Apply pre-policy evaluation | Validate generated results |
| Assistant recommendations | Surface policy warnings and reasons | Use policy explanations for recommendations |

## JSON policy format

Custom policies are defined as JSON files with rules that evaluate over normalized policy input.

### Supported effects

| Effect | Description |
|--------|-------------|
| `deny` | Block the player from selection |
| `warning` | Add a warning with code, severity, and message |
| `score_adjustment` | Adjust the player's selection score by a delta |
| `tag` | Tag the player with a label for tracking |

### Supported operators

| Operator | Description |
|----------|-------------|
| `eq` | Equal to value |
| `neq` | Not equal to value |
| `lt` | Less than value |
| `lte` | Less than or equal to value |
| `gt` | Greater than value |
| `gte` | Greater than or equal to value |
| `in` | Value is in the list |
| `not_in` | Value is not in the list |
| `exists` | Field exists (is not null/undefined) |
| `not_exists` | Field does not exist (is null/undefined) |
| `contains` | String field contains value |

### Supported field paths

Rules evaluate over these contexts:

- `player.*` — player properties (status, availableForContext, primaryPosition, recentMatchCount, etc.)
- `squad.*` — squad properties (playerCount, primaryGoalkeeperCount, anyGoalkeeperCount)
- `team.*` — team properties (targetSquadSize, minSquadSize, maxSquadSize)
- `context.*` — selection context (phase, mode, matchDate, etc.)
- `constraints.*` — constraints (maxSquadSize, minSquadSize, etc.)

### Condition groups

- `all` — all conditions must be true (AND)
- `any` — at least one condition must be true (OR)

### Example policies

#### Deny removed players

```json
{
  "id": "deny-removed-players",
  "effect": "deny",
  "when": {
    "all": [
      { "field": "player.status", "op": "eq", "value": "REMOVED" }
    ]
  },
  "reason": "Removed players cannot be selected."
}
```

#### Warn on weak goalkeeper coverage

```json
{
  "id": "warn-no-primary-goalkeeper",
  "effect": "warning",
  "when": {
    "all": [
      { "field": "squad.primaryGoalkeeperCount", "op": "eq", "value": 0 }
    ]
  },
  "warning": {
    "code": "no_primary_goalkeeper",
    "severity": "warning",
    "message": "Squad has no primary goalkeeper."
  }
}
```

#### Adjust score for low match opportunity

```json
{
  "id": "prioritize-low-recent-match-count",
  "effect": "score_adjustment",
  "when": {
    "all": [
      { "field": "player.recentMatchCount", "op": "lte", "value": 1 }
    ]
  },
  "scoreAdjustment": 5,
  "reason": "Player has had fewer recent match opportunities."
}
```

#### Tag low-activity players

```json
{
  "id": "tag-low-activity",
  "effect": "tag",
  "when": {
    "all": [
      { "field": "player.seasonMatchCount", "op": "lte", "value": 2 }
    ]
  },
  "tag": "low_activity",
  "reason": "Player has had few season matches."
}
```

## How to use custom policies

### Where to place custom policy files

Place custom policy files in:

```
policies/custom/custom.policy.json
```

### How custom policies are loaded

1. The default Matchboard policy always runs
2. If a custom policy file exists at `policies/custom/custom.policy.json`, it is loaded and evaluated after the default policy
3. Custom policy results are merged: denials are additive, warnings and score adjustments are collected
4. Core invariants are always enforced regardless of custom policy content

### How invalid policies fail

If a custom policy file contains invalid JSON or invalid rule structures, the load fails closed. The application continues with the default policy only. The error is logged clearly.

### How to disable a custom policy

Remove or rename the `policies/custom/custom.policy.json` file. The application falls back to default-only policy.

### How to test a policy

Write JSON policy files and use the policy test suite to verify behavior. The `JsonPolicyAdapter` can be instantiated with any `PolicyPack` object for testing.

### OPA/Rego positioning

The architecture is OPA-inspired and designed so a Rego adapter can be added later. The first implementation uses a safe JSON DSL and TypeScript adapter. Rego/OPA is **not** the default runtime in this version. Do not claim Rego is implemented unless it is.

## Key files

| File | Purpose |
|------|---------|
| `src/lib/policies/types.ts` | Policy input/result type definitions |
| `src/lib/policies/core-invariants.ts` | Non-overridable invariant checks |
| `src/lib/policies/build-policy-input.ts` | Build normalized policy input from app data |
| `src/lib/policies/json-policy-dsl.ts` | JSON DSL rule evaluation engine |
| `src/lib/policies/json-policy-loader.ts` | Load and validate policy packs from JSON |
| `src/lib/policies/default-matchboard-policy.ts` | Default Matchboard eligibility/warning/scoring policy |
| `src/lib/policies/selection-policy-adapter.ts` | Adapter interface, composite pipeline, factory |
| `policies/default/matchboard.default.policy.json` | Default policy as JSON DSL example |
| `policies/examples/stricter-goalkeeper-coverage.policy.json` | Example: stricter GK coverage |
| `policies/examples/equal-opportunity.policy.json` | Example: equal opportunity scoring |

## Decision logging

The `PolicyDecisionLog` Prisma model stores:
- Decision type
- Related entity IDs (event, match, team)
- Policy pack ID and version
- Warning and blocked counts
- Timestamp

No child/player personal data is stored in decision logs.
