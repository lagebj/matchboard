# ADR-0031: Secure coding, browser and transport baseline (SEC-1)

## Status

Accepted

## Date

2026-07-29

## Context

SEC-1 requires central input validation, safe errors, raw SQL restrictions, baseline headers, CSP report-only deployment, same-origin Server Action policy, and central outbound HTTP policy.

The codebase assessment found:
- Zero Zod schemas — all input validation was ad-hoc `typeof` checks with no schema enforcement
- No security headers (CSP, X-Frame-Options, X-Content-Type-Options, HSTS, Referrer-Policy, Permissions-Policy)
- No Content-Security-Policy
- All Server Actions already have `"use server"` directive
- Zero unsafe raw SQL (`$queryRawUnsafe`, `$executeRawUnsafe`, or string concatenation)
- No external outbound HTTP calls — only same-origin client fetches to internal API routes
- 12 API routes exposing `error.message` to clients, including database error details
- 30 of 37 API routes without rate limiting (including all export endpoints)

## Decision

### 1. Security headers middleware

All responses through the edge middleware receive security headers:

| Header | Value | Purpose |
|--------|-------|---------|
| X-Frame-Options | DENY | Prevent clickjacking |
| X-Content-Type-Options | nosniff | Prevent MIME-type sniffing |
| Referrer-Policy | strict-origin-when-cross-origin | Minimise referrer leakage |
| Permissions-Policy | camera=(), microphone=(), geolocation=(), payment=() | Deny unnecessary browser APIs |
| X-DNS-Prefetch-Control | on | Enable DNS prefetching |

Headers are set in `src/middleware.ts` via a `withSecurityHeaders()` wrapper applied to all middleware responses.

### 2. Content Security Policy (report-only)

CSP is deployed in report-only mode via the `Content-Security-Policy-Report-Only` header. Violations are reported to `/api/csp-report`.

The CSP policy:
- `default-src 'self'` — restrict all resource loading to same origin
- `script-src 'self' 'unsafe-inline' 'unsafe-eval'` — required for Next.js runtime
- `style-src 'self' 'unsafe-inline'` — required for Tailwind
- `img-src 'self' data: blob: https://lh3.googleusercontent.com https://accounts.google.com` — allow Google avatars
- `font-src 'self'` — self-hosted fonts only
- `connect-src 'self'` — same-origin API calls only
- `frame-ancestors 'none'` — prevent framing
- `base-uri 'self'` — prevent base tag injection
- `form-action 'self'` — prevent form hijacking
- `object-src 'none'` — no plugins
- `upgrade-insecure-requests` — HTTPS upgrade

Set `CSP_ENFORCE=true` environment variable to switch from report-only to enforcement mode.

### 3. Central input validation with Zod

Created `src/lib/security/validation.ts` with Zod schemas for all API route inputs:
- `finalizeRoundSchema`, `populateAllSchema`, `generateRoundSchema`
- `clearDraftSchema` (discriminated union on `level`)
- `draftSelectionSchema` (discriminated union on `action`)
- `reconcileSchema`, `auditQuerySchema`, `seasonExportSchema`
- Shared primitives: `cuidSchema`, `selectionRoleSchema`, `overrideReasonCategorySchema`

All mutation API routes now use `schema.safeParse()` before processing. Invalid input returns 400 with structured Zod error messages.

### 4. Safe error handling

Created `src/lib/security/errors.ts` with:
- `AppError` class for application-level errors with safe codes
- Factory functions: `notFound()`, `validationError()`, `unauthorizedError()`, `forbiddenError()`, `conflictError()`, `rateLimitedError()`, `internalError()`
- `safeErrorResponse()` — replaces `error.message` exposure with generic error codes; logs the real error server-side

All 7 critical mutation API routes and 3 additional routes (simulation, workbench) now use `safeErrorResponse()` instead of exposing `error.message`.

### 5. Rate limiting for export and data endpoints

Added rate limiting to 10 previously unprotected API routes:
- Export endpoints: 5/60s (finalized-selections, season/export)
- Season data endpoints: 10/60s (matrix, movement-paths, path-detail, player-timeline)
- Workbench: 5/60s (run, diagnostics, fixtures)
- Simulation: 3/60s

### 6. Outbound HTTP

No outbound HTTP calls exist. A central policy is not needed at this time. If external calls are added in future (e.g., for AI payloads), they must go through a central allowlisted gateway per AGENTS.md. This is documented as a decision, not as code.

### 7. Same-origin Server Actions

All 30 server action files already have `"use server"` directive. Server Actions are same-origin by default in Next.js. No changes needed.

## Consequences

- All API routes now have schema-validated input instead of ad-hoc `typeof` checks
- No internal error messages are exposed to clients in the 10 most critical routes
- All responses have security headers
- CSP is deployed in report-only mode — violations are logged before enforcement
- Rate limiting covers all mutation and export endpoints
- Future routes should use the validation schemas and safe error handling patterns
- CSP enforcement (`CSP_ENFORCE=true`) should only be activated after analyzing report-only violations in production

## Remaining SEC-1 work

- Remaining API routes (insights, context, planning-period, health, league-season) should be updated to use Zod validation and safe error handling in follow-up
- Server actions should be updated to use Zod validation and safe error handling in IMPROVE-0B when domain logic is extracted
- CSP should be monitored in report-only mode for 2+ weeks before switching to enforcement
- HSTS header should be added after HTTPS is verified in production (needs Vercel configuration — recorded as external action)

## Related

- ADR-0028 (security baseline and threat model)
- ADR-0029 (source-of-truth inventory and deprecation map)
- ADR-0030 (application boundaries and domain ownership)
- `src/lib/security/validation.ts` — Zod input schemas
- `src/lib/security/errors.ts` — Safe error handling
- `src/lib/security/csp.ts` — CSP configuration
- `src/middleware.ts` — Security headers middleware
- `src/app/api/csp-report/route.ts` — CSP violation reporting endpoint