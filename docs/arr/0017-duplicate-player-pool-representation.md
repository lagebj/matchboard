# ARR-0017: Duplicate player-pool representation during migration

## State

Identified

## Identified

2026-08-03

## Residue

Currently, a player's association with teams is represented by `player.coreTeamId`. After FootballGroup introduction, the association becomes `FootballGroupPlayer` (group membership) + `FootballGroupPlayer.coreTeamId` (team within group). During the migration foundation phase, both representations exist:

- `player.coreTeamId` remains the authoritative team assignment
- `FootballGroupPlayer` with `coreTeamId` is added as the new representation
- Both must stay in sync until cutover

This dual representation creates risk of divergence: if a player's core team is updated via the old path (`player.coreTeamId`) without updating the group membership, the two sources disagree.

Affected models: Player, FootballGroupPlayer
Affected services: All services that read `player.coreTeamId` for team assignment

## Intended architecture

Per ADR-0049, `FootballGroupPlayer.coreTeamId` is the authoritative team assignment within a group. `player.coreTeamId` on the Player model is removed after migration.

## Resolution plan

1. Foundation phase: Both fields exist; writes update both; reads prefer Player.coreTeamId
2. Enforcement phase: Writes update FootballGroupPlayer.coreTeamId; reads prefer FootballGroupPlayer; Player.coreTeamId becomes derived/read-only
3. Removal phase: Player.coreTeamId is removed; FootballGroupPlayer.coreTeamId is sole source of truth

## Superseded by

ADR-0049: Football Group as Operational Boundary