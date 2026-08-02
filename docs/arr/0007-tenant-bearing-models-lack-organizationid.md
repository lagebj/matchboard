# ARR-0007: Tenant-bearing models organizationId migration

## Status

Active — partially resolved

## Discovered

2026-07-30

## Last updated

2026-08-01

## Residue

All tenant-bearing Prisma models now have nullable `organizationId` columns added via migration `20260730140000`. However, `organizationId` is still nullable (NOT NULL constraint not yet applied). The null-allowing RLS policies remain active. Application-level filters (`organisationFilter()`) are the primary enforcement mechanism.

This ARR tracks the remaining work to make `organizationId` non-null and enforce composite unique constraints.

## Containment

- `organisationFilter()` and `resolveOrgFilterForUser()` provide application-level org scoping
- RLS policies exist on 53 tables but use null-allowing conditions during migration
- `resolveOrganisationAccess()` provides full org context with role and team delegation
- 136 files still use `requireCoachAccess()` without org context
- 115 files use `resolveOrgFilterForUser()` or `resolveOrganisationAccess()`

## Resolution criteria

- All 50 tenant-bearing models have a non-null `organizationId` column
- `Team.name` unique constraint is composite `@@unique([organizationId, name])`
- `Player.playerCode` unique constraint is scoped to `organizationId`
- `OpponentTeam.normalizedName` unique constraint is composite `@@unique([organizationId, normalizedName])` (already done)
- Every domain query, mutation, cache key, and export includes `organizationId`
- Zero unowned tenant rows after migration
- PostgreSQL RLS policies enforce hard tenant boundaries with null-rejecting conditions
- Application queries include `organizationId` even with RLS active

## Progress

- Nullable `organizationId` added to all 50+ tenant-bearing models (migration `20260730140000`)
- RLS policies created on 53 tables (migration `20260730160000`)
- Two database roles created (`matchboard_app`, `matchboard_admin`)
- `resolveOrganisationAccess()` and `orgFilterFromContext()` implemented
- `Team` and `OpponentTeam` composite unique constraints added
- NOT NULL constraint and null-rejecting RLS policies still pending

## Affected ADRs

- ADR-0035 (multitenancy architecture and product decisions)

## Related

- Data-ownership matrix: `docs/mt/mt0-data-ownership-matrix.md`
- ADR-0028 (security baseline and threat model)
- ADR-0032 (authentication, session and authorisation baseline)

---

# ARR-0008: requireCoachAccess() provides no role granularity or organisation context

## Status

Active — partially resolved

## Discovered

2026-07-30

## Last updated

2026-08-01

## Residue

`requireCoachAccess()` remains the primary auth gate for 136 files. `resolveOrganisationAccess()` provides full org context with role and team delegation but is only used in 115 org-scoped routes and actions. The transition from single-tenant email allowlist to org-scoped role-based auth is incomplete.

`resolveOrgFilterForUser()` can return `{type: "unscoped"}` when no membership exists — this is not fail-closed.

Per ADR-0035, the target model requires every protected operation to resolve through organisation membership.

## Containment

- `requireCoachAccess()` provides single-tenant access control (email allowlist)
- `resolveOrganisationAccess()` provides full org context for org-scoped routes
- `OrganisationAccessContext` includes role, team delegation, and permission checks
- Role enforcement helpers (`requireRole()`, `requireTeamAccess()`) exist but are not applied to most mutations

## Resolution criteria

- `requireOrganisationAccess()` replaces `requireCoachAccess()` for all protected routes
- User → OrganizationMembership → role resolution is mandatory
- COACH and VIEWER roles have explicit team delegation via TeamAccess
- OWNER and ADMIN roles have organisation-wide access
- Every mutation validates the user's role and permitted teams before executing
- `resolveOrgFilterForUser()` never returns `{type: "unscoped"}` for authenticated users with memberships

## Progress

- Organisation, Membership, Invitation, TeamAccess models implemented
- `OrganisationAccessContext` type with role and team delegation
- `resolveOrganisationAccess()`, `requireRole()`, `requireTeamAccess()` helpers
- Role permission logic in `organisation-domain.ts` (5 roles: OWNER, ADMIN, COACH, VIEWER, SUPPORT)
- Organisation lifecycle (suspend, reactivate, delete)
- Machine principal auth with scoped tokens
- Security assurance tests (SEC-3)
- 115 files migrated to org-scoped access
- 136 files still using `requireCoachAccess()`

## Affected ADRs

- ADR-0032 (authentication, session and authorisation baseline — deferred database-backed membership)
- ADR-0035 (multitenancy architecture and product decisions)

## Related

- `src/lib/auth.ts` — current auth implementation
- Threat model gaps G-03 (no resource-level authorisation) and G-04 (no role granularity)

---

# ARR-0009: Routes lack organisation-scoped path structure

## Status

Active — partially resolved

## Discovered

2026-07-30

## Last updated

2026-08-01

## Residue

Organisation detail and settings routes exist at `/o/{organisationSlug}/...` using `resolveOrganisationAccess()`. However, all main app routes (Assistant, Fixtures, Teams, Players, Rounds, Matches, Events, Insights, etc.) remain at flat paths under `src/app/(app)/` and use `requireCoachAccess()` + `resolveOrgFilterForUser()` for org scoping.

Per ADR-0035, the target route structure is `/o/{organisationSlug}/...` where every server request resolves through organisation membership.

## Containment

- Single-tenant deployment limits the impact
- Organisation listing at `/organisations` shows user's memberships
- `/o/{organisationSlug}/settings` provides org management
- `/invite/{token}` handles invitation acceptance
- Flat routes work because there is only one implicit organisation

## Resolution criteria

- All protected routes are under `/o/{organisationSlug}/...`
- Route params resolve organisation membership before data access
- Client-supplied organisation ID is never trusted as authority
- A remembered "last active organisation" is used for UX only
- Organisation switcher is available in sidebar/account area for multi-org users
- Legacy flat routes redirect to org-scoped equivalents

## Progress

- `/o/{organisationSlug}` — org detail page
- `/o/{organisationSlug}/settings` — org management
- `/organisations` — user's org listing
- `/invite/{token}` — invitation acceptance
- Main app routes (136 files) still use flat paths

## Affected ADRs

- ADR-0035 (multitenancy architecture and product decisions — MT-1.6)

## Related

- `src/app/(app)/` — current route structure
- Current navigation: Assistant, Fixtures, Teams, Players

---

# ARR-0010: Unique constraints will become composite with organizationId

## Status

Active — partially resolved

## Discovered

2026-07-30

## Last updated

2026-08-01

## Residue

Several Prisma models have global `@unique` constraints that must become composite `@@unique([organizationId, ...])` constraints. Some have already been converted; others remain global pending NOT NULL enforcement on `organizationId`.

## Progress

- `Team` composite unique `@@unique([organisationId, name])` added (migration `20260729120000`)
- `OpponentTeam` composite unique `@@unique([organisationId, normalizedName])` added
- `Player.playerCode` global unique still in place — pending organisationId NOT NULL
- `LeagueSeason.name` global unique still in place — pending organisationId NOT NULL
- Critical unique constraints added: `Selection_playerId_matchRoundId_draft_key`, `Availability_playerId_matchRoundId`, `RotationPath` composite keys (migration `20260729120000`)

## Resolution criteria

- All global unique constraints on tenant-bearing models are converted to composite unique constraints including `organizationId`
- The migration is idempotent and safe to rerun
- Existing data integrity is preserved through the migration

## Affected ADRs

- ADR-0035 (multitenancy architecture and product decisions — MT-2.7, MT-2.8)

## Related

- `prisma/schema.prisma` — current unique constraints
- Data-ownership matrix: `docs/mt/mt0-data-ownership-matrix.md`