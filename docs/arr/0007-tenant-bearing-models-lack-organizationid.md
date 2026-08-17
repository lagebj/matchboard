# ARR-0007: Tenant-bearing models organizationId migration

## Status

Resolved

## Discovered

2026-07-30

## Last updated

2026-08-17

## Residue

All tenant-bearing Prisma models now have non-null `organisationId` columns (migration `20260803160000`). Composite unique constraints are in place. RLS policies use null-rejecting conditions. Application-level org scoping uses `requireActorContext()` with fail-closed `OrgFilterMode`.

## Resolution

- Nullable `organisationId` added to all 50+ tenant-bearing models (migration `20260730140000`)
- RLS policies created on 53 tables (migration `20260730160000`)
- Two database roles created (`matchboard_app`, `matchboard_admin`)
- `organisationId` made NOT NULL on all tenant-bearing models (migration `20260803160000`)
- `Team` composite unique `@@unique([organisationId, name])` added
- `Player` composite unique `@@unique([organisationId, playerCode])` added (global unique dropped)
- `OpponentTeam` composite unique `@@unique([organisationId, normalizedName])` added (global unique dropped)
- `LeagueSeason` composite unique `@@unique([organisationId, name])` already in place
- `MatchRound` composite unique `@@unique([leagueSeasonId, name])` added
- `OrgFilterMode.unscoped` removed — `resolveOrgFilterForMachine` and `resolveOrgFilterForUser` throw `AuthorizationError` instead of returning unscoped filter
- All `ctx.orgFilter.type === "org"` conditionals simplified (always true after unscoped removal)
- All application code performing org-scoped lookups verified and fixed (PRs #258-#262)
- Application queries include `organisationId` with fail-closed org filter

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

2026-08-17

## Residue

`requireCoachAccess()` remains the primary auth gate for many files. `resolveOrganisationAccess()` provides full org context with role and team delegation. The transition from single-tenant email allowlist to org-scoped role-based auth is incomplete.

`OrgFilterMode.unscoped` has been removed — `resolveOrgFilterForMachine` and `resolveOrgFilterForUser` now throw `AuthorizationError` instead of returning an unscoped filter. This is fail-closed.

Per ADR-0035, the target model requires every protected operation to resolve through organisation membership.

## Containment

- `requireCoachAccess()` provides single-tenant access control (email allowlist)
- `resolveOrganisationAccess()` provides full org context for org-scoped routes
- `OrganisationAccessContext` type with role and team delegation
- Role enforcement helpers (`requireRole()`, `requireTeamAccess()`) exist but are not applied to all mutations
- `OrgFilterMode.unscoped` removed — no more unscoped queries (PRs #258-#260)
- All `ctx.orgFilter.type === "org"` conditionals simplified (PR #261)

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
- `OrgFilterMode.unscoped` removed — fail-closed (PR #259)
- All org-scoped code verified for correct filter usage (PRs #258-#262)
- Remaining: many files still use `requireCoachAccess()` without org context

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

2026-08-17

## Residue

Organisation detail and settings routes exist at `/o/{organisationSlug}/...` using `resolveOrganisationAccess()`. Main app routes (Assistant, Fixtures, Teams, Players, Rounds, Matches, Events, Insights, etc.) use `requireActorContext()` + org-scoped filters for data access but remain at flat paths under `src/app/(app)/` with org context resolved from session rather than URL params.

Per ADR-0035, the target route structure is `/o/{organisationSlug}/...` where every server request resolves through organisation membership.

## Containment

- Single-tenant deployment limits the impact
- Organisation listing at `/organisations` shows user's memberships
- `/o/{organisationSlug}/settings` provides org management
- `/invite/{token}` handles invitation acceptance
- Flat routes work because there is only one implicit organisation
- All data queries use org-scoped filters via `requireActorContext()`

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
- All data access uses `requireActorContext()` with org-scoped filters (PRs #258-#262)
- Main app routes still use flat paths with session-resolved org context

## Affected ADRs

- ADR-0035 (multitenancy architecture and product decisions — MT-1.6)

## Related

- `src/app/(app)/` — current route structure
- Current navigation: Assistant, Fixtures, Teams, Players

---

# ARR-0010: Unique constraints will become composite with organizationId

## Status

Resolved

## Discovered

2026-07-30

## Last updated

2026-08-17

## Residue

All Prisma models that had global unique constraints now have composite `@@unique([organisationId, ...])` constraints. Application code performing unsorged lookups has been fixed to scope by organisationId. See dedicated ARR-0010 file for full details.

## Resolution

- `Team` composite unique `@@unique([organisationId, name])`
- `Player` composite unique `@@unique([organisationId, playerCode])`
- `OpponentTeam` composite unique `@@unique([organisationId, normalizedName])`
- `LeagueSeason` composite unique `@@unique([organisationId, name])`
- `MatchRound` composite unique `@@unique([leagueSeasonId, name])` (new)
- All global unique constraints dropped where replaced by composites
- Application code org-scoped lookup fixes (PRs #258-#262)
- See dedicated file `docs/arr/0010-unique-constraints-will-become-composite.md` for full details