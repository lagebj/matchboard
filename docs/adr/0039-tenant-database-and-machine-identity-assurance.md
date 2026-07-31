# ADR-0039: Tenant, Database and Machine-Identity Assurance

## Status

Accepted

## Context

SEC-3 requires verification that the multitenancy and machine-identity foundation (MT-0 through MT-4) provides effective data isolation and containment. This includes:

1. Tenant ownership and RLS
2. Database-role separation
3. Pooled-connection tenant context behaviour
4. Machine-principal containment
5. Cache, job and export isolation
6. Tenant and machine negative test coverage

## Decision

### Application-level isolation is the primary boundary, RLS is defence in depth

Application-level Prisma `where` clauses (via `organisationFilter` and `orgFilterFromContext`) are the mandatory primary boundary. PostgreSQL RLS (`SET LOCAL app.current_organization_id`) provides defence in depth when the `matchboard_app` role is in use.

The `SET LOCAL` mechanism only takes effect inside explicit transactions (`db.$transaction`) and only restricts queries when RLS policies are enforced (i.e., the `matchboard_app` role is active). In local development with the default connection role (which has BYPASSRLS), `SET LOCAL` is a no-op for data filtering. This is by design: development convenience, production safety.

### Machine principals are strictly tenant-bound

- A machine principal's `organisationId` is set at creation and cannot be changed.
- Token exchange returns a JWT bound to the principal's `organisationId`.
- `resolveOrgFilterForMachine` returns `unscoped` when the principal's `organisationId` does not match the requested `organisationId`.
- Forbidden scopes (`organisation:admin`, `user:impersonate`, `data:read:cross-tenant`, etc.) cannot be assigned at creation and are rejected at token exchange.
- Revoked principals immediately lose all access (kill switch).

### Synthetic organisations are isolated at the data layer

- The `isSynthetic` flag is a data attribute, not an access control bypass.
- Synthetic organisation data is scoped by `organisationId` like any other organisation.
- Machine principals bound to a synthetic organisation cannot resolve org filters for non-synthetic organisations.

### Export paths are org-scoped

- Season export (`/api/season/export`) and event export (`/events/[eventId]/export`) both use `resolveOrgFilterForUser` to scope data.
- No export path returns cross-tenant data.

### No application-level caching exists

- Matchboard has no in-memory cache layer for domain data. All queries go through Prisma with org-scoped `where` clauses.
- This eliminates cache cross-tenant leakage as a concern at the application level.

## Consequences

- 31 SEC-3 assurance tests cover: machine-principal tenant containment, token-org binding, revoked-principal kill switch, scope boundary enforcement, cross-tenant attack prevention, org ID validation, synthetic org isolation, and export data isolation.
- RLS enforcement requires the `matchboard_app` role to be configured in Neon (external provider action).
- NOT NULL constraints on `organisationId` are deferred until real production data exists.
- No cache isolation work is needed because there is no application-level cache.

## Security findings

- None new. The multitenancy and machine-identity foundation provides effective isolation through application-level filters, with RLS as defence in depth.
- The `SET LOCAL` mechanism is correct for transaction-scoped tenant context but does not restrict data access in local development (where the connection role has BYPASSRLS). This is acceptable per ADR-0037.

## References

- ADR-0036: Tenant context resolution and query scoping
- ADR-0037: Row-level security and database role isolation
- ADR-0038: Machine identity and synthetic production tenant
- `src/test/sec3-assurance.test.ts`: 31 assurance tests
- `src/lib/tenancy/tenant-client.ts`: `SET LOCAL` tenant context
- `src/lib/tenancy/resolve-org-filter.ts`: Machine and user org filter resolution
- `src/lib/machine-principal/machine-auth.ts`: Bearer token authentication with scope and org verification