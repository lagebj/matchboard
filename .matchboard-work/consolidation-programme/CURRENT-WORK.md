# Current Work Packet

Packet ID: `P3-TEST-INFRASTRUCTURE` + `HOTFIX-ENV-VALIDATION-CRASH` + `HOTFIX-BUILD-LOCKFILE`
Phase: 3 + hotfixes
Mode: test-only auth, canonical dataset, deployment metadata, hotfix for production crash, hotfix for build

## Completed work

### HOTFIX-ENV-VALIDATION (PR #285, merged)

- Fixed `ensureEnvValidated()` throwing in production when non-critical env vars (CRON_SECRET, BREVO_WEBHOOK_BEARER_TOKEN) are missing
- Changed `ensureEnvValidated()` to return `EnvValidationResult` instead of throwing — logs errors but allows app to start
- Added `requireEnvValid()` for callers that need throw-on-failure behavior
- Added `_resetEnvValidation()` for test isolation
- Updated `instrumentation.ts` to log validation errors without crashing
- Both environments restored: `app.matchboard.football` and `test.matchboard.football` healthy

### HOTFIX-BUILD-LOCKFILE (PR #286, open)

- Vercel production deployment failing with `ERR_PNPM_OUTDATED_LOCKFILE`
- `pnpm-lock.yaml` was in `.gitignore`, causing Vercel to auto-generate an inconsistent lockfile
- Removed `pnpm-lock.yaml` from `.gitignore` and committed it
- This ensures reproducible Vercel builds

### P3-AUTH-1 (completed)

- TEST_AGENT_AUTH_ENABLED/SECRET environment variables with fail-closed production guards
- Auth.js Credentials provider conditionally registered (test-only)
- Email namespace restriction (@test-agent.matchboard.football)
- `/api/auth/test-agent` REST endpoint for programmatic agent access
- `/api/meta` deployment metadata endpoint
- `isTestAgentAuthEnabled()` centralized in `src/lib/env.ts`
- Production validation rejects TEST_AGENT_AUTH_ENABLED=true and TEST_AGENT_AUTH_SECRET
- Security audit tests for TEST_AGENT_AUTH production guards
- `TEST_DATASET_VERSION` concept in env and `/api/meta`
- Canonical test dataset seed script (`scripts/seed-test-dataset.ts`)
- ADR-0066
- **End-to-end verified**: Auth.js Credentials provider creates JWT sessions successfully on test.matchboard.football
- Seed dataset seeded on Neon test branch

### Seed dataset contents

- Organisation A: Matchboard Test Club (2 groups, 5 teams, ~52 players)
- Organisation B: Other Test Club (1 group, 2 teams, ~18 players)
- 8 test personas with auth emails
- Authorization matrix: coach-all-a, coach-a1, coach-a2, coach-b1
- Season, league season, rounds, matches, rotation paths, rule configs

## Architectural residue: BYPASS_AUTH

BYPASS_AUTH is retained for backward compatibility but is now superseded by test-agent-auth for deployed environments. It should be removed in a future cleanup phase.

**Location**: `src/lib/env.ts` (`isBypassAuthEnabled()`), `src/lib/auth.ts` (`getCurrentCoach()` bypass logic), `vitest.config.ts` (test env vars)
**Reason for deferral**: Test-agent-auth is now verified end-to-end. BYPASS_AUTH can be safely removed but this is a cleanup task, not a blocking issue.
**Removal checklist**:
- Remove `isBypassAuthEnabled()` from `src/lib/env.ts`
- Remove `BYPASS_AUTH` from `REQUIRED_ENV_VARS` validation (if added)
- Remove bypass logic from `getCurrentCoach()` in `src/lib/auth.ts`
- Remove `BYPASS_AUTH` from `vitest.config.ts` and `.env.example`
- Remove any test fixtures that rely on BYPASS_AUTH
- Update ADR-0066 or create a new ADR for the removal
- Verify all existing tests pass without BYPASS_AUTH

## Remaining Phase 3 work

- Merge hotfix PR #286 (pnpm-lock.yaml) and verify Vercel deployment succeeds
- Phase 1 valid-ID authorization matrix testing (unblocked by seed dataset)
- MultipleMembershipsError org-selection UX (needs product design)
- Neon branch lifecycle scripts (create child, reset test branch)
- BYPASS_AUTH removal (deferred, see residue above)

## Blocking items

- None — both environments are healthy, test-agent-auth is verified