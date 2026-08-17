# ADR-0062: MATCHBOARD_ENV environment identity and public route contract

## Status

Accepted

## Date

2026-08-17

## Decision owners

- Matchboard maintainer

## Context

Matchboard relies on `NODE_ENV` for environment detection, but `NODE_ENV` is a Node.js runtime setting that doesn't distinguish between application deployment environments (development, staging, production). Several modules make environment-dependent decisions:

- Auth bypass (`NODE_ENV === "test"`)
- Database client caching (`NODE_ENV !== "production"`)
- CSP enforcement (`NODE_ENV === "development"`)
- Brevo webhook auth (`NODE_ENV`)
- Middleware auth checks (implicit dependency on environment)

There is no centralised environment configuration or validation. Environment variables are read ad-hoc at the point of use with no startup validation. The public route contract in middleware is an inline boolean expression that must be kept in sync with auth layout decisions.

## Decision

### 1. Add `MATCHBOARD_ENV` environment variable

A new application-level environment variable `MATCHBOARD_ENV` explicitly identifies the runtime environment:

- `development` — local development
- `test` — automated test runs
- `staging` — pre-production staging
- `production` — production deployment

When `MATCHBOARD_ENV` is unset, it falls back to `NODE_ENV` inference:
- `NODE_ENV=production` → `MATCHBOARD_ENV=production`
- `NODE_ENV=test` → `MATCHBOARD_ENV=test`
- Otherwise → `MATCHBOARD_ENV=development`

An invalid `MATCHBOARD_ENV` value throws at module load time.

### 2. Create `src/lib/env.ts` — centralised environment module

A new module exports:
- `matchboardEnv` — the resolved environment constant
- `isProduction()`, `isTest()`, `isDevelopment()`, `isStaging()` — boolean helpers
- `validateEnv()` — startup validation for required env vars per environment
- `PUBLIC_ROUTES` — declarative public route list
- `isPublicRoute(pathname)` — route-level public access check

### 3. Replace ad-hoc `NODE_ENV` checks with `MATCHBOARD_ENV` helpers

- `src/lib/auth.ts` — `isTest()` instead of `process.env.NODE_ENV === "test"`
- `src/lib/db.ts` — `isProduction()` instead of `process.env.NODE_ENV !== "production"`
- `src/lib/security/csp.ts` — `isDevelopment()` instead of `process.env.NODE_ENV === "development"`
- `src/app/api/webhooks/brevo/route.ts` — `isProduction()` instead of `NODE_ENV`
- `src/middleware.ts` — `isPublicRoute(path)` instead of inline boolean expression

### 4. Declarative public route contract

`PUBLIC_ROUTES` is a `const` array of route prefixes that do not require authentication. `isPublicRoute()` checks membership. The middleware uses this instead of an inline boolean.

Current public routes: `/api/auth`, `/_next`, `/favicon.ico`, `/robots.txt`, `/signin`, `/error`, `/api/health`.

### 5. Environment validation

`validateEnv()` checks:
- Required vars per environment (DATABASE_URL, DIRECT_URL, AUTH_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET in non-test; TEST_DATABASE_URL in test)
- No `NEXT_PUBLIC_` prefixed secrets
- Production-specific warnings (APP_BASE_URL, BREVO_API_KEY)

## Rationale

- `MATCHBOARD_ENV` is explicit, application-scoped, and doesn't collide with Node.js or framework conventions.
- The fallback to `NODE_ENV` means existing deployment configurations continue to work without changes.
- Centralised env helpers eliminate scattered `process.env.NODE_ENV` checks that are harder to audit and maintain.
- The declarative public route contract is easier to audit and extend than an inline boolean in middleware.
- Startup validation catches missing configuration early rather than at first use.

## Alternatives considered

### Use only NODE_ENV

- Benefits: No new env var, no fallback logic.
- Costs: Cannot distinguish staging from production (both use `NODE_ENV=production`). Cannot add application-specific environment checks. Frameworks like Next.js already own `NODE_ENV`.
- Reason not selected: Staging is a distinct environment that needs different CSP, rate limiting, and email behaviour.

### Use Next.js publicRuntimeConfig

- Benefits: Framework-native configuration.
- Costs: Runtime config is client-exposed. Environment identity must not be exposed to the browser. `publicRuntimeConfig` is deprecated in Next.js 16.
- Reason not selected: Security boundary — environment identity is server-only.

## Consequences

### Positive

- Explicit environment identity for all modules
- Centralised validation catches missing config at startup
- Declarative public routes are auditable and testable
- Staging environment is a first-class concept
- `BYPASS_AUTH` is now gated by `isTest()` (via `MATCHBOARD_ENV`), not `NODE_ENV`

### Negative

- One new env var to set in deployment configurations
- Module import order matters — `@/lib/env` must not import modules that depend on it

### Risks and mitigations

- Risk: Existing deployments without `MATCHBOARD_ENV` will fall back to `NODE_ENV` inference, which matches current behaviour.
  Mitigation: Fallback is explicit and tested. Production deployments using `NODE_ENV=production` continue to work unchanged.
- Risk: Circular import if env module imports other modules that import env.
  Mitigation: `env.ts` has zero application imports — only `process.env` access and type exports.

## Migration and compatibility

- No data migration required.
- Existing deployments: add `MATCHBOARD_ENV` to Vercel/Neon env vars when ready. Not required for existing behaviour.
- CI workflows: `MATCHBOARD_ENV=test` added to CI and security test workflows.
- Vitest config: `MATCHBOARD_ENV=test` added to test environment.

## Security and operations

- `MATCHBOARD_ENV` is a server-only variable, never exposed to the browser.
- `validateEnv()` runs at module load time — missing required vars fail fast.
- `isPublicRoute()` replaces the middleware's inline boolean — same security boundary, more auditable.
- Test auth bypass (`BYPASS_AUTH`) is now double-gated: `MATCHBOARD_ENV=test` AND `BYPASS_AUTH=true`.

## Related records

- ADR-0061 (remove email allowlist)
- ADR-0032 (authentication baseline)
- `src/lib/env.ts` — environment module
- `src/middleware.ts` — public route contract usage

## Implementation evidence

- Pull requests: (to be added)
- Tests: `src/lib/__tests__/env.test.ts`, `src/test/security-audit.test.ts`

## Supersedes

None (new module, no prior ADR for environment config)

## Superseded by

None

## History

### 2026-08-17

Record created. Added MATCHBOARD_ENV, centralised env module, declarative public routes, replaced ad-hoc NODE_ENV checks.