# ADR-0067: BYPASS_AUTH Architectural Residue

## Status

Superseded — retained for backward compatibility, removal deferred

## Context

BYPASS_AUTH was the original mechanism for bypassing authentication in test environments. It allows any request to proceed without real authentication when `BYPASS_AUTH=true` and `MATCHBOARD_ENV=test`.

Phase 3 introduced TEST_AGENT_AUTH as a proper replacement: a Credentials-based auth provider that creates real Auth.js JWT sessions using test-persona emails and a shared secret, constrained to the `@test-agent.matchboard.football` namespace.

Test-agent-auth has been verified end-to-end on the deployed test environment (`test.matchboard.football`).

## Decision

Retain BYPASS_AUTH temporarily as a backward-compatible fallback. Remove it in a future cleanup phase after all test infrastructure and CI pipelines have migrated to TEST_AGENT_AUTH.

## Residue

- `isBypassAuthEnabled()` in `src/lib/env.ts`
- Bypass logic in `getCurrentCoach()` in `src/lib/auth.ts`
- `BYPASS_AUTH` env var references in `vitest.config.ts` and `.env.example`

## Removal checklist

- Remove `isBypassAuthEnabled()` from `src/lib/env.ts`
- Remove bypass logic from `getCurrentCoach()` in `src/lib/auth.ts`
- Remove `BYPASS_AUTH` from `vitest.config.ts` and `.env.example`
- Remove any test fixtures that rely on BYPASS_AUTH
- Verify all existing tests pass without BYPASS_AUTH
- Update this ADR to "Accepted" status

## Consequences

- Test environments use real auth sessions (TEST_AGENT_AUTH) instead of bypassing auth entirely
- BYPASS_AUTH remains as a fallback until explicitly removed
- Production guards prevent BYPASS_AUTH and TEST_AGENT_AUTH from being active in production