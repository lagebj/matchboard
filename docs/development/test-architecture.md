# Matchboard Test Architecture

## Test categories

| Category | Database | Network | Location | Speed |
|----------|----------|---------|----------|------|
| Unit | No | No | `src/**/*.test.ts` (no DB) | Fast |
| Database integration | Local PostgreSQL | No | `src/**/*.test.ts` (uses DB) | Moderate |
| Component | No | No | `src/**/*.test.tsx` | Fast |
| Security authz | Local PostgreSQL | No | `src/test/security-authz.test.ts` | Moderate |

The normal test suite (`npm test`) runs unit + database integration + component tests.

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
- `cleanTestDb()` — deletes all rows in dependency-safe order (used in `beforeAll`)
- `teardownTestDb()` — disconnects the client (used in `afterAll`)

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