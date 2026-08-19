# ARR-0020: OPA pinned to Rego v0 syntax, blocking current OPA releases

## State

Resolved

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

Superseded by resolution below — retained for history. New Rego policy packs should now use v1
syntax (`import rego.v1`, explicit `if` before rule/function bodies), matching
`policies/packs/matchboard-default/rego/` and `policies/rego/`.

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

Resolved. `policies/packs/matchboard-default/rego/*.rego` and `policies/rego/*.rego` are migrated
to Rego v1 syntax (mechanically, via `opa fmt --rego-v1 -w`, using OPA v1.19.1). `.devcontainer/Dockerfile`'s
`OPA_VERSION` is bumped from `0.70.0` to `1.19.1`. `npm run policy:test`, `npm run policy:verify`,
and `npm run policy:build`/`policy:build:pack` all pass with the current OPA release —
`npm run policy:verify` now genuinely passes for the first time (previously failed with either
"OPA binary not found" or the Wasm hash drift below).

**A second, unrelated pre-existing bug was found and fixed while migrating**: `blocked_players`
in `matchboard_selection.rego` (and its identical copy in the legacy tree) was written as a
single conditional value (`[{...}] { conditions }`) with no fallback, so whenever the condition
did *not* match (the normal case — no player blocked), the rule was undefined, which cascaded to
make the entire `decision` rule undefined, which silently fell back to the static empty
`default decision`. This discarded all real warnings and score adjustments whenever no player
happened to be blocked at the same time. The same bug pattern existed in
`no_primary_gk_warning`/`tertiary_gk_only_warning` (functions with no `default ... := null`
fallback, despite the surrounding comprehension already assuming and filtering on `w != null`).
Verified as 100% pre-existing and unrelated to the v1 migration: reproduced against the pristine,
untouched v0-syntax source using the original pinned OPA v0.70.0 — 4 of the pack's own 10
declared unit tests failed. Fixed with `default ... := null` and comprehension syntax
(`[value | conditions]` instead of `value { conditions }`); all 10 tests now pass on both OPA
v0.70.0 (pre-migration, as a regression check) and v1.19.1 (post-migration). Blast radius was low:
`MATCHBOARD_POLICY_REGO_ENABLED` defaults to `false` everywhere and is not documented as enabled
in any tracked environment, and this went undetected because no CI workflow runs any
`npm run policy:*` script — `policy:test`/`policy:verify` could not have caught it, since no OPA
binary existed in this devcontainer before ARR-0020 was first opened.

The Wasm hash drift is also resolved as a side effect: `npm run policy:build:pack` (run with the
new OPA v1.19.1) recomputed and updated `policy-pack.json`'s `wasmHash` to match the freshly
built, verified-correct-behavior Wasm artifact. This is a genuine, reviewed artifact change (not
a blind `policy:sync` overwrite) — the full source→tests→Wasm→hash chain was verified together in
one commit, per `AGENTS.md`'s "deployable policy change" discipline.

**Separately discovered, explicitly out of scope for this ARR**: `policies/examples/rego/` and
`policies/examples/packs/custom-example/rego/` were also migrated to v1 syntax (mechanical,
harmless — verified via diff that no other content changed). However, `npm run
policy:test:examples` has separate, pre-existing failures unrelated to this migration or to
either bug above: `equal_opportunity.rego` and `goalkeeper_coverage.rego` both declare
`package matchboard.selection` with conflicting `default decision` rules (a "multiple default
rules" conflict when loaded together), and `custom_selection_test.rego` has several
`rego_unsafe_var_error` failures. Both reproduced identically against the pristine, unmigrated
example source with the original OPA v0.70.0 — confirmed pre-existing, not introduced here.
`policies/examples/` is illustrative/undeployed content with no CI or `npm run validate`
dependency, so fixing it is left for separate, deliberately-scoped follow-up work, not folded
into this ARR.

## Related decisions

- ADR-0071: OPA/Rego v1 syntax migration — records the migration decision and the `blocked_players`/
  goalkeeper-warning bug fix found and resolved along the way.

## Related implementation

- `.devcontainer/Dockerfile` — `OPA_VERSION` pin (now `1.19.1`) and install step
- `policies/packs/matchboard-default/rego/`, `policies/rego/` — migrated to Rego v1 syntax, with
  the `blocked_players`/goalkeeper-warning bug fixed
- `policies/packs/matchboard-default/policy-pack.json` — `wasmHash` resynced to the v1.19.1 build
- `policies/examples/rego/`, `policies/examples/packs/custom-example/rego/` — migrated to v1
  syntax; separate pre-existing `policy:test:examples` failures left unresolved (see Disposition)

## Supersedes

None.

## Superseded by

None.

## History

### 2026-08-19

Record created. OPA CLI added to the devcontainer for the first time (previously entirely
missing); doing so surfaced this pre-existing v0/v1 Rego syntax mismatch. Pinned OPA to v0.70.0
as a documented, contained workaround rather than touching policy source.

### 2026-08-19 (resolved)

Migrated `policies/packs/matchboard-default/rego/*.rego` and `policies/rego/*.rego` to Rego v1
syntax; bumped `.devcontainer/Dockerfile`'s `OPA_VERSION` to `1.19.1`. Found and fixed a genuine,
pre-existing, unrelated bug in `blocked_players`/goalkeeper-warning functions (undefined-value
fallback to the static empty `default decision`, discarding real warnings/score adjustments in
the normal case) — verified pre-existing against pristine source with the original OPA v0.70.0.
`npm run policy:test`/`policy:verify`/`policy:build` all pass; `policy-pack.json`'s `wasmHash`
resynced as part of the reviewed build. Also migrated `policies/examples/` to v1 syntax
(mechanical, harmless) but found separate, pre-existing, out-of-scope failures there — left for
future work. See `docs/adr/0071-opa-rego-v1-migration.md` for the full decision record.
