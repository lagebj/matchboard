# ADR-0067: BYPASS_AUTH Removal

## Status

Accepted — BYPASS_AUTH has been removed

## Context

BYPASS_AUTH was the original mechanism for bypassing authentication in test environments. It allowed any request to proceed without real authentication when `BYPASS_AUTH=true` and `MATCHBOARD_ENV=test`.

Phase 3 introduced TEST_AGENT_AUTH as a proper replacement: a Credentials-based auth provider that creates real Auth.js JWT sessions using test-persona emails and a shared secret, constrained to the `@test-agent.matchboard.football` namespace.

Test-agent-auth has been verified end-to-end on the deployed test environment (`test.matchboard.football`). The Auth.js Credentials provider creates valid JWT sessions, and the REST endpoint `/api/auth/test-agent` successfully upserts users.

## Decision

Remove BYPASS_AUTH entirely. Test-agent-auth is the sole test authentication mechanism.

## Changes made

- Removed `isBypassAuthEnabled()` from `src/lib/env.ts`
- Removed bypass logic from `getCurrentCoach()` in `src/lib/auth.ts`
- Removed `BYPASS_AUTH` from `vitest.config.ts` and `.env.example`
- Removed `isBypassAuthEnabled` test block from `src/lib/__tests__/env.test.ts`
- Removed "allows BYPASS_AUTH=true in test environment" test (no longer applicable)
- Updated security audit tests to verify `isBypassAuthEnabled` no longer exists
- Kept `BYPASS_AUTH` production guard in `validateEnv()` — setting `BYPASS_AUTH=true` in production still causes a validation error, preventing accidental misconfiguration
- Updated this ADR status to Accepted

## Consequences

- Test environments use real auth sessions (TEST_AGENT_AUTH) instead of bypassing auth entirely
- No code path exists to bypass authentication
- Production guards prevent `BYPASS_AUTH=true` from being set in production
- `BYPASS_AUTH` environment variable is no longer consumed by any code path