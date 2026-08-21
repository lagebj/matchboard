# ARR-0016: Direct team-based player eligibility in selection engine

## State

Partially resolved

## Identified

2026-08-03

## Residue

Re-verified and narrowed 2026-08-20 (consolidation programme residue reconciliation pass) —
directly against real call sites, not just the file-list claim. Of the original three points:

1. **Still open**: check `FootballGroupPlayer` membership (ACTIVE, PRIMARY) *before* core-team
   eligibility. Core eligibility still starts from `player.coreTeamId` only — grepping
   `generate-round.ts`/`generate-selection.ts`/`selection-eligibility.ts` finds zero references
   to `group-pool-resolver.ts` or `FootballGroupPlayer`.
2. **Resolved**: intra-group `RotationPath` scoping — `src/lib/selection/load-rotation-paths.ts`
   is genuinely called from `generate-round.ts`, `generate-selection.ts`, and
   `resolve-round-support.ts`, confirmed via direct grep of real call sites.
3. **Resolved**: cross-group `GroupMovementPath` eligibility — `load-rotation-paths.ts` imports
   and merges `listGroupMovementPaths()` from `src/lib/groups/group-movement-path.ts`, called
   from the same real generation code paths as point 2.

This ARR is now scoped to point 1 only — points 2-3 are done and no longer residue.

Original background: the current selection engine resolves player eligibility through direct
team membership (`player.coreTeamId`) for core-team assignment. There is no group-pool-first
resolution before that — players are selected based on core team without first checking whether
they're in the group's active pool.

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

1. ~~Foundation phase: Selection engine unchanged, group data available but not used~~ — done
2. ~~Enforcement phase: Selection engine reads group membership for movement/rotation
   eligibility~~ — done for `RotationPath`/`GroupMovementPath` (points 2-3); **not yet done for
   core-team pool-membership eligibility (point 1)** — this is the only remaining work.
3. Removal phase: Selection engine requires group-pool membership before core-team eligibility,
   removes any implicit team-only fallback — not started.

## Superseded by

ADR-0049: Football Group as Operational Boundary

## History

### 2026-08-20

Re-verified and narrowed (consolidation programme residue reconciliation pass) — see Residue
section above. `State` updated from `Identified` to `Partially resolved` to reflect that 2 of
the 3 original points are genuinely done.