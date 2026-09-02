# ADR-0032: Authentication, session and authorisation baseline (SEC-2)

## Status

Accepted

## Date

2026-07-29

## Context

SEC-2 requires database-backed access, central policies, session revocation design, sensitive-operation reauthentication, negative tests, and invitation/token replay protection.

The original auth architecture assessment found:
- ~~Auth is email-allowlist based (`ALLOWED_COACH_EMAILS` env var), not database-backed membership~~ — **Removed in ADR-0061**
- JWT sessions with no explicit lifetime (default 30 days, 24h update)
- No session revocation mechanism — stolen JWTs valid until expiry
- No reauthentication for sensitive operations (finalize, clear, admin)
- `requireCoachAccess()` throws generic `Error("Unauthorized")` instead of structured 401/403
- Binary coach/not-coach role — no admin/viewer distinction
- ~~Edge auth config lacks `signIn` callback (allowlist gate done in middleware)~~ — **Removed in ADR-0061**

## Decision

### 1. Structured auth error types

Created `AuthenticationError` (401) and `AuthorizationError` (403) in `src/lib/auth.ts`, extending `AppError` from the SEC-1 error module. `requireCoachAccess()` now throws `AuthenticationError` instead of generic `Error`. This integrates with `safeErrorResponse()` for consistent API responses.

### 2. JWT session lifetime configuration

Set explicit session lifetime:
- `maxAge: 24 * 60 * 60` (24 hours) — reduced from the 30-day default
- `updateAge: 4 * 60 * 60` (4 hours) — token refreshed if older than 4 hours

Both `src/auth.ts` and the former `src/auth-edge.ts` had explicit session configuration. `auth-edge.ts` was removed when the proxy migrated from Edge Runtime to Node.js runtime — `src/proxy.ts` now uses `src/auth.ts` directly.

### 3. Session revocation design (documented, deferred)

JWT sessions cannot be individually revoked without server-side state. ~~The current architecture provides a mitigation: the middleware re-checks `ALLOWED_COACH_EMAILS` on every request, so removing a user from the allowlist immediately denies access (after server restart/redeployment picks up the env var change).~~ **(Superseded by ADR-0061: membership-based auth provides deny-by-default access control.)**

Full session revocation requires database-backed sessions, which is planned for MT-1 (organisation and membership model). Until then:
- JWT lifetime is limited to 24 hours (reduced from 30 days)
- Membership-based access control provides deny-by-default authorisation (ADR-0061)
- No `Session` table reads are needed (the Prisma Session model is retained for Auth.js adapter compatibility but not actively used)

### 4. Sensitive-operation reauthentication (documented, deferred)

Step-up authentication for high-risk operations (round finalization, draft clearing, admin operations) is deferred to SEC-6 (audit, incident and recovery) when session revocation is also addressed. The current override-reason requirement for finalizing blocked rounds provides domain-level confirmation without a full reauthentication flow.

### 5. Database-backed membership (implemented in ADR-0035, ADR-0061)

~~The current email-allowlist approach is sufficient for the single-tenant coach application. Database-backed membership, roles, and organisation context will be introduced in MT-1 through MT-4.~~ **Superseded: Membership-based auth is now implemented (ADR-0035, ADR-0061).** The email allowlist has been removed.
- `requireCoachAccess()` remains the central auth gate, now backed by membership
- `AuthenticationError` and `AuthorizationError` provide structured error responses
- Membership-based access control provides deny-by-default authorisation

### 6. Invitation and token replay protection (documented, deferred)

The app uses Google OAuth only (no email/password, no invitation tokens). OAuth state parameter and PKCE are handled by Auth.js. No custom invitation or token flow exists. When invitations are added (MT-5), token replay protection will be implemented at that time.

### 7. Negative auth tests

Added tests for:
- `AuthenticationError` and `AuthorizationError` creation and properties
- `AppError` integration with `safeErrorResponse()` for 401/403 status codes
- Rate limiting (6 tests for rate limiting behavior)
- Membership-based auth verification (security-audit.test.ts verifies allowlist module is removed)

## Consequences

- JWT sessions expire after 24 hours instead of 30 days — coaches may need to re-authenticate more frequently
- `requireCoachAccess()` now throws `AuthenticationError` which maps to 401 via `safeErrorResponse()`
- Session revocation is limited to membership removal until database-backed sessions are introduced
- Step-up authentication is deferred to SEC-6
- Database-backed membership is deferred to MT-1

## Related

- ADR-0028 (security baseline and threat model)
- ADR-0031 (secure coding, browser and transport baseline)
- ADR-0061 (remove email allowlist, use membership-based auth — supersedes allowlist sections)
- `src/lib/auth.ts` — AuthenticationError, AuthorizationError, requireCoachAccess
- `src/lib/security/errors.ts` — AppError, safeErrorResponse
- `src/auth.ts` — Explicit session lifetime configuration (now also used by `src/proxy.ts`; `src/auth-edge.ts` removed)
- Threat model: `docs/security/threat-model.md`
- ASVS matrix: `docs/security/asvs-matrix.md`

## Superseded by

ADR-0061 (email allowlist removal — the allowlist gate and `isAllowedCoach` are superseded by membership-based auth. Session lifetime and error type decisions remain.)