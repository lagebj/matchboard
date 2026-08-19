# ADR-0069: Browser acceptance testing against the live Test slot

## Status

Accepted

## Date

2026-08-19

## Context

The consolidation programme's Phase 5 defines a 3-layer testing model: Layer 1 (existing
lint/typecheck/unit/component tests, already in place), Layer 2 (Playwright functional
validation in a real browser), Layer 3 (agent-driven exploratory UX inspection, using the
`browser-testing-with-devtools` skill — a documented process, not automated code). Phase 5 was
`NOT_READY`: no Playwright dependency, no `e2e/` directory, no browser-acceptance CI job.

The persistent Test environment is verified live (see `EXTERNAL-STATE.md`): Vercel project
`matchboard-test` deployed at `https://test.matchboard.football`, backed by a dedicated Neon
`test` branch with a seeded canonical dataset (`datasetVersion: 1`, 8 personas across two
organisations — `owner-a`, `admin-a`, `coach-all-a`, `coach-a1`, `coach-a2`, `viewer-a`,
`owner-b`, `coach-b1`, all `@test-agent.matchboard.football`). Both Test and Production deploy
automatically from `main` via Vercel's Git integration.

Test-agent auth (ADR-0066) is the sole sanctioned test authentication mechanism (ADR-0067).
`POST /api/auth/test-agent` upserts a `User` row but does **not** establish a session — it's a
REST convenience endpoint, not a login flow. A real session requires driving Auth.js's actual
Credentials callback. This was verified directly against the live Test deployment during this
work (`next-auth@5.0.0-beta.32`):

1. `GET /api/auth/csrf` → `{"csrfToken": "..."}`, sets `__Host-authjs.csrf-token` and
   `__Secure-authjs.callback-url` cookies (`__Host-`/`__Secure-` prefixes because the deployment
   is HTTPS).
2. `POST /api/auth/callback/credentials` with form-urlencoded `email`, `secret`, `csrfToken` (the
   unsigned token from step 1's response body, alongside the cookie from step 1).
3. On success: redirect, with a `__Secure-authjs.session-token` cookie set.
4. On failure (wrong secret, `authorize()` returns `null`): redirect to `/error?error=Configuration`
   — a known `next-auth@5.0.0-beta.32` quirk (later Auth.js v5 releases changed this back to
   `CredentialsSignin`; this pinned beta version has the older behavior). This is not a
   misconfiguration — the request format above is correct.

## Decision

Add `@playwright/test` and `@axe-core/playwright` as devDependencies. New `e2e/` directory:

- `e2e/auth.setup.ts` — a Playwright "setup project" that drives the CSRF + credentials-callback
  flow above directly (not `page.goto()`-driven UI login — faster, and doesn't depend on the
  sign-in page's DOM), using the `coach-all-a@test-agent.matchboard.football` persona (full
  access to Org A's two groups — a representative default), and saves the resulting
  `storageState` to `e2e/.auth/coach.json`. Fails loudly if `TEST_AGENT_AUTH_SECRET` is unset or
  no session cookie results — never silently produces an unauthenticated state that fails
  confusingly downstream.
- `e2e/smoke.spec.ts` — genuine smoke coverage: unauthenticated access redirects to `/signin`,
  authenticated landing loads, one core navigation, no console errors.
- `e2e/accessibility.spec.ts` — `@axe-core/playwright`'s `AxeBuilder` against 1-2 key pages. Per
  the programme's explicit guidance not to build custom accessibility-scanning infrastructure,
  this is exactly that constraint honored — no custom a11y tooling, just the standard library.

`playwright.config.ts` defaults `baseURL` to `https://test.matchboard.football` — the hosted,
already-live Test slot — rather than starting a local server. This is a deliberate change from
this ADR's original draft (written before the Test slot was verified live), and is simpler: no
local Postgres, no local `next build`/`next start`, no environment-variable plumbing into a
child process. `PLAYWRIGHT_BASE_URL` overrides it for local iteration against a dev server
(`http://localhost:3333`) when needed. A hard guard rejects any `baseURL` containing
`app.matchboard.football` — Layer 2 must never run against production.

CI: a new `e2e` job in `ci.yml`, decoupled from `build`'s `needs:` (matching how
`migration-from-zero` doesn't gate `build` either), running `npx playwright install --with-deps
chromium` (plain `run:` step, no new `uses:` action — `scripts/check-supply-chain.ts`'s pinned-SHA
allowlist needs no change) then `npm run test:e2e`, using a `TEST_AGENT_AUTH_SECRET` GitHub
Actions secret. The job does **not** set `BYPASS_AUTH` — see ARR-0021, which records that 3
other files still do despite ADR-0067 stating the mechanism was fully removed; this job
deliberately doesn't propagate that residue into a 4th location.

Layer 3 (agent-driven exploratory review) remains a documented process using the existing
`browser-testing-with-devtools` skill — no automation code added here.

Following the pattern established in ADR-0068 (Swamp), a `verify-browser-acceptance`
`command/shell` Swamp model wraps `npm run test:e2e`, for local agent/developer discoverability
consistent with the other 9 procedures. This is local-only tooling, not part of CI (CI calls
`npm run test:e2e` directly — the CI runner doesn't have Swamp installed, and installing it there
would raise the same telemetry/EULA questions ADR-0068 already resolved for the devcontainer,
disproportionately for a single CI step).

## Scope (explicit — not full Layer 2 coverage)

This ships smoke + accessibility coverage only. Explicitly **not** in this change:
mutation/persistence flows, expected-authorization-failure specs (a second persona with a
restricted role attempting a blocked action), and broader page coverage. Recorded as follow-up
in `docs/development/browser-acceptance-testing.md`, not silently missing.

## Consequences

- Layer 2 now runs against real, live infrastructure rather than a synthetic local server —
  proves more (actual Vercel deployment behavior, actual Neon Test branch data) but means a
  flaky/down Test slot can fail CI for reasons unrelated to the PR under test. Accepted: the Test
  slot is already load-bearing for ADR-0066/0067's verification claims.
  `restore-test-baseline` (ADR-0068) exists if the Test dataset needs resetting after a bad e2e
  run leaves stray data.
- `e2e/` tests are read/navigate-only in this first packet — no mutation coverage yet, so there's
  no risk of e2e runs corrupting the shared Test dataset in this change. Future mutation-coverage
  work must account for shared-state cleanup.
- New dependency surface (`@playwright/test`, `@axe-core/playwright`) requires
  `npm run security:deps` review before merge, per standard dependency-addition policy.
- `test:e2e` is intentionally **not** folded into `npm test`/`npm run validate`/Swamp's
  `verify-repository` — it's slower and hits live infrastructure; keeping it separate and opt-in
  is a deliberate choice, revisited once Layer 2 coverage is broader than smoke + accessibility.
