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
- `e2e/accessibility.spec.ts` — `@axe-core/playwright` (WCAG 2.1 A/AA) against the Assistant and
  Fixtures pages.
- `e2e/round-mutation.spec.ts` — generates real draft selections for a round, verifies they
  persisted (a player chip on the Round Board), then clears them back to not-generated.
  Deliberately self-cleaning, safe to run repeatedly against the shared Test slot.
- `e2e/authz-failure.spec.ts` — runs under a separate `chromium-viewer` project as `viewer-a` (a
  real VIEWER-role persona): asserts creating a team is denied and never persisted, and asserts
  cross-organisation access (Org B) is denied and leaks no Org B data.

**Not yet implemented** — explicitly flagged, not silently missing:

- Team-creation mutation coverage — there is currently no UI-driven way to delete or archive a
  team (`deleteTeamAction` exists in `src/app/(app)/teams/actions.ts` but no component calls
  it), so a create-team e2e flow would leave permanent residue in the shared local Test dataset.
  Add this once team deletion/archival has a UI entry point.
- Finalizing selections as a mutation flow (round generate/clear is covered; finalize/un-finalize
  round-trip coverage is a natural next slice once prioritized).
- Broader page coverage beyond Assistant/Fixtures/Rounds/Teams.
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

A separate `e2e` job in `.github/workflows/ci-checks.yml` runs on every push/PR, using a
`TEST_AGENT_AUTH_SECRET` GitHub Actions secret. It runs against the same hosted Test slot as
local runs — there is no separate CI-only environment for this. The job is decoupled from
`build`'s `needs:` (a slow/flaky Test-slot-dependent job shouldn't block the build check).

The job deliberately does **not** set `BYPASS_AUTH` — see ARR-0021
(`docs/arr/0021-ci-bypass-auth-env-var-residue.md`), which records that other CI/test config
files still do despite ADR-0067 stating the mechanism was fully removed. Don't copy that pattern
into future jobs either.

## Test data

`e2e/auth.setup.ts` authenticates two personas from the canonical seed dataset
(`scripts/seed-test-dataset.ts`): `coach-all-a@test-agent.matchboard.football` (full access to
Org A's two groups, A1/A2 — used by `smoke.spec.ts`, `accessibility.spec.ts`,
`round-mutation.spec.ts`) and `viewer-a@test-agent.matchboard.football` (VIEWER role, Org A only
— used by `authz-failure.spec.ts`).

`round-mutation.spec.ts` is the one spec that mutates data. It's deliberately self-cleaning
(generate → verify → clear, ending in the same not-generated state it started from), so it needs
no separate teardown against the shared Test dataset. Any future mutation-coverage work that
can't be made self-cleaning this way must account for shared-state cleanup — or use
`restore-test-baseline` (`docs/development/swamp-workflows.md`) to reset the dataset, deliberately
and out-of-band from routine CI runs.
