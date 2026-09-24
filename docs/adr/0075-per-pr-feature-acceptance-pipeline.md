# ADR-0075: Per-PR feature acceptance pipeline (Neon child branch + Vercel alias)

## Status

Accepted

## Date

2026-08-20

## Context

The consolidation programme (`PROGRAMME.md` §7-10) requires that every PR be capable of
pre-merge acceptance against the shared `test.matchboard.football` slot, using an isolated
Neon database branch and the exact PR commit, with the slot returned to `main` + persistent Test
after merge. `EXTERNAL-STATE.md` (verified 2026-08-19/20) confirmed this does not exist: only 3
Neon branches exist (`production`, `test`, `dev`), and both Vercel projects (`matchboard`,
`matchboard-test`) simply auto-deploy whatever is pushed to `main`, same as Production.

Direct inspection of the live `matchboard-test` Vercel project (`vercel env ls`,
`vercel ls`, `vercel domains inspect test.matchboard.football`, 2026-08-20) established the real
starting point more precisely than the programme text alone:

- Vercel's Git integration **already** creates a distinct Preview deployment (its own unique
  `*.vercel.app` URL) for every push to every branch/PR against the `matchboard-test` project —
  no new deployment-triggering mechanism is needed.
- Every one of those Preview deployments currently shares the **same** `DATABASE_URL`/
  `DIRECT_URL` Preview-environment values as the Production deployment — i.e. every open PR's
  preview build for `matchboard-test`, if it ever ran a mutating action, would be writing to the
  same persistent Neon `test` branch other work (Playwright, manual QA) depends on. This is the
  actual gap, not deployment triggering.
- `test.matchboard.football` is a domain owned by the `matchboard-app` Vercel team/org and can be
  aliased with `vercel alias set <deployment> test.matchboard.football` to any deployment within
  that scope, including a Preview deployment — no Vercel Custom Environments needed (which
  `PROGRAMME.md` §5 explicitly forbids depending on).
- Vercel supports environment-variable values scoped to one exact git branch
  (`vercel env add <name> preview --git-branch <branch>`), which override the general Preview
  value for deployments built from that branch only. This is the standard, Custom-Environments-free
  mechanism for "this PR's preview build talks to this PR's database."

## Decision

Build the per-PR acceptance pipeline as a new GitHub Actions workflow,
`.github/workflows/test-acceptance.yml`, using Vercel's existing per-branch Preview deployment
mechanism plus branch-scoped environment variables and Neon child branches — not a new deployment
trigger, not Vercel Custom Environments, not a second parallel CI system.

### Concurrency (single shared slot)

A single `concurrency: { group: test-slot, cancel-in-progress: false }` block on the workflow.
GitHub Actions itself then serializes every acceptance and cleanup run for the shared slot —
no separate locking primitive, database row, or external lock service is needed.
`cancel-in-progress: false` is deliberate: `PROGRAMME.md` §8 says the slot has one owner "at a
time," not "latest wins" — a run in progress must finish (deploy or cleanup) before the next one
starts, so ownership transitions are always clean and observable in the Actions log, never
half-applied.

### On PR opened/synchronize/reopened (`acceptance-deploy` job)

1. Neon child branch named `pr-<number>`, created from the persistent `test` branch if it
   doesn't already exist (idempotent — reused across every push to the same PR, not recreated).
2. `prisma migrate deploy` against the child branch's direct connection string.
3. `vercel env add DATABASE_URL preview --git-branch <branch> --force` (and `DIRECT_URL`),
   pointed at the child branch's pooled/direct connection strings. `--force` makes repeated
   pushes to the same PR idempotent instead of erroring on "already exists."
4. Explicitly trigger a Vercel deployment for the exact PR commit via `vercel deploy` from CI
   (not relying on whichever deployment Vercel's Git integration already started in parallel —
   env var changes don't retroactively apply to an in-flight build, so the workflow must produce
   and alias its own authoritative deployment).
5. `vercel alias set <deployment-url> test.matchboard.football`.
6. Post a PR comment recording PR number, commit SHA, Neon branch name, and deployment URL —
   satisfying `PROGRAMME.md` §8's "identify current Test-slot owner" requirement.
7. Run `npm run test:e2e` against `https://test.matchboard.football` (functional acceptance) and
   the authorization/security suites already in CI.

### On PR closed (merged or not) (`acceptance-cleanup` job)

1. `vercel alias set matchboard-test-git-main-matchboard-app.vercel.app test.matchboard.football`
   — Vercel's own Git-integration alias for `main`'s latest deployment is always current, so this
   restores the slot to `main` + persistent Test (`PROGRAMME.md` §10) with no deployment-ID
   lookup or polling needed, whether the PR merged or was closed unmerged.
2. Remove the branch-scoped `DATABASE_URL`/`DIRECT_URL` Preview overrides for this git branch.
3. Delete the `pr-<number>` Neon branch.

Database content created during feature acceptance is disposable by construction — it lives only
on the per-PR Neon child branch, which is deleted at the end.

### Credentials

Requires `NEON_API_KEY`, `NEON_PROJECT_ID`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and a
**`matchboard-test`-specific** `VERCEL_TEST_PROJECT_ID` as GitHub Actions repo secrets — this
repo's `GH_TOKEN` used by the local devcontainer/agent session cannot read or list existing repo
secrets (confirmed: `gh secret list` returns `403`), so their presence must be confirmed by
someone with repo admin access before this workflow can run in CI; it is not something this
session can verify or provision itself.

### Rollout safety

This workflow performs real, hard-to-reverse actions against shared live infrastructure (creates
and deletes real Neon branches, moves the `test.matchboard.football` alias other work now
depends on for Playwright acceptance). It has no `workflow_dispatch` trigger — its jobs read
`github.event.pull_request.*`, which only exists for real `pull_request` events — so it cannot be
dry-run in isolation. Instead, the PR that introduces this workflow **is** its own first live
test: GitHub Actions runs `pull_request`-triggered workflows using the version of the workflow
file present on the PR's branch even before that file exists on `main`, so opening this PR fires
`acceptance-deploy` for real. This is safe by construction either way: if the required secrets
(below) aren't yet configured, the secrets-check step skips the rest of the job cleanly (same
pattern the existing `e2e` job in `ci-checks.yml` already uses); if they are configured, this PR's
own run is the real end-to-end verification, with each step's actual output inspected before
trusting the pipeline on subsequent PRs — not merged on the strength of the YAML reading
correctly. A failure partway through any run must not leave the alias pointed at a broken or
deleted deployment; `deploy.sh`'s own `ERR` trap restores the alias to baseline if a command
inside that one bash process fails.

**Gap found and fixed on a later PR (#306), not this one**: that trap only covers `deploy.sh`
itself — a failure in any *later* workflow step (the Playwright functional-acceptance step, or
the install steps before it) happens after `deploy.sh` already succeeded and already moved the
alias, invisible to a trap scoped to a process that already exited. Observed live: PR #306's
Playwright step failed for an unrelated reason (stale seed data on its freshly-branched Neon
child — see that PR's own history) and the shared `test.matchboard.football` slot stayed pointed
at PR #306's deployment indefinitely, since nothing in the job covered that failure. Fixed with a
job-level `if: failure()` step (covers every prior step, not just `deploy.sh`) that calls the same
`restore-baseline-alias.sh`. See `fix/test-acceptance-failure-safety-gap`'s own commit for the
fix; recorded here since it's this ADR's design gap, not a new decision.

**Verified**: after the required repo secrets were added, four live runs against this PR's own
branch (before merge) exercised the deploy path for real, in order: (1) `vercel deploy
--skip-domain` failed — that flag is production-only, confirmed by the actual CLI error, not
`--help` text; the failure trap correctly restored the alias to baseline before the job exited,
so the shared slot was never left broken. (2) Deploy succeeded fully (Neon branch created,
migrated, env vars scoped, deployment aliased) and 5/6 Playwright tests passed; the sixth failed
on two real console errors. (3)-(4) both real, previously-invisible bugs found and fixed (see
"Two bugs found" below); the fourth run passed 6/6. **Cleanup (`acceptance-cleanup`) has not yet
been exercised live** — it only runs on PR close, which happens naturally when this PR merges;
not artificially triggered early, since a real close is the same signal either way.

**Two bugs found and fixed by this PR's own live testing, not designed in from the start:**
1. `/api/csp-report`'s `POST` handler crashed (500) on every real report:
   `NextResponse.json(body, { status: 204 })` always attaches a body, but a 204 response must not
   have one (Fetch spec). This route had apparently never received a real CSP report before —
   the persistent Test slot is a Production-target deployment, and only Preview deployments (like
   this pipeline's) get Vercel's injected "Live Feedback" toolbar, whose own script triggers a
   report-only CSP violation. Fixed: `src/app/api/csp-report/route.ts`, with a regression test.
2. `e2e/smoke.spec.ts`'s `KNOWN_BENIGN_CONSOLE_MESSAGES` allowlist (added for that same toolbar's
   CSP-violation console message, since it's Vercel Preview infrastructure, not app behavior) had
   a whitespace mismatch on the first attempt — Chrome appends a trailing newline to that specific
   message, only visible once the real captured array was inspected. Fixed by trimming both sides
   before comparison instead of hardcoding exact incidental whitespace.

## Consequences

- Closes `PROGRAMME.md` §7-10 and the corresponding Phase 3 acceptance-gate items in
  `docs/../.matchboard-work/consolidation-programme/PHASES.md` (programme-local tracking, not
  repo-tracked).
- No second build/deploy system introduced — reuses Vercel's existing Git integration and
  per-branch environment variable scoping rather than replacing it.
- Every open PR now costs one live Neon branch for its duration; cleanup on close prevents branch
  accumulation, but a workflow bug or a PR closed via force-push/branch-deletion outside the
  normal close event could still orphan a branch — worth a periodic reconciliation check
  (`neonctl branches list` diffed against open PRs) as a follow-up, not blocking this ADR.
- `deploy-test-candidate`/`release-test-candidate` Swamp procedures (`models/command/shell/*.yaml`)
  updated in this same change to describe this pipeline instead of the old "Test only deploys
  from `main`" text — they stay informational (there is no ad-hoc trigger to wrap; the workflow
  already owns the full event-driven lifecycle), but no longer describe a stale reality.

## Related decisions

- `PROGRAMME.md` §5, §7-10 — the target contract this ADR implements.
- ADR-0068 — Swamp procedure runner; `deploy-test-candidate`/`release-test-candidate` noted there
  as informational pending this exact infrastructure.
- ADR-0069 — Playwright browser acceptance testing; this pipeline is what the functional
  acceptance step (`npm run test:e2e`) in the new workflow reuses.

## History

- 2026-08-20: Accepted. Design verified against live Vercel/Neon state before being written down
  (not assumed from `PROGRAMME.md` text alone). Implementation followed in the same session; see
  "Rollout safety" above for why the introducing PR is this workflow's own first live test rather
  than a separate dry run.
- 2026-08-20: Deploy path verified live end-to-end (4 real runs against the introducing PR,
  documented in "Rollout safety" above) — passes 6/6 Playwright tests on the isolated per-PR
  deployment. Two real, previously-invisible bugs found and fixed along the way (see "Two bugs
  found" above). Cleanup path remains unverified until this PR closes.
- 2026-08-20: PR #305 merged. Cleanup path verified live on its first-ever real execution (the
  merge's own `closed` event) — passed immediately: alias restored, env var overrides removed,
  Neon branch confirmed deleted via a direct `neonctl branches list` check. Both halves of the
  pipeline now proven against real infrastructure.
- 2026-08-20 (later): Failure-safety gap found and fixed on PR #306 — see "Rollout safety" above.
  `deploy.sh`'s `ERR` trap didn't cover a later workflow step failing, leaving the shared slot
  stuck on a broken deployment until manually restored. Fixed with a job-level `if: failure()`
  step in `test-acceptance.yml` (branch `fix/test-acceptance-failure-safety-gap`).
- 2026-08-21: Vercel deploy-quota exhaustion found on PR #313 — a trailing, purely cosmetic
  doc-wording commit (no application code touched) still triggered a full automatic Vercel
  Preview build for both linked projects (`matchboard`, `matchboard-test`), and that push landed
  after the session's cumulative deployment volume had already exhausted the project's build
  quota, leaving PR #313's final checks stuck "rate limited — retry in 24 hours" for several
  hours despite every substantive check already being green. Root cause: neither the automatic
  Vercel Git-integration previews nor this workflow's own `acceptance-deploy` job had ever been
  gated on what actually changed — every push deployed, regardless of whether the diff could
  possibly affect the running app. Fixed two ways: (1) `vercel.json`'s new `ignoreCommand`
  (`scripts/vercel-ignore-build-step.sh`) skips both projects' automatic previews when every file
  changed since the last deployed commit (`$VERCEL_GIT_PREVIOUS_SHA`) is docs/tracking-only
  (`docs/**`, `.matchboard-work/**`, any `*.md`); (2) this workflow's `acceptance-deploy` job gets
  a new `docs-only` check (via `gh api .../compare`) that skips only the deploy steps — not the
  whole job, and specifically not `acceptance-cleanup`, which must always run on `closed`
  regardless of diff content, per the "Rollout safety" lesson above about the shared slot getting
  stuck. Both checks fail open (deploy) on any ambiguity — an empty diff, a missing previous SHA,
  or an unreadable compare response all default to building rather than silently skipping a real
  change.
- 2026-08-23: **The persistent Neon "test" parent branch itself was never migrated by anything.**
  `deploy.sh` migrates each PR's isolated *child* branch, forked fresh from "test" — but nothing
  ever ran `prisma migrate deploy` against "test" directly, so it silently fell behind every time
  a migration merged to main. This surfaced as four consecutive PRs (#337–#340) all failing the
  same 7 Playwright specs on `Deploy PR to Test slot`, misdiagnosed at first as "known flake"
  because a `pull_request: closed` event's cleanup-only job (`acceptance-cleanup`, which does no
  testing) was mistaken for a genuine successful retry in the GitHub Actions run list — a real
  investigation only started once someone pointed out this couldn't just be flake. Directly
  confirmed via read-only queries against the actual persistent branch (using
  `TEST_DATABASE_DIRECT_URL`, the `matchboard_admin_migration`-role credential already present —
  commented out — in `.env`): 3 pending migrations, and separately, `coach-all-a`'s `User` row
  existed with **zero** organisation memberships, alongside 2 other orphaned users, 3
  `Organisation` rows, and 0 rows in `Team`/`Player`/`Match`/every other seeded table. This is the
  exact signature of a `seed-test-dataset.ts` run that started (created users/orgs) and then
  crashed before finishing (memberships/groups/teams/players) — almost certainly a run predating
  the `max: 1` connection-pool fix documented in this repo's own operator memory
  (`scripts/seed-test-dataset.ts`'s `createAdapter()` comment), never re-run to completion since.
  `getOrgSlugForUser()`/`resolveOrgFilterForUser()` correctly redirect a zero-membership user to
  `/organisations` — the *auth code* was working exactly as designed against genuinely corrupt
  data, not buggy.

  Fixed in two parts: (1) immediate remediation — applied the 3 pending migrations directly, then
  ran the existing `restore-test-baseline` swamp procedure (`docs/development/swamp-workflows.md`)
  to fully re-seed the branch from scratch, restoring `coach-all-a` to its correct single-org
  state (confirmed by direct query afterward) and repopulating all other tables (70 players, 7
  teams, 7 matches). (2) structural fix — added `.github/workflows/test-db-migrate.yml`, triggered
  the same way as `production-db-migrate.yml` (after CI succeeds on push to `main`, plus a
  `workflow_dispatch` fallback), running `prisma migrate deploy` against the persistent branch via
  a new `TEST_DATABASE_DIRECT_URL` repository secret. Deliberately no approval gate (unlike
  production) — this is disposable, fully-reseedable test data, and deliberately migration-only —
  it never reseeds automatically; reseeding stays a separate, deliberate, human-invoked
  `restore-test-baseline` call.
- 2026-08-24: **This workflow's core isolation guarantee was never actually in effect** — see
  ARR-0024 for the full record. `test-acceptance.yml`'s checkout steps had no `ref:` override, so
  `actions/checkout` used its default `pull_request`-event behavior: checking out
  `refs/pull/<PR>/merge` in detached HEAD state. `deploy.sh`'s branch-scoped Vercel Preview env
  vars depend on `vercel deploy`'s git-metadata auto-detection matching the checked-out branch
  name — a detached HEAD can't match, so every deploy silently used this Vercel project's generic
  "Production, Preview" `DATABASE_URL`/`DIRECT_URL` instead of the freshly created, correctly
  migrated, intentionally isolated `pr-<N>` branch. Confirmed by direct `neonctl`/`psql` query
  against both branches: the isolated branch had none of a PR's Playwright-created data across 4
  separate CI runs; the shared persistent `test` branch had all of it (97 extra `MatchRound` rows,
  dozens of extra `Match` rows). This had been true since the pipeline shipped (2026-08-20) — every
  PR's "isolated" run had actually been mutating the shared Test dataset the whole time. Fixed by
  adding `ref: ${{ github.head_ref }}` to both checkout steps. The `test` branch's accumulated
  pollution (97 extra `MatchRound` rows, dozens of extra `Match` rows) was cleaned up the same day
  via a user-authorized `restore-test-baseline` run — verified afterward back to the pristine
  4-round, 7-team canonical baseline. See ARR-0024's History for both parts.
- 2026-09-24: Skip-path list broadened, and its two independently-maintained copies
  (`scripts/vercel-ignore-build-step.sh`, `test-acceptance.yml`'s own inline `docs-only` check)
  consolidated into one shared classifier, `scripts/is-build-skip-eligible.sh` — user-requested
  after PR #669 (a swamp model-registration change touching zero application code) still paid
  for a full Vercel build on both projects plus a full Neon-branch Test-slot deploy. Confirmed
  live: the two copies had already drifted (`vercel-ignore-build-step.sh` knew `security/**` was
  skip-eligible for the ADR-0150 credential-broker subsystem; `test-acceptance.yml`'s own check
  never learned that). Skip-eligible paths extended to also cover `models/**`, `extensions/**`
  (swamp tooling config — PR #669's own case), `.claude/**` (agent tooling config), and
  `.devcontainer/**` (devcontainer config) — none of these can affect the deployed app. The rule
  is framed as "only build when application code is touched," but implemented as a maintained
  skip-list with an unconditional fail-open default (an unrecognized path always builds) rather
  than a literal allow-list that defaults to skipping — preserving the fail-open direction every
  real incident in this ADR's own History has been about getting wrong (see the 2026-08-21 and
  2026-08-24 entries above; skipping something that should have built has no equivalent line in
  this History; over-building has cost quota twice). `test-acceptance.yml`'s docs-only check
  gained one small unconditional checkout step ahead of the check itself, since it previously ran
  before any checkout at all (deliberately, to skip that cost too on a docs-only push) — reading
  the now-shared script needs the repo present, so that one narrow checkout was added back;
  the heavier deploy checkout further down stays exactly as conditional as before. `.github/**`
  (this repo's own CI/deploy workflow definitions) was deliberately left OUT of the skip list —
  a workflow change can be buggy and deserves the same live verification "Rollout safety" above
  already established for this pipeline's own introduction, not a shortcut around it. CodeQL
  (GitHub's repo-level "default setup," not a checked-in workflow file) and `security.yml`'s
  fast, non-Vercel/Neon-costing scanners (Semgrep/OSV/Gitleaks/authz/forbidden-sql/supply-chain)
  were deliberately left unfiltered — Gitleaks in particular must scan every push regardless of
  path (a secret can leak into a doc or config file as easily as into `src/`), and the others
  cost GitHub Actions minutes only, not the Vercel/Neon spend this change targets.
- 2026-09-24 (later, same day): the above was itself incomplete against the user's own stated
  rule ("only trigger build/test jobs when actual application code is touched") — `ci-checks.yml`
  has no path filtering of any kind, so its `Build`/`Tests`/`Lint`/`TypeScript Check`/
  `Policy Verify`/migration jobs still ran in full for a `models/**`/`.claude/**`/
  `.devcontainer/**`-only change, the exact case this whole effort started from. Added
  workflow-level `paths-ignore` to `ci-checks.yml`'s `on: push`/`on: pull_request`, using the
  identical path list `scripts/is-build-skip-eligible.sh` already classifies as skip-eligible
  (kept as one YAML anchor shared between both trigger blocks, not two copies). Confirmed safe
  specifically because `main` has no required status checks configured (`GET
  repos/.../branches/main/protection` returns 404 "Branch not protected") — a workflow skipped
  entirely via `paths-ignore` reports no status at all, which would otherwise permanently block
  a required check on a skip-eligible-only PR; that failure mode does not apply here.
  `workers/live-match/**` intentionally stays outside this list (and the shared script's) — its
  own `typecheck-workers`/`test-workers` jobs still need to run for a Worker-only change, and a
  workflow-level filter can only skip the whole workflow, not select individual jobs by path;
  a Worker-only PR still runs the full matrix, wastefully but safely. `security.yml` and CodeQL
  were left exactly as reasoned in the entry above — narrower than `ci-checks.yml`'s "Build"/
  "Tests" the user asked about by name, and this change does not revisit that. The shared
  script's own header comment now documents this third, YAML-only caller and the "keep both
  edits together" obligation it creates, since GitHub Actions path filtering cannot call out to
  a script the way the other two callers do.
- 2026-09-24 (later still): caught live by the user watching this exact PR's own checks —
  `.github/workflows/ci-checks.yml`-only changes (this PR, at the time) still triggered a full
  Vercel Preview build on both projects, pure waste, since a workflow YAML file has zero
  relationship to `next build`'s input or output. The `.github/**`-not-skip-eligible decision two
  entries above was right for `ci-checks.yml` re-verifying itself, but had been applied uniformly
  to the Vercel/Test-slot side too, where it doesn't belong — those two questions ("should
  ci-checks.yml itself re-run?" vs. "can this affect the deployed app?") are genuinely different
  and `.github/**` answers them differently. `scripts/is-build-skip-eligible.sh` now takes an
  optional `app-deploy` mode argument: passed by `vercel-ignore-build-step.sh` and
  `test-acceptance.yml`'s Test-slot check (both gating a real `vercel deploy`, so `.github/**`
  is skip-eligible for them), omitted by `ci-checks.yml`'s own static `paths-ignore` (unaffected
  by this change — it never could call the script anyway, and its list still deliberately
  excludes `.github/**` for the self-verification reason already established). `scripts/**`
  stays non-skip-eligible in both modes: most files under it (like this one) never run during
  `next build`, but the `prebuild` version-sync script does, and there is no reliable way here to
  tell which changed script is which — building unnecessarily for an unrelated `scripts/` change
  is the deliberate fail-open side of that ambiguity.
- 2026-09-24 (later still): the "no reliable way to tell which changed script is which" claim two
  entries above turned out to be wrong — checked directly (`package.json`'s `postinstall`/
  `prebuild`/`build` scripts, plus `next.config.ts`'s own imports) rather than assumed, prompted
  by this PR's own Test-slot deploy still running for a change that only touched CI-tooling
  scripts. Vercel's build executes exactly two npm lifecycle steps against this repo:
  `postinstall` (`prisma generate` — reads `prisma/schema.prisma`, nothing under `scripts/`) and
  `build` (npm's own `prebuild` hook, `node scripts/sync-version-module.mjs`, then `next build`;
  `next.config.ts` imports `APP_VERSION` from the file that script generates). No other file
  under `scripts/` is ever read by that pipeline — every other script is CI-only, dev-only, or a
  one-off maintenance/migration tool. `app-deploy` mode now treats `scripts/**` as skip-eligible
  too, with one hard-coded exception (`scripts/sync-version-module.mjs` itself always forces
  `build`, in both modes). Default mode is deliberately left exactly as conservative as before —
  `ci-checks.yml`'s own jobs collectively DO depend on most of `scripts/` (e.g. Policy Verify
  runs `scripts/policy-verify.mjs` directly, Prisma Query Fields runs `scripts/
  check-prisma-query-fields.mjs`), just not through `next build`, so there is no equivalent
  narrowing available there.
- 2026-09-24 (later still): caught live on PR #673 — a brand-new branch's *very first* push
  always built regardless of content, bypassing every skip-eligible classification above.
  Confirmed via the actual Vercel build log: `"No previous deployed SHA available (first deploy
  for this branch/project) — building."` `VERCEL_GIT_PREVIOUS_SHA` is only populated once a
  branch has been deployed at least once — `vercel-ignore-build-step.sh`'s original handling of
  an unset value ("no previous SHA, build to be safe") was correct in spirit but had no fallback
  for the extremely common case of a fresh PR branch's first commit. `test-acceptance.yml`'s own
  docs-only check does not share this gap — it sources its base commit from
  `github.event.pull_request.base.sha`, always available regardless of deploy history, not from
  a Vercel-populated env var. Fixed by falling back to this branch's merge-base with `main`
  (`git fetch --depth=1 origin main` then `git merge-base`) whenever `VERCEL_GIT_PREVIOUS_SHA` is
  unset, before falling through to the original "build to be safe" default if that fetch itself
  fails for any reason (network policy, an unreachable `origin`, etc. — the fail-open direction
  is preserved exactly, just given one more legitimate way to avoid needing it). Verified against
  four scenarios in an isolated throwaway git repo (no working `origin` → build; first push,
  docs-only → skip, reproducing PR #673's exact case; first push, app code mixed in → build;
  normal 2nd-push path → unaffected) before trusting the fix. Note (added the same day, see the
  next entry): the merge-base fetch does not actually succeed inside Vercel's real build sandbox
  for this repository — confirmed live on PR #675, whose build log read "No previous deployed SHA
  available, and could not establish a merge-base with main — building to be safe." The fallback
  logic is correct and the fail-open direction still holds (this repo's build sandbox behaving
  differently than a throwaway local repo is itself informative, not a bug in the fix), but in
  practice a branch's very first push to this specific repo still builds for real today; only
  its second-and-later pushes benefit from `VERCEL_GIT_PREVIOUS_SHA` being populated by then.
  Root cause not yet identified (plausibly credential scope on the temporary clone, or a
  shallow/single-branch clone with no fetchable `main` ref) — worth investigating further if the
  cost of first-push builds specifically becomes worth chasing.
- 2026-09-24 (later still): **repository rulesets requiring specific status-check names now exist
  on `main`** (confirmed via `gh api repos/.../rules/branches/main`) — they did not exist earlier
  the same day, when the `ci-checks.yml` `paths-ignore` entry above explicitly (and, at the time,
  correctly) reasoned that skipping the whole workflow was safe "because `main` currently has no
  required status checks configured." That precondition silently stopped holding partway through
  this same day's work, and the very next PR (#675, a docs-only ARR file, fully skip-eligible)
  could not be merged even with `--admin`: `"7 of 12 required status checks are expected."` Five
  of the twelve required names (Forbidden SQL Methods, Supply Chain Integrity, Semgrep SAST, OSV
  Dependency Scan, Gitleaks Secret Detection) happen to also be produced by `security.yml`, which
  was never path-filtered — those were satisfied by coincidence. The other seven (TypeScript
  Check, Lint, Tests, Tests (Workers), Version Verify, Migration from Zero, Build) exist only in
  `ci-checks.yml`, and a workflow skipped entirely via `paths-ignore` reports no status under
  those names at all — GitHub then leaves each one permanently "expected," blocking the merge
  with no path to resolution short of removing the rule or the residue.
  Fixed by replacing `ci-checks.yml`'s workflow-level `paths-ignore` with a new first job,
  `changes` (computes the same skip-eligible classification via a real call to
  `scripts/is-build-skip-eligible.sh`, in default mode), and giving every other job
  `needs: changes` plus `if: needs.changes.outputs.skip != 'true'`. The workflow itself now
  always triggers; every required-named job still runs — near-instantly when skip-eligible, since
  it immediately hits its own `if:` — and reports a real, satisfying status either way. `build`
  needed an explicit `if:` of its own beyond its existing `needs:` list, since GitHub's default
  job condition (`success()`) does not treat a *skipped* dependency as blocking, so it would
  otherwise still attempt to run even when everything it depends on was skipped.
  General lesson, not just for this workflow: workflow-level `paths-ignore` is only safe to use
  for a workflow with **zero** required-named jobs on the target branch — that precondition can
  change at any time, silently, from outside this repository's own commits (a ruleset is
  configured via the GitHub UI/API, not a file this repo's own CI would ever diff or flag). Any
  future required-status-check addition must be checked against every path-filtered workflow
  before or immediately after it's added, not assumed still safe because it was safe when a
  path-filter was first written.
