# Spec: Completion Pass — Implementation Order

## Overview

This document defines the implementation order for the Matchboard completion pass. Each item is a separate branch/PR.

## Implementation order

### PR 1: Opponent registry and match linking
- Spec: `docs/specs/opponent-registry.md`
- Branch prefix: `feat/opponent-registry`
- Key changes:
  - `normalizeOpponentName()` helper
  - `searchOpponents()` and `createOpponent()` server actions
  - `EventMatch.opponentTeamId` FK added
  - Match creation forms updated with opponent search/select
  - Event match creation updated with opponent linking
  - Backfill script for existing match opponent strings

### PR 2: Player lifecycle preservation
- Spec: `docs/specs/player-lifecycle-preservation.md`
- Branch prefix: `feat/player-lifecycle`
- Key changes:
  - Change `onDelete: Cascade` to `onDelete: Restrict` on Player relations
  - `removePlayer()` and `restorePlayer()` server actions
  - Query filtering for removed/unavailable players
  - UI toggle for showing removed players
  - Visual distinction for removed players in lists

### PR 3: Season period snapshots and finalization
- Spec: `docs/specs/season-period-snapshots.md`
- Branch prefix: `feat/season-snapshots`
- Key changes:
  - `LeagueSeasonStatus` enum and `LeagueSeason.status` field
  - `SeasonPeriodSnapshot`, `TeamSeasonSnapshot`, `TeamSeasonSnapshotPlayer` models
  - `finalizeLeagueSeason()` and `unfinalizeLeagueSeason()` server actions
  - Snapshot query layer
  - Historical view behavior (use snapshot when finalized)
  - Full-year aggregation
  - UI entry points for finalize/unfinalize

### PR 4: Assistant operational wiring
- Spec: `docs/specs/assistant-operational-wiring.md`
- Branch prefix: `feat/assistant-events`
- Key changes:
  - Event work item categories added to assistant types
  - `hasMatchPassed()` date utility
  - `getEventWorkItems()` query function
  - Extended `getAssistantCommandCentre()` to include event items
  - Date-aware post-match report logic
  - Action links to event/match/report screens
  - Priority ordering updated

### PR 5: Graphics and branding audit
- Spec: `docs/specs/graphics-branding-audit.md`
- Branch prefix: `feat/branding-audit`
- Key changes:
  - Add illustrations to remaining empty states (History, Season)
  - Event detail header sketch (optional, only if it doesn't crowd)
  - Verify logo rendering in both themes
  - Verify no EPS in runtime code

## Data migration

PR 1 includes a backfill script for existing opponent names.
PR 3 includes a migration for new models and fields.
PR 2 includes a schema migration for onDelete policy changes.

Each migration must:
- Be additive (no destructive changes)
- Preserve existing data
- Not break current planning flows

## Dependency graph

```
PR 1 (opponents) ←── independent, can start immediately
PR 2 (player lifecycle) ←── independent, can start immediately
PR 3 (snapshots) ←── depends on PR 2 (needs stable player lifecycle)
PR 4 (assistant) ←── depends on PR 1 (needs opponent data) and PR 3 (needs finalized state)
PR 5 (graphics) ←── independent, can start immediately
```

PR 1, PR 2, and PR 5 can be developed in parallel.
PR 3 should wait for PR 2.
PR 4 should wait for PR 1 and PR 3.

## Testing requirements

Each PR must:
- Pass `npm run typecheck`
- Pass `npm run lint` (pre-existing errors exempted)
- Pass `npm test`
- Pass `npm run build`
- Include relevant unit/integration tests for new behavior

## Commit message convention

Follow Conventional Commits:
- `feat(opponents): add opponent search and creation server actions`
- `feat(players): add removePlayer and restorePlayer lifecycle actions`
- `feat(seasons): add period snapshot model and finalization`
- `feat(assistant): wire event work items into command centre`
- `feat(branding): add illustrations to remaining empty states`