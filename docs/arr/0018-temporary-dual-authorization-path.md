# ARR-0018: Temporary dual authorization path (TeamAccess + GroupAccess)

## State

Resolved

## Identified

2026-08-03

## Resolved

2026-08-19

## Residue

During the enforcement phase of the FootballGroup migration, both TeamAccess and GroupAccess authorization paths had to coexist. The dual path has been resolved:

1. The `TeamAccess` Prisma model no longer exists — it has been removed from the schema
2. The `TeamAccess` database table has been removed
3. `delegatedTeamIds` no longer exists on `ActorContext`
4. All team-level authorization now resolves through `footballGroupId` and `accessibleGroupIds` (derived from `GroupAccess`)
5. `requireTeamAccess()` delegates to `requireTeamGroupAccess()`, which queries `team.footballGroupId` and checks `ctx.accessibleGroupIds`
6. OWNER/ADMIN/SUPPORT implicit access is handled through `ORG_IMPLICIT_ACCESS_ROLES` in `group-context.ts`

## Resolution evidence

- `TeamAccess` model removed from Prisma schema (zero matches)
- `src/lib/auth/team-access.ts` removed (file no longer exists)
- `ActorContext` uses `accessibleGroupIds: string[]` and `groupAccesses: GroupAccessEntry[]`, no longer has `delegatedTeamIds`
- All protected server actions and API routes use `requireActorContext()` for org-scoped operations
- Cross-org authorization matrix tests (24 tests) verify GroupAccess enforcement

## Remaining naming residue

Function names `requireTeamAccess`, `hasTeamAccess`, `requirePlayerTeamAccess`, `requireMatchTeamAccess` still reference "Team" but delegate to GroupAccess internally. This is a cosmetic issue, not a functional residue. A future rename to `requireTeamGroupAccess` etc. would complete the naming cleanup.

## Intended architecture

Per ADR-0049, GroupAccess is the sole operational access mechanism. TeamAccess is removed. This is now the implemented state.

## Superseded by

ADR-0049: Football Group as Operational Boundary

## History

### 2026-08-03

Record created from FootballGroup migration enforcement phase.

### 2026-08-19

Resolved. TeamAccess model removed, GroupAccess is the sole authorization path. Naming residue (function names) remains but is cosmetic only.