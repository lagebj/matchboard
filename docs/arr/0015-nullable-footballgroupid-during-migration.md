# ARR-0015: Nullable footballGroupId during migration foundation phase

## State

Resolved

## Identified

2026-08-03

## Resolved

2026-08-19

## Resolution evidence

All `footballGroupId` fields in the Prisma schema are now `String` (non-nullable, with foreign key constraints):
- Player: `footballGroupId String`
- Team: `footballGroupId String`
- MatchRound: `footballGroupId String`
- Match: `footballGroupId String`
- GroupAccess: `footballGroupId String`
- FootballGroupPlayer: `footballGroupId String`

The nullable period described in this ARR has been closed. All operational models now require group association.

## Residue

During the foundation phase of the FootballGroup migration, `footballGroupId` will be added as a nullable field on models that will eventually require it (Team, LeagueSeason, Match, Event, Player, RotationPath, etc.). Nullable `footballGroupId` means:

- Existing data has no group association yet
- Queries must handle null group references
- Group-scoped access checks must fall back to organisation scope when group is null
- Validation must allow creation without group during the transition

This nullable period is temporary and will be closed when the enforcement phase makes group references required and backfills all existing data.

Affected models: Team, LeagueSeason, Match, Event, RotationPath, Selection, Warning, MovementLedger, Player, and others (see CURRENT-STATE-AUDIT.md section 6)

## Intended architecture

Per ADR-0049, all operational models belong to exactly one FootballGroup. `footballGroupId` is non-nullable in the final state.

## Resolution plan

1. Foundation phase: Add nullable `footballGroupId` with optional relation
2. Backfill: Create default group per organisation, assign all existing data
3. Enforcement phase: Make `footballGroupId` non-nullable after backfill

## Superseded by

ADR-0049: Football Group as Operational Boundary