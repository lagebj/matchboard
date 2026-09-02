# Independent Security Assessment Preparation

## Purpose

This document prepares Matchboard for an independent security assessment by providing a comprehensive audit package covering architecture, controls, findings, and remediation status.

## Assessment Scope

### In Scope
- Application security: authentication, authorization, input validation, output encoding, session management
- Data security: tenant isolation, RLS, query filtering, export boundaries
- Infrastructure security: CI/CD, dependency management, secret management
- Operational security: audit logging, incident response, backup verification

### Out of Scope
- Vercel platform security (managed by Vercel)
- Neon PostgreSQL security (managed by Neon)
- Google OAuth security (managed by Google)
- Client-side browser security beyond CSP and XSS protections

## Architecture Summary

### Stack
- **Runtime**: Next.js 16 App Router (Turbopack), TypeScript
- **Database**: PostgreSQL (Neon for production, Docker Compose for local)
- **ORM**: Prisma v7
- **Auth**: Auth.js (Google OAuth, email allowlist)
- **Hosting**: Vercel (serverless functions, request proxy)
- **CI/CD**: GitHub Actions

### Multitenancy Model
- Shared-schema single-database (ADR-0035)
- Application-level query filters via Prisma where clauses (ADR-0036)
- RLS as defence in depth (ADR-0037, conditional migration)
- Two database roles: `matchboard_app` (NOBYPASSRLS) and `matchboard_admin` (BYPASSRLS)

### Auth Model
- Google OAuth with organisation membership (email allowlist removed, ADR-0061)
- `requireCoachAccess()` on all protected server actions and API routes
- Organisation membership-based authorization
- Machine principals with scoped JWT tokens (ADR-0038)
- SUPPORT role for time-bound read-only access (ADR-0040)

## Security Controls Inventory

### Authentication
| Control | Status | Location |
|---------|--------|----------|
| Google OAuth required | Implemented | `src/lib/auth.ts` |
| Email allowlist | Implemented | `src/lib/allowlist.ts` |
| Session management | Implemented | Auth.js default |
| Machine principal tokens | Implemented | `src/lib/machine-principal/machine-token.ts` |
| Token-org binding | Implemented | `src/lib/machine-principal/machine-token.ts` |

### Authorization
| Control | Status | Location |
|---------|--------|----------|
| Deny-by-default | Implemented | All server actions check `requireCoachAccess()` |
| Organisation membership check | Implemented | `src/lib/organisations/organisation-resolver.ts` |
| Role-based access (OWNER/ADMIN/COACH/VIEWER/SUPPORT) | Implemented | `src/lib/organisations/organisation-domain.ts` |
| Team-scoped access | Implemented | `src/lib/organisations/organisation-access.ts` |
| SUPPORT role restrictions | Implemented | `src/lib/organisations/organisation-domain.ts` |

### Data Isolation
| Control | Status | Location |
|---------|--------|----------|
| Application-level org filters | Implemented | `src/lib/tenancy/tenant-filter.ts`, `resolve-org-filter.ts` |
| RLS policies (conditional) | Implemented | `prisma/migrations/20260730160000_add_rls_policies_and_database_roles` |
| Organisation cascade deletes | Implemented | Migration `20260731120000` |
| Export org scoping | Implemented | Season export, org export, finalized selections export |
| Machine principal org binding | Implemented | `resolveOrgFilterForMachine()` |

### Input Validation
| Control | Status | Location |
|---------|--------|----------|
| Zod schemas on all mutations | Partial | Server actions use Zod validation |
| Output minimization | Implemented | Parent-facing exports strip internal data |
| Forbidden SQL methods | Implemented | `scripts/check-forbidden-sql.ts`, CI enforcement |
| SQL injection prevention | Implemented | Prisma parameterized queries |

### Output Encoding
| Control | Status | Location |
|---------|--------|----------|
| CSP headers | Implemented | `src/lib/security/csp.ts`, report-only mode |
| No NEXT_PUBLIC_ secrets | Implemented | Security audit test, `.gitignore` |
| Parent-safe language | Implemented | Export and display rules in AGENTS.md |

### Audit Logging
| Control | Status | Location |
|---------|--------|----------|
| Structured security events | Implemented | `src/lib/security/audit-log.ts` |
| Finalization events | Implemented | Audit logging on finalize |
| Manual override events | Implemented | Audit logging on overrides |
| Export events | Implemented | Audit logging on exports |
| Auth denial events | Implemented | `logAccessDenied()` |

## Security Findings and Status

### Open Findings

| ID | Severity | Finding | Status | Notes |
|----|----------|---------|--------|-------|
| SEC-0-01 | Medium | 18 transitive npm vulnerabilities | Accepted | All in dev/build deps, none directly exploitable |
| SEC-0-02 | Low | CSP in report-only mode | Active | Will enforce after tuning |
| SEC-4-01 | Low | No per-org rate limiting | Deferred | Requires multitenancy completion |
| SEC-4-02 | Low | No SSRF allowlist | Deferred | No outbound HTTP in app code |
| SEC-6-01 | Low | No step-up auth for destructive ops | Deferred | Product feature, not a security gap |

### Resolved Findings

| ID | Severity | Finding | Resolution |
|----|----------|---------|------------|
| SEC-0-03 | High | `/api/admin/policy` lacked auth | Fixed: requireCoachAccess added |
| SEC-0-04 | Medium | `"use server"` missing on server actions | Fixed: directive added |
| SEC-3-01 | High | No tenant isolation | Fixed: org scoping, RLS, cascade deletes |
| SEC-3-02 | High | Machine principal scope overreach | Fixed: scope validation, org binding |
| SEC-3-03 | Medium | Synthetic org data leakage | Fixed: isSynthetic flag, org scoping |
| SEC-5-01 | Medium | GitHub Actions not pinned by SHA | Fixed: pinned by SHA, supply chain check |
| SEC-5-02 | Medium | No secret rotation procedures | Fixed: documented rotation procedures |

## Dependency Audit

### Current State
- 18 npm audit vulnerabilities (16 high, 1 moderate, 1 low) — all in transitive dependencies
- None are directly exploitable in Matchboard's request handling
- `brace-expansion` DoS — dev dependency, no runtime impact
- `PostCSS` XSS/file-read — dev dependency for build only
- `sharp`/`libvips` CVEs — image processing, no user-controlled input path

### Supply Chain Controls
- GitHub Actions pinned by SHA with version comments
- Supply chain integrity check in CI (`npm run security:check-supply-chain`)
- No `$queryRawUnsafe` or `$executeRawUnsafe` in application code
- Dependabot configured for dependency updates

## Audit Test Coverage

| Area | Tests | Location |
|------|-------|----------|
| SEC-3 assurance | 31 | `src/test/sec3-assurance.test.ts` |
| MT-7 validation | 8 | `src/test/mt7-validation.test.ts` |
| CSP configuration | 6 | `src/lib/security/__tests__/csp.test.ts` |
| Forbidden SQL | 1 | `scripts/check-forbidden-sql.ts` |
| Supply chain | 1 | `scripts/check-supply-chain.ts` |
| Tenant context | 3 | `src/lib/tenancy/__tests__/tenant-context.test.ts` |
| Organisation lifecycle | 12 | `src/lib/organisations/__tests__/organisation-lifecycle.test.ts` |
| Organisation domain | 17 | `src/lib/organisations/__tests__/organisation-domain.test.ts` |
| Organisation access | 6 | `src/lib/organisations/__tests__/organisation-access.test.ts` |
| Machine principal | ~15 | `src/lib/machine-principal/__tests__/` |

## ADRs

| ADR | Title | Date |
|-----|-------|------|
| 0028 | Security baseline and threat model | 2026-07-28 |
| 0034 | Preview deployment protection and forbidden SQL | 2026-07-29 |
| 0035 | Shared-schema single-database multitenancy | 2026-07-30 |
| 0036 | Application-level isolation with RLS defence in depth | 2026-07-30 |
| 0037 | Database role isolation and RLS policies | 2026-07-30 |
| 0038 | Machine principal and scoped JWT tokens | 2026-07-30 |
| 0039 | Tenant database and machine identity assurance | 2026-07-31 |
| 0040 | Support access mechanism | 2026-07-31 |

## External Provider Actions Required

| Action | Provider | Status |
|--------|----------|--------|
| Enable GitHub secret scanning and push protection | GitHub | Documented, not yet configured |
| Enable GitHub branch protection rules (main) | GitHub | Documented, not yet configured |
| Configure external log drain for audit trail | Vercel | Documented, not yet configured |
| Create `matchboard_app` and `matchboard_admin` database roles | Neon | Not yet created |
| Test Neon PITR backup verification | Neon | Not yet tested |

## Assessment Readiness Checklist

- [x] Threat model documented and current
- [x] ASVS matrix completed (Level 2)
- [x] All security controls documented with locations
- [x] ADRs for all architectural security decisions
- [x] Test coverage for auth, authz, tenant isolation, machine principals
- [x] Supply chain integrity check in CI
- [x] Secret rotation procedures documented
- [x] Audit logging implemented for all mutations
- [x] CSP headers configured (report-only)
- [x] Forbidden SQL methods check in CI
- [x] No NEXT_PUBLIC_ secrets in source
- [x] No hardcoded credentials in tracked files
- [ ] GitHub branch protection rules configured (external)
- [ ] GitHub secret scanning enabled (external)
- [ ] RLS roles created in Neon (external)
- [ ] CSP enforcement mode tested (deferred)
- [ ] Per-org rate limiting (deferred to post-MT)
- [ ] Step-up auth for destructive operations (product feature)