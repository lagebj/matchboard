# ADR-0060: Tenant isolation hardening — Phase 1

## Status

Implemented

## Date

2026-08-17

## Decision owners

- Matchboard engineering

## Context

The baseline audit for the consolidation programme identified three tenant isolation gaps that violate the security invariants established in ADR-0035 and ADR-0057:

1. **GroupAccess has no `organisationId` column and is not in `RLS_TABLES`**. Queries on `GroupAccess` rely on `membershipId` scoping through `OrganisationMembership` rather than direct tenant filtering. The Prisma `tenantRLS` extension does not inject `organisationId` into `GroupAccess` queries because the table lacks the column and is not in the RLS_TABLES set. If a query omits the `membershipId` filter, it returns rows from all organisations.

2. **`resolveOrgFilterForUser()` unscoped mode returns an empty filter** (`{}`). When a machine principal's `organisationId` does not match the requested organisation, or when the principal is not found, the function returns `{ type: "unscoped", filter: {}, filterNullable: {} }`. An empty filter passed to Prisma `where` clauses returns all rows across all organisations. ADR-0035 explicitly notes this should fail closed.

3. **`insights-overview.ts` uses `$queryRaw` without `organisationId` in the SQL**. The `highLoadRows` raw query joins `Player`, `Selection`, and `Match` tables but only filters by `roundIds`. The `requireCoachAccess()` call provides authentication but not tenant scoping for the raw query.

## Decision

### 1. Add `organisationId` to `GroupAccess` and add to `RLS_TABLES`

Add an `organisationId` column to `GroupAccess`. This column is denormalised from the `FootballGroup` relationship (`GroupAccess.footballGroupId → FootballGroup.organisationId`) and serves the same tenant isolation purpose as the `organisationId` column on every other RLS-scoped table.

Add `groupAccess` to the `RLS_TABLES` set in `src/lib/db.ts` so the `tenantRLS` Prisma extension injects `organisationId` into all `GroupAccess` queries.

Update all `GroupAccess` creation and mutation code to include `organisationId`, sourced from the related `FootballGroup`.

Add a migration that:
- Adds the `organisationId` column (nullable initially)
- Backfills `organisationId` from `FootballGroup.organisationId` via `JOIN`
- Makes `organisationId` required (`NOT NULL`)
- Creates an index on `organisationId`

### 2. Make unscoped `resolveOrgFilterForUser` and `resolveOrgFilterForMachine` fail closed

Change `resolveOrgFilterForMachine` to throw an `AuthorizationError` instead of returning an unscoped empty filter when the principal is not found or the organisation does not match.

Change `resolveOrgFilterForUser` to throw a `MultipleMembershipsError` (already implemented) when there are multiple eligible memberships, and to throw an `AuthorizationError` when there are zero eligible memberships (already implemented). The unscoped return path for machine principals is the only path that returns an empty filter — eliminate it.

### 3. Add `organisationId` filter to raw SQL in `insights-overview.ts`

Replace the unparameterised `$queryRaw` in `getInsightOverview()` with a parameterised `$queryRaw` that includes `AND p."organisationId" = ${organisationId}` in the WHERE clause. This requires passing `organisationId` into the function and adding `requireActorContext()` instead of just `requireCoachAccess()`.

## Rationale

- **GroupAccess `organisationId`**: ADR-0057 explicitly notes that GroupAccess uses "join-based RLS policies" because it lacks `organisationId`. Adding the column directly eliminates the need for join-based RLS and makes GroupAccess subject to the same deterministic where-clause injection as all other RLS-scoped tables. This removes a class of potential IDOR where a `GroupAccess` query omits the `membershipId` filter.

- **Fail-closed unscoped filter**: The unscoped return path in `resolveOrgFilterForMachine` returns an empty Prisma filter `{}`, which means "no filter" — returning all rows. This directly violates the security invariant in ADR-0035 that queries should never return cross-tenant data. Throwing an authorization error is the correct fail-closed behaviour.

- **Raw SQL tenant filter**: The `tenantRLS` Prisma extension only applies to model queries (`findMany`, `findFirst`, `create`, etc.). Raw SQL (`$queryRaw`) bypasses the extension entirely. Any raw SQL that queries tenant-scoped tables must include an explicit `organisationId` filter. This is documented in AGENTS.md and enforced by security audit tests for `$queryRawUnsafe`/`$executeRawUnsafe`, but `$queryRaw` with template literals is not caught by that scanner.

## Alternatives considered

### Keep GroupAccess on join-based RLS only

- Benefits: No schema change, no migration, no backfill
- Costs: Every GroupAccess query must remember to join through membership or FootballGroup; the tenantRLS extension does not protect GroupAccess queries; any query that forgets the join leaks cross-tenant data
- Reason not selected: The consolidation spec (§38) explicitly requires auditing GroupAccess and determining its tenant context. A direct `organisationId` column is the safest and most consistent approach.

### Return empty result set instead of throwing for unscoped filter

- Benefits: Caller receives no data rather than all data
- Costs: Silent empty results mask authorization failures; debugging becomes harder; the caller cannot distinguish "no data because you have no access" from "no data because nothing exists"
- Reason not selected: Throwing an explicit authorization error is fail-closed and debuggable.

### Replace raw SQL with Prisma model queries

- Benefits: Automatic tenant filtering via the extension
- Costs: The high-load query uses aggregation and GROUP BY that may not be expressible in Prisma's query builder; refactoring to model queries could change query performance characteristics
- Reason not selected: Keep the raw SQL but add the explicit `organisationId` filter. A future refactoring pass can convert to model queries if desired.

## Consequences

### Positive

- GroupAccess is protected by the same deterministic where-clause injection as all other RLS-scoped tables
- No unscoped filter return paths remain in `resolveOrgFilterForMachine`
- Raw SQL in insights-overview is tenant-scoped
- All three gaps identified in the baseline audit are closed

### Negative

- GroupAccess migration requires backfill and downtime planning
- Code that creates GroupAccess rows must now provide `organisationId`
- `resolveOrgFilterForMachine` callers that relied on empty-filter returns need error handling

### Risks and mitigations

- Risk: Migration backfill is slow for large datasets. Mitigation: GroupAccess is typically small per organisation; backfill should be fast.
- Risk: Adding `organisationId` to GroupAccess creates a denormalised column that could drift from FootballGroup.organisationId. Mitigation: Application code always sources `organisationId` from the FootballGroup at creation time. A future invariant check can verify consistency.
- Risk: Throwing from `resolveOrgFilterForMachine` breaks callers that don't handle the error. Mitigation: Machine principal auth already validates principal existence; the throw only occurs on data inconsistency or IDOR attempts.

## Related records

- ADR-0035 (multitenancy architecture and product decisions)
- ADR-0057 (Prisma where-clause injection for tenant isolation)
- ADR-0056 (Football Group table RLS policies and missing RLS_TABLES entries)
- ARR-0050 (server actions lack explicit RLS tenant context — partially resolved)
- Consolidation programme specification (§38, §39, §42)

## History

### 2026-08-17

Record created. Phase 1 tenant isolation hardening based on baseline audit findings.

### 2026-08-17 (follow-up)

Extended Phase 1 hardening:
- All 6 insights library functions now use requireActorContext() with explicit organisationId filters (ARR-0011 resolution)
- Removed OrgFilterMode.unscoped type variant — no code path can return an unscoped filter
- Fixtures service and player-assignment service require org-scoped filters
- verifyRoundOrgAccess, verifyMatchOrgAccess, verifyLeagueSeasonOrgAccess always enforce org ownership checks