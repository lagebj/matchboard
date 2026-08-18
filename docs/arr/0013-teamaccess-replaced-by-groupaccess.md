# ARR-0013: TeamAccess naming residue in authorization functions

## State

Resolved

## Identified

2026-08-03

## Resolved

2026-08-19

## Residue

The `TeamAccess` Prisma model and table were removed. `GroupAccess` is the sole operational access mechanism. However, function names still referenced "Team" while delegating to GroupAccess:

- `requireTeamAccess` → delegated to `requireTeamGroupAccess`
- `hasTeamAccess` → checked `accessibleGroupIds` via `footballGroupId`
- `requirePlayerTeamAccess` → resolved player's team group
- `requireMatchTeamAccess` → resolved match's team group
- `canAccessAllTeams` → checked group access

These names were misleading because the authorization path resolved through `footballGroupId` and `accessibleGroupIds`, not through a `TeamAccess` table.

## Resolution evidence

All authorization functions have been renamed to reflect their Group-based implementation:

- `requireTeamAccess` → removed (was a wrapper calling `requireTeamGroupAccess`)
- `hasTeamAccess` → `hasTeamGroupAccess`
- `requirePlayerTeamAccess` → `requirePlayerGroupAccess`
- `requireMatchTeamAccess` → `requireMatchGroupAccess`
- `canAccessAllTeams` → `canAccessAllGroups`

The `requireTeamGroupAccess` function (which already existed as the real implementation) is now the primary entry point. Call sites updated across all server actions, API routes, test mocks, and organisation access modules.

Typecheck, lint, and 226 auth-related tests pass.

## Intended architecture

Per ADR-0049, GroupAccess is the sole operational access mechanism. Function names now reflect this.

## Related decisions

- ADR-0049: Football Group as Operational Boundary

## Superseded by

None.

## History

### 2026-08-03

Record created from FootballGroup migration enforcement phase.

### 2026-08-19

Updated to partially resolved. TeamAccess model removed. GroupAccess is the sole enforcement mechanism. Naming residue documented.

### 2026-08-19

Resolved. All authorization functions renamed from Team-based to Group-based names. `requireTeamAccess` wrapper removed. `canAccessAllTeams` renamed to `canAccessAllGroups`.