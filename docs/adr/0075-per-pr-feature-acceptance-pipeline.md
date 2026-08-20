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
deleted deployment; each job includes an explicit failure path that restores the
alias to the last-known-good baseline rather than leaving it stuck mid-transition.

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
