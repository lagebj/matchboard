# ADR 0024: Policy Pack Management

## Status

Proposed

## Context

Stages 2–4 established the Rego/Wasm policy adapter, operational policy usage, and rule migration. The current policy infrastructure has several gaps:

1. **Single hardcoded Wasm path** — `MATCHBOARD_POLICY_WASM_PATH` points to a single file. There is no concept of multiple policy packs, pack selection, or pack metadata.
2. **No pack identity** — The runtime knows "rego enabled/disabled" and a file path. It does not know which policy pack is active, what version it is, what Rego source produced it, or whether it was tested.
3. **No validation** — There is no script to validate that a policy pack's metadata, Rego source, compiled artifact, and fixtures are consistent and complete.
4. **No rollback mechanism** — Changing the active policy means replacing the Wasm file and redeploying. There is no documented way to roll back beyond reverting a deployment.
5. **No example packs** — The `policies/rego/examples/` directory contains two Rego files, but they are not structured as packable units with metadata, fixtures, and tests.
6. **No pack listing** — No script to list available packs, their versions, entrypoints, and compiled status.

The existing structure:

```
policies/
  rego/
    matchboard_selection.rego
    matchboard_selection_test.rego
    custom/
      README.md
    examples/
      equal_opportunity.rego
      goalkeeper_coverage.rego
  compiled/
    README.md
    (matchboard_selection.wasm is gitignored)
```

Scripts:
- `scripts/build-opa-policy.mjs` — builds from `policies/rego/` to `policies/compiled/matchboard_selection.wasm`
- `scripts/policy-dry-run.mjs` — evaluates a fixture against the default or Rego policy
- `scripts/workbench-dry-run.mjs` — workbench dry-run

Environment variables:
- `MATCHBOARD_POLICY_REGO_ENABLED` — enable Rego (default: false)
- `MATCHBOARD_POLICY_WASM_PATH` — path to Wasm artifact (default: `policies/compiled/matchboard_selection.wasm`)
- `MATCHBOARD_POLICY_REGO_FAILURE_MODE` — `fail_closed` (default) or `fail_open`

Runtime:
- `src/lib/policies/rego-policy-adapter.ts` — `RegoPolicyAdapter` loads Wasm, evaluates, normalizes results
- `src/lib/policies/policy-version.ts` — computes sha256 hash of Wasm artifact
- `src/lib/policies/selection-policy-adapter.ts` — `CompositePolicyAdapter` chains core invariants → default policy → optional Rego

## Decision

Introduce a policy pack model: a deliberate, versioned, validated unit of custom Rego policy configuration.

### Policy pack structure

Migrate from the current flat structure to packs:

```
policies/
  packs/
    matchboard-default/
      policy-pack.json
      rego/
        matchboard_selection.rego
        matchboard_selection_test.rego
      fixtures/
        event-squad-generation.json
        league-match-selection.json
      compiled/
        matchboard_selection.wasm

    custom-example/
      policy-pack.json
      rego/
        custom_selection.rego
        custom_selection_test.rego
      fixtures/
        event-squad-generation.json
      compiled/
        custom_selection.wasm
```

This is a migration from the current `policies/rego/` and `policies/compiled/` structure. The migration must:
- Move `policies/rego/matchboard_selection.rego` and `policies/rego/matchboard_selection_test.rego` into `policies/packs/matchboard-default/rego/`
- Move `policies/compiled/matchboard_selection.wasm` (when present) into `policies/packs/matchboard-default/compiled/`
- Move existing test fixtures into `policies/packs/matchboard-default/fixtures/`
- Keep `policies/rego/examples/` as-is for reference examples (not packs)
- Keep `policies/rego/custom/README.md` as-is (migration guide)
- Update `scripts/build-opa-policy.mjs` to build from the pack structure
- Update `scripts/policy-dry-run.mjs` to accept `--pack` parameter
- Update environment variables and runtime loader

### Policy pack metadata

Each pack has a `policy-pack.json` metadata file. This is metadata only — it is not a policy DSL and must not contain rules, conditions, effects, or custom operators.

Required fields:
- `id` — unique pack identifier (kebab-case)
- `name` — human-readable name
- `version` — semver version string
- `description` — one-line description
- `entrypoint` — Rego entrypoint (e.g., `matchboard/selection/decision`)
- `regoDirectory` — relative path to Rego source directory
- `compiledWasm` — relative path to compiled Wasm artifact
- `fixturesDirectory` — relative path to fixtures directory
- `runtime` — must be `opa-wasm`
- `schemaVersion` — integer, must be `1`

Forbidden:
- rules, conditions, effects, custom operators, JSON policy logic, anything resembling the old JSON DSL

### Active policy pack selection

New environment variable:
- `MATCHBOARD_POLICY_PACK_ID` — selects which pack to load (default: `matchboard-default`)

Existing environment variables (unchanged semantics):
- `MATCHBOARD_POLICY_REGO_ENABLED` — enable Rego (default: `false`)
- `MATCHBOARD_POLICY_REGO_FAILURE_MODE` — `fail_closed` (default) or `fail_open`

The `MATCHBOARD_POLICY_WASM_PATH` variable remains for backward compatibility but is now derived from pack metadata when `MATCHBOARD_POLICY_PACK_ID` is set. If `MATCHBOARD_POLICY_WASM_PATH` is explicitly set, it takes precedence.

Rules:
- If Rego disabled: app uses core invariants + default TypeScript policy only
- If Rego enabled: app loads the selected policy pack
- If pack missing: follow failure mode (`fail_closed` throws, `fail_open` continues with default only)
- If metadata invalid: follow failure mode
- If Wasm missing: follow failure mode
- If policy result invalid: follow failure mode (always `fail_closed` for invalid results)

### Build and validation scripts

New and updated scripts:

| Script | Purpose |
|--------|---------|
| `npm run policy:list` | List available packs with id, name, version, entrypoint, compiled status |
| `npm run policy:validate` | Validate all packs (metadata, Rego dir, entrypoint, Wasm path, fixtures, no JSON DSL) |
| `npm run policy:test` | Run OPA tests for all packs (or `--pack <id>`) |
| `npm run policy:build` | Build Wasm for all packs (or `--pack <id>`) |
| `npm run policy:dry-run` | Dry-run a pack against a fixture |

### Artifact hashing

Each compiled Wasm artifact gets a sha256 hash computed at load time. The hash is:
- Exposed via `/api/admin/policy` diagnostics (already partially exists)
- Included in policy decision logs (new)
- Included in simulation output (new)
- Included in workbench diagnostics (already exists, extend)
- Never exposing full filesystem paths in production UI

### Runtime loader update

Update `rego-policy-adapter.ts` to:
- Resolve pack from `MATCHBOARD_POLICY_PACK_ID`
- Load `policy-pack.json` from the pack directory
- Validate metadata before loading Wasm
- Compute and cache artifact hash
- Return diagnostics including pack id, version, hash, and validation status

The loader remains:
- Server-only
- Next/Vercel compatible
- No runtime Rego compilation
- No child processes at runtime
- No OPA server/sidecar
- No client-side policy loading
- Cached per runtime instance

### Failure modes

Already partially implemented. Document and extend:

| Case | Mutation flows | Dry-run/workbench | Assistant/status |
|------|---------------|-------------------|------------------|
| Rego disabled | Default policy only | Default-only comparison | No Rego warning |
| Pack id missing | Fail closed | Show diagnostic, default-only if possible | Admin warning |
| Metadata missing | Fail closed | Show diagnostic | Admin warning |
| Metadata invalid | Fail closed | Show diagnostic | Admin warning |
| Wasm missing | Fail closed (with build instruction) | Show diagnostic | Admin warning |
| Wasm invalid | Fail closed | Show diagnostic | Admin warning |
| Rego evaluation failure | Fail closed / fail open (config) | Show error | Admin warning |
| Invalid result shape | Fail closed | Show error | Admin warning |

### Workbench integration

Update `/api/workbench/diagnostics` to include:
- Active policy pack id
- Active policy pack version
- Artifact hash
- Rego enabled/disabled
- Failure mode
- Pack validation status

Update workbench dry-run to accept `--pack` parameter.

### Simulation and audit integration

- Simulation output includes `policyPackId`, `policyPackVersion`, `artifactHash`, `policyMode`
- Policy decision logs include the same identity fields
- Historical audit can display stored policy identity where available (from `ruleConfigVersion` or decision log)
- Do not fake historical policy reconstruction if logs don't support it

### Policy pack examples

Provide useful example Rego files in `policies/packs/custom-example/`:
- Equal opportunity weighting
- Strict goalkeeper warning/block
- Event pool exclusion
- League period fairness
- Event helper overlap check
- Competitive event explanation

Examples must branch by `decisionType` where relevant and use coach-safe language.

### What we do NOT build

- In-app Rego editor
- Policy upload UI
- Runtime Rego compilation
- OPA server/sidecar
- Proprietary JSON policy DSL
- Unversioned `policy.wasm` file without metadata
- Manual undocumented Wasm file replacement

## Consequences

### Positive

- Policy packs are traceable: id, version, hash, source, fixtures
- Admins can validate packs before deployment
- Rollback is a config change (`MATCHBOARD_POLICY_PACK_ID=matchboard-default`) or redeploy
- Multiple packs can coexist (only one active at runtime)
- Wasm artifacts are paired with their source and metadata
- Examples provide real starting points for custom policies
- Workbench, simulation, and audit include policy identity for reproducibility

### Negative

- Directory migration from flat structure to packs requires build script updates
- Slightly more complex directory layout
- Pack metadata is one more file to maintain per custom policy

## Rejected alternatives

- Raw Rego editor in the app — violates deployment-only policy principle
- Policy upload UI — same concern, plus security
- Runtime Rego compilation — not Vercel-compatible, security risk
- OPA server/sidecar — adds operational complexity
- Custom JSON policy DSL — removed in Stage 4, must not return
- Single hardcoded Wasm path without metadata — current state, no traceability
- Manual undocumented Wasm file replacement — current state, no validation