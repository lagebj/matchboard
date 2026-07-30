# ARR-0007: All 50 tenant-bearing models lack organizationId

## Status

Active

## Discovered

2026-07-30

## Residue

All 50 tenant-bearing Prisma models (football-domain data) lack the `organizationId` column required for multi-organisation isolation. Per the data-ownership matrix in `docs/mt/mt0-data-ownership-matrix.md`, every football-domain model needs direct `organizationId` rather than relying on indirect relationships (e.g. `Match → Team → Organisation`).

This is the foundational structural mismatch that MT-2 (tenant ownership across the domain) will resolve.

## Containment

Until MT-2 is implemented:
- `requireCoachAccess()` provides single-tenant access control (email allowlist)
- No cross-organisation data can exist because there is only one implicit organisation
- The email allowlist is checked on every request via middleware
- Preview deployment API routes are restricted to `PREVIEW_ALLOWLIST_EMAILS`

## Resolution criteria

- All 50 tenant-bearing models have a non-null `organizationId` column
- `Team.name` unique constraint is composite `@@unique([organizationId, name])`
- `Player.playerCode` unique constraint is scoped to `organizationId`
- Every domain query, mutation, cache key, and export includes `organizationId`
- Zero unowned tenant rows after migration
- PostgreSQL RLS policies enforce hard tenant boundaries
- Application queries include `organizationId` even with RLS active

## Affected ADRs

- ADR-0035 (multitenancy architecture and product decisions)

## Related

- Data-ownership matrix: `docs/mt/mt0-data-ownership-matrix.md`
- ADR-0028 (security baseline and threat model)
- ADR-0032 (authentication, session and authorisation baseline)

---

# ARR-0008: requireCoachAccess() provides no role granularity or organisation context

## Status

Active

## Discovered

2026-07-30

## Residue

The current `requireCoachAccess()` function in `src/lib/auth.ts` returns a single coach object with no role, no organisation context, and no team delegation. Every server action treats the authenticated user identically — as a full-access coach.

Per ADR-0035, the target model has four roles (OWNER, ADMIN, COACH, VIEWER) with organisation membership and team-level delegation. Until MT-1 is implemented, there is no database-backed membership, no role differentiation, and no team access scoping.

## Containment

- `requireCoachAccess()` is the single authorisation gate for all protected operations
- The middleware allowlist provides edge-level access control
- Preview deployment API routes are restricted to `PREVIEW_ALLOWLIST_EMAILS`
- No resource-level authorisation (IDOR) protection exists — acknowledged gap in threat model (G-03, G-04)

## Resolution criteria

- `requireOrganisationAccess()` replaces `requireCoachAccess()` for all protected routes
- User → OrganizationMembership → role resolution is mandatory
- COACH and VIEWER roles have explicit team delegation via TeamAccess
- OWNER and ADMIN roles have organisation-wide access
- Every mutation validates the user's role and permitted teams before executing

## Affected ADRs

- ADR-0032 (authentication, session and authorisation baseline — deferred database-backed membership)
- ADR-0035 (multitenancy architecture and product decisions)

## Related

- `src/lib/auth.ts` — current auth implementation
- Threat model gaps G-03 (no resource-level authorisation) and G-04 (no role granularity)

---

# ARR-0009: Routes lack organisation-scoped path structure

## Status

Active

## Discovered

2026-07-30

## Residue

All Matchboard routes use flat paths (`/teams`, `/players`, `/matches`, `/rounds`) without organisation context. Per ADR-0035, the target route structure is `/o/{organisationSlug}/...` where every server request resolves: authenticated user → requested organisation → membership → role → permitted teams → operation.

The current flat structure assumes single-tenant access. Adding organisation context requires restructuring the entire route hierarchy and every server action that reads or writes tenant-bearing data.

## Containment

- Single-tenant deployment limits the impact to one implicit organisation
- The email allowlist provides a single-tenant access boundary
- No production deployment serves multiple organisations yet

## Resolution criteria

- All protected routes are under `/o/{organisationSlug}/...`
- Route params resolve organisation membership before data access
- Client-supplied organisation ID is never trusted as authority
- A remembered "last active organisation" is used for UX only
- Organisation switcher is available in sidebar/account area for multi-org users

## Affected ADRs

- ADR-0035 (multitenancy architecture and product decisions — MT-1.6)

## Related

- `src/app/(app)/` — current route structure
- Current navigation: Assistant, Fixtures, Teams, Players

---

# ARR-0010: Unique constraints will become composite with organizationId

## Status

Active

## Discovered

2026-07-30

## Residue

Several Prisma models have global `@unique` constraints that must become composite `@@unique([organizationId, ...])` constraints when `organizationId` is added. The most significant:

1. `Team.name` — currently globally unique, must become `@@unique([organizationId, name])`
2. `Player.playerCode` — currently globally unique, must become scoped to `organizationId`
3. `OpponentTeam.name` — likely needs `@@unique([organizationId, name])`
4. `LeagueSeason.name` — likely needs `@@unique([organizationId, name])`

These constraints will require migration steps: add nullable `organizationId`, populate all rows, add composite unique, remove global unique, make `organizationId` NOT NULL.

## Containment

- Single-tenant deployment means these global unique constraints currently work correctly
- No cross-organisation data can violate the future composite constraints yet

## Resolution criteria

- All global unique constraints on tenant-bearing models are converted to composite unique constraints including `organizationId`
- The migration is idempotent and safe to rerun
- Existing data integrity is preserved through the migration

## Affected ADRs

- ADR-0035 (multitenancy architecture and product decisions — MT-2.7, MT-2.8)

## Related

- `prisma/schema.prisma` — current unique constraints
- Data-ownership matrix: `docs/mt/mt0-data-ownership-matrix.md`