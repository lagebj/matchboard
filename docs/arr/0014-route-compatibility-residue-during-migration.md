# ARR-0014: Route compatibility residue during org-to-group migration

## State

Identified

## Identified

2026-08-03

## Residue

All football operation routes currently live under `/o/{orgSlug}/teams`, `/o/{orgSlug}/players`, `/o/{orgSlug}/fixtures`, etc. without group scope. These routes will migrate to `/o/{orgSlug}/groups/{groupSlug}/...` but must maintain backwards compatibility during the transition.

During the migration period:
- Old routes remain functional and redirect or resolve group from context
- New routes are added alongside old routes
- Route handlers must resolve group from either URL parameter or context fallback

Affected routes: 39 org page routes, 41 API routes (per ROUTE-INVENTORY.md)

## Intended architecture

Per ADR-0049, canonical routes include group scope: `/o/{orgSlug}/groups/{groupSlug}/teams`, etc. The server validates both orgSlug and groupSlug. Legacy routes redirect deterministically.

## Resolution plan

1. Foundation phase: Add group routes alongside existing routes
2. Enforcement phase: Group routes are primary, legacy routes redirect
3. Removal phase: Remove legacy route handlers

## Superseded by

ADR-0049: Football Group as Operational Boundary