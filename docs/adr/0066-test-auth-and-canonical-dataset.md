# ADR-0066: Test-only authentication and canonical test dataset

## Status

Accepted

## Date

2026-08-18

## Context

Phase 3 of the consolidation programme requires:
1. A deterministic test-only authentication mechanism that authenticates real persisted Users without granting authorization bypass
2. A canonical synthetic test dataset for authorization and security verification
3. Deployment metadata endpoint for environment identification
4. Fail-closed production guards preventing test auth from ever activating in production

The existing `BYPASS_AUTH=true` mechanism bypasses authentication entirely and returns a hardcoded synthetic user, which is inadequate for authorization testing because it never exercises real Auth.js session creation or OrganisationMembership resolution.

## Decision

### Test-only authentication (TEST_AGENT_AUTH)

Implement `TEST_AGENT_AUTH_ENABLED` and `TEST_AGENT_AUTH_SECRET` environment variables:

- Only valid when `MATCHBOARD_ENV=test`
- Impossible to activate in production: `validateEnv()` rejects both variables in production
- Auth.js Credentials provider (`id: "test-agent"`) is conditionally registered when enabled
- Email namespace restriction: only emails ending in `@test-agent.matchboard.football` are accepted
- Creates/upserts real User records, exercises real Auth.js session flow, real OrganisationMembership/GroupAccess resolution
- `/api/auth/test-agent` REST endpoint for programmatic agent access: verifies secret, validates namespace, upserts User, returns user identity
- `isTestAgentAuthEnabled()` centralized in `src/lib/env.ts`
- `isBypassAuthEnabled()` retained for backward compatibility during transition but will be removed

### Fail-closed production guards

- `TEST_AGENT_AUTH_ENABLED=true` in production → startup error
- `TEST_AGENT_AUTH_SECRET` set in production → startup error
- `BYPASS_AUTH=true` in production → startup error (existing, retained)
- Test agent auth provider is never registered in production

### Canonical test dataset

Script: `scripts/seed-test-dataset.ts` (`npm run seed:test`)

Creates:
- Organisation A: "Matchboard Test Club" with Group A1 (3 teams, ~30 players) and Group A2 (2 teams, ~22 players)
- Organisation B: "Other Test Club" with Group B1 (2 teams, ~18 players)
- 8 test personas with `@test-agent.matchboard.football` emails:
  - owner-a, admin-a, coach-all-a (A1 + A2), coach-a1 (A1 only), coach-a2 (A2 only), viewer-a, owner-b, coach-b1 (B1)
- Authorization matrix enforced:
  - coach-all-a → A1 ✓, A2 ✓, B1 ✗
  - coach-a1 → A1 ✓, A2 ✗, B1 ✗
  - coach-a2 → A1 ✗, A2 ✓, B1 ✗
  - coach-b1 → A1 ✗, A2 ✗, B1 ✓
- ~70 total players with realistic positions, rotations, matches
- `TEST_DATASET_VERSION=1`

### Deployment metadata endpoint

`/api/meta` returns safe environment identity:
- `environment`, `version`, `commit`, `gitRef`, `pullRequest`, `databaseMode`, `datasetVersion`
- No secrets, connection strings, or internal identifiers exposed
- Added to `PUBLIC_ROUTES`

## Consequences

- Test and production use different `AUTH_SECRET` values (required by programme)
- Test agent auth exercises real Auth.js session flow and real membership resolution
- `BYPASS_AUTH` can be deprecated once test infrastructure fully adopts `TEST_AGENT_AUTH`
- The test dataset must be re-seeded after destructive operations
- Production deployments will never have the test-agent Credentials provider registered