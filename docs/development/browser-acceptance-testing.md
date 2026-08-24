# Browser acceptance testing (Layer 2)

Matchboard's testing model has three layers: Layer 1 (lint/typecheck/unit/component tests — the
existing `npm test`), Layer 2 (Playwright functional validation in a real browser — this
document), Layer 3 (agent-driven exploratory UX inspection via the `browser-testing-with-devtools`
skill — a documented process, not automated code).

See `docs/adr/0069-browser-acceptance-testing-layer2.md` for why Layer 2 targets the hosted Test
slot directly rather than a locally-started server, and for the exact Auth.js login protocol
`e2e/auth.setup.ts` drives.

## Current scope

Smoke, accessibility, one mutation/persistence flow, and expected-authorization-failure coverage
(see ADR-0078 for the mutation/authz-failure design):

- `e2e/smoke.spec.ts` — unauthenticated redirect to `/signin`, authenticated landing resolves to
  the Assistant page, one core navigation (Fixtures), no console errors.
- `e2e/accessibility.spec.ts` — `@axe-core/playwright` (WCAG 2.2 AA, superset of 2.1 A/AA) against
  Today, League, Players, Opponents, and Round Board. Runs under three Playwright projects
  (`chromium` desktop, `accessibility-phone` at 390×844, `accessibility-tablet` at 768×1024) —
  this is currently the entire phone/tablet viewport matrix, scoped to this one spec rather than
  every spec (Phase 2.18: the goal is catching responsive-layout a11y issues at real device
  sizes, not redundantly re-running mutation/business-logic specs across viewports).
- `e2e/round-mutation.spec.ts` — regenerates real draft selections for a round, verifies they
  persisted (a player chip on the Round Board), then clears them back to an empty draft.
  Deliberately self-cleaning, safe to run repeatedly against the shared Test slot.
- `e2e/authz-failure.spec.ts` — runs under a separate `chromium-viewer` project as `viewer-a` (a
  real VIEWER-role persona): asserts creating a team is denied and never persisted, and asserts
  cross-organisation access (Org B) is denied and leaks no Org B data.
- `e2e/live-reporting.spec.ts` — creates a throwaway finalized match (see
  `e2e/helpers/live-match-fixtures.ts`), then covers the real live-reporting flow: start session,
  record a goal, verify the scoreboard updates, finish cleanly; and a regression test for the
  2026-08-24 score data-integrity fix (`handleEndSession` in `live-match-client.tsx`) — going
  offline mid-session, recording an event, and confirming "Finish live reporting" refuses to end
  the session and lose the event, then succeeds once back online.
- `e2e/follow-live.spec.ts` — a genuine two-actor scenario: the reporting coach (`coach-all-a`)
  starts a live session; a second, distinct login (`coach-a1`, GROUP_COACH on the same group,
  opened via `browser.newContext({ storageState: "e2e/.auth/coach-a1.json" })`) opens "Follow
  live" for the same match and asserts the connection actually reaches the Cloudflare Durable
  Object over a real WebSocket, and that an event the reporter records actually arrives.

Unlike `round-mutation.spec.ts`, the live-reporting/follow-live specs cannot be made
self-cleaning — finalizing creates real selections and (once a session ends) a permanent
`PostMatchReport`, with no "delete match" UI action. Each test creates its own throwaway match
(unique opponent name, and deliberately spread across a wide randomized *future* date range —
see the comment in `live-match-fixtures.ts` for why matches dated "today" collided with each
other's player pool in round-level generation) rather than mutating the shared canonical seed
dataset. This is accepted as ongoing accumulation in the shared Test dataset.

**Live match reporting and CSP** — while building this coverage (2026-08-24), a Playwright
console listener caught the real root cause of both the "Follow live" `Connection problem` UI
state and reporting-coach events occasionally getting stuck in `Sync issue — data saved locally`:
the app's own Content-Security-Policy `connect-src` directive (`src/lib/security/csp.ts`) never
listed the Cloudflare Worker's WebSocket origins (`wss://realtime.matchboard.football`,
`wss://realtime-test.matchboard.football`) when the live-match-realtime-programme shipped, so the
*browser itself* silently blocked every connection attempt regardless of server-side
correctness. Fixed by adding both origins to `connect-src`; confirmed live in CI that the
connection now succeeds (the "Live" connected-state check in `follow-live.spec.ts` passes).

Two further bugs surfaced only once the CSP fix let these specs run past the connection step,
both fixed the same day: `follow-live.spec.ts` asserted rendered text that
`follow-live-client.tsx` could never produce (`"goal for us"` vs. the actual `"goal for"` —
`eventType.replaceAll("_", " ").toLowerCase()`), and `live-reporting.spec.ts`'s sync wait only
checked that "syncing…" text had disappeared, which is a false positive when an attempt instead
lands in the terminal `Sync issue` error state — `waitForEventsToSync()` in
`live-match-fixtures.ts` now polls for both states and actively nudges a retry (dispatching the
same `"online"` window event the app's own reconnect handler listens for) rather than trusting
the pending state's mere absence.

A third, unrelated bug also surfaced under CI's `fullyParallel`/2-worker concurrency: the shared
fixture identified "my" newly created round by assuming it was always the first card in
`/rounds`' org-wide, `createdAt desc`-ordered list — true for a single test running alone, but
not guaranteed once multiple specs create matches concurrently against the same shared,
unbounded, never-cleaned org. The fixture now locates the round by its rendered ISO week label
instead (the round card shows no opponent/match-identifying text, only the week label), which is
specific to the match this fixture just created regardless of what other tests are doing
concurrently.

**Round-generation transaction contention (`playwright.config.ts`'s `workers: 1`)** — even after
the fix above, CI still failed: `round-mutation.spec.ts`'s own pre-existing, unrelated round
lookup came up empty, and the round board crashed outright with a redacted "Server Components
render" error (React digest, no detail in the Playwright output). `vercel logs` against the
failed run's still-live ephemeral preview deployment (found via the CI job log's `Deployment:
<url>` line) surfaced the real, unredacted error: `PrismaClientKnownRequestError: Transaction API
error: Unable to start a transaction in the given time` (P2028). Each of `round-mutation.spec.ts`,
`live-reporting.spec.ts` (2 tests), and `follow-live.spec.ts` triggers a full round-level
generation transaction (AGENTS.md: per-match core selection, support resolution, conflict
resolution, development routing, squad repair, validation, policy evaluation); with 2 Playwright
workers, several of these could be mid-generation at once. Dropping CI to `workers: 1` reduces
that contention (roughly doubles wall-clock time, ~10min → ~20min observed) and is worth keeping
regardless, but investigating *why* transaction pressure was severe enough to matter at all led to
a much bigger finding: this per-PR run wasn't actually hitting its own isolated Neon branch in the
first place — it (and, it turned out, every PR before it) was mutating the shared, persistent
`test` branch, the same one every *other* concurrent PR's run and `ci-checks.yml`'s post-merge job
also use. See ARR-0024 and ADR-0075's History for the full record and fix (a missing checkout
`ref:`, causing Vercel's git-metadata branch-scoped env var selection to silently fail). `workers:
1` remains a reasonable safety margin against a freshly forked child branch's smaller initial
compute allocation, but the *cross-PR* contention is what the isolation fix actually addresses.

**Not yet implemented** — explicitly flagged, not silently missing:

- Team-creation mutation coverage — there is currently no UI-driven way to delete or archive a
  team (`deleteTeamAction` exists in `src/app/(app)/teams/actions.ts` but no component calls
  it), so a create-team e2e flow would leave permanent residue in the shared local Test dataset.
  Add this once team deletion/archival has a UI entry point.
- Finalizing selections as a mutation flow (round generate/clear is covered; finalize/un-finalize
  round-trip coverage is a natural next slice once prioritized).
- Broader mutation/persistence-flow coverage beyond the one round-generation flow — accessibility
  coverage now includes Today/League/Players/Opponents/Round Board (see above), but mutation
  flows for those pages are still only the one round-mutation spec.
- Running against a locally-started server in CI (currently CI runs against the hosted Test
  slot only — see the ADR for why).

## Running locally

```bash
npm run test:e2e
```

Requires `TEST_AGENT_AUTH_SECRET` in your environment, matching the value configured on the
`https://test.matchboard.football` deployment (find it in Vercel project settings for
`matchboard-test`, or ask whoever manages that project — it is never committed or documented
here). By default this targets the hosted Test slot; to run against a local dev server instead:

```bash
PLAYWRIGHT_BASE_URL=http://localhost:3333 TEST_AGENT_AUTH_SECRET=... npm run test:e2e
```

(the local server needs `TEST_AGENT_AUTH_ENABLED=true` and a matching `TEST_AGENT_AUTH_SECRET`
of its own — see `docs/adr/0066-test-auth-and-canonical-dataset.md`).

`playwright.config.ts` hard-refuses any `baseURL` containing `app.matchboard.football` — Layer 2
must never run against production.

Via Swamp (see `docs/development/swamp-workflows.md`):

```bash
swamp --no-telemetry model method run verify-browser-acceptance execute \
  --input env.TEST_AGENT_AUTH_SECRET='<secret>'
```

First run downloads the Chromium browser binary if not already cached:

```bash
npx playwright install --with-deps chromium
```

## Debugging a failing run

```bash
npm run test:e2e:ui
```

opens Playwright's UI mode for step-by-step replay. `playwright-report/` (gitignored) has the
HTML report after any run; `trace: "on-first-retry"` in the config means a trace file is captured
automatically once a test has failed once.

In CI, both the `e2e` job (`ci-checks.yml`) and `test-acceptance.yml`'s Playwright step upload
`test-results/` (screenshots, traces, `error-context.md` for every failure) as a
`playwright-results-<run-id>` build artifact, 5-day retention, regardless of outcome — added
2026-08-24 after a flaky-fixture failure took a full debugging cycle to diagnose from the console
log's text summary alone, with no screenshot or trace available. Download via the run's Actions
summary page or `gh run download <run-id> -n playwright-results-<run-id>`.

Next.js redacts Server Component render error messages in production builds down to a generic
`Minified React error #441` with an opaque digest — exactly what the deploy target runs, so
`error-context.md`/screenshots alone won't show the real error for a server-side crash. If the
failed run's deployment step logged a `Deployment: <url>` line (both `deploy.sh` and CI's own
`vercel deploy` steps do) and the deployment hasn't been torn down yet, `vercel logs <url>`
retrieves real runtime error logs (unredacted) for that specific ephemeral deployment — this is
how the 2026-08-24 `P2028` transaction-timeout root cause below was actually found, after the
Playwright output alone gave nothing but the redacted digest.

## CI

A separate `e2e` job in `.github/workflows/ci-checks.yml` (named "Browser Acceptance Tests") runs
**only on `push`** (post-merge), not on `pull_request` — pre-merge PR-level Playwright validation
is `test-acceptance.yml`'s job instead, which deploys the PR commit to an isolated per-PR Neon
branch and Vercel preview and aliases `test.matchboard.football` to it for the duration of the
run (ADR-0075), rather than racing the shared hosted Test slot against whatever other PR might be
running at the same time. The `ci-checks.yml` job serves post-merge smoke validation against the
just-restored baseline instead, using a `TEST_AGENT_AUTH_SECRET` GitHub Actions secret. The job is
decoupled from `build`'s `needs:` (a slow/flaky Test-slot-dependent job shouldn't block the build
check).

### Keeping the persistent test branch migrated

Each PR's `test-acceptance.yml` deploy forks an isolated Neon *child* branch from the
persistent `test` branch and migrates only that child (ADR-0075) — nothing ever migrated the
parent branch itself until `.github/workflows/test-db-migrate.yml` was added
(2026-08-23, see ADR-0075's History). That workflow runs `prisma migrate deploy` against the
persistent branch automatically after every CI success on `main`. If a fresh per-PR fork or a
local devcontainer run (pointed at the same branch via ambient `TEST_DATABASE_URL`) starts
failing with `type "X" does not exist` or similar schema-mismatch errors across many unrelated
specs, suspect this branch falling behind before assuming a real regression — check whether
`test-db-migrate.yml` has run recently and successfully.

That workflow only ever migrates schema — it never reseeds data. If the persistent branch's
canonical dataset itself becomes corrupted (e.g. a crashed seed run leaving partial data —
this happened for real, 2026-08-23, see ADR-0075's History), the fix is the `restore-test-baseline`
swamp procedure (`docs/development/swamp-workflows.md`), not this workflow.

The job deliberately does **not** set `BYPASS_AUTH` — see ARR-0021
(`docs/arr/0021-ci-bypass-auth-env-var-residue.md`), which records that other CI/test config
files still do despite ADR-0067 stating the mechanism was fully removed. Don't copy that pattern
into future jobs either.

## Test data

`e2e/auth.setup.ts` authenticates three personas from the canonical seed dataset
(`scripts/seed-test-dataset.ts`): `coach-all-a@test-agent.matchboard.football` (full access to
Org A's two groups, A1/A2 — used by `smoke.spec.ts`, `accessibility.spec.ts`,
`round-mutation.spec.ts`, and as the reporting coach in `live-reporting.spec.ts`/
`follow-live.spec.ts`), `viewer-a@test-agent.matchboard.football` (VIEWER role, Org A only — used
by `authz-failure.spec.ts`), and `coach-a1@test-agent.matchboard.football` (GROUP_COACH on group
A1 only — a second, genuinely distinct login used as the following coach in
`follow-live.spec.ts`'s two-actor scenario, opened via a manual
`browser.newContext({ storageState: "e2e/.auth/coach-a1.json" })` rather than a second Playwright
project, since both personas are needed live within the same test).

`round-mutation.spec.ts` is the one spec that mutates data. It's deliberately self-cleaning
(generate → verify → clear, ending in the same not-generated state it started from), so it needs
no separate teardown against the shared Test dataset. Any future mutation-coverage work that
can't be made self-cleaning this way must account for shared-state cleanup — or use
`restore-test-baseline` (`docs/development/swamp-workflows.md`) to reset the dataset, deliberately
and out-of-band from routine CI runs.
