# ARR-0018: Temporary dual authorization path (TeamAccess + GroupAccess)

## State

Identified

## Identified

2026-08-03

## Residue

During the enforcement phase of the FootballGroup migration, both TeamAccess and GroupAccess authorization paths must coexist. The authorization resolution algorithm must:

1. Check GroupAccess first (new path)
2. Fall back to TeamAccess if no GroupAccess exists (legacy path)
3. OWNER/ADMIN/SUPPORT follow the same implicit rules in both paths

This dual path means:
- ActorContext must resolve both delegatedTeamIds and delegatedGroupIds
- Server actions must check both authorization paths
- Access denials must consider both paths before rejecting
- Tests must cover both authorization paths

The dual path is temporary and will be removed when TeamAccess is removed.

Affected files:
- `src/lib/auth/actor-context.ts` — must resolve both TeamAccess and GroupAccess
- `src/lib/auth/team-access.ts` — legacy path, must remain functional
- All ~70+ server actions that check access
- `src/lib/auth/index.ts` — exported authorization helpers

## Intended architecture

Per ADR-0049, GroupAccess is the sole operational access mechanism. TeamAccess is removed.

## Resolution plan

1. Foundation phase: TeamAccess only, GroupAccess added but not enforced
2. Enforcement phase: Both paths active, GroupAccess preferred, TeamAccess fallback
3. Removal phase: TeamAccess removed, GroupAccess sole path

## Superseded by

ADR-0049: Football Group as Operational Boundary