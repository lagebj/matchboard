# Matchboard Policy-Capable Selection Engine

## What policies are

Policies control eligibility, warnings, score adjustments, and explanations for selection decisions. Policies do **not** replace the Matchboard squad/lineup solver. The solver owns squad generation, lineup generation, balancing, position coverage, fairness distribution, event helper selection, and deterministic output. The policy layer decides what is allowed, blocked, warned, adjusted, and explained.

## Policy layers

The policy pipeline runs three layers in order. Each layer adds to the result; no later layer can override an earlier layer's hard blocks.

1. **Core invariants** — non-overridable safety rules enforced in TypeScript (`src/lib/policies/core-invariants.ts`). Custom policies cannot override these. Removed players, inactive players, unavailable players, and duplicate lineup assignments are always enforced regardless of policy configuration.

2. **Default Matchboard policy** — standard eligibility, warnings, score adjustments, and explanations enforced in TypeScript (`src/lib/policies/default-matchboard-policy.ts`). Always runs. Cannot be disabled.

3. **Rego policy (always active)** — compiled to WebAssembly and evaluated server-side via `@open-policy-agent/opa-wasm`. May make rules stricter, add warnings, adjust scoring (bounded ±20), or add explanations. Cannot override core invariants. No OPA server, no sidecar, no runtime Rego compilation, no browser-side evaluation.

**OPA/Rego is a standard Matchboard runtime capability (ADR-0107) — there is no environment gate that turns it off.** The built-in `matchboard-default` pack always degrades safely to an empty result if its own Wasm evaluation fails unexpectedly; it never throws up to a coach-facing request and never bypasses core invariants.

The JSON DSL adapter was removed in Stage 4. Custom policies should use Rego compiled to Wasm. Do not reintroduce a proprietary JSON DSL.

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
  packs/
    matchboard-default/                   # Default Matchboard policy pack (schema v2)
      policy-pack.json                     # Pack metadata (id, version, entrypoints, failureMode)
      rego/
        matchboard_selection.rego          # Selection policy source
        matchboard_selection_test.rego     # Selection Rego unit tests
        matchboard_situation.rego          # Situation policy source (situational decision support)
        matchboard_situation_test.rego     # Situation Rego unit tests
      compiled/
        matchboard_selection.wasm          # Compiled Wasm artifact, both entrypoints (do not edit)
        README.md
      fixtures/
        event-selection-input.json         # Dry-run test fixtures
        weak-goalkeeper-coverage-input.json
        event-helper-overlap-input.json
  examples/
    packs/
      custom-example/                     # Example custom policy pack (schema v1, illustrative)
        policy-pack.json
        rego/
          custom_selection.rego
          custom_selection_test.rego
        compiled/
          README.md
        fixtures/
          event-selection-input.json
    rego/
      goalkeeper_coverage.rego
      equal_opportunity.rego
  rego/                                    # Legacy flat Rego source (still readable, not the active default)
    matchboard_selection.rego
    matchboard_selection_test.rego
    custom/
  compiled/                                # Legacy flat compiled artifact (still readable)
    matchboard_selection.wasm
    README.md
```

### Policy pack metadata

Each pack directory must contain a `policy-pack.json` file. Schema v2 (used by every pack this
repository ships) fields:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Pack identifier, must match directory name |
| `name` | string | Yes | Human-readable pack name |
| `version` | string | Yes | Semantic version of the pack |
| `description` | string | Yes | Description of the pack's purpose |
| `schemaVersion` | number | Yes | `2` for named multi-entrypoint packs |
| `entrypoints` | object | Yes (v2) | Name → OPA Wasm entrypoint map, e.g. `{ "selection": "matchboard/selection/decision", "situation": "matchboard/situation/decision" }`. Must declare a `selection` entry. |
| `regoDirectory` | string | Yes | Relative path to Rego source directory |
| `compiledWasm` | string | Yes | Relative path to compiled Wasm artifact |
| `fixturesDirectory` | string | Yes | Relative path to dry-run fixture directory |
| `runtime` | string | Yes | Must be `opa-wasm` |
| `failureMode` | string | No | `"degraded_fallback"` (default) or `"fail_closed"`. The built-in `matchboard-default` pack is always forced to `"degraded_fallback"` regardless of this field. |

Schema v1 (single `entrypoint: string`, no `entrypoints`/`failureMode`) remains readable for
backward compatibility — `policies/examples/packs/custom-example/` deliberately stays on schema
v1 as the live exerciser of that compatibility path. New/repository-owned packs should use v2.

Pack metadata must **not** contain `rules`, `conditions`, `effects`, or `operators` keys. Policy logic belongs in Rego source files, not in JSON DSL.

### Entrypoints

The `selection` entrypoint policy must use package `matchboard.selection` and export a `decision` rule, at Wasm entrypoint `matchboard/selection/decision`. The built-in pack additionally declares a `situation` entrypoint (package `matchboard.situation`, `matchboard/situation/decision`) for situational decision support — see `docs/domain/situational-decision-support.md`. `opa build` compiles all of a pack's declared entrypoints into one Wasm artifact (one `-e <path>` flag per entrypoint).

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

There is no environment variable that enables or disables Rego — it always runs as part of `createPolicyPipeline()`. Do not reintroduce `MATCHBOARD_POLICY_REGO_ENABLED` or a global `MATCHBOARD_POLICY_REGO_FAILURE_MODE`.

| Variable | Default | Description |
|----------|---------|-------------|
| `MATCHBOARD_POLICY_PACK_ID` | `matchboard-default` | Which policy pack to load. Must match a directory name under `policies/packs/`. |
| `MATCHBOARD_POLICY_WASM_PATH` | *(pack-resolved)* | Path to the compiled Wasm artifact. When set, overrides the pack-resolved path. When not set, the Wasm path is resolved from the active pack's `policy-pack.json`. |
| `MATCHBOARD_POLICY_PACKS_DIR` | `policies/packs` | Override the packs directory (advanced, usually not needed). |

Failure behavior is declared per pack in its own `policy-pack.json` (`failureMode`), not via an environment variable — see "Policy pack metadata" above.

## Failure behavior

When the shared policy runtime (`src/lib/policies/policy-runtime.ts`) encounters an error evaluating a named entrypoint:

1. **Pack/metadata resolution failure** (missing pack, invalid metadata, missing Wasm file): degrades the same as an evaluation failure below — see pack `failureMode`.
2. **Evaluation error** (Wasm load or evaluation fails), branching on the active pack's `failureMode`:
   - `"degraded_fallback"` (the built-in `matchboard-default` pack, always): marks policy runtime `DEGRADED`, logs a structured diagnostic (`[Policy/Runtime]`, no player-sensitive payload), and throws `PolicyRuntimeDegradedError` — the calling adapter (`RegoPolicyAdapter`) catches this and returns a safe empty result so core invariants and the default TypeScript policy still apply. Nothing is thrown up to the coach-facing request.
   - `"fail_closed"` (available to a non-built-in custom pack that declares it): throws `PolicyRuntimeError`, and the composite pipeline fails — the calling code must handle the error. No partial Rego result is applied.
3. **Invalid Rego output** (null, non-object, missing keys) from an otherwise-successful evaluation: always throws `RegoPolicyError`/`PolicyRuntimeError` regardless of the pack's `failureMode` — this is a policy-content bug, not a runtime availability failure, and must never be silently masked.

Error messages are logged to the server console. No player or team data is included in error logs.

## Score adjustment bounds

Rego score adjustments are clamped to the range [-20, 20]. A `delta` value outside this range is silently clamped to the nearest bound:

- `delta: 30` → clamped to `20`
- `delta: -50` → clamped to `-20`
- `delta: 5` → unchanged

This applies to both positive and negative adjustments. The default TypeScript policy has no explicit clamp because its adjustments are authored in TypeScript and bounded by design. The Rego clamp is a safety boundary for user-authored policies.

## Policy build and test scripts

| Command | Description |
|---------|-------------|
| `npm run policy:build` | Compile Rego source to Wasm (legacy mode, no `--pack` flag). Runs `scripts/build-opa-policy.mjs`. |
| `npm run policy:build:pack` | Compile the `matchboard-default` policy pack. Runs `scripts/build-opa-policy.mjs --pack matchboard-default`. |
| `npm run policy:test` | Run legacy Rego unit tests using `opa test policies/rego`. |
| `npm run policy:test:pack` | Run Rego unit tests for all packs. |
| `npm run policy:validate` | Validate all policy pack metadata and structure. |
| `npm run policy:validate:pack` | Validate a specific pack. |
| `npm run policy:list` | List all discovered policy packs with version and compilation status. |
| `npm run policy:dry-run` | Evaluate policy against a JSON fixture (legacy mode). |
| `npm run policy:dry-run:pack` | Evaluate `matchboard-default` pack against a fixture. |
| `npm run workbench:dry-run` | Run workbench dry-run comparison of default vs Rego policy. |

### Build process detail (pack mode)

The build script (`scripts/build-opa-policy.mjs`) supports two modes:

**Legacy mode** (default, no `--pack` flag):
1. Checks that the OPA CLI is installed
2. Runs `opa build` on `policies/rego/` targeting Wasm
3. Extracts `policy.wasm` from the resulting bundle
4. Writes the artifact to `policies/compiled/matchboard_selection.wasm`

**Pack mode** (`--pack <pack-id>`):
1. Reads `policies/packs/<pack-id>/policy-pack.json`
2. Validates that `metadata.id` matches the pack directory name
3. Resolves the Rego source directory and entrypoint from metadata
4. Runs `opa build` on the pack's Rego directory targeting Wasm with the pack's entrypoint
5. Extracts `policy.wasm` and writes to the pack's `compiled/` directory
6. Computes and reports the sha256 hash of the compiled artifact

The compiled artifact must be committed to version control alongside the Rego source. Do not edit the Wasm file directly.

### Policy pack validation

The `scripts/policy-validate.mjs` script checks:
- `policy-pack.json` exists and contains valid JSON
- All required metadata fields are present and correctly typed
- `id` matches the pack directory name
- No forbidden DSL content keys (`rules`, `conditions`, `effects`, `operators`)
- Rego source directory exists and contains at least one non-test `.rego` file
- Wasm artifact exists (warning only if missing)
- Fixtures directory exists (warning only)

### Policy pack listing

The `scripts/policy-list.mjs` script shows:
- All discovered packs with id, version, name, entrypoint
- Whether the compiled Wasm artifact is present
- The `MATCHBOARD_POLICY_PACK_ID` env var value

### Installing OPA CLI

- macOS: `brew install opa`
- Linux: Download from https://openpolicyagent.org and place in `$PATH`
- Verify: `opa version`

## How to use custom policies

### Using a policy pack

1. Create a pack directory under `policies/packs/<your-pack-id>/`
2. Add a `policy-pack.json` with schema v2 metadata (`entrypoints`, optionally `failureMode`)
3. Place Rego policy files in the pack's `rego/` directory
4. Run `npm run policy:validate -- --pack <your-pack-id>` to validate metadata
5. Run `npm run policy:test:pack` to run Rego unit tests
6. Run `npm run policy:build -- --pack <your-pack-id>` to compile Rego to Wasm (all declared entrypoints)
7. Run `npm run policy:dry-run -- --pack <your-pack-id> [--entrypoint <name>] <fixture-name>` to verify
8. Commit both the Rego source and the compiled Wasm artifact
9. Set `MATCHBOARD_POLICY_PACK_ID=<your-pack-id>` to activate it — Rego evaluation itself is always on, no separate enable flag needed

### Legacy Rego custom policies

The legacy flat structure under `policies/rego/` is still readable via `MATCHBOARD_POLICY_WASM_PATH`, but is not the active default and is not where new custom policy work should go — prefer a policy pack.

### How custom policies are loaded

1. The default Matchboard policy always runs
2. The active pack's `selection` entrypoint always runs after the default policy (ADR-0107: no enable flag)
3. Custom Rego policy results are merged: denials are additive, warnings and score adjustments are collected
4. Core invariants are always enforced regardless of custom policy content

### How to test a policy

Write tests in `policies/packs/<your-pack-id>/rego/*_test.rego` and run `npm run policy:test:pack` (or `npm run policy:test` for the legacy flat structure). Use `npm run policy:dry-run:pack -- --pack <your-pack-id> <fixture>` for end-to-end verification against a fixture.

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
3. Rego policy (active pack's `selection` entrypoint) always runs third

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

## Key files

| File | Purpose |
|------|---------|
| `src/lib/policies/types.ts` | Policy input/result type definitions |
| `src/lib/policies/core-invariants.ts` | Non-overridable core invariant checks |
| `src/lib/policies/build-policy-input.ts` | Build normalized policy input from app data |
| `src/lib/policies/default-matchboard-policy.ts` | Default Matchboard eligibility/warning/scoring policy |
| `src/lib/policies/selection-policy-adapter.ts` | Policy adapter interface, composite pipeline, factory |
| `src/lib/policies/policy-pack.ts` | Policy pack metadata validation (schema v1/v2), resolution, diagnostics, and artifact hashing |
| `src/lib/policies/policy-runtime.ts` | Single shared OPA Wasm runtime owner: pack/artifact loading, caching, named-entrypoint evaluation, health/degradation tracking |
| `src/lib/policies/rego-policy-adapter.ts` | Typed `selection`-entrypoint adapter over the shared policy runtime |
| `src/lib/policies/policy-evaluation.ts` | Evaluate policy pipeline, filter blocked players, apply score adjustments, coach-facing reason formatting |
| `src/lib/policies/policy-signal-mapper.ts` | Map policy results to plan integrity signals, merge with existing signals |
| `src/lib/policies/policy-version.ts` | Policy artifact hash/version tracking for audit and diagnostics |
| `src/lib/policies/policy-decision-log.ts` | Policy decision summary builder for logging |
| `src/app/api/admin/policy/route.ts` | Admin diagnostics: policy runtime, version, Rego status |
| `policies/rego/matchboard_selection.rego` | Rego policy source |
| `policies/rego/matchboard_selection_test.rego` | Rego policy tests |
| `policies/rego/custom/` | Directory for custom Rego policies |
| `policies/rego/examples/goalkeeper_coverage.rego` | Example: stricter GK coverage |
| `policies/rego/examples/equal_opportunity.rego` | Example: equal opportunity scoring |
| `policies/compiled/matchboard_selection.wasm` | Compiled Wasm artifact (do not edit) |
| `scripts/build-opa-policy.mjs` | Build script: compile Rego to Wasm |
| `scripts/policy-dry-run.mjs` | Dry-run utility for policy evaluation |
| `docs/adr/0019-generation-drafts-and-league-event-policy-contexts.md` | ADR: Generation drafts and league/event policy contexts |

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
| `getPolicyArtifactHash()` | SHA-256 hash of the active pack's Wasm artifact |
| `getPolicyVersion()` | Version string combining runtime info and artifact hash |

### Decision log builder (`policy-decision-log.ts`)

| Function | Purpose |
|----------|---------|
| `buildDecisionSummary(result, context)` | Build a structured summary for audit logging |

### Admin diagnostics (`/api/admin/policy`)

The admin diagnostics route reports:
- Policy runtime health (`HEALTHY`/`DEGRADED`), not a boolean "enabled" flag
- Last runtime error code, if degraded
- Policy version and artifact hash
- Whether the Wasm artifact is loaded
- Active policy pack id, version, name, schema version, declared entrypoints, and failure mode
- Pack validation errors and warnings

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

## Policy decision types

The policy pipeline uses `PolicyDecisionType` and `PolicyFairnessScope` to identify what kind of decision is being evaluated and what scope fairness applies to. These fields are available in `SelectionPolicyInput.context` and allow both the default TypeScript policy and custom Rego policies to branch their logic by decision context.

### PolicyDecisionType values

| Value | When used |
|-------|-----------|
| `league_match_selection` | League match per-match selection generation |
| `league_round_fairness` | League round-level fairness evaluation |
| `event_squad_generation` | Event squad generation (all modes) |
| `event_helper_selection` | Event match helper/support selection |
| `event_lineup_planning` | Event match lineup planning |
| `post_match_report_availability` | Post-match report availability checks |

### PolicyFairnessScope values

| Value | What it scopes |
|-------|----------------|
| `match` | Fairness within a single league match |
| `round` | Fairness across a league match round |
| `period` | Fairness across a league season part (spring/fall) |
| `season` | Fairness across the full season year |
| `event` | Fairness within a complete event |
| `event_match` | Fairness within a single event match |

The `fairnessScope` field is optional. It is populated when the policy is evaluated in a context where fairness scope is meaningful (league round fairness, event fairness). It may be absent for pre-selection checks that do not involve fairness scoring.

### Default TypeScript policy branching by mode

The default Matchboard policy (`src/lib/policies/default-matchboard-policy.ts`) branches on `input.context.mode`:

- **League mode** (`mode === "league"`): Applies fairness score adjustments for low match opportunity (`low_recent_match_count`, `low_period_match_count`, `low_season_match_count`). These adjustments give eligible players with fewer recent matches a higher selection priority.
- **Event mode** (`mode === "event"`): Does not apply fairness score adjustments. Event selection prioritizes formation/role fit and balance rather than historical match opportunity. Event mode does emit a `squad_below_target_but_playable` info warning when a squad has players but is below target size.

Both modes apply core invariants, goalkeeper coverage warnings, and squad minimum size warnings. The mode distinction only affects whether historical fairness scoring adjustments are included.

### `squad_below_target_but_playable` info warning

The `squad_below_target_but_playable` warning (severity: `info`) is emitted in event mode when a squad has at least one player but fewer than the target squad size. This is a planning note, not a blocker — it informs the coach that the squad is below target but still viable. In league mode, below-target conditions are handled separately by the solver and plan integrity signal model.

### Rego policy conditional logic

Custom Rego policies should use `input.context.mode` and `input.context.decisionType` to conditionally apply rules:

```rego
# Example: Only apply fairness adjustments in league mode
league_fairness_adjustments := [adj |
    input.context.mode == "league"
    some p in input.players
    p.available_for_context == true
    recent_count := object.get(p, "recent_match_count", 0)
    recent_count <= 1
    adj := {
        "player_id": p.id,
        "delta": 5,
        "reason": "Player has had fewer recent match opportunities.",
        "code": "rego_league_low_recent_match_count",
    }
]

# Example: Only warn about goalkeeper coverage in event squad generation
event_gk_warning := [{"code": "rego_event_no_gk", "severity": "warning", "message": "Event squad has no goalkeeper.", "team_id": s.team_id}] {
    input.context.decisionType == "event_squad_generation"
    some s in input.squads
    s.primary_goalkeeper_count == 0
}
```

Core invariants apply in all modes and cannot be bypassed by conditional Rego logic.