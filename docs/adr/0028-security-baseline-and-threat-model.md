# ADR-0028: Security baseline and threat model

## Status

Accepted

## Date

2026-07-29

## Context

Matchboard is moving from a single-trusted-user installation toward a product-capable, multi-organisation platform. The current security posture has gaps identified in the SEC-0 security inventory:

1. No resource-level authorisation (IDOR vulnerability)
2. No central input validation (no Zod or equivalent)
3. No security headers (CSP, X-Frame-Options, HSTS, etc.)
4. No structured security event logging
5. No database role separation
6. In-memory rate limiting (non-functional on serverless)
7. No CSV injection prevention in exports
8. No negative authorisation tests
9. One API route (`/api/admin/policy`) missing authentication

The existing architecture uses:
- Auth.js with Google OAuth for authentication
- Membership-based authorisation (OrganisationMembership with roles, ADR-0061)
- JWT sessions with 24h max age
- In-memory rate limiting
- Prisma ORM for all queries (parameterised raw SQL only)
- No outbound HTTP calls at runtime
- Vercel for hosting with Neon PostgreSQL

## Decision

1. **Deny-by-default authorisation**: Adopt the security invariant that every operation is denied by default and receives only the verified actor, tenant, input, data, network and dependency capabilities it needs. This principle is now embedded in AGENTS.md.

2. **Security assessment for every change**: Before adding or changing an operation, the agent must assess the 9-point security checklist (actor, organisation, trusted input, data output, external systems, secrets, logging, abuse cases, threat model impact).

3. **Security finding vs ARR vs ADR boundary**: Security findings describe vulnerabilities. ARRs describe structural mismatches. ADRs describe decisions. Do not create an ARR for every vulnerability. Do not use an ADR as a backlog item.

4. **Immediate fixes applied**: 
   - Added `requireCoachAccess()` to `/api/admin/policy` route
   - Added `"use server"` directive to `event-squad-commit-actions.ts`

5. **Security inventory and threat model created**: 
   - Threat model at `docs/security/threat-model.md`
   - ASVS 5.0 Level 2 applicability matrix at `docs/security/asvs-matrix.md`

6. **Security remediation will follow the programme stages**: SEC-0 through SEC-8 as defined in the programme specification, in parallel with improvement and multitenancy stages.

## Consequences

- All future code changes must include a proportionate security assessment
- The ASVS matrix tracks 97 requirements with 33 gaps, 30 partial, 22 implemented
- The highest-priority gaps are: access control (IDOR, role granularity), input validation (central schemas), and security headers (CSP)
- Multitenancy (MT-0 through MT-4) will address the most critical authorisation gaps
- SEC-1 will address input validation and security headers
- SEC-2 will address authentication and authorisation baseline
- No security control may be weakened to make tests pass

## Alternatives considered

- **Status quo**: Rejected — current posture has significant gaps for a product-facing application
- **Comprehensive security audit before any feature work**: Rejected — security is cross-cutting and must be integrated incrementally, not bolted on afterward
- **External pentest first**: Deferred to SEC-7 — internal baseline must be established first

## Related

- Threat model: `docs/security/threat-model.md`
- ASVS matrix: `docs/security/asvs-matrix.md`
- Security specification: `.matchboard-work/specifications/matchboard-security-hardening-spec.md`
- Programme status: `.matchboard-work/state/programme-status.md`