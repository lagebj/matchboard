# OWASP ASVS 5.0 Level 2 Applicability Matrix — Matchboard

Version: 1.1
Date: 2026-08-10
Status: Active (partially updated — resolved items marked)

> **Note:** Several gaps identified in version 1.0 have been resolved. V4 Access Control gaps (IDOR, role granularity, admin route auth) are now substantially resolved. V5 Validation has partial Zod coverage. The summary counts below reflect the original assessment and have not been fully recalculated.

This is an engineering aid, not a certification claim.

## Legend

| Status | Meaning |
|--------|---------|
| Implemented | Control is in place and verified |
| Partial | Control exists but has gaps or is not fully verified |
| Planned | Control is designed but not yet implemented |
| Not applicable | Does not apply to Matchboard's architecture |
| Accepted risk | Deliberately deferred with documented reason |
| External | Requires provider action |

## V1: Architecture, Design and Threat Modelling

| ASVS ID | Requirement | Status | Implementation/Notes |
|---------|-------------|--------|---------------------|
| V1.1.1 | Secure development lifecycle | Partial | AGENTS.md defines workflow; no formal SDL process |
| V1.1.2 | Threat model for application | Planned | Threat model created at `docs/security/threat-model.md` |
| V1.1.3 | Threat model for all integrations | Planned | Currently no external integrations beyond auth provider |
| V1.1.4 | Threat model for all data flows | Planned | Partial — main flows documented in threat model |
| V1.2.1 | Secure software development controls | Partial | Branch protection not yet enforced; lint/type/test required |
| V1.2.2 | Component inventory | Implemented | `package.json` and lockfile; Dependabot not yet enabled |
| V1.3.1 | Authorisation architecture | Partial | Single role; multitenancy planned |
| V1.3.2 | Central authorisation mechanism | Partial | `requireCoachAccess()` central; no resource-level auth |
| V1.3.3 | Role-based access control | Partial | COACH role only; no OWNER/ADMIN/VIEWER distinction |
| V1.4.1 | Security documentation | Planned | This matrix + threat model |
| V1.5.1 | Secure defaults | Partial | Deny-by-default middleware; some gaps (admin/policy route) |
| V1.5.2 | Minimal privilege | Partial | All coaches have same access; no scoped access |
| V1.6.1 | Secure component definition | Planned | Architectural boundaries defined in AGENTS.md |

## V2: Authentication

| ASVS ID | Requirement | Status | Implementation/Notes |
|---------|-------------|--------|---------------------|
| V2.1.1 | Auth via trusted service | Implemented | Auth.js with Google OAuth |
| V2.1.2 | Auth not mixed with authz | Implemented | `requireCoachAccess()` separate from authentication |
| V2.1.3 | Auth not bypassable | Partial | Middleware enforces; `/api/admin/policy` gap |
| V2.2.1 | Password not stored | Implemented | Google OAuth; no password handling |
| V2.2.2 | Identity verification | Implemented | Google verifies email ownership |
| V2.3.1 | Session management | Partial | JWT sessions; no absolute expiry configured |
| V2.3.2 | Session invalidation | Gap | No session revocation on role change |
| V2.3.3 | Session logout | Implemented | NextAuth sign-out clears JWT |
| V2.4.1 | Credential recovery | N/A | Google OAuth handles account recovery |
| V2.5.1 | Auth verifier | Implemented | Auth.js handles OAuth state, nonce, PKCE |
| V2.5.2 | Callback URLs | Planned | Must verify exact production URLs in Google Console |
| V2.6.1 | Brute force protection | Gap | No account lockout; Google OAuth provides some protection |
| V2.7.1 | Auth failures logged | Gap | No structured auth event logging |

## V3: Session Management

| ASVS ID | Requirement | Status | Implementation/Notes |
|---------|-------------|--------|---------------------|
| V3.1.1 | Session tokens generated securely | Implemented | Auth.js JWT with secure defaults |
| V3.1.2 | Session tokens not in URL | Implemented | HttpOnly cookies only |
| V3.2.1 | Session timeout | Gap | No absolute session lifetime configured |
| V3.2.2 | Session regeneration | Partial | JWT rotation on sign-in; no rotation on privilege change |
| V3.3.1 | Logout effective | Partial | Client-side clear; no server-side session invalidation |
| V3.4.1 | Session storage | Implemented | HttpOnly, Secure, SameSite cookies |

## V4: Access Control

| ASVS ID | Requirement | Status | Implementation/Notes |
|---------|-------------|--------|---------------------|
| V4.1.1 | Access control by trusted service | Implemented | `requireCoachAccess()` server-side |
| V4.1.2 | Deny by default | Partial | Middleware denies unauthenticated; but all authenticated users have same access |
| V4.1.3 | Access control not bypassable | **Resolved** | Organisation-scoped query filters via Prisma where clauses (ADR-0036, ADR-0057) |
| V4.1.4 | Access control fail secure | Implemented | Redirects to sign-in/access-denied |
| V4.2.1 | Role definitions | **Resolved** | OWNER/ADMIN/COACH/VIEWER/SUPPORT roles implemented |
| V4.2.2 | Role hierarchy | **Resolved** | Role hierarchy enforced in `requireCoachAccess()` |
| V4.3.1 | Resource-level access control | **Resolved** | Organisation membership + query scoping (ADR-0036) |
| V4.3.2 | IDOR protection | **Resolved** | Resource IDs checked against user's organisation via query filters |
| V4.4.1 | Administrative access | **Resolved** | Admin routes require OWNER/ADMIN role |
| V4.5.1 | Access control logging | Gap | No structured access denial logging |

## V5: Validation and Sanitisation

| ASVS ID | Requirement | Status | Implementation/Notes |
|---------|-------------|--------|---------------------|
| V5.1.1 | Input validation on server | Partial | Manual validation in routes/actions; Zod on many mutations |
| V5.1.2 | Input validation framework | **Partially Resolved** | Zod now used on mutation endpoints; coverage expanding |
| V5.1.3 | Positive validation (allowlist) | Partial | Some enum checks; many fields accept any string |
| V5.2.1 | Output encoding | Implemented | Next.js JSX escaping |
| V5.2.2 | No unsanitised HTML | Gap | No rich text sanitiser for any free-text fields |
| V5.3.1 | Parameterised queries | Implemented | Prisma ORM and tagged template raw SQL |
| V5.3.2 | No unsafe raw SQL methods | Implemented | No `$queryRawUnsafe` or `$executeRawUnsafe` |
| V5.3.3 | No SQL string concatenation | Implemented | None found |
| V5.4.1 | File upload validation | N/A | No file uploads currently |
| V5.5.1 | Mass assignment protection | Partial | Prisma select/include patterns; no explicit whitelist |
| V5.6.1 | Request size limits | Gap | No explicit request body size limits |
| V5.7.1 | CSV/formula injection prevention | Gap | No formula prefix escaping in exports |

## V6: Stored Cryptography

| ASVS ID | Requirement | Status | Implementation/Notes |
|---------|-------------|--------|---------------------|
| V6.1.1 | Sensitive data encrypted at rest | Partial | Neon handles encryption; no app-level encryption |
| V6.2.1 | Cryptographic algorithms | N/A | Auth.js and Neon handle crypto |
| V6.2.2 | Key management | N/A | Provider-managed |
| V6.4.1 | Passwords hashed | N/A | Google OAuth; no password storage |

## V7: Error Handling and Logging

| ASVS ID | Requirement | Status | Implementation/Notes |
|---------|-------------|--------|---------------------|
| V7.1.1 | Error handling not revealing information | Partial | Next.js error pages; no custom error classification |
| V7.1.2 | Stack traces not in production | Partial | Next.js default; no explicit suppression |
| V7.2.1 | Security event logging | Gap | No structured security event logging |
| V7.2.2 | Access denial logging | Gap | No logging of failed auth or authorisation |
| V7.3.1 | Log injection prevention | Partial | Structured console logging; no log aggregation |
| V7.3.2 | Sensitive data not in logs | Partial | No explicit log sanitisation |

## V8: Data Protection

| ASVS ID | Requirement | Status | Implementation/Notes |
|---------|-------------|--------|---------------------|
| V8.1.1 | Sensitive data classification | Planned | Youth data present; no formal classification system |
| V8.1.2 | Data minimisation | Partial | Parent-safe export filters exist; no formal minimisation policy |
| V8.2.1 | PII not in URLs | Partial | Player IDs in URLs (not PII by themselves); names not in URLs |
| V8.2.2 | PII not in logs | Gap | No explicit log sanitisation for player data |
| V8.3.1 | Data retention | Gap | No automated retention or deletion |
| V8.3.2 | Secure deletion | Gap | No tenant deletion capability |
| V8.4.1 | Data export access control | Implemented | Auth required on all export endpoints |
| V8.4.2 | Parent-safe export | Implemented | `parent-safe-filter.ts` strips coach-only fields |

## V9: Communications

| ASVS ID | Requirement | Status | Implementation/Notes |
|---------|-------------|--------|---------------------|
| V9.1.1 | TLS enforced | Partial | Vercel enforces HTTPS; no HSTS header |
| V9.1.2 | Certificate validation | Implemented | Neon and Auth.js validate certificates |
| V9.2.1 | No mixed content | Implemented | Next.js enforces HTTPS for assets |
| V9.2.2 | CSP implemented | Gap | No Content-Security-Policy |
| V9.2.3 | X-Frame-Options | Gap | No header set |
| V9.2.4 | X-Content-Type-Options | Gap | No header set |
| V9.2.5 | Referrer-Policy | Gap | No header set |
| V9.2.6 | Permissions-Policy | Gap | No header set |

## V10: HTTP Client Configuration

| ASVS ID | Requirement | Status | Implementation/Notes |
|---------|-------------|--------|---------------------|
| V10.1.1 | Outbound HTTP restricted | Acceptable | No outbound HTTP calls at runtime |
| V10.2.1 | SSRF protection | N/A | No user-influenced URLs |
| V10.3.1 | CORS policy | Acceptable | Same-origin by default; no explicit CORS |

## V11: HTTP Server Configuration

| ASVS ID | Requirement | Status | Implementation/Notes |
|---------|-------------|--------|---------------------|
| V11.1.1 | Server hardening | Partial | Vercel manages; no custom server config |
| V11.1.2 | Security headers | Gap | No security headers middleware |
| V11.1.3 | HTTP methods restricted | Partial | Next.js restricts methods on API routes |
| V11.2.1 | Rate limiting | Partial | In-memory rate limiter; non-functional on serverless |
| V11.2.2 | DoS protection | Partial | Vercel provides DDoS mitigation |

## V12: API and Web Service

| ASVS ID | Requirement | Status | Implementation/Notes |
|---------|-------------|--------|---------------------|
| V12.1.1 | API auth on all endpoints | Partial | `/api/admin/policy` missing auth |
| V12.1.2 | API auth not bypassable | Partial | IDOR gaps; no resource ownership checks |
| V12.2.1 | Input validation on all API endpoints | Gap | No central schema validation |
| V12.3.1 | CSRF protection | Partial | Server actions have Origin check; API routes lack CSRF tokens |
| V12.4.1 | API rate limiting | Partial | Some endpoints; not per-user; not distributed |
| V12.5.1 | API response filtering | Partial | Parent-safe exports exist; no general response filtering |
| V12.6.1 | Error responses do not leak info | Partial | Next.js default error handling |

## V13: Configuration

| ASVS ID | Requirement | Status | Implementation/Notes |
|---------|-------------|--------|---------------------|
| V13.1.1 | Secure default configuration | Partial | Auth required; some endpoints unprotected |
| V13.1.2 | No default credentials | Implemented | Google OAuth; no default passwords |
| V13.2.1 | Secrets in environment | Implemented | All secrets from env vars |
| V13.2.2 | Secrets not in code | Implemented | No secrets in repository |
| V13.2.3 | Secrets not in client | Implemented | No NEXT_PUBLIC_ secrets |
| V13.3.1 | Debug features off in production | Implemented | No debug endpoints |
| V13.4.1 | Security headers configured | Gap | None configured |
| V13.4.2 | CSP configured | Gap | None configured |

## V14: Infrastructure

| ASVS ID | Requirement | Status | Implementation/Notes |
|---------|-------------|--------|---------------------|
| V14.1.1 | Database credentials separate | Gap | Single DATABASE_URL for runtime and migrations |
| V14.1.2 | Runtime role cannot modify schema | Gap | No role separation |
| V14.1.3 | Database connection encrypted | Implemented | Neon requires SSL |
| V14.2.1 | Application secrets in secure storage | Partial | Vercel sensitive env vars not yet configured |
| V14.3.1 | Network segmentation | Planned | Vercel provides edge; no custom network config |
| V14.4.1 | Logging and monitoring | Gap | No structured security event logging |
| V14.5.1 | Backup and recovery | Gap | Neon PITR available; no tested restore procedure |

## Summary

| Category | Implemented | Partial | Gap | Planned | N/A | External |
|----------|:-----------:|:------:|:---:|:-------:|:---:|:--------:|
| V1 Architecture | 1 | 5 | 0 | 3 | 0 | 0 |
| V2 Authentication | 4 | 1 | 2 | 1 | 1 | 0 |
| V3 Session | 2 | 1 | 2 | 0 | 0 | 0 |
| V4 Access Control | 1 | 2 | 5 | 0 | 0 | 0 |
| V5 Validation | 4 | 3 | 4 | 0 | 1 | 0 |
| V6 Cryptography | 1 | 1 | 0 | 0 | 4 | 0 |
| V7 Errors/Logging | 0 | 3 | 3 | 0 | 0 | 0 |
| V8 Data Protection | 2 | 2 | 3 | 1 | 0 | 0 |
| V9 Communications | 2 | 1 | 4 | 0 | 0 | 0 |
| V10 HTTP Client | 1 | 0 | 0 | 0 | 2 | 0 |
| V11 HTTP Server | 0 | 3 | 2 | 0 | 0 | 0 |
| V12 API | 0 | 5 | 2 | 0 | 0 | 0 |
| V13 Configuration | 3 | 2 | 2 | 0 | 0 | 0 |
| V14 Infrastructure | 1 | 1 | 4 | 0 | 0 | 0 |
| **Total** | **22** | **30** | **33** | **5** | **7** | **0** |

### Priority gaps (highest impact)

1. **V4 Access Control**: ~~No resource-level authorization, no IDOR protection, no role granularity~~ — **Substantially resolved**: org membership + query filters (ADR-0036, ADR-0057), OWNER/ADMIN/COACH/VIEWER/SUPPORT roles, `/api/admin/policy` auth
2. **V5 Validation**: Partial Zod coverage on mutations, no CSV injection prevention — input attack surface
3. **V9/V13 Security Headers**: No CSP, no security headers — browser attack surface
4. **V7/V14 Logging and Infrastructure**: No security event logging, no DB role separation — detection and defence in depth
5. **V12 API Security**: ~~Unauthenticated admin route~~ — **Resolved**: `/api/admin/policy` now requires auth. No per-user rate limiting — API abuse surface

### Planned remediation tracking

Each gap is tracked in the programme status file and will be addressed in the corresponding SEC stage:
- SEC-0: This inventory, threat model, and ASVS matrix
- SEC-1: Input validation (V5), security headers (V9/V13), raw SQL safety (V5)
- SEC-2: Authentication hardening (V2/V3/V4), session security, authorisation baseline
- SEC-3: Tenant isolation (V4), database roles (V14), RLS
- SEC-4: Rate limiting (V11/V12), WAF, network protection
- SEC-5: Secrets (V13/V14), supply chain, CI security
- SEC-6: Audit logging (V7/V14), incident, backup
- SEC-7: Independent assessment preparation
- SEC-8: Final acceptance