# ARR-0025: Live-match Worker deploys to production without its own CI gate

## State

Confirmed

## Identified

2026-08-24 (Architecture Integrity Programme, AIP-0 baseline)

## Residue

`workers/live-match/` (the Cloudflare Worker + `MatchSessionObject` Durable Object, ADR-0086) is
an independently deployed runtime with its own dedicated verification scripts —
`npm run test:workers` (`vitest run --config workers/live-match/vitest.config.ts`) and
`npm run typecheck:workers` (`tsc --noEmit -p workers/live-match/tsconfig.json`) — documented in
`docs/development/live-match-realtime.md:186-191` as necessary because the Worker's types
(`@cloudflare/workers-types`) are incompatible with the main app's `dom` lib and its tests live
outside the root `vitest.config.ts` include pattern.

Neither script is invoked anywhere in CI or the deploy pipeline:

- `package.json`'s `validate` script (the mandatory aggregate command per AGENTS.md's "Quality
  checks must pass" policy) does not call `test:workers` or `typecheck:workers`.
- `.github/workflows/ci-checks.yml` (the workflow that gates PR merges via required status
  checks) has no job that runs either script — confirmed by grepping every job in the file.
- `.github/workflows/deploy-live-match-worker.yml` triggers `workflow_run` on `workflows: ["CI"]`
  with `types: [completed]` and `conclusion == 'success'`, then runs `npx wrangler deploy` for
  both the production and test Cloudflare environments unconditionally — it does not run
  `test:workers`/`typecheck:workers` as a pre-deploy gate, and "CI success" for the triggering
  push never actually covered the Worker's own code.

The two scripts exist and pass real, meaningful tests (event classification, HMAC sign/verify
round-trips, idempotency/version-assignment logic, Origin/matchId validation — see
`docs/development/live-match-realtime.md:199-213`), but nothing in the delivery pipeline ever
runs them. A Worker change with a type error or a broken `state.ts` decision would merge on a
green PR and then auto-deploy straight to the production Cloudflare Worker on the next push to
`main`, with the first real signal being a live incident on `realtime.matchboard.football`.

## Intended architecture

Programme outcome #1 (`.matchboard-work/matchboard-architecture-integrity/PROGRAMME.md` §2):
"Every independently deployed runtime has mandatory typecheck/test coverage before deployment."
The Worker is exactly this case — a second independently deployed runtime alongside the main
Next.js/Vercel app — and per that same principle it needs a CI job (or an addition to
`validate`/`ci-checks.yml`) that runs `typecheck:workers`/`test:workers` and blocks both PR merge
and the downstream deploy trigger on failure.

## Evidence

- `package.json:11-16` — `test:workers`/`typecheck:workers` script definitions; `validate`
  script definition does not reference either.
- `.github/workflows/ci-checks.yml` — full job list (`typecheck`, `lint`,
  `security-check-sql`, `security-check-supply-chain`, `version-verify`, `test`, `e2e`,
  `migration-from-zero`, `build`); none runs a worker-scoped command.
- `.github/workflows/deploy-live-match-worker.yml:44-49,58-109` — triggers on `workflow_run`
  from `CI` completing successfully, then deploys immediately; no test/typecheck step for
  `workers/live-match/` anywhere in the file.
- `docs/development/live-match-realtime.md:186-213` — documents the scripts' existence and
  coverage, but nothing about CI wiring.
- `docs/security/branch-protection-and-secret-scanning.md:9` — documented required status
  checks are "typecheck, test, build, security:check-sql", none of which cover the Worker.

## Impact

- Worker code (Origin/matchId validation, HMAC persistence auth, event classification, session
  state transitions) can regress silently through a normally-reviewed PR and reach production
  Cloudflare infrastructure without ever having been type-checked or tested by CI.
- The existing test suite's real value (documented per-behavior coverage) is currently unrealized
  as a delivery gate — it only helps a developer who remembers to run it locally.
- Per ADR-0086's own stated risk framing ("a bad deploy here degrades to the existing
  HTTP/local-first reporting path — it cannot corrupt data or block match reporting"), the blast
  radius of a bad deploy is bounded, which is why this was not caught as a release-blocking gap
  before — but it is still a genuine gate that this programme's outcome #1 requires.

## Containment

- Do not treat `deploy-live-match-worker.yml`'s `workflow_run` trigger on `CI` success as
  evidence the Worker's own code was verified — `ci-checks.yml` never touches
  `workers/live-match/`.
- Any Worker-code PR should be manually verified with `npm run typecheck:workers && npm run
  test:workers` until this is fixed, since neither runs automatically.

## Resolution criteria

- `typecheck:workers` and `test:workers` run as required, blocking checks — either as new jobs
  in `ci-checks.yml` (added to the branch-protection required-checks list) or folded into
  `validate` — before `deploy-live-match-worker.yml`'s trigger can be considered a real
  post-verification gate.
- `docs/security/branch-protection-and-secret-scanning.md`'s required-checks list is updated to
  match whatever the real, current set of blocking CI jobs is (it is also currently missing
  `lint`, `version-verify`, and `migration-from-zero`, which independently exist as jobs in
  `ci-checks.yml` today).
- Assigned to AIP-1 (Runtime quality parity) in the Architecture Integrity Programme.

## Disposition

Open. Scoped to AIP-1.

## Related decisions

- ADR-0086: Live match realtime — Cloudflare Durable Objects (Accepted) — establishes the Worker
  as an independent runtime.

## Related implementation

- `package.json` (`test:workers`, `typecheck:workers`, `validate` scripts)
- `.github/workflows/ci-checks.yml`
- `.github/workflows/deploy-live-match-worker.yml`
- `workers/live-match/`

## Supersedes

None.

## Superseded by

None.

## History

### 2026-08-24

Identified during AIP-0 baseline verification of the Architecture Integrity Programme's starting
hypothesis F-001. Confirmed by direct inspection of `package.json` and every workflow file in
`.github/workflows/` — no invocation of `test:workers`/`typecheck:workers` exists anywhere in the
delivery pipeline.
