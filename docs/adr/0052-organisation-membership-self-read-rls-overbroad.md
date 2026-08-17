# ARR-0052: OrganisationMembership self-read RLS policy is overly broad

## State

Resolved

## Identified

2026-08-04

## Residue

The `OrganisationMembership_tenant_self_read` policy allows `matchboard_app_runtime` to read ALL `OrganisationMembership` rows when `app.current_organization_id` is NULL or empty. This is necessary for auth resolution (finding which orgs a user belongs to before knowing the org), but it means any query without tenant context can read all memberships across all organisations.

## Intended architecture

Auth resolution should be able to find a user's memberships without tenant context, but non-auth queries should not accidentally bypass tenant isolation for OrganisationMembership.

## Evidence

- `prisma/migrations/20260804140000_allow_org_membership_self_read_rls/migration.sql` — self-read policy using `IS NOT DISTINCT FROM '' OR IS NULL`
- `src/lib/auth/resolve-org-slug.ts` — `getOrgSlugForUser()` queries OrganisationMembership without tenant context
- `src/lib/auth/actor-context.ts` — `requireActorContext()` fallback path queries OrganisationMembership without tenant context (but inside `withTenantContext`)
- `src/lib/organisations/organisation-resolver.ts` — `resolveOrganisationAccess()` queries OrganisationMembership inside `withTenantContext`

## Impact

- If a code path queries `OrganisationMembership` without tenant context and without the auth resolution intent, it would read all memberships across all organisations
- This is mitigated by application-level WHERE filters (userId) in auth resolution paths
- The RLS bypass remains available to any query without tenant context

## Containment

- Only auth resolution code should query OrganisationMembership without tenant context
- All other queries must use `withTenantContext()` or have tenant context set via `enterWith()`
- Do not add new OrganisationMembership queries without tenant context outside auth resolution
- The self-read policy condition (`IS NOT DISTINCT FROM '' OR IS NULL`) should be reviewed if multi-tenant isolation requirements change

## Resolution criteria

- Auth resolution uses a dedicated mechanism that doesn't expose all memberships
- Or: self-read policy is scoped to the authenticated user's own memberships only (e.g., `USING (userId = current_setting('app.current_user_id', true))`)
- Non-auth queries never bypass tenant context for OrganisationMembership

## Disposition

Resolved. OrganisationMembership self-read RLS policy scoped to authenticated user via `app.current_user_id` session variable in the RLS policy, plus application-layer userId injection in the Prisma tenantRLS extension. The extension injects `userId` into OrganisationMembership queries when organisation context is not set but userId is available, providing primary enforcement. Database RLS provides defence-in-depth scoping when the session variable is set.

## Related decisions

ADR-0037, ADR-0057, ADR-0060

## Related implementation

PR #189, PR #190, PR #272

## Supersedes

None

## Superseded by

None

## History

### 2026-08-17

Resolved. Implementation:
- Added `userId` to `TenantContextStorage` and `setTenantUserId()` in `tenant-async-storage.ts`
- Auth resolution paths (`requireActorContext`, `getOrgSlugForUser`, `resolveOrgFilterForUser`) now set userId via `setTenantUserId()`
- Prisma tenantRLS extension injects `userId` into OrganisationMembership queries when organisation context is not set but userId is available
- Database migration scopes the OrganisationMembership_tenant_read RLS policy: when no org context is set but `app.current_user_id` is set, only the user's own memberships are visible
- Dropped the redundant OrganisationMembership_tenant_self_read policy (merged into tenant_read)