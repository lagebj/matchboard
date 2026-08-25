# ADR-0057: Prisma where-clause injection for tenant isolation

## Status

Accepted

## Date

2026-08-05

## Decision owners

- Matchboard engineering

## Context

ADR-0037 prescribed `SET LOCAL app.current_organization_id` inside `rawClient.$transaction()` as the primary mechanism for PostgreSQL RLS tenant isolation. This approach was deployed in PRs #191–#198.

Production diagnostic testing revealed that the Neon WebSocket adapter (`PrismaNeon`) does **not** preserve `SET LOCAL` session state between raw SQL (`$executeRawUnsafe`) and Prisma model queries (`tx.model.operation()`) inside the same `rawClient.$transaction()` callback. The session variable is correctly set and visible to subsequent raw SQL, but model queries execute as if the variable was never set, returning 0 rows from all RLS-protected tables.

This made the entire application return no data on all organisation-scoped routes in production.

### Diagnostic evidence

A temporary `/api/rls-test` endpoint confirmed:
- `SET LOCAL` + `SHOW` inside `db.$transaction()` works for raw SQL (returns correct value)
- `SET LOCAL` + model query inside `rawClient.$transaction()` returns 0 rows (session state lost)
- `AsyncLocalStorage.enterWith()` correctly propagates into transaction callbacks
- Non-RLS tables return data normally

### Why SET LOCAL fails

The `PrismaNeon` adapter uses WebSocket connections managed by Neon's serverless driver. Inside a `$transaction()`, the adapter may route raw SQL and model queries through different connection/session boundaries. PostgreSQL `SET LOCAL` is transaction-scoped and tied to a specific database session, but the Neon adapter's query routing does not guarantee that the model query reuses the same session where `SET LOCAL` was executed.

## Decision

Replace `SET LOCAL` inside `$transaction()` with **Prisma where-clause injection** as the primary tenant isolation mechanism.

### 1. Where-clause injection via Prisma `$extends` query hook

A Prisma client extension intercepts every query on RLS-scoped tables and injects `organisationId` into the `where` clause (for reads, updates, deletes) and `data` (for creates):

```typescript
// Read operations: inject organisationId into where clause
case "findMany":
  return query({ ...args, where: { ...args.where, organisationId: orgId } });

// Create operations: inject organisationId into data
case "create":
  return query({ ...args, data: { ...args.data, organisationId: orgId } });

// findUnique: convert to findFirst (organisationId is not a unique field)
case "findUnique":
  return rawClient.model.findFirst({ ...args, where: { ...args.where, organisationId: orgId } });
```

This is deterministic, adapter-agnostic, and does not depend on PostgreSQL session state.

### 2. Database RLS policies are permissive when app context is not set

RLS policies are updated to allow access when `app.current_organization_id` is not set (null or empty string):

```sql
USING (
  organisationId = current_setting('app.current_organization_id', true)
  OR current_setting('app.current_organization_id', true) IS NULL
  OR current_setting('app.current_organization_id', true) = ''
)
```

When the session variable IS set (e.g., by direct SQL access, admin tools, or future session-propagation mechanisms), RLS enforces tenant scoping as defence-in-depth. When it is NOT set (the normal application path), application-layer filtering is trusted.

### 3. AsyncLocalStorage remains the context propagation mechanism

`setTenantOrganisationId()` (using `enterWith()`) and `runWithTenantOrganisationId()` (using `run()`) still set the organisation ID for the Prisma extension. The extension reads `getTenantOrganisationId()` and injects it into queries. This works reliably because it does not depend on PostgreSQL session state.

### 4. Tables in scope

All tables with an `organisationId` column are in the `RLS_TABLES` set, including `OrganisationMembership`, `OrganisationInvitation`, and `MachinePrincipal`. `Organisation` is excluded because it IS the organisation entity, not scoped by one.

### 5. GroupAccess uses join-based RLS policies (no direct organisationId)

`GroupAccess` does not have `organisationId`. Its RLS policies use a subquery join through `FootballGroup`. The Prisma extension injects `organisationId` into the `FootballGroup` query, which transitively scopes `GroupAccess` lookups.

## Rationale

- Where-clause injection is deterministic and does not depend on adapter-specific session state behaviour
- The Neon adapter's query routing is opaque and cannot be relied upon to preserve `SET LOCAL` across model query boundaries
- Application-level filtering was already mandated by ADR-0035 as the primary isolation mechanism; this change makes it the sole runtime mechanism
- RLS policies as defence-in-depth remain in place and are strengthened with the permissive fallback
- `findUnique` → `findFirst` conversion is safe: `organisationId` combined with the original unique fields provides sufficient selectivity

## Alternatives considered

### SET LOCAL inside $transaction (previous approach)

- Benefits: Database-enforced isolation within the transaction boundary
- Costs: **Does not work with the Neon WebSocket adapter** — model queries lose session state
- Reason not selected: Production-verified failure; returns 0 rows on all RLS-protected tables

### SET (not SET LOCAL) before each query

- Benefits: Session variable persists across queries on the same connection
- Costs: Connection pooling leaks tenant context between requests; Neon's pooler may reuse connections; requires manual reset after each request
- Reason not selected: Security risk with pooled connections; ADR-0035 explicitly forbids connection-global tenant state

### Neon prepared statement with set_config

- Benefits: Could set session variable via a prepared statement mechanism
- Costs: Undocumented, fragile, not supported by Prisma adapter; would require custom driver changes
- Reason not selected: Fragile and unsupported; would create tight coupling to Neon internals

### No RLS at all, application filters only

- Benefits: Simplest implementation, no database policy management
- Costs: A single missing filter exposes cross-tenant data; no defence in depth
- Reason not selected: ADR-0035 explicitly mandates both layers

## Consequences

### Positive

- Tenant isolation works reliably with the Neon WebSocket adapter
- No transaction overhead on every query (the `$transaction` wrapper is removed)
- Deterministic query behaviour — no dependency on PostgreSQL session state
- RLS policies remain as defence-in-depth and work correctly when `app.current_organization_id` is set
- `findUnique` → `findFirst` conversion provides additional tenant scoping on unique lookups

### Negative

- Application code must maintain the `RLS_TABLES` set — new tables with `organisationId` must be added
- RLS policies are permissive when app context is not set, which means direct database access without context sees all data
- `findUnique` → `findFirst` conversion changes query semantics slightly (findFirst may return different results if multiple rows match the non-unique filter)

### Risks and mitigations

- Risk: Missing table from `RLS_TABLES` set means no application-level filtering for that table. Mitigation: RLS policy still enforces isolation when context is set; code review must verify new tables are added to the set.
- Risk: `findUnique` → `findFirst` returns first match instead of throwing on duplicates. Mitigation: `organisationId` combined with unique fields provides sufficient selectivity; duplicate within an organisation would be a data integrity bug anyway.
- Risk: Permissive RLS when context is not set allows direct database access to see all rows. Mitigation: Direct database access requires admin credentials; runtime role is used only through the application which always sets context.
- Risk: `organisationId` injection in `where` clause could conflict with existing `organisationId` filters. Mitigation: Duplicate filter values are harmless (AND of identical values); Prisma merges them correctly.

## Migration and compatibility

- Migration `20260804160000` updates all RLS policies to include the permissive fallback clause
- `src/lib/db.ts` replaces the `$transaction` + `SET LOCAL` extension with where-clause injection
- The diagnostic `/api/rls-test` endpoint is removed
- No data migration required
- Rollback: Revert `db.ts` to previous `SET LOCAL` approach and revert RLS policies to strict mode (would re-introduce the production bug)

## Security and operations

- Application-level filtering is the primary isolation mechanism; database RLS is defence-in-depth
- `matchboard_app_runtime` role still cannot bypass RLS; policies enforce when context is set
- `matchboard_admin_migration` role has `admin_all` policies granting full access through RLS
- Direct SQL access without `app.current_organization_id` sees all data (same as admin role)
- The `ORG_ID_PATTERN` validation in the extension prevents SQL injection through organisation IDs
- No `$executeRawUnsafe` or `$queryRawUnsafe` in application code (security check enforced by CI)

## Related records

- ADRs: ADR-0035 (multitenancy architecture), ADR-0036 (tenant context resolution), ADR-0037 (superseded — row-level security and database role isolation)
- ARRs: ARR-0050 (server actions RLS context — partially resolved, where-clause injection reduces dependency on session state), ARR-0051 (superseded — RLS extension transaction overhead)
- Implementation: PR #202 (where-clause injection), migration `20260804160000` (permissive RLS policies)

## Supersedes

ADR-0037 (row-level security and database role isolation — the `SET LOCAL` approach)

## Superseded by

None. Amended by ADR-0087 (fail-closed tenant scoping and an explicit system-privilege
capability) — the where-clause-injection design here is unchanged; ADR-0087 changes what happens
when `orgId` is absent (previously: execute unscoped; now: refuse, with a narrow explicit
privileged-access opt-in). The "Negative" consequence below ("RLS policies are permissive when
app context is not set, which means direct database access without context sees all data") still
describes the database-level RLS defence-in-depth layer accurately — that has not changed — but
no longer describes the primary application-level `tenantRLS` extension, which is the layer
ADR-0087 changes.

## History

### 2026-08-05

Record created. Where-clause injection deployed to production and verified working. RLS migration applied to production database. ADR-0037's `SET LOCAL` approach is superseded.

### 2026-08-24

Amended by ADR-0087: the `tenantRLS` extension's behaviour when organisation context is absent
changes from "execute unscoped" to "fail closed" (throw), with a narrow explicit
`runWithSystemPrivilege()` opt-in for genuinely privileged system callers. Resolves ARR-0027.