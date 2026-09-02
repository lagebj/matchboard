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

6. **All configuration env reads centralized through `src/lib/env.ts`:**
   - `isBypassAuthEnabled()` — BYPASS_AUTH reads (auth.ts)
   - `getAppBaseUrl()` — APP_BASE_URL/AUTH_URL reads (provider.ts)
   - `getCronSecret()` — CRON_SECRET reads (cron route)
   - `getBrevoWebhookBearerToken()` — BREVO_WEBHOOK_BEARER_TOKEN reads (webhook route)
   - `getEmailFromAddress()` — EMAIL_FROM_ADDRESS reads (provider.ts)
   - `getEmailFromName()` — EMAIL_FROM_NAME reads (provider.ts)
   - `getBrevoApiKey()` — BREVO_API_KEY reads (provider-factory.ts)
   - `getBrevoTestRecipients()` — BREVO_TEST_RECIPIENTS reads (brevo-provider.ts)
   - `getAuthSecret()` — AUTH_SECRET reads (machine-token.ts)
   - `isCspEnforceEnabled()` — CSP_ENFORCE reads (csp.ts)
   - `isRlsDebug()` — RLS_DEBUG reads (db.ts)
   - `getPreviewAllowlistEmails()` — PREVIEW_ALLOWLIST_EMAILS reads (proxy.ts)
   - `isVercelPreview()` — VERCEL_ENV reads (proxy.ts)

7. **App layout redirects to `/organisations`** when `getOrgSlugForUser()` returns null (no membership or multiple memberships). Previously the layout rendered a minimal header without navigation. The `/organisations` page already shows org list and pending invitations.

8. **Error page updated** to link authenticated users to `/organisations` instead of showing only a dead-end "contact your admin" message.

9. **HSTS header added for production** in proxy: `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`.

10. **`PREVIEW_ALLOWLIST_EMAILS` semantics documented** in proxy comments: when unset or empty, all authenticated users can access preview API routes; when set, only listed emails are allowed.

11. **Security audit tests added** for BYPASS_AUTH centralization, APP_BASE_URL production validation, AUTH_URL fallback documentation, HSTS header, CRON_SECRET/BREVO_WEBHOOK_BEARER_TOKEN production validation, env read centralization.

12. **Environment validation tests added** for all new centralized helpers and production safety guards.

## Remaining direct `process.env` reads (accepted)

The following direct reads remain and are accepted:

- `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` in `auth.ts` — Auth.js framework integration, validated by `validateEnv()` (`auth-edge.ts` removed; proxy uses `auth.ts` directly)
- `AUTH_SECRET` in `auth.ts` — Auth.js framework integration, validated by `validateEnv()`
- `DATABASE_URL`, `DIRECT_URL`, `DIRECT_RUNTIME_URL` in `db.ts` — Prisma connection initialization at module load time, validated by `validateEnv()`
- Policy env vars in `policy-pack.ts` — complex parsing logic deeply integrated with policy infrastructure
- `AUTH_URL` fallback in `provider.ts` — documented risk, only used when `APP_BASE_URL` is unset in development

## Consequences

- Production deployments missing `APP_BASE_URL`, `CRON_SECRET`, or `BREVO_WEBHOOK_BEARER_TOKEN`, or with `http://` URLs, or with `BYPASS_AUTH=true` will fail to start.
- Startup validation catches configuration errors before request handling.
- All configuration environment variable reads are centralized through `src/lib/env.ts` helpers (except accepted framework integration points).
- Authenticated users without organisation membership are redirected to `/organisations` instead of seeing a dead-end error page.
- HSTS header protects production users against protocol downgrade.
- `AUTH_URL` fallback remains for development convenience but is documented as unsuitable for production external links.
- `PREVIEW_ALLOWLIST_EMAILS` empty-allowlist behavior is unchanged but documented.
- Security audit tests enforce centralization invariants, preventing regression to direct `process.env` reads.