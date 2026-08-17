# ARR-0012: Admin API routes use requireCoachAccess() without role or org context distinction

## State

Resolved

## Identified

2026-08-02

## Residue

Four admin API routes in `src/app/api/admin/` use `requireCoachAccess()` for authentication but do not verify admin-level role or organisation context. These routes handle sensitive operations (audit, policy, migration, reconciliation) and should require higher privilege than a regular coach.

Affected files:
- `src/app/api/admin/audit/route.ts`
- `src/app/api/admin/migrate/route.ts`
- `src/app/api/admin/policy/route.ts`
- `src/app/api/admin/reconcile/route.ts`

Additionally, two organisation-level routes use `requireCoachAccess()` without verifying org membership:
- `src/app/api/organisations/[orgSlug]/export/route.ts`

## Intended architecture

Per ARR-0008 and ADR-0035, admin operations require role-granular authorisation. Admin routes should:
1. Verify the authenticated user has an ADMIN or OWNER role within the target organisation
2. Use `requireActorContext()` with org scoping to ensure the operation is scoped to an authorised organisation
3. Not rely on `requireCoachAccess()` alone, which grants identical access to all authenticated coaches

## Evidence

- All four admin routes call `requireCoachAccess()` (2 calls each) but never check role
- No role-based access control exists for admin operations
- `organisations/[orgSlug]/export/route.ts` uses `requireCoachAccess()` without verifying org membership or export permissions
- Any authenticated coach can currently invoke admin audit, migration, policy, and reconciliation endpoints

## Impact

- No role distinction between coach, admin, and owner for admin operations
- Admin endpoints are accessible to any authenticated coach, violating the intended privilege boundary
- No org scoping for admin operations that should be organisation-specific

## Containment

- No new admin route may use `requireCoachAccess()` without role verification
- No new admin route may be added without `requireActorContext()` and role check
- Existing admin routes must not gain additional operations without role verification
- The admin route paths (`/api/admin/*`) are not a security boundary — they must have server-side role checks

## Resolution criteria

- All admin API routes use `requireActorContext()` and verify `ctx.role` is ADMIN or OWNER
- Organisation export routes use `requireActorContext()` with org slug and verify membership
- Admin operations are scoped to the user's authorised organisation
- Role checks are tested (positive and negative cases)

## Disposition

Resolved. All four admin routes now use `requireActorContext()` + `requireAdminRole()`. Organisation export route uses `resolveOrganisationOwner()` (OWNER role required) and no longer calls `requireCoachAccess()`.

## Related decisions

- ADR-0032 (authentication, session and authorisation baseline)
- ADR-0035 (multitenancy architecture and product decisions)
- ARR-0008 (requireCoachAccess provides no role granularity)

## Related implementation

- `src/lib/auth/actor-context.ts` — `requireActorContext()` provides `role` field for role checks
- `src/lib/organisations/organisation-resolver.ts` — `resolveOrganisationAccess()` provides role verification

## Supersedes

None

## Superseded by

None

## History

### 2026-08-17

Resolved. Admin routes already use `requireActorContext()` + `requireAdminRole()`. Organisation export route updated to use `resolveOrganisationOwner()` without redundant `requireCoachAccess()`, and uses `ctx.userEmail` for export metadata. Owner role is required for export access.