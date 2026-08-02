# ADR-0037: Row-level security and database role isolation

## Status

Accepted — implementation in progress

## Date

2026-07-30

## Decision owners

- Matchboard engineering

## Context

ADR-0035 established that Matchboard uses shared-schema multi-tenancy with application-level tenant enforcement plus PostgreSQL RLS as defence in depth. ADR-0036 implemented application-level query filters via Prisma `where` clauses. MT-2 is complete: all 53 tenant-bearing models have nullable `organisationId`, all server actions and API routes resolve org context and scope queries, and production migrations are deployed.

MT-3 adds PostgreSQL RLS policies as a defence-in-depth layer. Even with correct application-level filtering, a bug or missing filter in any query could expose cross-tenant data. RLS prevents this at the database level.

Key constraints:
- Neon PostgreSQL with connection pooling (pooled `DATABASE_URL`, direct `DIRECT_URL`)
- Prisma 7.9 with `@prisma/adapter-neon` for pooled connections and `@prisma/adapter-pg` for direct/local
- Prisma does not natively support RLS context injection; we must use `$executeRaw` within transactions
- Neon's pooled connection router may not maintain session state across queries; transaction-scoped `SET LOCAL` is required
- The application runtime role must not have `BYPASSRLS` and must not own tenant tables
- Migration/admin operations need a separate role with elevated privileges

## Decision

### 1. Two database roles: `matchboard_app` (runtime) and `matchbook_admin` (migration)

- `matchboard_admin` owns all tables, can run migrations, has `BYPASSRLS` for maintenance. Used only by `prisma migrate deploy` and operational scripts.
- `matchboard_app` is the runtime role used by the Next.js application. It has `SELECT`, `INSERT`, `UPDATE`, `DELETE` on tenant-bearing tables and full access to non-tenant tables. It does NOT have `BYPASSRLS`. It does NOT own any tables.
- `DIRECT_URL` uses `matchboard_admin` for Prisma migrations.
- `DATABASE_URL` uses `matchboard_app` for application queries (via Neon pooler).

### 2. RLS policies enforce `organisationId = current_setting('app.current_organization_id')` on all 53 tenant-bearing models

Every tenant-bearing table gets:
- `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
- A read policy: `USING (organisationId = current_setting('app.current_organization_id', true))`
- A write policy: `WITH CHECK (organisationId = current_setting('app.current_organization_id', true))`
- An admin bypass: policy for `matchboard_admin` role that allows all operations

Non-tenant tables (Organisation, User, Account, Session, VerificationToken) do NOT have RLS policies. They are accessed through application-level authorization only. TeamAccess is also not RLS-protected because it bridges org membership to teams and is always scoped through org membership checks.

### 3. Transaction-local tenant context via Prisma `$executeRaw`

The application sets tenant context inside each Prisma transaction:

```typescript
await db.$transaction(async (tx) => {
  await tx.$executeRaw`SET LOCAL app.current_organization_id = ${organisationId}`;
  // ... tenant-scoped queries within the transaction
});
```

`SET LOCAL` ensures the context is scoped to the current transaction and resets automatically when the transaction completes. This prevents connection-pooling state leaks.

### 4. Tenant-scoped Prisma client extension

A Prisma client extension (`src/lib/tenancy/tenant-client.ts`) wraps the standard Prisma client to:
1. Accept an `organisationId` parameter
2. Begin a transaction with `SET LOCAL app.current_organization_id`
3. Expose the transaction client for all operations
4. Handle read-only operations that don't need a transaction (use `$queryRaw` to set context first)

This replaces direct `db` imports in tenant-scoped code with `createTenantDb(organisationId)` or `db.withTenant(organisationId)`.

### 5. Non-transactional reads also need tenant context

For operations that use `db.findMany()` without a transaction wrapper (common in read-only pages), we use a Prisma client extension that injects `SET LOCAL` via `$queryRaw` before the actual query, wrapped in a `$transaction`:

```typescript
async function withTenantContext<T>(orgId: string, fn: (tx: PrismaTransaction) => Promise<T>): Promise<T> {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SET LOCAL app.current_organization_id = ${orgId}`;
    return fn(tx);
  });
}
```

All tenant-scoped reads go through this wrapper.

### 6. RLS is defence in depth, not a replacement for application-level filters

Per ADR-0035 MT-3.9: application queries MUST always include `organisationId` in `where` clauses. RLS is an additional layer. If both layers are working, queries are doubly safe. If one layer has a bug, the other prevents data leakage.

### 7. RLS policy naming convention

Policies are named:
- `{table}_tenant_read` — SELECT policy for `matchboard_app`
- `{table}_tenant_write` — INSERT/UPDATE/DELETE policy for `matchboard_app`
- `{table}_admin_all` — ALL policy for `matchboard_admin`

### 8. Null `organisationId` handling during migration

Until all rows have `organisationId` set and the column is `NOT NULL`:
- RLS policies use `organisationId = current_setting('app.current_organization_id', true)` which will NOT match null values
- An additional policy allows null `organisationId` reads temporarily: `USING (organisationId IS NULL AND current_setting('app.current_organization_id', true) = '')`
- This temporary null-allowing policy is removed once all columns are `NOT NULL`
- Application-level filters already handle null values via `organisationFilterNullable()`

### 9. Organisation-scoped cache keys

All cache keys, export filenames, and cache namespaces are prefixed with `org:{organisationId}:`. No unscoped cache path remains for tenant-bearing data.

## Rationale

- Two-role separation ensures the runtime application cannot bypass RLS even if a code bug tries to
- `SET LOCAL` inside transactions is the only safe way to set PostgreSQL session state with Neon's pooled connections
- Prisma client extension provides a clean API that doesn't require every call site to remember `SET LOCAL`
- Application-level filters plus RLS provides defence in depth per ADR-0035
- Null-handling policy ensures existing data with null `organisationId` remains accessible during migration

## Alternatives considered

### Single database role with RLS bypass for migrations

- Benefits: Simpler setup, fewer credentials to manage
- Costs: Risk of accidental RLS bypass in application code; migration scripts could silently skip tenant checks
- Reason not selected: ADR-0035 explicitly requires separate runtime and admin credentials

### Connection-global `SET` instead of `SET LOCAL`

- Benefits: Simpler — no transaction wrapper needed
- Costs: Connection pooling leaks tenant context between requests; Neon's pooler may reuse connections for different organisations
- Reason not selected: Security risk with pooled connections; ADR-0035 explicitly forbids connection-global tenant state

### Prisma middleware instead of client extension

- Benefits: Middleware runs before every query
- Costs: Prisma 7 deprecates middleware in favour of extensions; middleware cannot set transaction-local state outside transactions
- Reason not selected: Client extensions are the supported Prisma 7 approach and integrate with `$transaction`

### Application-level filters only (no RLS)

- Benefits: No database role management, no RLS policies, simpler deployment
- Costs: A single missing filter exposes cross-tenant data; no defence in depth
- Reason not selected: ADR-0035 explicitly mandates both layers

### View-based isolation (one view per organisation)

- Benefits: Stronger isolation, simpler RLS policies
- Costs: View explosion with many organisations; complex migration; Prisma doesn't natively support views
- Reason not selected: Over-engineering for current scale; RLS policies on base tables are sufficient

## Consequences

### Positive

- Cross-tenant data leakage is prevented at the database level even if application code has a bug
- Separate runtime/admin roles limit the blast radius of compromised credentials
- Defence in depth: two independent isolation mechanisms
- `SET LOCAL` prevents connection-pooling state leaks
- Prisma client extension provides a clean, auditable API

### Negative

- Every tenant-scoped operation must go through a transaction wrapper (performance overhead)
- RLS policies add maintenance burden when new tables are added
- Two database roles require separate Neon credentials and connection strings
- Debugging RLS issues requires database-level inspection

### Risks and mitigations

- Risk: Performance overhead from transaction wrapper on every read. Mitigation: Neon's HTTP-based pooling already uses transactions for most operations; overhead is minimal for typical page loads.
- Risk: Forgotten RLS policy on new table. Mitigation: Migration checklist requires RLS policies for every new tenant-bearing model; tests verify RLS enforcement.
- Risk: `SET LOCAL` context lost if Neon pooler reassigns connection mid-transaction. Mitigation: `SET LOCAL` is transaction-scoped by PostgreSQL semantics; the pooler cannot break this within a transaction.
- Risk: Null `organisationId` rows bypass RLS during migration. Mitigation: Temporary null-allowing policy is removed once `NOT NULL` constraint is applied; application filters also handle nulls.

## Migration and compatibility

### Phase 1: Create roles and enable RLS (this stage)

1. Create `matchboard_app` and `matchboard_admin` roles in Neon
2. Grant appropriate permissions
3. Create RLS policies on all 53 tenant-bearing tables
4. Create migration SQL
5. Update `.env` configuration: `DATABASE_URL` uses `matchboard_app`, `DIRECT_URL` uses `matchboard_admin`
6. Implement tenant client extension in application code
7. Write isolation tests that verify cross-tenant read/write rejection

### Phase 2: Application code migration (subsequent)

1. Update all server actions to use tenant client for tenant-bearing operations
2. Update all API routes to use tenant client
3. Remove temporary null-allowing RLS policy once all rows have `organisationId`

### Phase 3: NOT NULL constraints (after data migration)

1. Make `organisationId` NOT NULL on all tenant-bearing tables
2. Remove null-allowing RLS policy
3. Add foreign key constraints from `organisationId` to `Organisation.id`

### Rollback

- RLS policies can be disabled per table: `ALTER TABLE ... DISABLE ROW LEVEL SECURITY`
- Application continues to work with application-level filters even with RLS disabled
- Role separation can be reverted by granting `matchboard_app` the same permissions as `matchboard_admin`

## Security and operations

- `matchboard_admin` credentials are stored in `DIRECT_URL` environment variable, used only by `prisma migrate deploy`
- `matchboard_app` credentials are stored in `DATABASE_URL`, used by the Next.js application at runtime
- Neon connection pooling is safe because `SET LOCAL` is transaction-scoped
- RLS failures produce standard PostgreSQL permission errors that should be logged and monitored
- The tenant client extension validates `organisationId` format before setting context
- Cross-tenant access attempts should produce security telemetry

## Related records

- ADRs: ADR-0035 (multitenancy architecture), ADR-0036 (tenant context resolution and query scoping)
- ARRs: ARR-0007 (tenant-bearing models lack organisationId — addressed in MT-2), ARR-0008 (no role granularity — addressed in MT-1), ARR-0009 (no org-scoped routes — partially addressed in MT-2), ARR-0010 (unique constraints will become composite — addressed in MT-2)
- Security findings: None new
- Issues or plans: MT-3 implementation plan

## Implementation evidence

- Pull requests or commits: (pending)
- Tests or verification: (pending)
- Provider evidence: (pending — Neon role creation)

## Supersedes

None.

## Superseded by

None.

## History

### 2026-07-30

Record created.