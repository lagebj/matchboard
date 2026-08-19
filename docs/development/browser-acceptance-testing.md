# Browser acceptance testing (Layer 2)

Matchboard's testing model has three layers: Layer 1 (lint/typecheck/unit/component tests — the
existing `npm test`), Layer 2 (Playwright functional validation in a real browser — this
document), Layer 3 (agent-driven exploratory UX inspection via the `browser-testing-with-devtools`
skill — a documented process, not automated code).

See `docs/adr/0069-browser-acceptance-testing-layer2.md` for why Layer 2 targets the hosted Test
slot directly rather than a locally-started server, and for the exact Auth.js login protocol
`e2e/auth.setup.ts` drives.

## Current scope

This ships **smoke + accessibility coverage only**:

- `e2e/smoke.spec.ts` — unauthenticated redirect to `/signin`, authenticated landing resolves to
  the Assistant page, one core navigation (Fixtures), no console errors.
- `e2e/accessibility.spec.ts` — `@axe-core/playwright` (WCAG 2.1 A/AA) against the Assistant and
  Fixtures pages.

**Not yet implemented** — explicitly flagged, not silently missing:

- Mutation/persistence flows (creating a team, generating a round, finalizing selections).
- Expected-authorization-failure specs (a second, restricted-role persona attempting a blocked
  action and getting denied).
- Broader page coverage beyond Assistant/Fixtures.
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

## CI

A separate `e2e` job in `.github/workflows/ci.yml` runs on every push/PR, using a
`TEST_AGENT_AUTH_SECRET` GitHub Actions secret. It runs against the same hosted Test slot as
local runs — there is no separate CI-only environment for this. The job is decoupled from
`build`'s `needs:` (a slow/flaky Test-slot-dependent job shouldn't block the build check).

The job deliberately does **not** set `BYPASS_AUTH` — see ARR-0021
(`docs/arr/0021-ci-bypass-auth-env-var-residue.md`), which records that other CI/test config
files still do despite ADR-0067 stating the mechanism was fully removed. Don't copy that pattern
into future jobs either.

## Test data

`e2e/auth.setup.ts` authenticates as `coach-all-a@test-agent.matchboard.football` — full access
to Org A's two groups (A1, A2) from the canonical seed dataset
(`scripts/seed-test-dataset.ts`). These specs are read/navigate-only (no mutations), so they
don't need to clean up after themselves against the shared Test dataset. If future
mutation-coverage work changes that, it must account for shared-state cleanup — or use
`restore-test-baseline` (`docs/development/swamp-workflows.md`) to reset the dataset, deliberately
and out-of-band from routine CI runs.
