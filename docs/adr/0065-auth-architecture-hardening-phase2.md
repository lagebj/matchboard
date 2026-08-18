# 0065: Authentication Architecture Hardening — Phase 2 Closure

## Status

Accepted

## Context

The consolidation programme's Phase 2 audit identified several authentication and environment architecture gaps:

1. **BYPASS_AUTH not fail-closed in production.** While `BYPASS_AUTH=true` was double-gated with `isTest()`, the environment validation module did not reject it in production. A misconfigured production deployment with `BYPASS_AUTH=true` and `MATCHBOARD_ENV=production` would bypass the double-gate but would not be caught by `validateEnv()`.

2. **`validateEnv()` not called at startup.** The environment validation function existed but was never automatically invoked. Missing required environment variables would not be caught until runtime failure.

3. **`APP_BASE_URL` not required in production.** External invitation URLs could fall back from `APP_BASE_URL` to `AUTH_URL` to `localhost:3333`. The programme requires externally generated URLs to originate from validated `APP_BASE_URL`.

4. **No HTTPS validation for `APP_BASE_URL` in production.** A misconfigured `http://` URL would generate insecure invitation links without warning.

5. **`AUTH_URL` used as fallback for `APP_BASE_URL`.** `AUTH_URL` is an Auth.js internal callback URL that may point to a Vercel internal domain. Using it as a fallback for external link generation risks incorrect invitation URLs in staging/production.

6. **HSTS header missing.** The threat model (G-07) identified missing HTTP Strict Transport Security.

7. **`PREVIEW_ALLOWLIST_EMAILS` empty-allowlist semantics undocumented.** When unset, all authenticated users can access preview API routes. This is intentional but was not clearly documented.

## Decision

1. **`validateEnv()` now enforces production safety:**
   - `APP_BASE_URL` is required in production (error, not warning).
   - `APP_BASE_URL` must start with `https://` in production (error).
   - `BYPASS_AUTH=true` is rejected in production (error).
   - Non-production missing `APP_BASE_URL` produces a warning.

2. **`ensureEnvValidated()`** added to `src/lib/env.ts` and called from `instrumentation.ts` at Next.js startup. In production, validation errors throw and prevent startup. In other environments, errors are logged but do not prevent startup.

3. **`getAppBaseUrl()` in `src/lib/email/provider.ts`** updated with explicit documentation that `AUTH_URL` is an Auth.js callback URL, not a reliable base URL for external links. The fallback chain remains (`APP_BASE_URL` → `AUTH_URL` → `localhost:3333`) but the code and comments make the risk clear.

4. **HSTS header added for production** in middleware: `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`.

5. **`PREVIEW_ALLOWLIST_EMAILS` semantics documented** in middleware comments: when unset or empty, all authenticated users can access preview API routes; when set, only listed emails are allowed.

6. **Security audit tests added** for BYPASS_AUTH double-gate, APP_BASE_URL production validation, AUTH_URL fallback documentation, and HSTS header.

7. **Environment validation tests added** for BYPASS_AUTH production rejection, APP_BASE_URL production requirements, and HTTPS enforcement.

## Consequences

- Production deployments missing `APP_BASE_URL` or with `http://` URLs will fail to start.
- Production deployments with `BYPASS_AUTH=true` will fail to start.
- Startup validation catches configuration errors before request handling.
- HSTS header protects production users against protocol downgrade.
- `AUTH_URL` fallback remains for development convenience but is documented as unsuitable for production external URLs.
- `PREVIEW_ALLOWLIST_EMAILS` empty-allowlist behavior is unchanged but documented.