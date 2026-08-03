# ARR-0013: TeamAccess will be removed and replaced by GroupAccess

## State

Identified

## Identified

2026-08-03

## Residue

`TeamAccess` is the current per-team delegation model controlling which teams a COACH or VIEWER can operate on. It will be replaced by `GroupAccess` (per-group, roles: COACH, VIEWER only). During the migration foundation phase, both models coexist. TeamAccess is the authoritative access mechanism until GroupAccess enforcement is wired.

Affected files:
- `src/lib/auth/actor-context.ts` — `delegatedTeamIds`, `hasTeamAccess()`, `requireTeamAccess()`
- `src/lib/auth/team-access.ts` — TeamAccess query helpers
- `prisma/schema.prisma` — `TeamAccess` model, `OrganisationMembership` relations
- ~70+ server actions that call `requireTeamAccess()` or `hasTeamAccess()`

## Intended architecture

Per ADR-0049, `GroupAccess` with roles COACH and VIEWER replaces TeamAccess. OWNER/ADMIN have implicit access. SUPPORT has temporary read-only. A COACH without GroupAccess has no operational access.

## Resolution plan

1. Foundation phase: Add GroupAccess alongside TeamAccess
2. Enforcement phase: Wire GroupAccess checks, dual-path with TeamAccess fallback
3. Removal phase: Remove TeamAccess model, remove `delegatedTeamIds` from ActorContext, update all server actions

## Superseded by

ADR-0049: Football Group as Operational Boundary