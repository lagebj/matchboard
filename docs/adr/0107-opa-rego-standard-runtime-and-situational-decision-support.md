# ADR-0107: OPA/Rego becomes a standard runtime capability; situational decision-support architecture

## Status

Accepted

## Date

2026-08-30

## Context

Matchboard's selection engine already has a policy-capable architecture (ADR-0015 through
ADR-0020, ADR-0024): core TypeScript invariants → default TypeScript policy → an optional custom
Rego policy compiled to Wasm and evaluated via `@open-policy-agent/opa-wasm`. That optional layer
has always been gated behind `MATCHBOARD_POLICY_REGO_ENABLED`, defaulting to `false`, with no
tracked environment enabling it. `isRegoEnabled()`/`regoEnabled` model Rego as a global on/off
application concept rather than a standing runtime capability.

Separately, Matchboard's coach-facing workflow is organised around modules/categories (Today's
`AssistantWorkItem` + `CATEGORY_PRIORITY`, League, Events, Players, Insights). As the domain model
has grown (readiness signals, plan integrity, combination evidence, opportunity/exposure insights,
review requests), the same underlying fact can matter differently depending on what the coach is
actually doing right now — fixing a live match 20 minutes before kickoff is a different situation
from planning next week's round, which is different again from a season development review. There
is no shared mechanism for contextual relevance; each surface (Today, Round Board, Insights) would
otherwise reinvent its own priority ordering.

A programme bundle (external work package, `.matchboard-work/situational-decision-support/`,
gitignored/untracked per repository convention — see AGENTS.md's licensing/documentation rules
and this ADR's own "do not copy working specs into tracked paths" constraint) specifies both
changes together, because the second depends on the first: a situational-relevance policy
(visibility/urgency/horizon/interaction-depth) is exactly the kind of "contextual policy, not
football truth" decision this codebase already assigns to Rego, not TypeScript.

### Current policy runtime, verified against `HEAD` (commit `8658b942`)

- `src/lib/policies/policy-pack.ts` defines policy-pack schema v1: one `entrypoint: string`
  field, `getActivePackId()` defaulting to `matchboard-default`, `isRegoEnabled()`/
  `getRegoFailureMode()` reading `MATCHBOARD_POLICY_REGO_ENABLED`/
  `MATCHBOARD_POLICY_REGO_FAILURE_MODE`.
- `src/lib/policies/rego-policy-adapter.ts`'s `RegoPolicyAdapter.evaluate()` short-circuits to an
  empty, fully-permissive result whenever `isRegoEnabled()` is false — the only call site is
  `selection-policy-adapter.ts`'s `createPolicyPipeline()`, which conditionally includes
  `RegoPolicyAdapter` only when `isRegoEnabled()`.
- The declared `OpaPolicy` type in `rego-policy-adapter.ts` (`evaluate(input, options?:
  { entrypoint?: string | number })`) does **not** match the installed
  `@open-policy-agent/opa-wasm@1.10.0` API: `LoadedPolicy.evaluate(input, entrypoint = 0)` takes
  the entrypoint as a bare second positional argument (string name looked up in
  `this.entrypoints`, or a numeric id) — never wrapped in an options object. This was never
  exercised because no call site ever passes a second argument. Multi-entrypoint work in this ADR
  is the first code to actually call `evaluate` with a named entrypoint, so this call-signature
  bug is fixed as part of that work, not left latent.
- `npm run validate` includes `policy:verify`, but **no GitHub Actions workflow runs any
  `npm run policy:*` script today** (`ci-checks.yml` audited directly: jobs are typecheck, lint,
  typecheck-workers, test-workers, security-check-sql, security-check-supply-chain,
  version-verify, test, e2e, migration-from-zero, migration-upgrade-from-populated-state, build —
  no policy job). "Missing declared entrypoint / failed policy tests / missing compiled artifact
  fails build/deploy validation" is not enforced anywhere except a developer's own local `npm run
  validate`. This ADR treats adding that CI gate as part of "the built-in policy pack is a
  required build/deployment artifact," since an unenforced local-only check is not really a
  build/deploy requirement.
- `scripts/bootstrap-opa.mjs` already downloads and checksum-verifies a pinned OPA release into
  `.opa-cache/`, so a CI job can bootstrap OPA without relying on the devcontainer image.
- ARR-0020 (resolved) already migrated Rego source to v1 syntax and pinned OPA to `1.19.1`; this
  ADR builds on that, it does not revisit it.

## Decision

### 1. OPA/Rego becomes a standard Matchboard runtime capability

Remove `MATCHBOARD_POLICY_REGO_ENABLED` and the `isRegoEnabled()` concept entirely from normal
runtime behaviour. The selection policy pipeline (`createPolicyPipeline()`) always includes the
Rego-backed adapter; there is no global switch that turns Rego off. This is a deliberate removal
of an environment gate, not a change of its default to `true`.

Boundary (unchanged in spirit, made explicit and enforced by this ADR):

- **TypeScript/domain owns**: persistence, authorisation/tenancy, football/domain invariants,
  fact derivation, time calculations, recommendations from existing engines, possible actions,
  command execution, transactions.
- **OPA/Rego owns**: contextual relevance, visibility/promotion/suppression, urgency, decision
  horizon, interaction depth, reason codes, configurable policy treatment. Rego must never query
  Prisma, generate squads, optimise lineups, calculate evidence from raw history, mutate state, or
  own a transaction boundary — enforced structurally (Rego has no such capability in this
  Vercel-hosted, Wasm-sandboxed evaluation model) and by policy-authoring convention
  (`docs/admin/policy-management.md`).

### 2. Policy pack schema v2: named multi-entrypoint packs

`policy-pack.json` gains `schemaVersion: 2` with `entrypoints: Record<string, string>` (e.g.
`{ "selection": "matchboard/selection/decision", "situation": "matchboard/situation/decision" }`)
replacing the single `entrypoint: string` field. Schema v1 (`entrypoint: string`) remains readable
— `loadPackMetadata()` normalises a v1 pack to `{ entrypoints: { selection: entrypoint } }` at
load time. The built-in `matchboard-default` pack is migrated to v2 (it needs both entrypoints).
`policies/examples/packs/custom-example/` **deliberately stays on schema v1** — it is a
non-deployable, illustrative example (selection-only, no situation policy), and keeping it on v1
makes it the real, live exerciser of the backward-compatibility path (a genuine repository pack,
not a synthetic unit-test fixture) proving v1 packs keep working unmigrated. Build/list/validate/
diagnostics tooling reads both shapes through the same normalisation (`resolveEntrypoints()` in
`scripts/policy-metadata-utils.mjs`, `policy-pack.ts`'s `normalizeEntrypoints()`), so there is
exactly one code path, not a v1 branch and a v2 branch scattered across scripts.

The built-in `matchboard-default` pack's compiled Wasm artifact is built once from `opa build`
with one `-e <entrypoint>` flag per declared entrypoint, producing one Wasm module that exports
both `matchboard/selection/decision` and `matchboard/situation/decision`. `@open-policy-agent/
opa-wasm`'s `LoadedPolicy.entrypoints` map (built from the compiled module's own `entrypoints()`
export) is the runtime source of truth for which named entrypoints exist in a given artifact —
evaluating a name absent from that map throws a predictable, typed error rather than silently
evaluating entrypoint 0.

### 3. One shared OPA Wasm runtime owner

`src/lib/policies/policy-runtime.ts` (new) is the single owner of: active pack resolution, Wasm
artifact loading/caching, OPA module loading, named-entrypoint evaluation
(`evaluatePolicyEntrypoint<TInput, TRaw>({ entrypoint, input })`), and runtime-health diagnostics.
`rego-policy-adapter.ts` (selection-shaped) and the new situation-policy adapter are thin typed
adapters above this shared runtime — normalising their own input/output shapes — not two
independent Wasm-loading stacks.

### 4. Runtime failure degrades safely; the built-in pack is fail-open-safe, custom packs may opt into strict failure

`MATCHBOARD_POLICY_REGO_FAILURE_MODE` is **removed** — the global env var is replaced by a
per-pack, versioned `failureMode` field on `policy-pack.json` itself
(`"degraded_fallback" | "fail_closed"`, `PolicyPackFailureMode` in `policy-pack.ts`). Failure
behaviour is now deployment configuration that travels with the pack's own source and metadata
(consistent with ADR-0024's "policy packs are deployment configuration" framing), not a runtime
environment toggle a deploy can silently drift from the pack it's paired with.
`validatePackMetadataShape()` **forces** `matchboard-default`'s effective `failureMode` to
`"degraded_fallback"` regardless of what its own metadata claims — the built-in pack cannot be
configured into strict failure, structurally, not just by convention. A future custom pack may
declare `"fail_closed"` in its own `policy-pack.json` for instances that want a broken custom
policy to halt selection mutation rather than silently degrade. The **built-in `matchboard-default`
pack always degrades safely** on unexpected runtime failure (Wasm load failure, OPA module
init failure, invalid output shape, entrypoint evaluation exception) regardless of the configured
failure mode:

- mark policy runtime `DEGRADED`;
- return the safe empty policy result for the failed entrypoint (no additional blocks/warnings/
  score adjustments/tags from Rego; for situation evaluation, order using hard consequence and
  deadline facts only — see the situational domain contract below);
- never suppress a candidate because suppression cannot be trusted when the policy that would
  decide suppression is itself unavailable;
- never use `AUTO`;
- keep core TypeScript invariants and the default TypeScript policy layer fully active — they do
  not depend on Rego and are unaffected by this degradation;
- log one structured diagnostic (`lastRuntimeErrorCode`) without player-sensitive payloads;
- never throw up to a coach-facing request — the composite/situation pipeline catches the runtime
  error and proceeds in `DEGRADED` mode.

This is a deliberate asymmetry: the built-in pack is Matchboard's own product surface — its
unavailability must never make the app "up but broken" for a volunteer coach. A custom
organisation-authored pack is deployment configuration the operator controls, and may still prefer
`fail_closed` (hard error) so a broken custom policy is caught immediately rather than silently
ignored — that choice is now declared on the custom pack's own `policy-pack.json`, reviewed and
versioned alongside its Rego source, rather than left to an easily-forgotten environment variable.
There is no second full situation-policy implementation in TypeScript;
degraded mode is a bounded fallback (deterministic ordering by hard facts), not a rewrite of the
Rego rules in TypeScript.

### 5. Built-in policy artifact required in build/deploy validation

`policy:verify` (already checks: Wasm present, hash matches `policy-pack.json`, rebuild-from-source
hash matches committed artifact, `opa test` passes for deployable packs) becomes a required
GitHub Actions CI job (new `policy-verify` job in `ci-checks.yml`, bootstrapping OPA via
`scripts/bootstrap-opa.mjs`), and the `build` job depends on it. A missing/invalid built-in pack,
missing declared entrypoint, or failing fixture/unit test now fails CI, not just a developer's
optional local `npm run validate`.

### 6. Situational decision-support layer

Add a decision-support layer over the existing domain model, producing three contextual
projections (`MATCHDAY`, `NEXT`, `LONG_TERM`) from one underlying state — not three parallel data
sources. Full contract in `docs/domain/situational-decision-support.md` (new). Summary:

- `SituationContext` — deterministic TypeScript resolver (time, live-match state, route intent) →
  `primarySituation: "MATCHDAY" | "NEXT" | "LONG_TERM"`. Never persisted as a hidden user mode.
- `CoachDecisionCandidate` — normalised fact/consequence/action shape produced by candidate
  providers that adapt existing domain owners (Assistant work items, availability, plan-integrity
  signals, round/match/event readiness, report state, live-match state). Providers do not decide
  final relevance.
- `matchboard/situation/decision` Rego entrypoint — takes compact normalised facts, returns
  `{ visibility, horizon, urgency, interaction, reason_codes, suppress_nonessential_context }`.
  Never a single opaque weighted score.
- `CoachDecision` — normalised, ordered, coach-facing decision. `getCoachSituationProjection()` is
  the one query boundary Today/Matchday/Next/Long-term UI consumes; React does not independently
  reconstruct priority.

This is deliberately staged: this ADR authorises and scopes the architecture; delivery proceeds
through the phases in the programme bundle's migration plan, tracked in
`.matchboard-work/situational-decision-support/STATUS.md` (untracked) during implementation, with
durable outcomes (new domain modules, ADR amendments if the design changes materially, doc
updates) landing in tracked paths as each phase completes.

## Alternatives considered

- **Default `MATCHBOARD_POLICY_REGO_ENABLED` to `true` instead of removing it** — rejected. This
  programme's explicit product decision is that Rego is a standing capability, not a togglable
  feature that merely defaults differently; keeping the flag invites it being flipped back off
  and re-introduces "is Rego on?" as a support/diagnostic question instead of "is policy runtime
  healthy?".
- **Keep the same `fail_closed`/`fail_open` semantics uniformly for every pack including the
  built-in one** — rejected. A strict `fail_closed` built-in pack would mean a Wasm loading bug in
  Matchboard's own shipped policy takes down normal coaching workflows; the programme's product
  requirement is that the app's own default behaviour must degrade, not error out.
  `fail_open` uniformly would remove the intentional strictness an operator running a genuinely
  custom, security-relevant pack might want. Splitting the behaviour by pack identity preserves
  both intents.
- **A second full situation-policy implementation in TypeScript as the "real" default, with Rego
  only for overrides** — rejected. This duplicates the exact class of logic (contextual
  visibility/urgency/horizon rules) Rego already exists to hold, doubles the maintenance surface,
  and the degraded-mode fallback already covers the safety concern without a second complete
  implementation.
- **A new generic JSON policy DSL for situational rules** — rejected, explicitly out of scope per
  the programme and consistent with ADR-0024's existing rejection of a JSON policy DSL.

## Consequences

### Positive

- One clear, testable answer to "is the policy runtime OK" (`HEALTHY`/`DEGRADED`) instead of a
  boolean that only ever meant "off."
- Multi-entrypoint packs let one compiled artifact serve both selection and situational policy
  without duplicating the pack/build/validate/diagnostics machinery.
- CI now actually enforces the built-in pack's integrity; previously only a local, optional
  command did.
- Contextual relevance (situational decision support) gets a policy substrate that was already
  the right shape for this kind of concern, rather than being invented ad hoc per UI surface.

### Negative

- Removing an environment gate is a breaking change for any as-yet-undeployed configuration that
  assumed Rego could be turned off; mitigated by the built-in pack's safe-degrade behaviour making
  "off" and "healthy-but-empty-of-custom-rules" behaviourally very close for the default pack.
- Schema v2 adds a second metadata shape to reason about during the migration window, even though
  every repository-owned pack is migrated immediately; the v1-compatibility code path exists only
  for a hypothetical external custom pack and must be kept honest by a dedicated test rather than
  assumed correct.
- A situational Rego entrypoint is new policy-authoring surface; it needs its own fixture
  discipline (`06-QUALITY-GATES.md`'s functional policy scenarios) to stay trustworthy, distinct
  from the existing selection fixtures.

### Neutral / follow-up

- The per-pack `failureMode` metadata field should be re-evaluated if Matchboard ever ships a
  second built-in pack with different safety requirements — not anticipated at this time.
- Full situational UI migration (Today, Matchday mobile, Next, Long-term) is delivery work
  tracked outside this ADR's own text; if a phase reveals the contract in
  `docs/domain/situational-decision-support.md` needs to change materially, that is a new ADR
  amendment, not a silent drift.

## Related

- Supersedes/narrows: ADR-0024 (policy pack management) — schema v1 → v2 migration and the
  `MATCHBOARD_POLICY_REGO_ENABLED` removal described here supersede ADR-0024's schema-v1-only
  metadata format and its "Rego enabled/disabled" runtime model. ADR-0024's pack-directory
  structure, hashing, and validation-script decisions remain in force.
- Builds on: ADR-0015 (policy-capable selection engine), ADR-0016 (OPA/Rego Wasm policy adapter),
  ADR-0017 (policy operationalization), ADR-0018 (selection rule ownership after policy
  migration), ADR-0071 (Rego v1 syntax migration), ARR-0020 (resolved: OPA v0 syntax pin).
- New durable domain doc: `docs/domain/situational-decision-support.md`.
