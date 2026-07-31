# ADR-0035: Multitenancy architecture and product decisions (MT-0 through MT-4)

## Status

Accepted

## Date

2026-07-30

## Context

Matchboard operates as a single-tenant coach application. All 54 Prisma models lack `organizationId`. Authentication uses an email allowlist (`ALLOWED_COACH_EMAILS`) with a single COACH role. There is no organisation model, no membership, no role granularity, and no tenant isolation.

The security baseline (ADR-0028) and authentication baseline (ADR-0032) identified critical gaps: no resource-level authorisation (IDOR), no role granularity, and no tenant boundary. These gaps are addressed by the multitenancy programme MT-0 through MT-4.

The full multitenancy specification exists at `.matchboard-work/specifications/matchboard-multitenancy-spec.md`. This ADR records the binding product and architecture decisions that constrain implementation.

## Decision

### MT-0.1: Deployment model — shared-schema multi-tenancy, one database

One Neon PostgreSQL database. All organisations share the same schema. Tenant isolation is enforced by `organizationId` on every tenant-bearing row plus PostgreSQL Row-Level Security. No schema-per-tenant, no Neon branching per organisation.

### MT-0.2: Organisation scope — a club with multiple teams

An organisation represents a single football club that may have multiple teams (age groups, squads). A team is a delegation boundary within the organisation, not a tenant boundary. Cross-organisation team sharing is not supported.

### MT-0.3: Cross-organisation data isolation — fully isolated

Organisations are fully isolated. No data is shared across organisations. Opponents, formations, game formats, seasons, and events are organisation-scoped, not globally shared. System-provided immutable formation templates may exist globally, but organisations own their mutable instances.

### MT-1.4: Role granularity — four roles

| Role | Scope | Permissions |
|------|-------|-------------|
| OWNER | Organisation | All football data. Create/archive teams. Manage all memberships and roles including ADMIN. Transfer ownership. Delete organisation. Manage security-sensitive settings. |
| ADMIN | Organisation | All football data. Create/archive/configure teams. Assign teams to coaches/viewers. Invite/manage COACH and VIEWER memberships. Cannot transfer ownership, delete organisation, remove/change OWNER, or promote to ADMIN. |
| COACH | Delegated teams | Full football-operational access to explicitly delegated teams: players, matches, events, squads, selections, tactics, reports, observations. Cannot create organisation-level teams or manage organisation memberships. |
| VIEWER | Delegated teams | Read-only access to explicitly delegated teams. No mutation permissions. |

No additional roles at this stage. OWNER/ADMIN manage organisational structure. COACH manages football inside delegated teams. VIEWER observes.

### MT-1.5: Invitation model — global user, organisation membership

Conceptual model:

```
User → OrganizationMembership → Organization
                                ├── TeamAccess → Team
User → OrganizationMembership → Organization (separate org, separate role)
```

A user has a single global identity (Google OAuth email) with separate memberships per organisation. Each membership has a role. Each COACH/VIEWER membership has explicit team access grants.

Invitations are email-bound, expiring, single-use, revocable, and auditable. OWNER can invite any role. ADMIN can invite COACH and VIEWER. ADMIN creation/promotion is OWNER-only.

### MT-1.6: Active organisation context — organisation-scoped routes

Routes use organisation scope: `/o/{organisationSlug}/...`. Every server request resolves: authenticated user → requested organisation → membership → role → permitted teams → requested operation.

A remembered "last active organisation" may be used for UX navigation only. It must never be trusted as authorisation. Client-supplied organisation IDs are never authority.

### MT-2.7: Organisation ownership — all mutable football entities are organisation-scoped

All mutable football-domain entities are organisation-scoped:

- Players, Teams, Opponents, Formations, Seasons, Events, Matches, Reports, Selections, Observations, Statistics, Configuration

Players belong to exactly one organisation. Players may participate across multiple teams inside the same organisation via existing rotation/support functionality. Players cannot belong to multiple organisations. Same real-world person in two clubs = two independent Player records. No cross-tenant player identity linking.

Direct `organizationId` on tenant-bearing tables is preferred over indirect relationships (e.g. `Match → Team → Organisation`). The organisation is the hard tenant boundary. The team is a delegation boundary inside the organisation.

### MT-2.8: Existing data migration — automatic, idempotent, fail-closed

All current data belongs to one implicit organisation. Migration sequence:

1. Add Organisation, OrganizationMembership, OrganizationInvitation models
2. Add nullable `organizationId` to existing tenant tables
3. Create the initial organisation using `BOOTSTRAP_OWNER_EMAIL`, `BOOTSTRAP_ORGANIZATION_NAME`, `BOOTSTRAP_ORGANIZATION_SLUG` (fail if ambiguous)
4. Create the initial OWNER membership
5. Attach all existing tenant-domain data to the initial organisation
6. Verify zero unowned tenant rows
7. Verify zero invalid/cross-org relationships
8. Add required indexes, foreign keys, unique constraints
9. Make `organizationId` NOT NULL
10. Enable tenant-isolation mechanisms (application queries + RLS)

The migration must be safe to rerun and must not create duplicate organisations or memberships.

### MT-3.9: Repository and database isolation — application-level plus RLS

Both application-level tenant enforcement and PostgreSQL RLS. RLS is defence in depth, not a replacement for correct application queries.

Application layer: organisation membership, role permissions, team delegation, operation-specific authorisation.

Database RLS: hard organisation boundary. Prevent cross-tenant reads and writes.

Tenant-aware Prisma queries remain mandatory even with RLS:

```sql
-- Application query
WHERE organizationId = :authorisedOrganisation

-- PLUS RLS
-- row.organizationId must match current authorised organisation
```

Runtime DB identity must not own tenant tables or have BYPASSRLS. Migration/admin credentials are separate from runtime credentials. Tenant context uses transaction-local state (`set_config('app.current_organization_id', $1, true)`). No connection-global tenant state with pooled connections.

### MT-3.10: Export, cache and Assistant isolation — organisation-scoped

All exports, caches, and Assistant context are organisation-scoped. Cache keys include organisation identity first: `org:{organizationId}:team:{teamId}:...`. No backwards-compatible unscoped data path remains. Organisation must always be the hard boundary.

### MT-4.11: Automation scope — synthetic organisations only

Simulation, generation, and CI use synthetic organisations with synthetic data. No access to real tenant/customer data. CI uses an isolated test database with a synthetic organisation. Production-level smoke testing uses a dedicated synthetic organisation with a machine principal that can only access that organisation.

### MT-4.12: Machine authentication — short-lived tokens via token exchange

No general-purpose long-lived API keys. Machine authentication uses workload identity / OIDC credential → token exchange → short-lived access token (10-15 minute lifetime). Long-lived client credentials exist only as token-exchange credentials, stored hashed, scoped, rotatable, and revocable. They are never accepted directly by application APIs.

## Schema constraints that affect implementation

1. `Team.name` has a `@unique` constraint — must become `@@unique([organizationId, name])` after migration
2. `Player.playerCode` has a `@unique` constraint — must become scoped to `organizationId`
3. All 54 Prisma models lack `organizationId` — MT-2 adds nullable `organizationId`, then NOT NULL after validation
4. `User` model has no membership or role fields — MT-1 adds `OrganizationMembership` and `TeamAccess`
5. Auth.js `Session` model is retained for adapter compatibility but not actively used — MT-1 replaces session-based auth with database-backed membership
6. `LeagueSeason` and `Season` models are organisation-scoped — same real-world league name in two organisations means two independent records

## Consequences

- Every domain query, mutation, cache key, export, and audit event must include `organizationId`
- The `requireCoachAccess()` function evolves into `requireOrganisationAccess()` resolving user → membership → role → permitted teams
- Routes move from `/teams/...` to `/o/{organisationSlug}/teams/...`
- PostgreSQL RLS policies enforce hard tenant boundaries at the database level
- Application queries must always include `organizationId` even with RLS active
- The email allowlist (`ALLOWED_COACH_EMAILS`) transitions to invitation-based membership
- Existing data migrates into one initial organisation automatically
- The `Team` unique constraint on `name` becomes composite with `organizationId`
- Machine principals access only synthetic organisations with short-lived tokens
- This ADR supersedes the single-tenant assumptions in ADR-0032 (database-backed membership deferred to MT-1)

## Alternatives considered

- **Schema-per-tenant (Neon branching)**: Rejected — operational complexity, migration coordination across branches, cross-tenant analytics difficulty. Product decision MT-0.1 explicitly chose shared-schema.
- **Global shared entities (opponents, formations)**: Rejected — product decision MT-0.3 requires full isolation. System-provided immutable templates are the only exception.
- **Cross-tenant player identity linking**: Rejected — product decision MT-2.7 explicitly prohibits it.
- **Long-lived API keys**: Rejected — product decision MT-4.12 mandates short-lived tokens via exchange.
- **More granular roles**: Rejected — product decision MT-1.4 mandates four roles only at this stage.
- **Generic link-based invitations**: Rejected — product decision MT-1.5 mandates email-bound invitations.

## Related

- ADR-0028 (security baseline and threat model)
- ADR-0030 (application boundaries and domain ownership)
- ADR-0032 (authentication, session and authorisation baseline)
- ADR-0034 (preview deployment protection and forbidden SQL)
- Threat model: `docs/security/threat-model.md`
- ASVS matrix: `docs/security/asvs-matrix.md`
- Multitenancy specification: `.matchboard-work/specifications/matchboard-multitenancy-spec.md`
- Programme status: `.matchboard-work/state/programme-status.md`
- Source-of-truth register: `docs/domain/source-of-truth-register.md`