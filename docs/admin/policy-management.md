# Policy Management

Policies are managed as deployment configuration, not edited inside the running app.

Admins manage policies by:

1. Editing Rego policy files in the repo
2. Running policy tests
3. Compiling policy to Wasm
4. Committing policy source and compiled artifact
5. Deploying the app

Normal app users (coaches) do not write policies. Coaches only see outcomes such as warnings, blocked reasons, score adjustments, and explanations produced by the policy pipeline. There is no in-app policy editor in this version.

Admins and self-hosters manage policies through the Git and deployment workflow described below.

## Policy Layers

The selection policy pipeline evaluates in three layers, in order:

### 1. Core Matchboard invariants (non-overridable)

Core invariants are enforced in TypeScript (`src/lib/policies/core-invariants.ts`). These rules cannot be overridden by any custom policy:

- Removed players cannot be selected
- Inactive players cannot be selected
- Unavailable players cannot be selected (unless context allows override)
- Duplicate player assignments in the same squad are blocked

Core invariants always apply. No Rego policy can allow something that a core invariant blocks.

### 2. Default Matchboard policy (built-in)

The default policy runs after core invariants (`src/lib/policies/default-matchboard-policy.ts`). It adds:

- Warnings for squads with no goalkeeper coverage
- Warnings for squads below minimum size
- Score adjustments for players with fewer recent, period, or season match opportunities
- Eligibility explanations for active available players

### 3. OPA/Rego policy (compiled to Wasm, always active)

OPA/Rego is a standard Matchboard runtime capability (ADR-0107) — there is no environment flag
that turns it off. The built-in `matchboard-default` pack runs after the default policy and
always degrades safely (returns an empty result, marks runtime `DEGRADED`) if its own Wasm
evaluation fails unexpectedly, rather than making coach workflows unavailable. Admins can also
activate a different, non-built-in policy pack. Custom Rego can:

- Make rules stricter (add additional blocked players)
- Add warnings
- Add score adjustments (bounded to ±20)
- Add explanations
- Add tags

Custom Rego **cannot**:

- Override core invariants (a player blocked by core invariants stays blocked)
- Mutate database state, make network calls, or perform side effects
- Replace squad generation or lineup generation
- Access secrets, read files, or use `http.send`

The composite pipeline merges results from all layers. Core invariants take absolute precedence. Policy-blocked players from custom Rego are added to (not subtracted from) the default blocked list.

## Files and directories

### Policy packs (primary)

Policy packs are the primary way to manage Rego policies. Each pack is a self-contained directory with metadata, source, compiled Wasm, and test fixtures.

| Path | Purpose |
|------|---------|
| `policies/packs/matchboard-default/policy-pack.json` | Default pack metadata |
| `policies/packs/matchboard-default/rego/matchboard_selection.rego` | Default Rego policy source |
| `policies/packs/matchboard-default/rego/matchboard_selection_test.rego` | Default Rego policy tests |
| `policies/packs/matchboard-default/compiled/matchboard_selection.wasm` | Default compiled Wasm artifact |
| `policies/packs/matchboard-default/fixtures/` | Default pack test fixtures |
| `policies/packs/custom-example/` | Example custom policy pack |
| `src/lib/policies/policy-pack.ts` | Pack discovery, validation, resolution, diagnostics |
| `scripts/build-opa-policy.mjs` | Build script (supports `--pack <id>`) |
| `scripts/policy-validate.mjs` | Pack metadata and structure validation |
| `scripts/policy-list.mjs` | List discovered packs |

### Legacy flat structure (backward-compatible)

| Path | Purpose |
|------|---------|
| `policies/rego/matchboard_selection.rego` | Legacy Rego policy source (still supported) |
| `policies/rego/matchboard_selection_test.rego` | Legacy Rego tests |
| `policies/rego/examples/` | Example policies for admins to copy and adapt |
| `policies/rego/custom/` | Directory for custom instance policies |
| `policies/compiled/matchboard_selection.wasm` | Legacy compiled Wasm artifact (fallback when no pack is active) |

### Runtime and evaluation

| Path | Purpose |
|------|---------|
| `src/lib/policies/policy-evaluation.ts` | Evaluation helpers: filter, adjust, format coach-facing reasons |
| `src/lib/policies/policy-signal-mapper.ts` | Map policy results to plan integrity signals |
| `src/lib/policies/policy-version.ts` | Policy version tracking (delegates to pack system) |
| `src/lib/policies/policy-decision-log.ts` | Decision summary builder for audit logging |
| `src/app/api/admin/policy/route.ts` | Admin diagnostics endpoint |

### Admin diagnostics endpoint

`GET /api/admin/policy` reports:

- Policy runtime health (`HEALTHY`/`DEGRADED`) — not a boolean "enabled" flag
- Last runtime error code, when degraded
- Policy version and artifact hash
- Active policy pack id, version, name, schema version, declared entrypoints, and failure mode
- Pack validation errors and warnings
- Whether the Wasm artifact is loaded

No player personal data is included in diagnostics output.

The active policy pack is always resolved from `MATCHBOARD_POLICY_PACK_ID` (default:
`matchboard-default`) — Rego evaluation itself has no separate enable flag. The Wasm path is
resolved from the pack's `policy-pack.json` unless `MATCHBOARD_POLICY_WASM_PATH` explicitly
overrides it.

## Creating a custom policy

### Using a policy pack (recommended)

1. **Create a pack directory** under `policies/packs/<your-pack-id>/`

2. **Add `policy-pack.json`** with required metadata:

   ```json
   {
     "id": "my-custom-policy",
     "name": "My Custom Policy",
     "version": "1.0.0",
     "description": "Custom policy for my instance",
     "schemaVersion": 2,
     "entrypoints": { "selection": "my_custom/selection/decision" },
     "regoDirectory": "rego",
     "compiledWasm": "compiled/my_custom_selection.wasm",
     "fixturesDirectory": "fixtures",
     "runtime": "opa-wasm",
     "failureMode": "fail_closed"
   }
   ```

   `failureMode` is optional (defaults to `"degraded_fallback"` — the same safe fallback the
   built-in pack always uses). Declare `"fail_closed"` if a broken custom policy should halt
   evaluation with an error instead of silently degrading.

   The `id` must match the directory name. Forbidden keys: `rules`, `conditions`, `effects`, `operators`.

3. **Place Rego policy files** in `policies/packs/<your-pack-id>/rego/`

   The policy must use a unique package name and export a `decision` rule.

4. **Validate pack metadata**:

   ```bash
   npm run policy:validate -- --pack <your-pack-id>
   ```

5. **Write tests** alongside your Rego source (e.g., `rego/my_custom_selection_test.rego`)

6. **Run Rego tests**:

   ```bash
   npm run policy:test:pack
   ```

7. **Compile policy to Wasm**:

   ```bash
   npm run policy:build -- --pack <your-pack-id>
   ```

8. **Dry-run the policy** against a fixture:

   ```bash
   npm run policy:dry-run -- --pack <your-pack-id> <fixture-name>
   ```

9. **Select the pack** by setting the pack id (Rego evaluation itself has no separate enable flag):

   ```bash
   MATCHBOARD_POLICY_PACK_ID=<your-pack-id>
   ```

10. **Run the full test suite and build**, then commit source and compiled artifact.

### Legacy workflow (backward-compatible, not recommended for new policies)

The legacy flat structure is still readable via `MATCHBOARD_POLICY_WASM_PATH`. Prefer a policy pack for anything new.

1. **Copy an example policy** from `policies/rego/examples/` to `policies/rego/matchboard_selection.rego`

   Available examples:
   - `equal_opportunity.rego` — boosts selection priority for players with few season matches
   - `goalkeeper_coverage.rego` — stricter goalkeeper coverage warnings

2. **Edit the policy** for your instance requirements. The policy must:
   - Use package `matchboard.selection`
   - Export a `decision` rule that produces an object with keys: `blocked`, `warnings`, `score_adjustments`, `explanations`, `tags`

3. **Write tests** in `policies/rego/matchboard_selection_test.rego`

4. **Run policy tests**:

   ```bash
   npm run policy:test
   ```

   This runs `opa test policies/rego`. You need the OPA CLI installed (`brew install opa` on macOS).

5. **Compile policy to Wasm**:

   ```bash
   npm run policy:build
   ```

   This runs `node scripts/build-opa-policy.mjs`, which compiles the Rego source to Wasm and writes the artifact to `policies/compiled/matchboard_selection.wasm`.

6. **Dry-run the policy** against a test fixture:

   ```bash
   npm run policy:dry-run -- test/fixtures/policies/event-selection-input.json
   ```

   This evaluates all three policy layers (core invariants, default Matchboard policy, custom Rego) and prints the results. The dry-run script accepts any JSON fixture path:

   ```bash
   npm run policy:dry-run -- test/fixtures/policies/lineup-input.json
   ```

7. **Set `MATCHBOARD_POLICY_WASM_PATH`** to point at the compiled legacy artifact (Rego evaluation itself always runs; this only selects which compiled artifact is loaded).

8. **Run the full test suite and build**:

   ```bash
   npm run lint
   npm run typecheck
   npm test
   npm run build
   ```

9. **Commit both source and compiled artifact**:

   ```bash
   git add policies/rego/matchboard_selection.rego \
           policies/rego/matchboard_selection_test.rego \
           policies/compiled/matchboard_selection.wasm
   git commit -m "feat(policy): update custom selection policy"
   ```

10. **Deploy** the app. The compiled Wasm artifact is included in the deployment.

## Deploying custom policy on Vercel

No OPA server, custom server, or sidecar is needed.

- Rego is compiled to Wasm before deployment
- The compiled Wasm artifact must be included in the deployed app
- Policy evaluation runs server-side in the Next.js/Vercel runtime using `@open-policy-agent/opa-wasm`
- `next.config.ts` includes `outputFileTracingIncludes` for the Wasm artifact

### Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MATCHBOARD_POLICY_PACK_ID` | `matchboard-default` | Which policy pack to load. Must match a directory under `policies/packs/`. |
| `MATCHBOARD_POLICY_WASM_PATH` | *(pack-resolved)* | Path to the compiled Wasm artifact. When set, overrides the pack-resolved path. When not set, the Wasm path is resolved from the active pack's `policy-pack.json`. |
| `MATCHBOARD_POLICY_PACKS_DIR` | `policies/packs` | Override the packs directory (advanced, usually not needed) |

Set these in your Vercel project environment variables or your local `.env` file. There is no
`MATCHBOARD_POLICY_REGO_ENABLED`/`MATCHBOARD_POLICY_REGO_FAILURE_MODE` — Rego is always active
(ADR-0107), and failure behavior is declared per pack (`policy-pack.json`'s `failureMode`).

## Testing and validation

Required checks before deployment:

```bash
# Rego tests
npm run policy:test           # Legacy Rego tests
npm run policy:test:pack     # Pack-based Rego tests

# Build
npm run policy:build                      # Legacy build (no --pack flag)
npm run policy:build:pack                 # Build matchboard-default pack

# Validate
npm run policy:validate -- --pack <pack-id>  # Validate a specific pack
npm run policy:validate                     # Validate all packs

# Dry-run
npm run policy:dry-run -- <fixture-path>                      # Legacy dry-run
npm run policy:dry-run -- --pack <pack-id> <fixture-name>     # Pack dry-run

# List packs
npm run policy:list

# Full validation
npm run lint
npm run typecheck
npm test
npm run build
```

Invalid or untested policies can affect: squad generation, helper selection, lineup planning, and assistant recommendations. Always run the full validation sequence before deploying a policy change.

### Test fixture format

Test fixtures in `test/fixtures/policies/` are anonymized JSON files matching the `SelectionPolicyInput` schema. They must never contain real player data. Two fixtures are provided:

- `event-selection-input.json` — event squad selection context
- `lineup-input.json` — league lineup selection context

## Failure behavior

| Condition | Behavior |
|-----------|----------|
| Wasm artifact is missing or fails to load (built-in `matchboard-default` pack) | Always degrades safely: policy runtime marked `DEGRADED`, empty Rego result returned, default TypeScript policy still applies. Never throws to the coach-facing request. |
| Wasm artifact is missing or fails to load (custom pack with `failureMode: "fail_closed"`) | Error propagated (`PolicyRuntimeError`); the composite pipeline fails. |
| Rego evaluation throws an error | Same split as above, by the active pack's `failureMode`. |
| Rego result has invalid shape from an otherwise-successful evaluation | Always errors (`RegoPolicyError`) regardless of `failureMode` — a malformed policy result is a policy-content bug, never silently masked. |
| Custom policy blocks additional players | Additive: custom blocked players are merged with default blocked players. Core invariants still apply. |
| Custom policy produces extreme score adjustments | Clamped to ±20. Values outside `[-20, 20]` are clamped to the nearest bound. |

`"degraded_fallback"` (the default, and the only mode the built-in pack may use) ensures the app
stays usable for coaches even when Matchboard's own shipped policy has a runtime problem. Declare
`"fail_closed"` on a custom pack only if you want a broken custom policy to halt evaluation
immediately rather than silently degrade.

## Safe admin practices

- **Never edit compiled Wasm directly.** Always edit Rego source, then rebuild.
- **Commit source and compiled artifact together.** The Wasm file must be in the repo for deployment.
- **Do not commit real player data in policy fixtures.** Use anonymized IDs and names only.
- **Do not use Rego for core invariants.** Core invariants belong in TypeScript (`src/lib/policies/core-invariants.ts`).
- **Do not use policy wording that shames players.** Policy language must follow the same child-safe, coach-facing rules as the rest of Matchboard. See the domain language rules in `AGENTS.md`.
- **Keep custom policies small and tested.** Large policies are harder to debug and slower to evaluate.
- **Prefer warnings before hard blocks** unless the rule is truly strict (e.g., safety requirements). Warnings inform the coach; blocks prevent actions.
- **Run the full validation sequence** (`policy:test`, `policy:build`, `policy:dry-run`, `lint`, `typecheck`, `test`, `build`) before every deployment.
- **Use the dry-run utility** to verify policy output against known fixtures before enabling in production.

## Example admin policies

### Example 1: Increase selection priority for players with fewer recent match opportunities

This policy boosts the selection score for players who have had 1 or fewer recent matches, giving them slightly higher priority in squad generation.

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

blocked_players := []

all_warnings := []

all_score_adjustments := [adj |
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

all_explanations := [exp |
  some p in input.players
  p.status == "ACTIVE"
  p.available_for_context == true
  recent_count := object.get(p, "recent_match_count", 0)
  recent_count <= 1
  exp := {
    "player_id": p.id,
    "code": "rego_low_recent_match_count",
    "summary": "Priority boost: player has had few recent matches.",
    "hard_rule": false,
  }
]

all_tags := []
```

### Example 2: Warn when squad has no primary goalkeeper coverage

This policy adds blocking warnings when a squad has no primary goalkeeper, and regular warnings when only tertiary (emergency) goalkeeper coverage exists.

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

blocked_players := []

all_warnings := squad_goalkeeper_warnings

all_score_adjustments := []

all_explanations := []

all_tags := []

squad_goalkeeper_warnings := [w |
  some squad in input.squads
  some w in [
    no_primary_gk_warning(squad),
    tertiary_gk_only_warning(squad),
  ]
  w != null
]

no_primary_gk_warning(squad) := {
  "code": "rego_no_primary_goalkeeper",
  "severity": "blocking",
  "message": "Squad has no primary goalkeeper coverage.",
  "team_id": object.get(squad, "team_id", null),
} {
  squad.primary_goalkeeper_count == 0
  squad.any_goalkeeper_count == 0
}

tertiary_gk_only_warning(squad) := {
  "code": "rego_tertiary_goalkeeper_only",
  "severity": "warning",
  "message": "Squad only has tertiary goalkeeper coverage.",
  "team_id": object.get(squad, "team_id", null),
} {
  squad.primary_goalkeeper_count == 0
  squad.any_goalkeeper_count > 0
}
```

### Entrypoint contract

All custom Rego policies must use the `matchboard.selection` package and export a `decision` rule. The `decision` rule receives `input` matching the Stage 2 input schema and must return an object with these keys:

| Key | Type | Description |
|-----|------|-------------|
| `blocked` | array of `{player_id, reasons}` | Players blocked from selection with reason codes |
| `warnings` | array of `{code, severity, message, team_id?, player_id?}` | Policy warnings (severity: `info`, `warning`, or `blocking`) |
| `score_adjustments` | array of `{player_id, delta, reason, code}` | Score adjustments (delta clamped to ±20) |
| `explanations` | array of `{player_id, code, summary, hard_rule}` | Human-readable explanations |
| `tags` | array of `{player_id, tag, reason}` | Policy tags for tracking |

All keys are required. Use empty arrays for unused categories.

The `input` object provides:

- `input.players` — array of player objects with `id`, `status`, `available_for_context`, `recent_match_count`, `season_match_count`, `period_match_count`, `current_team_ids`, `goalkeeper_ability`, `primary_position`, `policy_tags`
- `input.teams` — array of team objects with `id`, `name`, `target_squad_size`, `min_squad_size`, `max_squad_size`
- `input.squads` — array of squad objects with `id`, `team_id`, `player_id_list`, `primary_goalkeeper_count`, `any_goalkeeper_count`
- `input.matches` — array of match objects with `id`, `is_cancelled`, `opponent_name`
- `input.history` — object with `player_match_count_map`, `player_role_map`, `player_recent_support_count`
- `input.constraints` — object with `max_squad_size`, `min_squad_size`, `target_squad_size`, `require_goalkeeper`
- `input.context` — object with `phase`, `mode`, `now_iso`, `game_format`

Use `object.get(object, key, default)` for optional fields that may be absent from the input.

## Current limitations

- No in-app policy editor. Policies are managed through Git and deployment.
- No policy upload UI. Policies are files in the repository.
- No per-coach policy customization. Custom policy is instance-level configuration.
- No runtime Rego compilation. Rego must be compiled to Wasm before deployment.
- No OPA daemon or server required. Policy evaluation runs in-process via Wasm.
- No browser or client-side policy evaluation. All evaluation is server-side.
- Custom policy is deployment configuration, not user configuration.
- Score adjustments are bounded to ±20. Values outside this range are clamped.
- Rego cannot override core invariants. A player blocked by core invariants cannot be unblocked by Rego.