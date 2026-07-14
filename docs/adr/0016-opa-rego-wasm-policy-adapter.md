# ADR 0016: OPA/Rego Wasm Policy Adapter

## Status

Accepted

## Context

Stage 1 (ADR 0015) implemented a policy-capable selection engine with:
- Core invariants (TypeScript, non-overridable)
- Default Matchboard policy (TypeScript)
- JSON policy DSL (proprietary, for custom instance policies)

The JSON DSL was a stepping stone. The task now requires a real OPA/Rego adapter that can run inside Next.js on Vercel without an OPA server, sidecar, or custom server.

The JSON DSL has limited expressiveness and is proprietary to Matchboard. Rego is a standard policy language with broad ecosystem support, tooling, and community knowledge. This ADR documents Stage 2: replacing the proprietary DSL with OPA/Rego compiled to WebAssembly.

## Decision

Implement Rego policy evaluation using compiled WebAssembly artifacts evaluated by `@open-policy-agent/opa-wasm` inside the Next.js server runtime.

### Architecture

```
Rego policy source (policies/rego/)
  -> compiled before deployment using OPA CLI
  -> compiled policy.wasm artifact (policies/compiled/)
  -> Next.js server loads policy.wasm at runtime
  -> @open-policy-agent/opa-wasm evaluates policy input
  -> result normalized into Matchboard SelectionPolicyResult
```

### Hard constraints met

- No OPA server
- No custom Node server
- No sidecar containers
- No runtime Rego compilation
- No browser/client-side evaluation
- No proprietary policy DSL (JSON DSL retained as legacy, not extended)

### Policy layering

1. **Core invariants** (TypeScript, non-overridable)
2. **Default Matchboard policy** (TypeScript, always runs)
3. **Optional Rego custom policy** (Wasm, enabled via `MATCHBOARD_POLICY_REGO_ENABLED`)

Core invariants are checked first. Default policy runs second. Rego policy runs third if enabled. Results are merged. Core invariant blocks cannot be removed by Rego.

### Configuration

| Variable | Default | Purpose |
|----------|---------|---------|
| `MATCHBOARD_POLICY_REGO_ENABLED` | `false` | Enable Rego adapter |
| `MATCHBOARD_POLICY_WASM_PATH` | `policies/compiled/matchboard_selection.wasm` | Path to compiled Wasm artifact |
| `MATCHBOARD_POLICY_REGO_FAILURE_MODE` | `fail_closed` | `fail_closed` or `fail_open` |

### Score adjustment bounds

Rego score adjustments are clamped to ±20. This prevents custom policies from distorting selection scoring beyond a controlled range.

### Composite pipeline

```
Input: normalized PolicyInput
  │
  ├─ 1. Core invariants (TypeScript) → blocks that cannot be overridden
  │
  ├─ 2. Default Matchboard policy (TypeScript) → standard rules
  │
  ├─ 3. Rego custom policy (Wasm, if enabled) → instance-specific rules
  │
  └─ Merge: union of blocks, warnings, score adjustments (clamped), explanations, tags
      → SelectionPolicyResult
```

### Failure behavior

| State | Behavior |
|-------|----------|
| Rego disabled | Core + default TypeScript policy only |
| Rego enabled and valid | Core + default + Rego |
| Rego enabled, Wasm file not found | `fail_closed`: selection mutation flows fail; `fail_open`: falls back to core + default |
| Rego enabled, invalid Wasm artifact | `fail_closed`: selection mutation flows fail; `fail_open`: falls back to core + default |
| Rego enabled, runtime evaluation error | `fail_closed` or `fail_open` per configuration |

In `fail_closed` mode, selection-generation, manual-edit, and finalization flows fail with a clear error message. Assistant and preview flows can fall back to default policy in `fail_open` mode.

### Key files

| File | Purpose |
|------|---------|
| `src/lib/policies/types.ts` | Policy input/result type definitions |
| `src/lib/policies/core-invariants.ts` | Non-overridable core invariant checks |
| `src/lib/policies/build-policy-input.ts` | Build normalized policy input from app data |
| `src/lib/policies/default-matchboard-policy.ts` | Default Matchboard eligibility/warning/scoring policy |
| `src/lib/policies/selection-policy-adapter.ts` | Policy adapter interface, composite pipeline, factory |
| `src/lib/policies/rego-policy-adapter.ts` | OPA/Rego Wasm adapter for custom Rego policies |
| `src/lib/policies/json-policy-dsl.ts` | JSON DSL rule evaluation (legacy, internal use only) |
| `src/lib/policies/json-policy-loader.ts` | Load and validate policy packs from JSON files |
| `policies/rego/matchboard_selection.rego` | Rego policy source |
| `policies/rego/matchboard_selection_test.rego` | Rego policy tests |
| `policies/compiled/matchboard_selection.wasm` | Compiled Wasm artifact |
| `scripts/build-opa-policy.mjs` | Build script: compile Rego to Wasm |
| `scripts/policy-dry-run.mjs` | Dry-run utility for policy evaluation |

### Rego capabilities and restrictions

Rego may:
- Add blocked player reasons
- Add warnings
- Add score adjustments (bounded ±20)
- Add explanations
- Add tags

Rego may not:
- Override core invariants
- Allow players blocked by core invariants
- Mutate data, access the database, access secrets, make network calls, depend on `http.send`, read files, perform side effects, replace squad generation, replace lineup generation, or alter historical snapshots

### `server-only` import

The Rego adapter module uses `server-only` to prevent client-side leakage of policy evaluation logic or Wasm loading.

## Consequences

### Positive

- Standard OPA/Rego policy language — no proprietary DSL
- Runs in standard Next.js deployment on Vercel
- No external services required
- Rego tests can be run independently with `opa test`
- Core invariants are guaranteed non-overridable
- Custom policies can make rules stricter, add warnings, adjust scoring, add explanations
- Score adjustment clamping prevents scoring distortion
- Clear failure modes with configurable fail-open/fail-closed behavior

### Negative

- Compiled Wasm artifact must be tracked in the repo or rebuilt during deployment
- OPA CLI must be installed locally to compile Rego
- Wasm evaluation adds minor latency per policy evaluation
- Rego debugging is harder than TypeScript debugging
- `server-only` import needed to prevent client-side leakage

## Risks and mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Wasm file not found | Selection flows fail in fail_closed mode | Clear error message; fail_open fallback for read flows |
| Invalid Wasm artifact | Policy evaluation fails | Fail_closed with logged error; build script validates artifact |
| Rego runtime error | Partial or incorrect policy result | Per-configuration fail_closed or fail_open; logging captures error detail |
| Performance | Added latency per evaluation | Wasm evaluation is O(milliseconds); acceptable for selection pipeline |
| Stale Wasm artifact | Policy logic doesn't match Rego source | Build script compiles from source; CI can verify artifact freshness |

## Rejected alternatives

- **Custom JSON DSL as primary policy language**: Proprietary, limited expressiveness, no ecosystem tooling
- **OPA daemon/server**: Deployment complexity, not Vercel-compatible
- **Sidecar container**: Not Vercel-compatible
- **Runtime Rego compilation**: Security and performance risk — Rego compiler should not run in production
- **Client-side policy evaluation**: Security risk, data exposure — policy input contains coach-facing data
- **Implementing the selection solver in Rego**: Over-engineered, hard to debug, defeats the purpose of separating deterministic solving from configurable policy