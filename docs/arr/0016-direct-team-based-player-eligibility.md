# ARR-0016: Direct team-based player eligibility in selection engine

## State

Identified

## Identified

2026-08-03

## Residue

The current selection engine resolves player eligibility through direct team membership: `player.coreTeamId` determines which team a player belongs to, and `RotationPath` (team-to-team) determines movement eligibility. There is no group concept — players are selected based on their core team and intra-organisation rotation paths.

After FootballGroup introduction, player eligibility must resolve through group pool membership first (is the player in the group's active pool?) and then core team assignment (which team within the group?). The selection engine must be updated to:
1. Check `FootballGroupPlayer` membership (ACTIVE, PRIMARY) instead of only `player.coreTeamId`
2. Scope `RotationPath` to intra-group (teams in the same group)
3. Use `GroupMovementPath` for cross-group movement eligibility

During the foundation phase, the selection engine continues using direct team-based logic. During enforcement, both paths are valid.

Affected files:
- `src/lib/selection/generate-selection.ts`
- `src/lib/selection/generate-round.ts`
- `src/lib/selection/selection-eligibility.ts`
- `src/lib/selection/rotation-path-policy.ts`
- `src/lib/selection/resolve-round-support.ts`
- `src/lib/selection/movement-candidate.ts`
- And other selection engine files

## Intended architecture

Per ADR-0049, selection eligibility uses group player pool membership + intra-group RotationPath + cross-group GroupMovementPath.

## Resolution plan

1. Foundation phase: Selection engine unchanged, group data available but not used
2. Enforcement phase: Selection engine reads group membership for eligibility, falls back to team-based logic for ungrouped data
3. Removal phase: Selection engine requires group membership, removes team-based fallback

## Superseded by

ADR-0049: Football Group as Operational Boundary