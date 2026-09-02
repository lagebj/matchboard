# Threat Model — Matchboard

Version: 1.1
Date: 2026-08-10
Status: Active (partially updated — resolved gaps marked)

> **Note:** Several gaps identified in version 1.0 have been resolved since the initial assessment. Resolved gaps are noted inline. The gap classification table (Section 7) has been updated with resolution status where applicable.
Owner: Matchboard security programme

## 1. Purpose

This document describes the threat model for Matchboard as a hosted web application serving multiple football organisations. It follows the OWASP ASVS 5.0 Level 2 baseline and will be updated when trust boundaries, identity types, external integrations, or privileged operations change.

## 2. Assets

| Asset | Description | Sensitivity |
|-------|-------------|------------|
| Identities and sessions | User accounts, Google OAuth tokens, session cookies | High |
| Organisation membership | User-organisation relationships, roles, scopes | High |
| Player and coach data | Names, attributes, ratings, positions, availability | High (youth data present) |
| Ratings, observations, health-adjacent free text | Coach-facing assessments, post-match observations | High |
| Match, opponent, and season history | Fixtures, results, opponents, selections, encounters | Medium |
| Exports and generated reports | Season workbooks, selection exports | Medium-High (contains youth data) |
| Tenant configuration | Organisation settings, competition levels, rotation paths | Medium |
| Machine credentials | Automation principal tokens | High |
| Provider and database credentials | Neon, Vercel, Google OAuth secrets | Critical |
| Audit and simulation evidence | Security events, simulation run records | Medium |
| Backups and restore points | Database backups | High |
| Policy configuration | Rego/WASM policies, policy packs | Medium |

## 3. Actors

| Actor | Description |
|-------|-------------|
| Unauthenticated visitor | Accesses only sign-in and public error pages |
| Ordinary member (COACH) | Authenticated user with organisation membership, performs football operations |
| Organisation owner/administrator | Manages memberships, settings, exports |
| Viewer | Read-only access within scope |
| Platform operator | Manages platform infrastructure, separate from organisation membership |
| Support actor | Time-limited, audited, organisation-bound read-only or elevated access |
| Automation principal | Non-human identity bound to synthetic organisation, restricted scopes |
| CI workflow | Builds, tests, deploys using workload identity or short-lived secrets |
| Compromised account | Authenticated user with stolen or phished credentials |
| Malicious tenant member | Authorised user attempting cross-tenant access or privilege escalation |
| External attacker | Unauthenticated threat attempting exploitation |
| Vulnerable dependency | Compromised npm package or GitHub Action |

## 4. Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Browser → Vercel Edge | Client HTTPS requests to Next.js application |
| Vercel Edge → Next.js Application | Proxy processes auth before route handlers |
| Route/Action → Command/Query Layer | Application business logic boundary |
| Application → Neon PostgreSQL | Database queries over pooled or direct connection |
| Application → External AI or integrations | Outbound HTTP to allowlisted providers (currently none active) |
| CI → Preview/Production | Deployment pipeline |
| Operator surface → Platform operations | Admin access to platform management |
| Simulation → Synthetic tenant | Machine principal accessing synthetic organisation |
| Backup/Export storage | Database backups and generated file storage |

## 5. Required Abuse Cases

| ID | Abuse Case | Affected Boundary |
|----|-----------|-------------------|
| AC-01 | Cross-tenant object access | App → DB, App → Cache |
| AC-02 | Forged organisation and resource identifiers | Browser → App, App → DB |
| AC-03 | Stale or removed membership | App → Auth, App → DB |
| AC-04 | Session theft and replay | Browser → Edge → App |
| AC-05 | Invitation abuse | Browser → App → DB |
| AC-06 | Privilege escalation (member → admin → owner → platform) | App → DB |
| AC-07 | IDOR/BOLA (insecure direct object reference) | Browser → App → DB |
| AC-08 | SQL injection and unsafe raw SQL | App → DB |
| AC-09 | XSS and unsafe rich text | App → Browser |
| AC-10 | CSRF and origin confusion | Browser → App |
| AC-11 | SSRF and arbitrary redirects | App → External |
| AC-12 | Cache contamination and cross-tenant cache | App → Cache |
| AC-13 | Public or guessable exports | App → Export |
| AC-14 | AI or log data leakage | App → Logs, App → External AI |
| AC-15 | Denial of service through expensive operations | Browser → App → DB |
| AC-16 | Compromised machine principal | Automation → App |
| AC-17 | Malicious dependency or workflow | CI → Production |
| AC-18 | Backup, restore, or deletion failure | App → DB, App → Storage |
| AC-19 | Support access misuse | Support → App → DB |
| AC-20 | Rate-limit bypass | Browser → App |
| AC-21 | Unauthorized policy/admin access | Browser → App |
| AC-22 | Unvalidated mutation input | Browser → App → DB |
| AC-23 | CSV/formula injection in exports | App → Export |
| AC-24 | Missing security headers | Edge → Browser |

## 6. Current Security Controls Inventory

### 6.1 Authentication

| Control | Status | Location |
|---------|--------|----------|
| Google OAuth via Auth.js | Active | `src/auth.ts` |
| JWT session strategy | Active | `src/auth.ts` |
| Organisation membership | Active | `src/lib/organisations/organisation-resolver.ts` |
| Proxy auth check (all routes) | Active | `src/proxy.ts` (formerly `src/middleware.ts`) |
| `BYPASS_AUTH` for tests | Active (test only) | `src/lib/auth.ts` |

### 6.2 Authorization

| Control | Status | Location |
|---------|--------|----------|
| `requireCoachAccess()` on all server actions | Active | `src/lib/auth.ts` |
| `requireCoachAccess()` on most API routes | Active | Various route files |
| `/api/admin/policy` has auth | **Resolved** (G-01) | `src/app/api/admin/policy/route.ts` |
| Organisation-scoped resource authorization (IDOR) | **Resolved** — org membership + query filters | ADR-0036, ADR-0057 |
| Role granularity (OWNER/ADMIN/COACH/VIEWER/SUPPORT) | **Resolved** | ADR-0035 |

### 6.3 Input Validation

| Control | Status | Location |
|---------|--------|----------|
| Manual validation in API routes | Partial | Various route files |
| Manual validation in server actions | Partial | Various action files |
| Observation content validation (email/phone/URL rejection) | Active | `src/lib/opponents/validate-observation.ts` |
| Zod schema validation on mutations | **Partially Resolved** — Zod now used on many mutations | Various action files |
| No request body size limits | **Gap** | API routes |

### 6.4 Output and Browser

| Control | Status | Location |
|---------|--------|----------|
| Next.js JSX escaping (default) | Active | All components |
| No Content-Security-Policy | **Gap** | None |
| No X-Frame-Options | **Gap** | None |
| No X-Content-Type-Options | **Gap** | None |
| No HSTS | **Gap** | None |
| No Referrer-Policy | **Gap** | None |
| No Permissions-Policy | **Gap** | None |
| No CORS restrictions on API routes | Acceptable (same-origin app) | None |

### 6.5 Database

| Control | Status | Location |
|---------|--------|----------|
| Prisma ORM for queries | Active | All data access |
| Tagged template raw SQL (parameterized) | Active | 3 migration/query files |
| No `$queryRawUnsafe` or `$executeRawUnsafe` | Active | None found |
| No SQL string concatenation | Active | None found |
| No database role separation (runtime vs migration) | **Gap** | Single `DATABASE_URL` |
| No query timeout configuration | **Gap** | `src/lib/db.ts` |

### 6.6 Rate Limiting

| Control | Status | Location |
|---------|--------|----------|
| In-memory rate limiter | Active (limited) | `src/lib/rate-limit.ts` |
| Per-key rate limiting | Partial (static keys, not per-user) | API routes |
| No rate limiting on server actions | **Gap** | None |
| No distributed rate limiting | **Gap** | In-memory only, non-functional on serverless |

### 6.7 Exports

| Control | Status | Location |
|---------|--------|----------|
| Auth required on all export routes | Active | Export route files |
| Parent-safe filtering for exports | Active | `src/lib/export/parent-safe-filter.ts` |
| No CSV formula injection prevention | **Gap** | Export utilities |
| No export rate limiting | **Gap** | None |
| No file size/row count limits | **Gap** | None |

### 6.8 Secrets

| Control | Status | Location |
|---------|--------|----------|
| `.env.example` has no real secrets | Active | `.env.example` |
| `.gitignore` covers `.env` files | Active | `.gitignore` |
| `NEXT_PUBLIC_APP_VERSION` only non-sensitive NEXT_PUBLIC_ | Active | `next.config.ts` |
| `TEST_DATABASE_URL` required for tests | Active | `src/test/test-db.ts` |
| No secret scanning enforcement | **Gap** | CI/CD |

### 6.9 Outbound HTTP

| Control | Status | Location |
|---------|--------|----------|
| No external HTTP calls at runtime | Active | None found |
| No AI service integrations | Active | None |
| No outbound allowlist | Acceptable (no outbound) | N/A |

## 7. Gap Classification

| Gap ID | Category | Classification | Notes |
|--------|----------|----------------|-------|
| G-01 | Auth: `/api/admin/policy` missing auth | **Resolved** | Added `requireCoachAccess()` |
| G-02 | Auth: `event-squad-commit-actions.ts` missing `"use server"` | **Resolved** | Added directive |
| G-03 | Auth: No resource-level authorization (IDOR) | **Resolved** — org membership + query filters | ADR-0036, ADR-0057 |
| G-04 | Auth: No role granularity | **Resolved** | OWNER/ADMIN/COACH/VIEWER/SUPPORT roles |
| G-05 | Auth: Edge auth duplicates allowlist logic | Code work | Extract shared module |
| G-06 | Headers: No CSP | Code work | Deploy report-only first, then enforce |
| G-07 | Headers: No security headers (X-Frame-Options, X-Content-Type-Options, HSTS, Referrer-Policy, Permissions-Policy) | Code work | Add Next.js headers config or proxy |
| G-08 | Validation: No central schema validation library | **Partially Resolved** — Zod on mutations | Continue expanding Zod coverage |
| G-09 | Validation: No CSV formula injection prevention | Code work | Escape formula prefixes in exports |
| G-10 | Rate Limit: Non-functional on serverless | ADR (defer Redis) | Document compensating controls |
| G-11 | Rate Limit: Not per-user | Code work | Requires user identity in rate limit key |
| G-12 | Rate Limit: No server action rate limiting | Code work | Add rate limiting to mutation actions |
| G-13 | Tests: No authorization bypass tests | Code work | Add negative auth tests |
| G-14 | Tests: No CSRF, IDOR, or input fuzzing tests | Code work | Add security test suite |
| G-15 | DB: No role separation | Provider action + ADR | Requires Neon role configuration |
| G-16 | DB: No query timeout | Code work | Add Prisma query timeout |
| G-17 | Secrets: No CI secret scanning enforcement | Provider action | GitHub secret scanning and push protection |
| G-18 | Exports: No rate limiting or size limits | Code work | Add per-user rate limiting to exports |
| G-19 | Auth: No session timeout/absolute expiry | Code work | Configure NextAuth session maxAge |
| G-20 | Auth: No account lockout | ADR (evaluate risk) | Low risk with Google OAuth + allowlist |

## 8. Update Triggers

This threat model must be updated when:

- A new trust boundary is introduced (multitenancy, RLS, machine identity)
- A new identity type is added (automation principal, platform operator)
- A new external integration is connected (AI service, payment, notification)
- A new privileged operation is introduced (tenant deletion, support access)
- A new file type or export format is supported
- A new attack pattern becomes relevant

## 9. References

- OWASP ASVS 5.0.0 Level 2 (see ASVS applicability matrix at `docs/security/asvs-matrix.md`)
- Existing ADRs in `docs/adr/`