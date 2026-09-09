# ARR-0037: `policy:verify`'s rebuild-and-compare check is architecture-dependent

## State

Resolved — Consolidation Programme C7 (F7), 2026-09-09. The cross-architecture non-reproducibility
of `opa build -t wasm` is upstream and unchanged, but it is no longer a *contract ambiguity*: the
canonical architecture (amd64) is now explicit in code and docs, `policy:verify` is
architecture-aware, and the scripts that would commit a wrong-arch artifact refuse to. See
"Resolution".

## Identified

2026-08-30

## Residue

`npm run policy:verify` (`scripts/policy-verify.mjs`) proves a committed policy pack's Wasm
artifact matches a fresh `opa build -t wasm` of its own committed Rego source, by rebuilding into
a temp directory and comparing SHA-256 hashes. This assumes `opa build -t wasm` produces
byte-identical output for identical Rego source regardless of which machine runs it. That
assumption is false across host CPU architectures.

Confirmed live: a `matchboard-default` Wasm artifact built and committed from an arm64
devcontainer (this repository's own devcontainer, `.devcontainer/Dockerfile`, on an `aarch64`
host) failed `policy-verify`'s first real CI run on GitHub's `ubuntu-24.04` (amd64) hosted runner
— the CI rebuild produced a different hash (`2a762459...` vs. the committed `8cd84090...`) for the
exact same OPA version (1.19.1) and exact same Rego source. Isolated the cause: three consecutive
local rebuilds on the arm64 devcontainer produced an *identical* hash every time (ruling out
general non-determinism, e.g. Go map iteration order varying per process) — the divergence is
specifically tied to which architecture's `opa` binary performed the compilation. The two
resulting Wasm artifacts are behaviourally identical (verified: both correctly expose the
`matchboard/selection/decision` and `matchboard/situation/decision` entrypoints and evaluate to
identical results for the same input) — this is a byte-level packaging difference in the OPA
Wasm-target compiler, not a Rego semantics bug.

## Intended architecture

AGENTS.md's "deployable policy change is incomplete until source, tests, Wasm, hashes, and
metadata are aligned in one commit" and ADR-0107's "built-in policy artifact required in
build/deploy validation" both implicitly assume one canonical, reproducible build process whose
output can be verified from any machine running the same OPA version. `policy:verify`'s
hash-compare design is the concrete implementation of that assumption.

## Evidence

- `scripts/policy-verify.mjs` — rebuilds to a temp dir and compares SHA-256 against
  `policy-pack.json`'s `wasmHash`, with no architecture awareness.
- CI run `33303090441` (job `Policy Verify`, PR #389, commit `bc17dc58`) — first real failure,
  full log captured in this session's transcript: `Committed: 8cd84090...` vs.
  `Rebuilt: 2a762459...`.
- Local reproduction: `for i in 1 2 3; do node scripts/build-opa-policy.mjs --pack
  matchboard-default; sha256sum policies/packs/matchboard-default/compiled/matchboard_selection.wasm;
  done` on the arm64 devcontainer — identical hash (`8cd84090...`) all three times, ruling out
  per-process non-determinism.
- CI run `33303598453`'s diagnostic upload (`policy-wasm-rebuilt-33303598453` artifact, added in
  commit `3b974633` specifically to capture this) — downloaded and verified: same hash
  (`2a762459...`) CI's failure log reported, confirming the artifact is reproducible *within* the
  amd64 architecture, just not *across* architectures.
- `.devcontainer/Dockerfile` targets whatever host architecture the devcontainer runs on
  (unpinned) — this repository's devcontainer has been run on arm64 (this session) — while every
  CI runner (`ci-checks.yml`: `runs-on: ubuntu-24.04`) is GitHub-hosted amd64.

## Impact

- A contributor developing on an arm64 machine (Apple Silicon, arm64 Linux) who runs `npm run
  policy:sync`/`policy:build` locally and commits the result will produce a Wasm artifact that
  fails CI's `policy-verify` job on the very next push, even though the Rego source is completely
  correct — a confusing false-positive failure that looks like a policy bug but is actually a
  toolchain packaging difference.
- `npm run policy:verify` can never pass locally on a non-amd64 devcontainer once the committed
  artifact is amd64-canonical (as it now is, post-incident) — a developer on arm64 must trust
  CI's `policy-verify` job as authoritative rather than their own local run, which is a real,
  ongoing workflow friction, not a one-time fix.
- This is architectural residue rather than an ordinary bug because it exposes a mismatch between
  the *intended* single-source-of-truth verification model (works identically anywhere) and what
  the OPA Wasm toolchain *actually* guarantees (reproducible only within one host architecture) —
  fixing the immediate hash mismatch (done, see Resolution) does not remove the underlying
  cross-architecture non-reproducibility, which will resurface on the next policy change made
  from a non-amd64 machine unless contained.

## Containment

- **Do not run `npm run policy:sync` or `npm run policy:build[:pack]` and commit the resulting
  `.wasm`/`policy-pack.json` changes from a non-amd64 machine without first confirming the
  resulting hash against CI** — either by pushing and downloading `ci-checks.yml`'s
  `policy-verify` job's diagnostic `policy-wasm-rebuilt-<run-id>` artifact (added in commit
  `3b974633` specifically for this) and using *that* build instead of the local one, or by some
  future equivalent mechanism.
- Do not "fix" a `policy:verify` failure by weakening the check (e.g. removing the hash comparison
  or making it advisory) — the check is doing its job correctly; the containment is procedural
  (build on/via the canonical architecture), not a check to relax.
- Do not assume a green local `npm run policy:verify` run on a non-amd64 machine proves anything
  about what CI will report, once the committed artifact is amd64-canonical — a non-amd64 local
  pass would actually indicate the artifact has drifted back to that machine's architecture.

## Resolution criteria

Full resolution (removing this ARR) requires one of:

- OPA's own Wasm-target compiler becomes byte-reproducible across host architectures for
  identical input (upstream fix, outside this repository's control), or
- This repository adopts a single canonical build path all contributors use regardless of their
  own machine's architecture (e.g., a documented "always build/sync policy changes through this
  CI workflow, never locally" rule, or a containerized build step pinned to amd64 available to
  every contributor), making the architecture question moot rather than merely contained.

## Resolution

Consolidation Programme C7 took the "documented single canonical build path" option (the second
bullet above), plus made the check itself architecture-aware so it is no longer a false failure
off amd64:

- **`scripts/policy-verify.mjs`** — the deterministic stored-hash check and `opa build` success
  still hard-fail on every host. The *rebuild-hash comparison* only hard-fails when
  `process.arch === "x64"` (the canonical arch = CI) or `--strict` / a matching
  `MATCHBOARD_POLICY_CANONICAL_ARCH` is passed. On any other host a `DRIFT` is printed as an
  explicit advisory (`DRIFT (expected off canonical arch)`) and `policy:verify` exits 0. CI's
  `policy-verify` job now runs `npm run policy:verify -- --strict`.
- **`scripts/policy-sync.mjs` / `scripts/build-opa-policy.mjs`** — via
  `assertCanonicalArchForArtifactRegen()` in `policy-utils.mjs`, both refuse to run on a non-x64
  host (unless `--force` / `CI`), because they mutate the committed `.wasm` + `wasmHash` and
  would produce a wrong-architecture artifact. This closes the ARR-0037 trap where the failing
  check's own hint ("Run `npm run policy:sync`") led an arm64 developer straight into it.
- **`npm run validate`** is now `scripts/run-validate.mjs` — it runs every step and reports a
  summary instead of aborting the `&&` chain, so a `policy:verify` result (advisory or not) can
  never mask the checks after it.
- **Documented** in `AGENTS.md` ("Quality checks must pass" + the policy section),
  `docs/development/coding-agent-working-session.md`, `README.md`, and
  `docs/development/swamp-workflows.md` — the amd64-canonical rule and the advisory-off-amd64
  behaviour are stated in the validation contract itself, not tribal knowledge or a personal
  memory file.

The residual upstream fact (OPA's Wasm-target compiler is not byte-reproducible across host
architectures) is unchanged and outside this repo's control; if OPA ever fixes it, the
architecture-awareness here becomes a harmless no-op.

## Disposition

Resolved. The contract ambiguity F7 named is gone: the canonical architecture is explicit in
code and every place the validation contract is documented, `policy:verify` no longer produces a
false failure off amd64, and the artifact-regen scripts refuse to create the wrong-arch artifact.

## Related decisions

- ADR-0107 (introduced the `policy-verify` CI job that first surfaced this).
- ARR-0020 (resolved) — separately documented that Wasm codegen is "not guaranteed byte-stable
  across OPA compiler *versions*"; this ARR extends that same underlying caution to compiler
  *host architecture*, a distinct dimension the resolved ARR-0020 did not cover.

## Related implementation

- `.github/workflows/ci-checks.yml`'s `policy-verify` job — added the diagnostic
  `policy-wasm-rebuilt-${{ github.run_id }}` artifact upload (commit `3b974633`) used to resolve
  the immediate incident.
- `policies/packs/matchboard-default/compiled/matchboard_selection.wasm` and
  `policy-pack.json`'s `wasmHash` — replaced with the CI (amd64)-built artifact downloaded from
  that diagnostic upload, verified behaviourally identical to the arm64 build before committing.

## Supersedes

None.

## Superseded by

None.

## History

### 2026-08-30

Record created. First real run of the newly-added `policy-verify` CI job (ADR-0107) failed
because the committed `matchboard-default` Wasm artifact was built on an arm64 devcontainer while
CI rebuilds and compares on amd64. Verified the divergence is architecture-specific (not general
non-determinism) via three stable local rebuilds. Added a diagnostic artifact-upload step to the
CI job, downloaded the amd64-canonical rebuild, verified it behaviorally identical to the arm64
build, and replaced the committed artifact/hash with it — resolving the immediate incident while
leaving the underlying cross-architecture non-reproducibility risk contained (procedural, not
structural) rather than fully resolved.
