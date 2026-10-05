# ADR-0153: Converge to a single Vercel project with deliberate Test acceptance

## Status

Accepted. Phases A–C implemented (repository changes, Custom Environment + env vars, domain
cutover). Phase D (observe one full real PR acceptance lifecycle) is being exercised via this
PR. Phases E–F pending — see "Rollout" below.

## Date

2026-10-05

## Context

ADR-0075 built the per-PR feature acceptance pipeline on top of two separately-linked Vercel
projects — `matchboard` (Production) and `matchboard-test` (Test) — because the account was on
Vercel's Hobby plan at the time, and `PROGRAMME.md` §5 explicitly forbade depending on Vercel
Custom Environments (not available on that plan). The account has since moved to Vercel Pro,
which grants one Custom Environment per project; the original constraint that shaped ADR-0075's
architecture no longer holds.

Live recon (2026-10-05, read-only, via the Vercel/Neon APIs and CLIs) confirmed the two-project
architecture is now the primary driver of avoidable Vercel/Neon spend during ordinary
coding-agent development, not merely a tidiness concern:

- **Both `matchboard` and `matchboard-test` auto-deploy on every push** — every commit to any
  branch (including every Dependabot branch) triggers two full Vercel builds, not one. Recent
  deployment history on both projects showed every live feature branch and every Dependabot
  branch building on both projects.
- The persistent Neon `test` branch carries roughly 30x production's data transfer (~54 GB vs
  ~1.8 GB) and near-production compute time — consistent with `test-acceptance.yml` (ADR-0075)
  reacting to every `opened`/`synchronize`/`reopened` event rather than a deliberate request, so
  ordinary iteration on an open PR was already paying for a fresh Neon branch, a Vercel Preview
  deploy, and a Playwright run on every single push.
- `scripts/test-acceptance/restore-baseline-alias.sh` hardcoded the alias
  `matchboard-test-git-main-matchboard-app.vercel.app` — an artifact of `matchboard-test` having
  its own always-current Git-integration alias for `main`. `VERCEL_TEST_PROJECT_ID` was threaded
  through 5 files (`docs/adr/0075-...md`, `docs/development/swamp-workflows.md`,
  `scripts/test-acceptance/{cleanup,deploy}.sh`, `.github/workflows/test-acceptance.yml`) as the
  one piece of state that assumed a second project exists.
- No live orphan `pr-*` Neon branches existed at the time of this recon (both prior ones were
  already archived) — branch cleanup itself was not the problem; deploy/branch-creation
  *frequency* was.

Separately, no existing ADR addresses Vercel Custom Environments, and ADR-0112 (per-PR
Cloudflare Worker `--env test` deploy) shares the same `test-slot` concurrency assumption as
ADR-0075 — this ADR does not change that workflow's Worker-deploy half, only the Vercel/Neon
half it runs alongside.

## Decision

Converge to one Vercel project (`matchboard`, `prj_JBbTT6bEjj8qNDpCsPq2muoSRRQ1`) with a `test`
Custom Environment, and make Test/Neon-PR-branch infrastructure activate only on an explicit PR
label (`acceptance`) instead of on every push. This supersedes ADR-0075's two-project,
every-push architecture while preserving its per-PR Neon database isolation guarantee and its
rollout-safety lessons (all of ADR-0075's History remains correct and load-bearing — it is not
rewritten, only superseded where its two-project assumptions no longer apply).

### Target architecture

- **Production** — unchanged. `matchboard` project, Production environment, `main` branch,
  `app.matchboard.football`, Neon production branch.
- **Test** — a new Custom Environment, slug `test`, on the same `matchboard` project.
  **Deliberately no branch matcher** — it never auto-deploys from a push; every deployment into
  it is explicit (`vercel deploy --target=test`), either from an acceptance run or from the new
  post-merge baseline job below. Domain `test.matchboard.football`. Independent env-var scope,
  via `customEnvironmentIds` rather than Preview's git-branch scoping.
- **Development** — unchanged. Local Next.js + Docker Postgres 17 (`docker-compose.yml`),
  already fully Neon/Vercel-independent.

### Automatic Git-triggered builds: `main` only

`scripts/vercel-ignore-build-step.sh` (wired as `vercel.json`'s `ignoreCommand`) now skips
(`exit 0`) immediately for any branch other than `main`, before the existing docs-only
skip-eligibility check even runs. `ignoreCommand` only gates Git-triggered deployments, not
explicit CLI/REST-triggered ones (confirmed against Vercel's docs) — so this cannot and does not
affect the acceptance pipeline's own explicit `vercel deploy --target=test` calls. A push to
`feature/*`, `fix/*`, `chore/*`, a Dependabot branch, or any other non-`main` branch now costs
zero Vercel builds, automatically, with no workflow changes needed on the GitHub Actions side.

### Acceptance is now label-gated, not push-reactive

`.github/workflows/test-acceptance.yml`'s trigger changed from
`[opened, synchronize, reopened, closed]` to `[labeled, synchronize, closed]`:

- **`acceptance-deploy`** now runs only `if: action == 'labeled' && label.name == 'acceptance'`
  — a human (or an agent acting on explicit instruction) must apply the label to request
  acceptance. Internals are otherwise the same as ADR-0075 (Neon `pr-<N>` branch
  create-or-reuse + migrate, deploy the exact PR commit, alias the shared slot, Playwright,
  PR comment recording the exact accepted commit), retargeted to the single project/Custom
  Environment (see "Environment-variable scoping" below).
- **`acceptance-invalidate`** (new) runs `if: action == 'synchronize' && the PR currently has the
  'acceptance' label` — removes the label and comments that new commits invalidated the prior
  acceptance. This is the structural invalidation mechanism: no SHA-tracking side-state is
  needed, because the absence of the label *is* "not currently accepted." Re-requesting
  acceptance for the new commit means re-applying the label.
- **`acceptance-cleanup`** is unchanged in trigger (`action == 'closed'`), retargeted internals.
- The shared `concurrency: { group: test-slot, cancel-in-progress: false }` is unchanged — the
  Test slot is still single-occupancy, now also shared with `test-db-migrate.yml`'s new
  baseline job (see below), so a baseline redeploy can never race an in-flight acceptance run.

A plain push to an open PR without the label now triggers **no** job in this workflow at all —
normal CI (`ci-checks.yml`) is the only thing that runs, with zero Neon/Vercel activation.

### Environment-variable scoping: environment-wide, not per-branch

ADR-0075 scoped `DATABASE_URL`/`DIRECT_URL` to the PR's exact git branch
(`vercel env add ... preview --git-branch <branch>`) — Preview deployments support this; Custom
Environments do not (the env-var API's `gitBranch` field is only valid with `target=preview`).
The replacement is an environment-wide override, upserted and restored around each PR's run:

1. `test`'s default `DATABASE_URL`/`DIRECT_URL` point at the **persistent** Neon `test` branch.
2. `deploy.sh` temporarily upserts both to the PR's isolated `pr-<N>` branch's connection
   strings (via the Vercel REST API's `customEnvironmentIds`, not the CLI's `env add` — see
   `scripts/test-acceptance/vercel-api.sh`'s header comment for why the REST API was chosen:
   the CLI's positional `[environment]` argument is documented, and enforced on the version
   installed in this repo's devcontainer, as one of `production|preview|development` only, with
   no version-independent guarantee an arbitrary Custom Environment slug is accepted there).
3. `restore-baseline-alias.sh` — called by `cleanup.sh` on every close, and by both `deploy.sh`'s
   own failure trap and `test-acceptance.yml`'s job-level `if: failure()` step — upserts both
   vars back to the persistent branch's connection strings, then resolves and re-aliases the
   Test baseline.

This is safe only because the shared Test slot is itself serialized one-PR-at-a-time
(`test-slot` concurrency group): nothing else can be mid-flight with a different override in
place, and every path that sets a temporary override is paired with one that restores the
default before releasing the lock. The user's own task spec explicitly permits this trade-off
("because Test acceptance is serialized, temporary Test environment changes are allowed if they
are safely restored").

### Baseline resolution: dynamic lookup, not a hardcoded alias

`matchboard-test` had its own static, Vercel-managed alias for `main`'s latest deployment
(`matchboard-test-git-main-matchboard-app.vercel.app`), because that whole project auto-deployed
every push. The `test` Custom Environment deliberately never does. There is therefore no
equivalent static alias — `resolve_test_baseline_deployment_url()`
(`scripts/test-acceptance/vercel-api.sh`) looks it up instead: the most recent `READY`
deployment targeting `test` with `branch=main` (`GET /v6/deployments`). A PR's own deployment is
never mistaken for the baseline, because its recorded branch is the PR's own branch, never
`main`.

### Main → Test baseline redeploy

`.github/workflows/test-db-migrate.yml` gained a `deploy-test-baseline` job (`needs: migrate`,
job-level `concurrency: { group: test-slot, ... }` overriding the workflow's own
`test-database` group for this one job): after the persistent Neon `test` branch's schema is
confirmed current, it deploys that same `main` commit into the `test` Custom Environment
(`scripts/test-acceptance/deploy-test-baseline.sh`) and re-aliases `test.matchboard.football` to
it. This implements the documented safe order: merge → CI green → migrate persistent Test →
deploy `main` to Test. Production's own migration/deploy sequencing
(`production-db-migrate.yml`) is untouched and remains separately gated.

### Cron jobs

Vercel Cron Jobs only activate on Production deployments (confirmed against Vercel's docs: a
cron is only "activated" by a deployment to the Production environment). The `test` Custom
Environment will never run `vercel.json`'s three crons — no additional disabling was needed or
added.

### Secondary Neon-branch consumer left as-is

`ci-checks.yml`'s `migration-upgrade-from-populated-state` job (ADR-0090/ARR-0026) also forks a
disposable Neon branch from `test`, but only on `push` to `main` — low frequency, not part of
the per-iteration cost this ADR targets. Not changed here.

## Consequences

- Ordinary coding-agent iteration (pushing to a feature/fix/chore branch, including every
  Dependabot branch) now costs zero Vercel builds and zero Neon branch activity — the two things
  that previously happened on every single push.
- Requesting Test acceptance is now a deliberate action (apply the `acceptance` label) rather
  than an automatic side effect of pushing to an open PR. A coding agent must be explicitly told
  to request acceptance; it must not apply the label merely to check whether something compiles.
- `VERCEL_TEST_PROJECT_ID` is no longer referenced anywhere in the repository. A new
  `VERCEL_PROJECT_ID` GitHub Actions secret (matchboard's project id) is required for
  `test-acceptance.yml` and `test-db-migrate.yml`'s new job to function — see "Rollout" below;
  this is a live-infrastructure action, not something this PR can perform itself.
- `matchboard-test` is not deleted by this change and must not be deleted until Phase F below is
  explicitly authorized — it remains the rollback path for the full rollout.
- Env var migration matrix (names only; see `.env.example` for the authoritative template):

  | Variable group | Production | Test (Custom Environment) | Development | Notes |
  |---|---|---|---|---|
  | `DATABASE_URL`, `DIRECT_URL` | Neon production branch | Neon persistent `test` branch (default); temporarily overridden per-PR during acceptance | Local Docker Postgres | See "Environment-variable scoping" above |
  | `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_URL`, `ALLOWED_COACH_EMAILS` | set | set (distinct values) | `.env` local | |
  | `NEXT_PUBLIC_LIVE_MATCH_REALTIME_URL`, `LIVE_MATCH_INTERNAL_SECRET`, `LIVE_MATCH_REALTIME_SECRET` | `wss://realtime.matchboard.football` | `wss://realtime-test.matchboard.football` | local Worker/mocks | |
  | `MATCHBOARD_ENV`, `APP_BASE_URL`, `CRON_SECRET`, `CSP_ENFORCE`, `BREVO_API_KEY`, `BREVO_WEBHOOK_BEARER_TOKEN` | set | set (distinct values) | `.env` local | |
  | `BREVO_TEST_RECIPIENTS`, `TEST_DATASET_VERSION`, `TEST_AGENT_AUTH_NAMESPACE`, `TEST_AGENT_AUTH_SECRET`, `TEST_AGENT_AUTH_ENABLED` | **never set** | set | local `.env` (for local Playwright runs) | Test-only by design |
  | `AI_SECURITY_*`, `AI_CREDENTIAL_ACCESS_*`, `AI_ENROLLMENT_SIGNING_*` | **never set in Vercel** | **never set in Vercel** | local only | Owned by the separate `matchboard-security` service (ADR-0150); `.env.example` already states this |

- GitHub secrets no longer required once Phase E (below) completes: `VERCEL_TEST_PROJECT_ID`.
  Secrets still required: `NEON_API_KEY`, `NEON_PROJECT_ID`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`,
  `GH_TOKEN` (implicit `GITHUB_TOKEN`), `TEST_AGENT_AUTH_SECRET`, Cloudflare Worker secrets
  (unchanged), the new `VERCEL_PROJECT_ID`, and the new `VERCEL_AUTOMATION_BYPASS_SECRET`
  (required only because of the Deployment Protection behavior found during Phase C — see
  "Rollout" below).

## Rollout

Live infrastructure changes were deliberately **not** bundled with Phase A's PR — ADR-0075's own
"Rollout safety" lesson (a failure partway through a live-infra change must not leave shared
state broken) argues against combining a repository change with simultaneous irreversible live
changes. Each later phase required its own explicit go-ahead:

- **Phase B** (done): created the `test` Custom Environment (no branch matcher) on `matchboard`;
  added the `VERCEL_PROJECT_ID` GitHub secret; migrated the Test-only env vars into it
  (`customEnvironmentIds`); smoke-tested `vercel deploy --target=test` end-to-end (build, `/api/
  meta`, `/api/health`, `/signin` all verified against a real deployment) before touching any
  domain.
- **Phase C** (done): moved `test.matchboard.football` from `matchboard-test` to `matchboard`'s
  `test` environment (`DELETE` then `POST .../domains` with `customEnvironmentId` — not the
  dedicated move endpoint, since it cannot set `customEnvironmentId` atomically and would have
  left the domain briefly bound to `matchboard`'s Production target by default). Updated
  `models/command/shell/inspect-deployment.yaml`'s `vercel_project` to `"matchboard"` for both
  targets at the same time.

  **Found during Phase C verification, not anticipated in the original plan**: Vercel's SSO
  Deployment Protection `all_except_custom_domains` exemption, confirmed live, only exempts a
  project's **Production** custom domain — a domain scoped to a non-Production Custom
  Environment (the `test` environment's `type` is `preview` under the hood) is NOT exempted and
  gets redirected to Vercel's own login page (302) for any unauthenticated caller, including
  Playwright in CI and local `curl`/dev. Fixed by generating a Protection Bypass for Automation
  secret for the `matchboard` project, storing it as the `VERCEL_AUTOMATION_BYPASS_SECRET`
  GitHub secret, and sending it as the `x-vercel-protection-bypass` header
  (`playwright.config.ts`, gated behind `ci-checks.yml`'s `e2e` job and
  `test-acceptance.yml`'s `acceptance-deploy` job both now requiring it alongside
  `TEST_AGENT_AUTH_SECRET`) and from the swamp diagnostic models that curl `/api/meta` directly.
  See the follow-up fix PR for the exact diff.
- **Phase D** (in progress): observe one full real PR acceptance lifecycle end-to-end on the new
  architecture (label → deploy → Playwright → close → cleanup) before relying on it for real
  work. Being exercised via this PR — see History for the observed result once available.
- **Phase E**: remove the `VERCEL_TEST_PROJECT_ID` GitHub secret. Confirmed via repo-wide search
  that it is no longer referenced anywhere outside historical ADR prose (ADR-0075, this ADR) —
  safe to remove once Phase D confirms the replacement pipeline works end-to-end. Not yet done.
- **Phase F**: recommend — never automatically perform — deletion/archival of the
  `matchboard-test` project. Final deletion requires explicit user authorization. Not yet done.

### Rollback

`matchboard-test` stays fully intact and undeleted through Phase E — it still has its own working
deployment, so reverting Phase C is re-pointing `test.matchboard.football` back to it (the same
two-call sequence in reverse: remove the domain from `matchboard`, add it back to
`matchboard-test`). Reverting Phase A is `git revert` of its PR's commits.

## Related decisions

- ADR-0075 — superseded by this ADR for the two-project, every-push architecture. Its per-PR
  Neon isolation guarantee, concurrency design, and incident history remain valid and are
  preserved, not rewritten.
- ADR-0112 — per-PR Cloudflare Worker `--env test` deploy; unchanged by this ADR, still shares
  the `test-slot` concurrency group.
- ADR-0069 — browser acceptance testing against the hosted Test slot; unchanged in design, only
  in how the slot gets populated.
- ADR-0090/ARR-0026 — the separate Neon-branch-forking migration-upgrade check in
  `ci-checks.yml`; not changed by this ADR (see "Secondary Neon-branch consumer" above).

## History

- 2026-10-05: Accepted. Phase A (this ADR, plus the repository changes it describes) merged.
  Live recon (team/project IDs, domain ownership, env var names, deployment patterns, Neon
  branch state) performed read-only before writing this decision down, not assumed from the
  prior architecture's documentation alone. Phases B–F pending explicit operator authorization.
- 2026-10-05 (later, same day): Phase B executed and verified live (Custom Environment created,
  env vars set, smoke-test deploy's build/`/api/meta`/`/api/health`/`/signin` all confirmed
  working). Phase C executed: domain moved from `matchboard-test` to `matchboard`'s `test`
  environment. Found live immediately afterward: the moved domain was blocked by Vercel's own
  SSO Deployment Protection (302, not an app-level issue) — `all_except_custom_domains` exempts
  only a project's Production domain, not a Custom Environment's. Fixed the same day with a
  Protection Bypass for Automation secret (`VERCEL_AUTOMATION_BYPASS_SECRET`), wired into
  `playwright.config.ts`, `ci-checks.yml`'s `e2e` job, `test-acceptance.yml`'s
  `acceptance-deploy` job, and the four swamp diagnostic models that curl `/api/meta` directly
  — see that fix's own PR. This is the kind of platform-behavior discovery the phased rollout
  (rather than a single irreversible big-bang cutover) was specifically designed to surface
  safely, and it worked as intended: caught immediately after Phase C via live verification,
  fixed forward the same day, nothing left silently broken.
- 2026-10-05 (later still): a second, independent consequence of the same Deployment Protection
  behavior surfaced once the AUTH_URL fix above let CI actually reach the live-match specs:
  the Cloudflare Worker's server-to-server calls to `MATCHBOARD_API_BASE_URL`
  (`workers/live-match/src/internal-client.ts`) were also being rejected (401) by Vercel's edge
  before ever reaching the app's own HMAC verification — confirmed live via `wrangler tail`
  (`PERSISTENCE_UNAVAILABLE`/`lastErrorStatus: 401` on every retry, with fresh timestamps
  ruling out stale backlog). Unlike the browser/Playwright case, this had nothing to do with
  `LIVE_MATCH_INTERNAL_SECRET`'s value — a prior same-day rotation of that secret (and of
  `LIVE_MATCH_REALTIME_SECRET`, done out of caution after the earlier migration bug corrupted
  both to the literal placeholder `"[SENSITIVE]"`) was necessary cleanup but not the fix for
  this specific symptom. Fixed by adding an optional `bypassSecret` parameter through
  `buildSignedRequest`/`persistEvent`/`fetchSnapshot`, sent as `x-vercel-protection-bypass`
  whenever present, sourced from a new optional `VERCEL_AUTOMATION_BYPASS_SECRET` Worker
  binding — set only on the `test` Worker environment (Production's domain is already exempt,
  so the production Worker has no such secret and sends no header). Wired into
  `deploy-live-match-worker.yml` and `test-acceptance.yml`'s existing Worker-secret-sync steps,
  reusing the same GitHub secret the Vercel-side env var is upserted from, so a future rotation
  stays in sync automatically on both sides. Also found during this investigation: the
  persistent Neon `test` branch had independently accumulated enough live-match test data over
  time that round planning had closed for at least one round (`"Planning is closed for one or
  more matches in this round"` from the `seed-finalized-match` test fixture) — a pre-existing,
  unrelated data-staleness issue (documented precedent in this ADR's own History and ADR-0152's)
  fixed via the `restore-test-baseline` swamp procedure, run against the real persistent branch
  after a local `.env` file's own `TEST_DATABASE_URL` was caught silently shadowing the intended
  target on the first attempt (corrected before any real branch was touched incorrectly).
- 2026-10-05 (later still): the Worker protection-bypass fix above shipped (PR #721, merged),
  the test Worker was redeployed with `VERCEL_AUTOMATION_BYPASS_SECRET` synced, and a fresh
  `main` CI run confirmed `Browser Acceptance Tests` passing end-to-end (45 passed, no timeout)
  — closing out the incident. Separately, the remaining env vars corrupted to the literal
  placeholder `"[SENSITIVE]"` during Phase B's `vercel env pull` mistake were resolved:
  `AUTH_SECRET`/`CRON_SECRET` rotated to fresh values; `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET`,
  `BREVO_API_KEY`, `BREVO_TEST_RECIPIENTS`, `BREVO_WEBHOOK_BEARER_TOKEN` set to real values.
  `ALLOWED_COACH_EMAILS` was deleted rather than restored — confirmed dead: ADR-0061 removed the
  email-allowlist auth mechanism entirely, and `security-audit.test.ts` asserts no code
  references it. The env var migration matrix above still lists it under the old
  ADR-0075-era grouping; left as historical record of what Phase B copied, not a statement that
  it is still set.
- 2026-10-05 (Phase D): this PR itself is the real PR used to exercise Phase D — applying the
  `acceptance` label and observing `acceptance-deploy`, then merging and observing
  `acceptance-cleanup`, on the live single-project/Custom-Environment architecture end to end.
