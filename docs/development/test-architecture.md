# Matchboard Test Architecture

## Test categories

| Category | Database | Network | Location | Speed |
|----------|----------|---------|----------|------|
| Unit | No | No | `src/**/*.test.ts` (no DB) | Fast |
| Database integration | Local PostgreSQL | No | `src/**/*.test.ts` (uses DB) | Moderate |
| Component | No | No | `src/**/*.test.tsx` | Fast |
| Security authz | Local PostgreSQL | No | `src/test/security-authz.test.ts` | Moderate |
| Browser acceptance (Playwright) | Neon Test branch (live) | Live HTTPS (`test.matchboard.football`) | `e2e/**/*.spec.ts` | Slow |

The normal test suite (`npm test`) runs unit + database integration + component tests. Browser
acceptance tests (`npm run test:e2e`) are a separate, opt-in layer — see
`docs/development/browser-acceptance-testing.md` and
`docs/adr/0069-browser-acceptance-testing-layer2.md`.

External SaaS integration tests (Neon, Brevo, etc.) must NOT be part of the normal suite.

## Database architecture

```
Unit tests
    |
    +-- no database

Database integration tests
    |
    +-- local PostgreSQL (devcontainer, Codespaces, CI)
    |
    +-- TEST_DATABASE_URL (never falls back to DATABASE_URL)

Explicit remote verification
    |
    +-- Neon (only when explicitly configured)
```

Tests must never accidentally target production or development Neon databases.

## Test database configuration

- `TEST_DATABASE_URL` — required for all database-backed tests (runtime queries)
- `TEST_DATABASE_DIRECT_URL` — direct connection for Prisma migrations in test/CI (falls back to `TEST_DATABASE_URL` if not set)
- `DATABASE_URL` — must NOT be used as a fallback for tests
- `DIRECT_URL` — dev/production direct connection for Prisma CLI (migrations)
- `PRODUCTION_DATABASE_URL` — production database URL (Vercel secret, used in deployment workflows)
- `setupTestDb()` — creates/reuses the test PrismaClient singleton
- `cleanTestDb()` — wipes every application table; used in `beforeAll` in some files, `beforeEach` in others depending on how much isolation the file's tests need
- `teardownTestDb()` — disconnects the client (used in `afterAll`)

### `cleanTestDb()` performance: TRUNCATE vs sequential DELETE

`cleanTestDb()` tries a single dynamic `TRUNCATE TABLE ... CASCADE` statement first (one round
trip, wipes every table in `public` except `_prisma_migrations`) and only falls back to the
original per-table `deleteMany()` sequence (~80 round trips) if the TRUNCATE attempt fails for
any reason — most commonly, the connecting role lacking `TRUNCATE` privilege (`DELETE` privilege
alone is not sufficient in Postgres; it's a separate grant).

This matters a lot when `TEST_DATABASE_URL` points at a remote database (a Neon branch) rather
than `localhost` (local Postgres, what CI uses): with `cleanTestDb()` running before every test
in many files, ~80 sequential round trips at real network latency (~30-40ms each, measured
against a Neon `eu-central-1` branch from this repo's devcontainer) adds up to minutes across
thousands of tests. The single-round-trip TRUNCATE path collapses that entirely, regardless of
network latency — confirmed empirically: `sec3-assurance.test.ts` (31 tests, each calling
`cleanTestDb()` in `beforeEach`) dropped from ~109s to ~28s against Neon after this change alone.

**Combined with a genuinely local target, the full effect is much larger than that.** With
`TEST_DATABASE_URL` correctly pointed at local Postgres, the same file drops to **~2.6s** (from
~109s originally — ~41x), and the full suite (2533 tests across 168 files) drops from the
original ~1550-1580s to **~52s** — faster than a GitHub Actions run's own `Tests` job (~150-194s
for the identical `npm test`). An earlier version of this section reported "no improvement from
local Postgres beyond what TRUNCATE alone captured" and theorized a Docker Desktop network
degradation under sustained load; that was wrong, and the real cause was mundane — see the
callout below. Local Postgres is not just recommended, it is measurably the fastest option
available for this suite, full stop.

**If `TEST_DATABASE_URL` points at a Neon branch**, the connecting role needs `TRUNCATE`
granted once (Postgres doesn't include it in `DELETE`/`INSERT`/`UPDATE`/`SELECT`):

```sql
-- Run once against the Neon branch, using an admin-privileged connection
-- (e.g. TEST_DATABASE_DIRECT_URL's role, which owns the tables via Prisma migrations):
GRANT TRUNCATE ON ALL TABLES IN SCHEMA public TO <test_database_url_role>;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT TRUNCATE ON TABLES TO <test_database_url_role>;
```

The `ALTER DEFAULT PRIVILEGES` statement covers tables created by future migrations too, so this
is genuinely one-time per branch, not something to repeat after every schema change. Without it,
`cleanTestDb()` still works correctly (falls back to sequential deletes) — just at the original,
slower speed.

**If `TEST_DATABASE_URL` points at a local Postgres** (Docker Compose's `docker-compose.yml`
where Docker is available, or the native `postgresql-17` server this repository's own sandboxed
Claude Code devcontainer sets up instead — see `.devcontainer/README.md`'s "Local Postgres (no
Docker)" section — either way, matching `.env.example`'s documented default and what CI uses),
this whole distinction mostly stops mattering: round trips to `localhost` are sub-millisecond
regardless of which path runs, and the connecting role already owns its tables (full privileges,
including `TRUNCATE`, no grant needed). Local Postgres is the recommended default when available;
pointing at a Neon branch is a documented, supported alternative for anyone who wants to test
against Neon-specific behavior deliberately, not a required setup.

### `fileParallelism` stays disabled — verified unsafe, not just cautious

`vitest.config.ts`'s `fileParallelism: false` (all 168 test files run sequentially, regardless of
how many CPUs are available) was tested directly rather than left alone out of caution: enabling
it (`fileParallelism: true` + `maxForks: 4`) against local Postgres produced real, reproducible
test failures within minutes — `clear-draft-selection.test.ts` failed 8/8 assertions it normally
passes. Root cause: `cleanTestDb()` unconditionally `TRUNCATE`s every table in the database. Any
two files running concurrently against the *same* database — local or remote — race: one file's
cleanup destroys another file's in-progress fixture data out from under it. Safe file-level
parallelism would need each worker isolated onto its own database or schema — a real,
separately-scoped restructuring of the test-support layer, not a config flag.

### A stale shell-exported `TEST_DATABASE_URL` can silently defeat all of the above — check `export -p` after editing `.env`

Two earlier versions of this section reported first "no improvement from local Postgres" and then
(after further investigation) "local Postgres latency is unstable and degrades under sustained
load, likely a Docker Desktop networking issue." **Both were wrong, and the real cause was much
simpler**: `.devcontainer/load-local-env.sh` is sourced into every interactive shell via
`~/.bashrc` (see `.devcontainer/post-create.sh`), and does `set -a; source .env; set +a` —
**exporting** every `.env` variable into the shell's environment, not just setting it for one
process. That happens once, whenever the shell starts. If `.env` is edited *after* that — e.g.
pointing `TEST_DATABASE_URL` at local Postgres instead of a Neon branch — an **already-running**
shell keeps the old exported value. `dotenv/config` (used by `vitest.config.ts` and any ad hoc
diagnostic script) never overrides a variable that's already present in `process.env` — that's
correct, standard `dotenv` behavior, not a bug in this repo's code — so every command run in that
same shell after the edit silently kept using the stale, already-exported value, no matter what
`.env` said. In this repo's own investigation, that meant a long series of "local Postgres" tests
were actually still hitting the old Neon branch, which produced exactly the confusing symptoms
recorded in the earlier (now-corrected) versions of this section: numbers that looked
Neon-latency-shaped even when `.env` clearly said `localhost`, and that didn't change no matter
what was restarted locally (restarting local Postgres does nothing if the process was never
actually talking to it).

**If a `.env` database URL was just edited in an already-running shell, verify the shell's actual
environment before trusting any timing measurement**:

```bash
# See what's actually exported right now — may be stale even if .env looks right:
export -p | grep TEST_DATABASE_URL

# Force a clean reload:
unset TEST_DATABASE_URL TEST_DATABASE_DIRECT_URL DATABASE_URL DIRECT_URL
source .devcontainer/load-local-env.sh
echo "$TEST_DATABASE_URL"   # confirm this matches the intended target before measuring anything
```

Once done, the real numbers are unambiguous (see above): local Postgres is fast, stable, and
faster than CI. There is no Docker Desktop networking issue, no unexplained degradation, and no
open question left here — just a shell-state gotcha worth knowing about before trusting any
future "before vs. after" comparison in this devcontainer.

The canonical database lifecycle is:

```typescript
import { setupTestDb, teardownTestDb, getTestDb } from "@/test/test-db";

let testDb: PrismaClient;

vi.mock("@/lib/db", () => ({
  get db() { return getTestDb(); },
}));

beforeAll(async () => {
  testDb = await setupTestDb();
});

afterAll(async () => {
  await teardownTestDb();
});
```

## Test database commands

```bash
# Full suite (unit + database integration)
npm test

# Node tests only
npx vitest run

# Component tests only
npm run test:components

# Single test file
npx vitest run src/lib/selection/generate-round.test.ts
```

## Canonical test-support layer

### Location

```
src/test/
  support/
    auth-mock.ts     — authentication mock helpers
    factories.ts     — entity factories and scenario builders
    index.ts         — barrel exports
  test-db.ts         — database lifecycle (setup, cleanup, teardown, seed)
  setup-component.ts — jsdom component test setup
```

### Factories

Entity factories create individual domain objects with sensible defaults:

```typescript
import { createTestOrganisation, createTestGroup, createTestTeam } from "@/test/support";

const org = await createTestOrganisation(db, { name: "My Org" });
const group = await createTestGroup(db, org.id, { name: "U12 Boys" });
const team = await createTestTeam(db, org.id, group.id, { name: "Blå" });
```

Available factories:
- `createTestOrganisation(db, overrides?)`
- `createTestGroup(db, organisationId, overrides?)`
- `createTestTeam(db, organisationId, groupId, overrides?)`
- `createTestTeams(db, organisationId, groupId, count, overrides?)`
- `createTestPlayer(db, organisationId, coreTeamId, overrides?)`
- `createTestPlayers(db, organisationId, coreTeamId, count, overrides?)`
- `createTestSeason(db, organisationId, overrides?)`
- `createTestLeagueSeason(db, organisationId, groupId, seasonId, overrides?)`
- `createTestRound(db, organisationId, leagueSeasonId, overrides?)`
- `createTestMatch(db, organisationId, matchRoundId, teamId, opponentTeamId, overrides?)`
- `createTestOpponentTeam(db, organisationId, overrides?)`
- `createTestEvent(db, organisationId, groupId, overrides?)`
- `createTestEventSquad(db, organisationId, eventId, overrides?)`
- `createTestAvailability(db, organisationId, playerId, matchRoundId, overrides?)`
- `createTestRotationPath(db, organisationId, fromTeamId, toTeamId, overrides?)`
- `createTestUser(db, overrides?)`
- `createTestAccount(db, userId, overrides?)`
- `createTestMembership(db, organisationId, userId, overrides?)`

### Scenario builders

For recurring domain graphs:

- `createTestOrganisationWithMembership(db, overrides?)` — org + user + account + membership
- `createTestPermissionScenario(db)` — owner, admin, coach, viewer, outsider with memberships
- `createTestCrossTenantScenario(db)` — two orgs with groups and coaches for tenancy tests

### Auth mock

```typescript
import { mockAuthContext } from "@/test/support";

// Sets up full mock stack for server actions
const { mockRequireActorContext, context } = mockAuthContext({
  organisationId: fixture.organisationId,
});

// Override in individual tests:
mockRequireActorContext.mockResolvedValue({
  ...context,
  role: "VIEWER",
});
```

### Bulk helpers

- `createTestPlayers(db, organisationId, coreTeamId, count, overrides?)` — creates N players
- `createTestTeams(db, organisationId, groupId, count, overrides?)` — creates N teams

### Cleanup helpers

- `cleanTestDb(db)` — canonical full cleanup (all tables, dependency order)
- `cleanEventTables(db)` — event table cleanup only

## Factory defaults

Factories use deterministic defaults, not random data.

Good:
```typescript
createTestPlayer(db, orgId, teamId, { firstName: "Player 1", primaryPosition: "CM" });
```

Bad:
```typescript
createTestPlayer(db, orgId, teamId, { name: faker.person.fullName(), rating: Math.random() * 10 });
```

Unique values use deterministic counters, not random generators.

## Test architecture rules

1. Reuse canonical test factories instead of manually duplicating common domain setup.
2. Add new factory capabilities to `src/test/support/factories.ts` before creating overlapping helpers.
3. Use scenario builders only for genuinely repeated domain graphs.
4. Keep behavioural inputs and assertions visible in individual tests.
5. Centralise database lifecycle and authentication setup in `src/test/test-db.ts` and `src/test/support/auth-mock.ts`.
6. Keep factories deterministic and minimal.
7. Never use shared persistent database state as a substitute for fixtures.
8. Remove superseded helpers when consolidating test infrastructure.
9. Do not secretly create parent entities in child factories — pass dependencies explicitly.
10. Tests must never fall back to `DATABASE_URL` if `TEST_DATABASE_URL` is not set.
11. Prisma CLI migrations in test/CI use `TEST_DATABASE_DIRECT_URL` (falls back to `TEST_DATABASE_URL`).

## Pre-existing test failures

The following test files have pre-existing mock and module-resolution failures that require dedicated fixes (separate from this task):

1. Event tests (`event-match-actions`, `event-pool-actions`, `event-squad-commit-actions`, `event-support-actions`, `event-export`) — `organisationId` required in nested creates and `vi.mock` hoisting issues
2. `coaching-actions.test.ts`, `lifecycle.test.ts`, `readiness-actions.test.ts` — `requireActorContext` calls `cookies()` from next/headers without proper mock
3. `match-edit.test.ts` — mock DB queries don't account for `orgFilter.filter.organisationId`
4. `live-match-integration.test.ts` — `server-only` module not mocked
5. `rls-isolation.test.ts`, `mt7-validation.test.ts`, `sec3-assurance.test.ts` — `next-auth`/`next/server` module resolution
6. `populate-all.test.ts` — `generatedCount: 0` regression (possible selection engine issue)
7. `attribute-edit.test.ts` — `cookies()`/`requireActorContext` mock issue
8. `setup-registry.test.ts` — `requireActorContext` mock not returning `organisationId`
9. `rotation-path-actions.test.ts` — `requireActorContext` mock issue

These need per-file mock fixes that require understanding each test's specific mock chain.