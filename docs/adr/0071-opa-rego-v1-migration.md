# ADR-0071: OPA/Rego v1 syntax migration

## Status

Accepted

## Date

2026-08-19

## Context

`docs/arr/0020-opa-rego-v0-syntax-pinned.md` recorded that `policies/packs/matchboard-default/rego/*.rego`
and the legacy `policies/rego/*.rego` were written in Rego v0 syntax (no `if` keyword before rule/
function bodies), and that OPA v1.0.0 made Rego v1 syntax the default — any OPA release
`>= 1.0.0` fails to compile this source at all. `.devcontainer/Dockerfile` was pinned to OPA
v0.70.0 (the last v0-default release) as a contained, documented workaround, with the syntax
migration deliberately deferred: migrating `.rego` syntax is a policy-behavior-adjacent change
requiring the full "source, tests, Wasm, hashes, and metadata aligned in one commit" discipline
`AGENTS.md` requires for policy changes, not something to do incidentally while fixing an
unrelated devcontainer gap.

That migration is now being done deliberately, as part of a broader backlog sweep. While
rehearsing it (in a scratch copy outside the repository, before touching any tracked file), a
second, unrelated, genuine bug surfaced: `blocked_players` and the two goalkeeper-warning
functions (`no_primary_gk_warning`, `tertiary_gk_only_warning`) in `matchboard_selection.rego`
were written as single conditional values with no fallback default. In Rego, a rule/function
defined as `value := X { conditions }` (or `X if { conditions }`) is **undefined** — not `X`'s
"empty" equivalent — when `conditions` doesn't hold. Because `decision` unconditionally
references `blocked_players`, and `squad_goalkeeper_warnings`'s comprehension unconditionally
builds an array literal from both warning functions' results, an undefined value from any of
these silently collapsed the *entire* `decision` rule to the static `default decision` (empty
blocked/warnings/score_adjustments/tags) — discarding all real policy output whenever the
triggering condition simply didn't match, which is the normal case for almost every input.

This was verified as 100% pre-existing and unrelated to the syntax migration: reproduced against
the pristine, untouched v0-syntax source using the original pinned OPA v0.70.0, with 4 of the
pack's own 10 declared unit tests failing. It went undetected because no CI workflow runs any
`npm run policy:*` script, and no OPA binary existed in this devcontainer to run them locally
before the `feat/swamp-procedure-runner` PR added one (which is what surfaced the v0/v1 syntax
mismatch that led to this ADR in the first place).

Blast radius is low: `MATCHBOARD_POLICY_REGO_ENABLED` defaults to `false` everywhere in this
repository and is not documented as enabled in any tracked/deployed environment (`AGENTS.md`,
`docs/adr/0024-policy-pack-management.md`, `docs/admin/policy-management.md`,
`docs/policies/README.md` all agree). When Rego is disabled, `src/lib/policies/rego-policy-adapter.ts`
never evaluates this source at all.

## Decision

1. **Migrate to Rego v1 syntax.** `policies/packs/matchboard-default/rego/*.rego` and
   `policies/rego/*.rego` (an exact, intentionally-kept-identical duplicate — see the legacy
   directory's own README) are migrated mechanically using `opa fmt --rego-v1 -w`, plus one
   required manual rename: several test cases in `matchboard_selection_test.rego` declared a
   local variable named `input`, which shadows Rego v1's reserved `input` global (a hard parse
   error under v1, not merely a style nit). Renamed to `testInput` throughout — a pure rename,
   verified via `opa test` before and after to produce identical pass/fail results.

2. **Fix the undefined-value bug alongside the migration**, not deferred to a separate change,
   because the migration's own verification step (`opa test`) cannot pass without it, and
   because both bugs live in the exact lines the migration is already touching:
   - `blocked_players`: converted from a single conditional value (`[{...}] { conditions }`) to a
     proper array comprehension (`[{...} | conditions]`) — the same pattern already correctly
     used elsewhere in the same file (`low_recent_match_adjustments`, `squad_goalkeeper_warnings`).
     A comprehension naturally evaluates to `[]` when nothing matches and to one element per
     match, instead of being undefined for the zero-match case.
   - `no_primary_gk_warning`/`tertiary_gk_only_warning`: given `default ... := null`, so they
     always return a value (the warning object, or `null`) instead of being undefined when their
     condition doesn't hold — matching what the surrounding comprehension's existing `w != null`
     filter already assumed.
   - Verified as a pure bug fix, not a behavior redesign: all 10 of the pack's own pre-existing
     unit tests (which already encoded the intended behavior — "a warning/adjustment appears when
     the condition holds") pass after the fix, on both the original OPA v0.70.0 (as a regression
     check, before any syntax migration) and the new v1.19.1 (after migration).

3. **Bump `.devcontainer/Dockerfile`'s `OPA_VERSION` from `0.70.0` to `1.19.1`** (current stable
   at decision time), now that the source compiles under it.

4. **Resync `policy-pack.json`'s `wasmHash`** via `npm run policy:build:pack` run with the new
   OPA release — this also resolves ARR-0020's separate Wasm-hash-drift finding, as a genuine
   reviewed artifact change (source, tests, and Wasm all verified together in one commit), not a
   blind `policy:sync` overwrite of a possibly-production-relevant artifact.

5. **Also migrate `policies/examples/`** (`policies/examples/rego/*.rego`,
   `policies/examples/packs/custom-example/rego/*.rego`) to v1 syntax for consistency — mechanical
   and verified harmless (no other content change) — but explicitly **not** fix the separate,
   pre-existing `npm run policy:test:examples` failures found there (a "multiple default rules"
   package conflict between two example files, and unrelated `rego_unsafe_var_error`s in
   `custom_selection_test.rego`), since both reproduce identically against the pristine,
   unmigrated example source and are unrelated to anything this ADR addresses. `policies/examples/`
   has no CI or `npm run validate` dependency. Left for separate, deliberately-scoped follow-up.

## Consequences

- `npm run policy:verify` passes for the first time in this repository's history (previously
  either "OPA binary not found" or a Wasm hash mismatch).
- New Rego policy packs should use v1 syntax (`import rego.v1`, explicit `if`) to match.
- If `MATCHBOARD_POLICY_REGO_ENABLED` is ever turned on in a deployed environment, its actual
  behavior now matches what the pack's own test suite has always claimed it should be — a
  behavior change in the sense that dormant, broken functionality is now dormant, working
  functionality, not a change to any currently-observed production behavior.
- `policies/examples/`'s pre-existing test failures remain open and undocumented as a numbered
  finding beyond this ADR's own note — low priority given no CI/validate dependency, but should
  be picked up separately if the examples are ever relied on as a template for a new custom pack.

## Related decisions

- `docs/arr/0020-opa-rego-v0-syntax-pinned.md` — the residue record this ADR resolves.
- `docs/adr/0016-opa-rego-wasm-policy-adapter.md` — original Rego/Wasm adapter architecture,
  unchanged by this migration (syntax-only + bug fix, no adapter contract change).
- `docs/adr/0068-swamp-procedure-runner.md` — the PR that first installed an OPA binary in this
  devcontainer, surfacing the v0/v1 mismatch this ADR resolves.

## History

- 2026-08-19: Accepted. Rego v1 migration completed alongside a genuine, verified-pre-existing
  bug fix in the default policy pack; `policy-pack.json`'s `wasmHash` resynced; `docs/arr/0020`
  marked Resolved.
