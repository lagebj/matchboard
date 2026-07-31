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