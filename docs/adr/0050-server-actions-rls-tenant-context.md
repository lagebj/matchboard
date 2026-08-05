# ARR-0050: Server actions lack explicit RLS tenant context for background operations

## State

Partially resolved

## Identified

2026-08-04

## Residue

`requireActorContext()` calls `setTenantOrganisationId()` via `AsyncLocalStorage.enterWith()`, which sets context for the current async execution. This works for request-scoped server actions and page components. However, `AsyncLocalStorage.enterWith()` does NOT propagate to detached async operations (background jobs, cron handlers, fire-and-forget). Any background processing that bypasses `requireActorContext()` will have no RLS context, causing queries against tenant-bearing tables to return 0 rows.

## Intended architecture

Every `db` query against an RLS-protected table must have `app.current_organization_id` set in the PostgreSQL session. The Prisma extension handles this automatically when `getTenantOrganisationId()` returns a value. Tenant context must be set before any RLS-protected query and must not leak across requests.

## Evidence

- `src/lib/db.ts` — Prisma extension reads from `getTenantOrganisationId()`
- `src/lib/tenancy/tenant-async-storage.ts` — `enterWith()` sets context for current async execution only
- `src/lib/auth/actor-context.ts` — `requireActorContext()` calls `setTenantOrganisationId()`
- 33+ server action files call `requireActorContext()` before `db` queries — these work correctly
- `src/app/api/cron/notification-outbox/route.ts` — cron handler has no `requireActorContext()` call

## Impact

- Detached async operations that bypass `requireActorContext()` will have no RLS context
- The `OrganisationMembership` self-read policy allows queries without tenant context, but all other tenant-bearing tables require it
- Cron handlers, webhook handlers, and background jobs are at risk

## Containment

- All server actions and page components must call `requireActorContext()` before any `db` queries
- Background jobs and cron handlers must use `withTenantContext(db, orgId, ...)` or `runWithTenantOrganisationId(orgId, ...)` explicitly
- Do not add background processing that bypasses `requireActorContext` without explicit RLS context setup

## Resolution criteria

- All `db` queries against RLS-protected tables have tenant context set
- Background operations explicitly set tenant context
- Tests verify RLS isolation for all tenant-bearing tables
- Cron handlers and webhook handlers use explicit tenant context

## Disposition

Partially resolved. The where-clause injection approach (ADR-0057) reduces the dependency on `AsyncLocalStorage.enterWith()` for RLS enforcement — queries are filtered by `organisationId` in the Prisma extension regardless of whether PostgreSQL session state is set. However, background operations that bypass `requireActorContext()` still need explicit `runWithTenantOrganisationId()` to ensure the correct `organisationId` is injected into queries. Database RLS policies are permissive when context is not set, so missing context does not cause 0-row returns, but it does mean the query is not scoped to the correct organisation.

## Related decisions

ADR-0037 (superseded), ADR-0057 (current approach), ADR-0035 (multitenancy architecture)

## Related implementation

PR #202 (where-clause injection)

## Supersedes

None

## Superseded by

None

## History

### 2026-08-05

Updated. Where-clause injection (ADR-0057) reduces the impact of missing `enterWith()` context — queries still get `organisationId` injected if context is set. Missing context now returns unscoped results (all organisations) instead of 0 rows, which is less dangerous but still incorrect. Background operations still need explicit context setup.

### 2026-08-04

Record created. RLS extension and `enterWith()` mechanism deployed. Background operation gap identified.