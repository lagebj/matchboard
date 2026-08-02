# ARR-0008: requireCoachAccess() provides no role granularity or organisation context

## Status

Partially resolved

## Discovered

2026-07-30

## Residue

The `requireCoachAccess()` function in `src/lib/auth.ts` returns a coach object with no role, no organisation context, and no team delegation. Every server action that uses it treats the authenticated user identically — as a full-access coach.

Per ADR-0035, the target model has four roles (OWNER, ADMIN, COACH, VIEWER) with organisation membership and team-level delegation.

**Partial resolution**: `requireActorContext()` in `src/lib/auth/actor-context.ts` now provides `userId`, `email`, `membershipId`, `organisationId`, `organisationSlug`, `role`, `delegatedTeamIds`, and `orgFilter` in a single call. All production server actions, API routes, and page components that previously called both `requireCoachAccess()` and `resolveOrgFilterForUser()` now use `requireActorContext()` instead.

**Remaining residue**: 21 production files still call `requireCoachAccess()` alone (without `resolveOrgFilterForUser`). These fall into three categories:
1. **Insights library functions** (7 files): accept orgFilter as a parameter but still call `requireCoachAccess()` internally for user identity
2. **Admin API routes** (4 files): use `requireCoachAccess()` for auth-only checks
3. **Page components and actions** (10 files): use `requireCoachAccess()` for redirect or identity only

## Containment

- `requireActorContext()` is the mandatory auth + org context entry point for all new code that needs organisation scoping
- `requireCoachAccess()` must not be combined with `resolveOrgFilterForUser()` in new code — use `requireActorContext()` instead
- No new call sites may call `requireCoachAccess()` + `resolveOrgFilterForUser()` as a pair
- Insights library functions must receive org context as a parameter, not resolve it internally (see ARR-0011)
- Admin routes should use a distinct admin auth pattern, not `requireCoachAccess()` (see ARR-0012)

## Resolution criteria

- `requireActorContext()` replaces `requireCoachAccess()` for all protected routes and actions that need org context
- No production code calls `requireCoachAccess()` + `resolveOrgFilterForUser()` as a pair
- `requireCoachAccess()` is removed or reduced to a thin wrapper for auth-only checks where org context is not needed
- User → OrganisationMembership → role resolution is mandatory for all org-scoped operations
- COACH and VIEWER roles have explicit team delegation via TeamAccess
- OWNER and ADMIN roles have organisation-wide access
- Every mutation validates the user's role and permitted teams before executing

## Affected ADRs

- ADR-0032 (authentication, session and authorisation baseline — deferred database-backed membership)
- ADR-0035 (multitenancy architecture and product decisions)

## Related

- `src/lib/auth.ts` — current auth implementation
- `src/lib/auth/actor-context.ts` — new `requireActorContext()` implementation
- `src/lib/tenancy/resolve-org-filter.ts` — `resolveOrgFilterForUser()` still exported, only used by test files and `actor-context.ts` internally
- Threat model gaps G-03 (no resource-level authorisation) and G-04 (no role granularity)

## Supersedes

None

## Superseded by

None

## History

### 2026-07-30

Record created from IMPROVE-0A architecture assessment.

### 2026-08-02

Substantially resolved: `requireActorContext()` now provides combined auth + org context. All production server actions, API routes, and page components that previously called `requireCoachAccess()` + `resolveOrgFilterForUser()` migrated to `requireActorContext()`. Remaining `requireCoachAccess()` call sites fall into three categories documented above. See ARR-0011 and ARR-0012 for specific residue categories.