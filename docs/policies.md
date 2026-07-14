# Matchboard Policy-Capable Selection Engine

## What policies are

Policies control eligibility, warnings, score adjustments, and explanations for selection decisions. Policies do **not** replace the Matchboard squad/lineup solver. The solver owns squad generation, lineup generation, balancing, position coverage, fairness distribution, event helper selection, and deterministic output. The policy layer decides what is allowed, blocked, warned, adjusted, and explained.

## Policy layers

The policy pipeline runs three layers in order. Each layer adds to the result; no later layer can override an earlier layer's hard blocks.

1. **Core invariants** — non-overridable safety rules enforced in TypeScript (`src/lib/policies/core-invariants.ts`). Custom policies cannot override these. Removed players, inactive players, unavailable players, and duplicate lineup assignments are always enforced regardless of policy configuration.

2. **Default Matchboard policy** — standard eligibility, warnings, score adjustments, and explanations enforced in TypeScript (`src/lib/policies/default-matchboard-policy.ts`). Always runs. Cannot be disabled.

3. **Optional custom Rego policy** — compiled to WebAssembly and evaluated server-side via `@open-policy-agent/opa-wasm`. May make rules stricter, add warnings, adjust scoring (bounded ±20), or add explanations. Cannot override core invariants. No OPA server, no sidecar, no runtime Rego compilation, no browser-side evaluation.

The optional JSON DSL policy (Stage 1) is retained for backward compatibility and internal default policy expression. New custom policies should use Rego compiled to Wasm. Do not add proprietary JSON DSL extensions.

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

## Rego/Wasm policy support

### Architecture

Custom Rego policies run as compiled WebAssembly inside the Next.js server process. There is no OPA server, no sidecar, no custom server, and no runtime Rego compilation.

- Rego source files are compiled to Wasm **before** deployment using `npm run policy:build`
- The compiled Wasm artifact is loaded server-side by `@open-policy-agent/opa-wasm`
- No browser-side policy evaluation occurs
- No Rego source is loaded at runtime — only the pre-compiled Wasm binary
- The Wasm artifact is cached in-process after first load

### File layout

```
policies/
  rego/
    matchboard_selection.rego          # Default Rego policy source
    matchboard_selection_test.rego     # Rego unit tests
    custom/                             # Place custom Rego policies here
    examples/
      goalkeeper_coverage.rego         # Example: stricter GK coverage
      equal_opportunity.rego           # Example: equal opportunity scoring
  compiled/
    matchboard_selection.wasm          # Compiled Wasm artifact (do not edit)
    README.md
```

### Entrypoint

The Rego policy must use package `matchboard.selection` and export a `decision` rule. The Wasm entrypoint for `opa build` is `matchboard/selection/decision`.

The `decision` rule must return an object with these keys:

| Key | Type | Required |
|-----|------|----------|
| `blocked` | Array of `{player_id, reasons}` | Yes |
| `warnings` | Array of `{code, severity, message, ...}` | Yes |
| `score_adjustments` | Array of `{player_id, delta, reason, code}` | Yes |
| `explanations` | Array of `{player_id, code, summary, hard_rule}` | Yes |
| `tags` | Array of `{player_id, tag, reason}` | Yes |

All keys must be present. Return empty arrays for keys with no results.

### What Rego may do

- Add blocked player reasons (these merge with core invariant and default policy blocks)
- Add warnings with code, severity (`info`, `warning`, `blocking`), and message
- Add score adjustments bounded to ±20 (values outside this range are clamped)
- Add explanations with code, summary, and `hard_rule` boolean
- Add tags for player tracking

### What Rego may not do

- Override core invariants (removed/inactive/unavailable/duplicate checks always run first)
- Allow players blocked by core invariants
- Mutate data, access the database, access secrets, make network calls
- Depend on `http.send`, read files, or perform side effects
- Replace squad generation or lineup generation
- Replace or alter historical snapshots
- Access browser APIs or run client-side
- Perform unbounded computation (Wasm execution is bounded by the runtime)

### Input transformation

The `RegoPolicyAdapter` transforms `SelectionPolicyInput` (TypeScript) into snake_case JSON before passing it to the Wasm evaluator. Player IDs are preserved; player display names are included for logging but must not drive policy logic.

Input fields available to Rego:

| Path | Description |
|------|-------------|
| `input.context.phase` | Decision phase: `pre_selection`, `post_selection`, `assistant_recommendation`, `report_availability` |
| `input.context.mode` | Policy mode: `league` or `event` |
| `input.context.now_iso` | Current timestamp in ISO 8601 |
| `input.players[]` | Player objects with `id`, `status`, `available_for_context`, positions, match counts, `policy_tags` |
| `input.teams[]` | Team objects with `id`, `name`, squad size limits |
| `input.squads[]` | Squad objects with goalkeeper counts |
| `input.matches[]` | Match objects with timing and opponent |
| `input.history` | Player match counts, role maps, recent support counts |
| `input.constraints` | Squad size limits, position constraints, blocked IDs |

### Output normalization

The `RegoPolicyAdapter` normalizes Rego output from snake_case to the TypeScript `SelectionPolicyResult` shape:

- `player_id` → `playerId`
- `score_adjustments[].delta` is clamped to [-20, 20]
- `severity` is normalized to `"info"` | `"warning"` | `"blocking"` (defaults to `"warning"` if unrecognized)
- Missing keys default to empty arrays
- `reasons` in `blocked` entries defaults to `["blocked_by_rego_policy"]`

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `MATCHBOARD_POLICY_REGO_ENABLED` | `false` | Enable Rego/Wasm policy evaluation. When `false`, the Rego adapter returns an empty result and the default TypeScript policy runs alone. |
| `MATCHBOARD_POLICY_WASM_PATH` | `policies/compiled/matchboard_selection.wasm` | Path to the compiled Wasm artifact. Relative to project root unless an absolute path is provided. |
| `MATCHBOARD_POLICY_REGO_FAILURE_MODE` | `fail_closed` | Controls behavior when Rego evaluation fails. `fail_closed` throws an error (default policy still runs for players not blocked by Rego, but the composite pipeline fails). `fail_open` logs a warning and returns an empty Rego result, so only core invariants and the default TypeScript policy apply. |

When Rego is disabled (`MATCHBOARD_POLICY_REGO_ENABLED=false`), the policy pipeline runs core invariants and the default TypeScript policy only. No Wasm file is loaded.

## Failure behavior

When the Rego policy adapter encounters an error:

1. **Missing Wasm file**: `RegoPolicyError` is thrown with a message directing the user to run `npm run policy:build` or set `MATCHBOARD_POLICY_WASM_PATH`.
2. **Evaluation error** (Wasm load or evaluation fails):
   - `fail_closed` (default): `RegoPolicyError` is thrown. The composite pipeline fails, and the calling code must handle the error. No partial Rego result is applied.
   - `fail_open`: An empty Rego result is returned. Core invariants and the default TypeScript policy still apply. A warning is logged: `[Policy/Rego] fail_open mode: returning empty result (default policy still applies).`
3. **Invalid Rego output** (null, non-object, missing keys): `RegoPolicyError` is thrown regardless of failure mode, because an invalid result cannot be safely merged into the pipeline.

Error messages are logged to the server console with the prefix `[Policy/Rego]`. No player or team data is included in error logs.

## Score adjustment bounds

Rego score adjustments are clamped to the range [-20, 20]. A `delta` value outside this range is silently clamped to the nearest bound:

- `delta: 30` → clamped to `20`
- `delta: -50` → clamped to `-20`
- `delta: 5` → unchanged

This applies to both positive and negative adjustments. The default TypeScript policy has no explicit clamp because its adjustments are authored in TypeScript and bounded by design. The Rego clamp is a safety boundary for user-authored policies.

## Policy build and test scripts

| Command | Description |
|---------|-------------|
| `npm run policy:build` | Compile Rego source to Wasm. Requires the OPA CLI (`opa`) installed. Runs `scripts/build-opa-policy.mjs`. |
| `npm run policy:test` | Run Rego unit tests using `opa test`. Tests are in `policies/rego/matchboard_selection_test.rego`. |
| `npm run policy:dry-run` | Evaluate a policy against a JSON fixture. Optional second argument is the fixture path (defaults to `test/fixtures/policies/event-selection-input.json`). Respects `MATCHBOARD_POLICY_REGO_ENABLED` and `MATCHBOARD_POLICY_WASM_PATH`. |

### Build process detail

The build script (`scripts/build-opa-policy.mjs`):

1. Checks that the OPA CLI is installed (`opa version`)
2. Runs `opa build` on `policies/rego/` targeting Wasm with entrypoint `matchboard/selection/decision`
3. Extracts `policy.wasm` from the resulting bundle
4. Writes the artifact to `policies/compiled/matchboard_selection.wasm`

The compiled artifact must be committed to version control alongside the Rego source. Do not edit the Wasm file directly.

### Installing OPA CLI

- macOS: `brew install opa`
- Linux: Download from https://openpolicyagent.org and place in `$PATH`
- Verify: `opa version`

## JSON policy format (legacy)

The JSON DSL (`src/lib/policies/json-policy-dsl.ts`) is retained for backward compatibility and internal default policy expression. New custom policies should use Rego compiled to Wasm. Do not add proprietary policy DSL extensions.

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

### Example policies (JSON DSL)

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

### Rego custom policies (recommended)

1. Place Rego policy files in `policies/rego/custom/` using the `matchboard.selection` package
2. Run `npm run policy:test` to run Rego unit tests
3. Run `npm run policy:build` to compile Rego to Wasm
4. Run `npm run policy:dry-run` to verify the compiled policy against a fixture
5. Commit both the Rego source and the compiled Wasm artifact
6. Set `MATCHBOARD_POLICY_REGO_ENABLED=true` to enable in production

### JSON custom policies (legacy)

#### Where to place custom policy files

```
policies/custom/custom.policy.json
```

#### How custom policies are loaded

1. The default Matchboard policy always runs
2. If `MATCHBOARD_POLICY_REGO_ENABLED=true`, the Rego policy runs after the default policy
3. If a custom JSON policy file exists at `policies/custom/custom.policy.json`, it is loaded and evaluated after Rego
4. Custom policy results are merged: denials are additive, warnings and score adjustments are collected
5. Core invariants are always enforced regardless of custom policy content

#### How invalid policies fail

If a custom JSON policy file contains invalid JSON or invalid rule structures, the load fails closed. The application continues with the default policy only. The error is logged clearly.

If a Rego policy fails to load or evaluate, behavior depends on `MATCHBOARD_POLICY_REGO_FAILURE_MODE` (see Failure behavior).

#### How to disable a custom policy

- **Rego**: Set `MATCHBOARD_POLICY_REGO_ENABLED=false` or unset the variable. The Wasm artifact is not loaded.
- **JSON**: Remove or rename the `policies/custom/custom.policy.json` file. The application falls back to default-only policy.

#### How to test a policy

- **Rego**: Write tests in `policies/rego/matchboard_selection_test.rego` and run `npm run policy:test`. Use `npm run policy:dry-run` for end-to-end verification against a fixture.
- **JSON**: Use the `JsonPolicyAdapter` with any `PolicyPack` object for unit testing.

## Policy input/output contract

### Input contract

The `SelectionPolicyInput` type defines the normalized data passed to all policy layers.

```typescript
type SelectionPolicyInput = {
  context: {
    phase: "pre_selection" | "post_selection" | "assistant_recommendation" | "report_availability";
    mode: "league" | "event";
    seasonYear?: number;
    period?: "spring" | "fall" | "full_year";
    eventId?: string;
    eventMatchId?: string;
    leagueMatchId?: string;
    teamId?: string;
    opponentId?: string;
    matchDate?: string | null;
    matchTime?: string | null;
    nowIso: string;
    gameFormat?: string | null;
    tacticId?: string | null;
  };
  players: PolicyPlayer[];
  teams: PolicyTeam[];
  squads: PolicySquad[];
  matches: PolicyMatch[];
  history: {
    playerMatchCountMap: Record<string, number>;
    playerRoleMap: Record<string, string[]>;
    playerRecentSupportCount: Record<string, number>;
  };
  constraints: {
    maxSquadSize?: number | null;
    minSquadSize?: number | null;
    targetSquadSize?: number | null;
    requireGoalkeeper?: boolean;
    allowedPositions?: string[];
    blockedPlayerIds?: string[];
  };
  candidateSelection?: {
    selectedPlayerIds: string[];
    blockedPlayerIds: string[];
    warnedPlayerIds: string[];
  };
};
```

### Output contract

All policy adapters return `SelectionPolicyResult`:

```typescript
type SelectionPolicyResult = {
  allowedPlayerIds: string[];
  blocked: Record<string, string[]>;    // playerId → [reasons]
  warnings: PolicyWarning[];
  scoreAdjustments: PolicyScoreAdjustment[];
  explanations: PolicyExplanation[];
  tags: PolicyTag[];
};
```

### Pipeline composition

`createPolicyPipeline()` builds the composite adapter:

1. Core invariants run first and produce blocked entries that cannot be overridden
2. Default Matchboard policy runs second
3. Rego policy runs third (if `MATCHBOARD_POLICY_REGO_ENABLED=true`)
4. JSON custom policy runs fourth (if a custom policy file exists)

All blocked entries are merged additively across layers. A player blocked by any layer cannot be allowed by a later layer. Warnings, score adjustments, explanations, and tags are collected from all layers.

### Example: Rego policy that blocks players with a custom tag

```rego
package matchboard.selection

default decision = {
  "blocked": [],
  "warnings": [],
  "score_adjustments": [],
  "explanations": [],
  "tags": [],
}

decision = result if {
  result := {
    "blocked": blocked_players,
    "warnings": all_warnings,
    "score_adjustments": all_score_adjustments,
    "explanations": all_explanations,
    "tags": all_tags,
  }
}

blocked_players := [{
  "player_id": p.id,
  "reasons": ["blocked_by_custom_policy_tag"],
}] {
  some p in input.players
  p.status == "ACTIVE"
  p.available_for_context == true
  "custom_blocked" in object.get(p, "policy_tags", [])
}

all_warnings := []
all_score_adjustments := []
all_explanations := []
all_tags := []
```

### Example: Rego policy that adjusts scores for low match opportunity

```rego
low_recent_match_adjustments := [adj |
  some p in input.players
  p.status == "ACTIVE"
  p.available_for_context == true
  recent_count := object.get(p, "recent_match_count", 0)
  recent_count <= 1
  adj := {
    "player_id": p.id,
    "delta": 5,
    "reason": "Player has had fewer recent match opportunities.",
    "code": "rego_low_recent_match_count",
  }
]
```

### Example: JSON DSL policy that warns on weak goalkeeper coverage

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

## Key files

| File | Purpose |
|------|---------|
| `src/lib/policies/types.ts` | Policy input/result type definitions |
| `src/lib/policies/core-invariants.ts` | Non-overridable core invariant checks |
| `src/lib/policies/build-policy-input.ts` | Build normalized policy input from app data |
| `src/lib/policies/default-matchboard-policy.ts` | Default Matchboard eligibility/warning/scoring policy |
| `src/lib/policies/selection-policy-adapter.ts` | Policy adapter interface, composite pipeline, factory |
| `src/lib/policies/rego-policy-adapter.ts` | OPA/Rego Wasm adapter for custom Rego policies |
| `src/lib/policies/policy-evaluation.ts` | Evaluate policy pipeline, filter blocked players, apply score adjustments, coach-facing reason formatting |
| `src/lib/policies/policy-signal-mapper.ts` | Map policy results to plan integrity signals, merge with existing signals |
| `src/lib/policies/policy-version.ts` | Policy artifact hash/version tracking for audit and diagnostics |
| `src/lib/policies/policy-decision-log.ts` | Policy decision summary builder for logging |
| `src/lib/policies/json-policy-dsl.ts` | JSON DSL rule evaluation (legacy, internal use) |
| `src/lib/policies/json-policy-loader.ts` | Load and validate policy packs from JSON |
| `src/app/api/admin/policy/route.ts` | Admin diagnostics: policy runtime, version, Rego status |
| `policies/rego/matchboard_selection.rego` | Rego policy source |
| `policies/rego/matchboard_selection_test.rego` | Rego policy tests |
| `policies/rego/custom/` | Directory for custom Rego policies |
| `policies/rego/examples/goalkeeper_coverage.rego` | Example: stricter GK coverage |
| `policies/rego/examples/equal_opportunity.rego` | Example: equal opportunity scoring |
| `policies/compiled/matchboard_selection.wasm` | Compiled Wasm artifact (do not edit) |
| `policies/default/matchboard.default.policy.json` | Default policy as JSON DSL example |
| `policies/examples/stricter-goalkeeper-coverage.policy.json` | Example: stricter GK coverage (JSON) |
| `policies/examples/equal-opportunity.policy.json` | Example: equal opportunity scoring (JSON) |
| `scripts/build-opa-policy.mjs` | Build script: compile Rego to Wasm |
| `scripts/policy-dry-run.mjs` | Dry-run utility for policy evaluation |

## Decision logging

The `PolicyDecisionLog` Prisma model stores:
- Decision type
- Related entity IDs (event, match, team)
- Policy pack ID and version
- Warning and blocked counts
- Timestamp

No child/player personal data is stored in decision logs.

## Stage 3: Operationalization

Stage 3 wires the policy pipeline into real application flows and provides coach-facing visibility.

### Integration points

| Flow | Where policy runs | What it does |
|------|-------------------|-------------|
| League match generation (`generate-round.ts`) | Post-Phase 7 | Filters blocked players, adds policy warnings to `roundWarnings` |
| Plan integrity computation (`compute-plan-integrity.ts`) | Post-computation | Merges policy-derived signals with canonical signals |
| Event squad generation (`actions.ts`) | Pre-generation | Filters blocked players from eligible pool, appends policy warnings |
| Event pool validation (`event-validation.ts`) | Exported helper | `applyPolicyWarnings()` merges policy warnings into validation output |
| Assistant (`get-assistant-command-centre.ts`) | Indirect | Consumes policy signals through `computeRoundPlanIntegrity` |

### Evaluation helpers (`policy-evaluation.ts`)

| Function | Purpose |
|----------|---------|
| `evaluateSelectionPolicy(input)` | Run the full composite pipeline and return a structured result |
| `filterBlockedPlayerIds(result)` | Extract blocked player IDs from policy result |
| `applyScoreAdjustments(candidates, adjustments)` | Apply bounded score adjustments to candidate rankings |
| `coachFacingBlockedReason(result, playerId)` | Human-readable blocked reason for a specific player |
| `coachFacingWarningMessage(warning)` | Human-readable warning message |
| `summarizePolicyResult(result)` | One-line summary of blocked/warning/adjustment counts |
| `policyBlockedReasonsForPlayer(result, playerId)` | All blocked reasons for a player |
| `policyWarningsForPlayer(result, playerId)` | All warnings for a player |
| `policyWarningsForTeam(result, teamId)` | All warnings for a team |

### Signal mapping (`policy-signal-mapper.ts`)

Policy warnings and blocked entries map to Matchboard's plan integrity signal model:

| Policy result | Plan integrity signal |
|---------------|----------------------|
| Blocked player | Blocked condition (`BLOCKED`) |
| `severity: "blocking"` warning | Blocked condition (`BLOCKED`) |
| `severity: "warning"` warning | Decision required (`DECISION_REQUIRED`) |
| `severity: "info"` warning | Planning note (`PLANNING_NOTE`) |

| Function | Purpose |
|----------|---------|
| `policyBlockedToSignals(blocked, matchRoundId)` | Convert blocked entries to plan integrity signals |
| `policyWarningsToSignals(warnings, matchRoundId)` | Convert warnings to categorized signals |
| `mergePolicySignals(existing, policySignals)` | Merge policy signals with existing signals, deduplicating by key |

### Version tracking (`policy-version.ts`)

| Function | Purpose |
|----------|---------|
| `getPolicyArtifactHash()` | SHA-256 hash of the Wasm artifact (or null if Rego disabled) |
| `getPolicyVersion()` | Version string combining runtime info and artifact hash |

### Decision log builder (`policy-decision-log.ts`)

| Function | Purpose |
|----------|---------|
| `buildDecisionSummary(result, context)` | Build a structured summary for audit logging |

### Admin diagnostics (`/api/admin/policy`)

The admin diagnostics route reports:
- Whether Rego is enabled
- Rego failure mode
- Policy version and artifact hash
- Whether the Wasm artifact is loaded
- Last evaluation timestamp
- Blocked/warning/adjustment counts from last evaluation

No player personal data is included in diagnostics output.

### Coach-facing language rules

All policy output visible to coaches must follow Matchboard's child-safe language rules:

| Policy concept | Use | Never use |
|----------------|-----|-----------|
| Player blocked from selection | "Not eligible for selection" | "Rejected", "Failed" |
| Policy warning | "Planning note" or "Decision required" | "Error", "Violation" |
| Score adjustment | "Selection priority adjusted" | "Penalty", "Bonus" |
| Blocked reason | "Unavailable for this match", "Core team assignment conflict" | "Banned", "Punished" |

Raw Rego internals, policy codes, and internal severity levels must not appear in coach-facing UI.