# ARR-0013: TeamAccess replaced by GroupAccess

## State

Partially resolved

## Identified

2026-08-03

## Residue

The `TeamAccess` Prisma model and table have been removed. `GroupAccess` is the sole operational access mechanism. `requireTeamAccess()` and `hasTeamAccess()` now delegate to `requireTeamGroupAccess()`, which resolves through `team.footballGroupId` and `ctx.accessibleGroupIds`.

**Resolved:** TeamAccess model removed, `delegatedTeamIds` removed from `ActorContext`, GroupAccess is the enforcement mechanism, cross-org authorization matrix tests (24 tests) verify enforcement.

**Remaining naming residue:** Function names `requireTeamAccess`, `hasTeamAccess`, `requirePlayerTeamAccess`, `requireMatchTeamAccess` still reference "Team" but delegate to GroupAccess internally. The `OrganisationAccessContext` still has a `requireTeamAccess` function that resolves via `footballGroupId`.

This naming residue is cosmetic, not architectural. The authorization path is correct; only the function names are misleading.

## Intended architecture

Per ADR-0049, GroupAccess is the sole operational access mechanism. TeamAccess is removed.

## Containment

- No new code may reference `TeamAccess` as a model or authorization path
- All new team-level authorization must use `GroupAccess` and `accessibleGroupIds`
- Function names may be renamed in a future naming cleanup PR

## Resolution criteria

- [x] TeamAccess Prisma model removed
- [x] TeamAccess database table removed
- [x] `delegatedTeamIds` removed from `ActorContext`
- [x] All team-level authorization resolves through GroupAccess
- [ ] Function names renamed from `requireTeamAccess` to `requireTeamGroupAccess` etc. (cosmetic)

## Related decisions

- ADR-0049: Football Group as Operational Boundary

## History

### 2026-08-03

Record created.

### 2026-08-19

Updated to partially resolved. TeamAccess model and table removed. GroupAccess is the sole enforcement mechanism. Function naming residue remains as cosmetic issue.