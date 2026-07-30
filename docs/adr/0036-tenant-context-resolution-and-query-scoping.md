# ADR-0036: Tenant context resolution and query scoping

## Status

Proposed

## Date

2026-07-30

## Decision owners

- Matchboard engineering

## Context

ADR-0035 established that all mutable football-domain entities are organisation-scoped. ADR-0035 decision MT-1.6 mandates organisation-scoped routes `/o/{orgSlug}/...` and specifies that client-supplied org IDs are never authority.

MT-1 created the Organisation, OrganisationMembership, OrganisationInvitation, TeamAccess, and MachinePrincipal models. MT-1 also created the organisation resolver (`resolveOrganisationAccess`) which authenticates and authorises coaches against an organisation slug.

MT-2 adds `organisationId` to the remaining 50 tenant-bearing models. Every server action and API route that reads or writes protected data must resolve the authenticated user's organisation context before accessing tenant-bearing data.

The resolver pattern from MT-1 (`resolveOrganisationAccess` → `OrganisationAccessContext`) needs a lightweight wrapper for query scoping. The tenant context module provides filter helpers that wrap the organisation ID into Prisma-compatible where clauses.

## Decision

1. **Tenant context module** (`src/lib/tenancy/tenant-context.ts`): Provides `getOrganisationContext(slug)`, `requireOrganisationId(ctx)`, `organisationFilter(id)`, and `organisationFilterNullable(id)`. These are the canonical way to scope Prisma queries to an organisation.

2. **No `$executeRawUnsafe` or raw SQL for tenant context**: The `SET LOCAL app.current_organisation_id` approach for PostgreSQL RLS (per ADR-0035 MT-3.9) is deferred to MT-3. MT-2 uses application-level query filters via Prisma `where` clauses.

3. **Route-level resolution**: Server actions resolve the organisation slug from the route parameter (`/o/{orgSlug}/...`) or from the request context. The organisation slug is never trusted from client-supplied form data or headers.

4. **Nullable `organisationId` during migration**: All new `organisationId` columns are added as nullable. Existing data is migrated in a separate data migration step. The column becomes `NOT NULL` only after all existing rows have been assigned an organisation.

5. **Composite unique constraints**: Per ADR-0035, `Team.name`, `Player.playerCode`, `OpponentTeam.normalizedName`, and `LeagueSeason.name` unique constraints become composite with `organisationId`. These are added alongside the existing single-column constraints to avoid breaking existing data.

## Rationale

- Application-level query filters are simpler than PostgreSQL RLS and work with any database backend. RLS is deferred to MT-3 as a defence-in-depth layer.
- Nullable `organisationId` allows incremental migration without breaking existing queries that don't yet filter by organisation.
- The tenant context module is a thin wrapper that keeps organisation scoping explicit and auditable.

## Alternatives considered

### PostgreSQL RLS immediately (MT-3 brought forward)

- Benefits: Stronger isolation guarantee at the database level
- Costs: Requires Neon-specific setup, transaction-local `set_config`, complex testing, and blocks development velocity
- Reason not selected: ADR-0035 explicitly sequences RLS as MT-3, after application-level enforcement is in place

### Global middleware that auto-injects organisationId

- Benefits: No manual filter calls needed
- Costs: Hidden magic, harder to audit, impossible to reason about without reading middleware code
- Reason not selected: ADR-0035 mandates "One business operation, one owning implementation, multiple adapters." Explicit filters per query are auditable and follow the principle.

## Consequences

### Positive

- Every query can be scoped to an organisation with a single `where` clause addition
- The tenant context module is testable without database dependencies
- Incremental migration allows existing queries to continue working while `organisationId` is nullable

### Negative

- Every new server action must remember to include the organisation filter
- Nullable `organisationId` means some queries might return cross-organisation data if the filter is forgotten

### Risks and mitigations

- Risk: Queries without organisation filter leak cross-tenant data. Mitigation: Code review checklist, and MT-3 RLS as defence in depth.
- Risk: Nullable `organisationId` allows null rows that bypass filters. Mitigation: Data migration assigns all existing rows to the bootstrap organisation; `NOT NULL` constraint added after migration.

## Migration and compatibility

- Phase 1 (MT-2): Add nullable `organisationId` to all 50 tenant-bearing models. Add composite unique constraints.
- Phase 2 (data migration): Assign all existing rows to the bootstrap organisation.
- Phase 3: Make `organisationId` `NOT NULL` on all tenant-bearing models.
- Phase 4 (MT-3): Add PostgreSQL RLS policies as defence in depth.

## Security and operations

- Organisation context is resolved server-side from the authenticated coach's membership, never from client-supplied data.
- Per ADR-0035: "Authorisation is server-side and deny-by-default."
- All server actions that read or write protected data must call `requireCoachAccess()` and resolve organisation context before querying.

## Related records

- ADRs: ADR-0035 (multitenancy architecture and product decisions)
- ARRs: ARR-0007 (tenant-bearing models lack organizationId), ARR-0008 (no role granularity), ARR-0009 (no org-scoped routes), ARR-0010 (unique constraints will become composite)
- Security findings: None new
- Issues or plans: MT-2 implementation plan

## Implementation evidence

- Pull requests or commits: `2b39c58`, `d3a366e`, `8fcd035`, `1f65daa`, `0951676`
- Tests or verification: 46 organisation domain tests, 3 tenant context tests, 63 total organisation+security tests passing
- Provider evidence: None required

## Supersedes

None.

## Superseded by

None.

## History

### 2026-07-30

Record created.