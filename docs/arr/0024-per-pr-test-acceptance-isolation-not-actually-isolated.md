# ARR-0024: test-acceptance.yml's per-PR Neon isolation silently fell back to the shared branch

## State

Resolved

## Identified

2026-08-24

## Residue

ADR-0075's entire design promise is that `test-acceptance.yml` deploys each PR against an
**isolated** per-PR Neon child branch (`pr-<N>`), so PR-level Playwright runs can safely mutate
data without affecting the shared, persistent `test` branch that local development, other PRs,
and `ci-checks.yml`'s post-merge smoke job all depend on.

That isolation was not actually happening. `deploy.sh` sets branch-scoped Vercel Preview env vars
(`vercel env add DATABASE_URL preview "$GIT_BRANCH" --force --yes`, keyed by
`github.head_ref`), relying on `vercel deploy`'s own git-metadata auto-detection (reading the
local `.git` checkout) to pick that branch-scoped value over the Vercel project's generic
"Production, Preview"-scoped `DATABASE_URL`/`DIRECT_URL`. Both checkout steps in
`test-acceptance.yml` (`actions/checkout@v4.2.2`, no `ref:` override) used `actions/checkout`'s
default behavior for a `pull_request` event: checking out `refs/pull/<PR>/merge` in **detached
HEAD** state, not a real branch. A detached HEAD can't match a named-branch-scoped env var, so
every deploy silently fell back to the generic Preview `DATABASE_URL` — which points at the
shared, persistent `test` Neon branch, not the isolated `pr-<N>` branch created and migrated
earlier in the same script.

Verified directly via `neonctl`/`psql` against both branches on 2026-08-24 while debugging
unrelated E2E flakiness on PR #349 (`chore/live-match-worker-observability`):
- The isolated branch (`pr-349`, forked 2026-08-24T09:19:47Z from `test`) contained exactly the
  4 `MatchRound` rows present at fork time — zero trace of any of the PR's own Playwright-created
  data across 4 separate CI runs.
- The shared, persistent `test` branch contained 97 new `MatchRound` rows and dozens of new
  `Match` rows (`opponent LIKE 'E2E Live%'`) created by those same 4 runs — every one of them.
- `vercel env ls preview` on the `matchboard-test` project confirmed the branch-scoped
  `DATABASE_URL`/`DIRECT_URL` pair for `chore/live-match-worker-observability` did exist (created
  correctly by `deploy.sh`) alongside the generic "Production, Preview" pair — the branch-scoped
  entry was simply never selected at build time.

## Intended architecture

Per ADR-0075: each PR's Playwright acceptance run mutates only its own disposable, isolated Neon
child branch. The shared persistent `test` branch (and the canonical seed dataset on it) is never
touched by per-PR runs — only by `ci-checks.yml`'s post-merge smoke job and local development.

## Evidence

- `.github/workflows/test-acceptance.yml`'s two `actions/checkout@v4.2.2` steps, before this
  fix, had no `ref:` input.
- `scripts/test-acceptance/deploy.sh:56-60` — the branch-scoped env var mechanism this depends on.
- Direct Neon query evidence (both branches, captured 2026-08-24, see History) showing zero
  fixture data on `pr-349` and 97 new rounds / dozens of new matches on `test`.
- `vercel env ls preview` output confirming the correctly-set, never-selected branch-scoped pair.

## Impact

- **Every PR's per-PR "isolated" acceptance run has actually been mutating the shared,
  persistent Test dataset** since this pipeline shipped (ADR-0075) — not just this session's
  runs. Any PR that ran Playwright through this workflow polluted `test` instead of its own
  branch.
- Concurrent PRs' acceptance runs (or a single PR's own retries) were genuinely contending for
  the *same* shared database, not separate isolated ones — a likely contributing factor to
  transaction-timeout flakiness (`PrismaClientKnownRequestError` P2028) observed and initially
  misattributed purely to Playwright worker concurrency within one run (see
  `docs/development/browser-acceptance-testing.md`'s 2026-08-24 entry — that finding is still
  correct as *a* contributing factor, just not the whole picture).
- `round-mutation.spec.ts`'s canonical seed round could be, and was, disturbed by concurrent
  interference from unrelated per-PR runs that should never have reached it.
- Test data volume: 97 extra `MatchRound` rows and ~30+ extra `Match` rows accumulated on the
  shared `test` branch from this session alone before the bug was found.

## Containment

- Do not add a new per-PR Vercel Preview deployment step to any workflow without an explicit
  `ref: ${{ github.head_ref }}` (or equivalent) on its checkout step — a detached-HEAD checkout
  silently defeats git-metadata-based branch-scoped env var selection.
- Before trusting "isolated" per-PR infrastructure in this repo again, verify with a direct query
  against both the isolated and shared resources — do not assume env var scoping "worked" just
  because the deploy succeeded and the app functioned correctly (it will, regardless of which
  branch it's actually talking to).

## Resolution criteria

- `test-acceptance.yml`'s checkout steps pin `ref: ${{ github.head_ref }}`.
- A fresh PR run's Playwright-created data verifiably lands on that PR's isolated `pr-<N>` Neon
  branch (confirmed via direct query), not on `test`.
- The `test` branch's accumulated pollution from this incident is cleaned up (surgical delete of
  `opponent LIKE 'E2E Live%'` matches/rounds and their cascade — not a full baseline restore,
  which would discard unrelated legitimate state).

## Disposition

Resolved. `ref: ${{ github.head_ref }}` added to both checkout steps in
`test-acceptance.yml`. Pollution cleanup and re-verification tracked in this record's History.

## Related decisions

- ADR-0075: Per-PR Feature Acceptance Pipeline (Accepted) — states the isolation guarantee this
  ARR shows was never actually in effect.

## Related implementation

- `.github/workflows/test-acceptance.yml`
- `scripts/test-acceptance/deploy.sh`

## Supersedes

None.

## Superseded by

None.

## History

### 2026-08-24

Found while debugging unrelated E2E test flakiness on PR #349. A round-board crash surfaced a
redacted Next.js Server Components error; `vercel logs` against the still-live ephemeral preview
deployment revealed a Prisma P2028 transaction-timeout error, which led to inspecting the actual
Neon branch the deployment was using — at which point direct `neonctl`/`psql` queries showed the
isolated `pr-349` branch had none of the run's data, and the shared `test` branch had all of it.
Root-caused to the missing `ref:` on `actions/checkout`. Fixed in the same PR.
