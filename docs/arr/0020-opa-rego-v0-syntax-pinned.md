# ARR-0020: OPA pinned to Rego v0 syntax, blocking current OPA releases

## State

Confirmed

## Identified

2026-08-19

## Residue

`policies/packs/*/rego/*.rego` (currently `policies/packs/matchboard-default/rego/`, plus the
legacy `policies/rego/matchboard_selection.rego`) is written in Rego v0 syntax — rule and function
bodies without the `if` keyword. OPA v1.0.0 made Rego v1 syntax the default; compiling this
policy source with any OPA release `>= 1.0.0` fails immediately:

```
error: load error: 3 errors occurred during loading:
.../matchboard_selection.rego:25: rego_parse_error: `if` keyword is required before rule body
.../matchboard_selection.rego:61: rego_parse_error: `if` keyword is required before function body
.../matchboard_selection.rego:71: rego_parse_error: `if` keyword is required before function body
```

This devcontainer previously had no OPA binary installed at all (`npm run policy:verify` failed
with "OPA binary not found" — a separate, now-fixed gap; see the `feat/swamp-procedure-runner`
PR). Installing a current OPA release to close that gap surfaced this v0/v1 syntax mismatch,
which had not been exercised or documented before.

## Intended architecture

Per `AGENTS.md`'s "Rego/Wasm policy adapter" section: "Custom policies are written in Rego,
compiled to Wasm before deployment, and evaluated inside the Next.js server runtime." Nothing in
that section specifies a Rego syntax version — the implicit expectation is that `npm run
policy:*` works with whatever OPA release is installed, kept reasonably current for security
patches.

## Evidence

- `policies/packs/matchboard-default/rego/matchboard_selection.rego` — v0 syntax (no `if`
  keyword), confirmed failing to compile under OPA v1.19.1 (current latest as of 2026-08-19)
- `policies/rego/matchboard_selection.rego` — legacy Rego source, same v0 syntax
- `scripts/policy-utils.mjs` `resolveOpaPath()` — no version pin or compatibility flag; picks up
  whatever `opa` binary is on `PATH` or cached in `.opa-cache/`
- `scripts/policy-sync.mjs` `buildWasm()` — invokes `opa build ... -t wasm` with no
  `--v0-compatible`/`--v1-compatible` flag
- `.devcontainer/Dockerfile` — now pins `OPA_VERSION=0.70.0` (the last 0.x release, which
  defaults to v0 syntax) specifically to avoid this failure without touching policy source or
  build scripts
- Verified: OPA v0.70.0 compiles `policies/packs/matchboard-default/rego` to a valid Wasm module
  (`file` confirms `WebAssembly (wasm) binary module version 0x1 (MVP)`); OPA v1.19.1 fails to
  load the same source at all
- **Separate, additional finding**: even with OPA v0.70.0 successfully compiling, `npm run
  policy:verify` still fails — the freshly rebuilt Wasm's SHA-256 hash does not match
  `policies/packs/matchboard-default/policy-pack.json`'s committed `wasmHash`
  (`a87759c7...` committed vs. `b2c048e6...` rebuilt). `policy-pack.json`'s `wasmHash` was last
  set in commit `5525b515` ("feat(policy): add policy pack management (Stage 9)", #113). Since no
  OPA binary existed in this devcontainer before this ARR's fix, `policy:verify`/`policy:sync`
  could never have been run successfully here since that commit — the drift has been silently
  unverifiable, not necessarily a real source/artifact mismatch. The most likely explanation is
  that whichever OPA version originally produced the committed Wasm differs from v0.70.0 (Wasm
  codegen is not guaranteed byte-stable across OPA compiler versions for identical Rego source).
  **Not resolved here**: running `policy:sync` would overwrite the committed, potentially
  production-deployed Wasm artifact, which is a deployable-policy-change decision requiring the
  full "source, tests, Wasm, hashes, and metadata aligned in one commit" review `AGENTS.md`
  requires — out of scope for a devcontainer-tooling fix.

## Impact

- OPA v0.70.0 (released 2024-10-31) will not receive further security patches — pinning it
  indefinitely means the policy toolchain's OPA dependency silently ages out of the security
  patch stream.
- Any future OPA release will continue to fail against this policy source until either the Rego
  files are migrated to v1 syntax, or a `--v0-compatible` flag is added to every `opa build`/`opa
  test` invocation in `scripts/policy-*.mjs`.
- This is architectural residue rather than a simple version bump because migrating `.rego`
  syntax is a policy-behavior-adjacent change requiring the full "source, tests, Wasm, hashes,
  and metadata aligned in one commit" discipline AGENTS.md requires for policy changes — not
  something to do incidentally while fixing an unrelated devcontainer gap.

## Containment

- Do not bump `OPA_VERSION` in `.devcontainer/Dockerfile` past the 0.x line without first
  migrating `policies/packs/*/rego/*.rego` (and the legacy `policies/rego/*.rego`) to v1 syntax
  and verifying `npm run policy:test`/`policy:verify` still pass.
- New Rego policy packs should still use v0 syntax to match the existing packs, until a
  deliberate, full migration is scoped and executed — mixing syntax versions across packs would
  make the eventual migration harder to reason about, not easier.

## Resolution criteria

- `policies/packs/*/rego/*.rego` and `policies/rego/*.rego` are migrated to Rego v1 syntax (or
  the build scripts explicitly pass `--v0-compatible`, as a documented interim choice).
- `.devcontainer/Dockerfile`'s `OPA_VERSION` is bumped to a current 1.x release.
- `npm run policy:test`, `npm run policy:verify`, and `npm run policy:sync` all pass against the
  migrated source with the current OPA release.
- Separately (can land sooner, does not require the v1 migration above): the `policy-pack.json`
  `wasmHash` drift is investigated and resolved deliberately — either by confirming the pinned
  v0.70.0 rebuild is behaviorally identical to the currently-deployed Wasm and re-syncing the
  hash with its own reviewed, tested commit, or by determining the drift reflects a real,
  unintended source/artifact mismatch that needs a different fix. Do not resolve by running
  `policy:sync` and committing the result without that review.

## Disposition

Accepted for now: pin OPA to v0.70.0 so the devcontainer's `npm run policy:*` commands work at
all against the existing policy source, without touching policy behavior. Revisit when a Rego v1
migration is deliberately scoped.

## Related decisions

None yet — a future Rego v1 migration would likely warrant its own ADR if it changes build
tooling conventions, given the "deployable policy change" discipline in `AGENTS.md`.

## Related implementation

- `.devcontainer/Dockerfile` — `OPA_VERSION` pin and install step
- `scripts/policy-utils.mjs`, `scripts/policy-sync.mjs`, `scripts/policy-verify.mjs` — OPA
  invocation sites that would need `--v0-compatible` if resolved via option (b) above
- `policies/packs/matchboard-default/rego/`, `policies/rego/` — the v0-syntax Rego source

## Supersedes

None.

## Superseded by

None.

## History

### 2026-08-19

Record created. OPA CLI added to the devcontainer for the first time (previously entirely
missing); doing so surfaced this pre-existing v0/v1 Rego syntax mismatch. Pinned OPA to v0.70.0
as a documented, contained workaround rather than touching policy source.
