# 0065: Authentication Architecture Hardening — Phase 2

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

8. **Environment variable reads not centralized.** `BYPASS_AUTH`, `CRON_SECRET`, `BREVO_WEBHOOK_BEARER_TOKEN`, and `APP_BASE_URL` were read directly from `process.env` instead of through centralized helpers in `src/lib/env.ts`.

9. **`CRON_SECRET` and `BREVO_WEBHOOK_BEARER_TOKEN` not validated in production.** Cron and webhook endpoints accepted unauthenticated requests when these secrets were unset, with no startup warning.

10. **No org-selection redirect for authenticated users without membership.** Users authenticated but with no organisation membership saw a dead-end error page instead of being directed to the organisations page.

## Decision

1. **`validateEnv()` now enforces production safety:**
   - `APP_BASE_URL` is required in production (error, not warning).
   - `APP_BASE_URL` must start with `https://` in production (error).
   - `BYPASS_AUTH=true` is rejected in production (error).
   - `CRON_SECRET` is required in production (error).
   - `BREVO_WEBHOOK_BEARER_TOKEN` is required in production (error).
   - Non-production missing `APP_BASE_URL` produces a warning.

2. **`ensureEnvValidated()`** added to `src/lib/env.ts` and called from `instrumentation.ts` at Next.js startup. In production, validation errors throw and prevent startup. In other environments, errors are logged but do not prevent startup.

3. **`isBypassAuthEnabled()`** centralized helper in `src/lib/env.ts`. `BYPASS_AUTH` reads in `auth.ts` now use this centralized function instead of direct `process.env` access. The function reads `MATCHBOARD_ENV` from `process.env` at call time (not the module-level `matchboardEnv`), consistent with how `validateEnv()` performs production checks.

4. **`getAppBaseUrl()` centralized** in `src/lib/env.ts`. `src/lib/email/provider.ts` imports and uses the centralized version. The fallback chain remains (`APP_BASE_URL` → `AUTH_URL` → `localhost:3000`/`localhost:3333`) with documentation that `AUTH_URL` is unsuitable for production external links.

5. **`getCronSecret()` and `getBrevoWebhookBearerToken()`** centralized helpers in `src/lib/env.ts`. Cron and Brevo webhook routes use these instead of direct `process.env` reads.

6. **App layout redirects to `/organisations`** when `getOrgSlugForUser()` returns null (no membership or multiple memberships). Previously the layout rendered a minimal header without navigation. The `/organisations` page already shows org list and pending invitations.

7. **Error page updated** to link authenticated users to `/organisations` instead of showing only a dead-end "contact your admin" message.

8. **HSTS header added for production** in middleware: `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`.

9. **`PREVIEW_ALLOWLIST_EMAILS` semantics documented** in middleware comments: when unset or empty, all authenticated users can access preview API routes; when set, only listed emails are allowed.

10. **Security audit tests added** for BYPASS_AUTH centralization, APP_BASE_URL production validation, AUTH_URL fallback documentation, HSTS header, CRON_SECRET/BREVO_WEBHOOK_BEARER_TOKEN production validation.

11. **Environment validation tests added** for BYPASS_AUTH production rejection, APP_BASE_URL production requirements, HTTPS enforcement, CRON_SECRET/BREVO_WEBHOOK_BEARER_TOKEN production requirements, isBypassAuthEnabled, getCronSecret, getBrevoWebhookBearerToken.

## Consequences

- Production deployments missing `APP_BASE_URL`, `CRON_SECRET`, or `BREVO_WEBHOOK_BEARER_TOKEN`, or with `http://` URLs, or with `BYPASS_AUTH=true` will fail to start.
- Startup validation catches configuration errors before request handling.
- Environment variable reads for auth, cron, and webhook secrets are centralized through `src/lib/env.ts`.
- Authenticated users without organisation membership are redirected to `/organisations` instead of seeing a dead-end error page.
- HSTS header protects production users against protocol downgrade.
- `AUTH_URL` fallback remains for development convenience but is documented as unsuitable for production external links.
- `PREVIEW_ALLOWLIST_EMAILS` empty-allowlist behavior is unchanged but documented.