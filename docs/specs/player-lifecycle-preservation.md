# Spec: Player Lifecycle Preservation

## Objective

Ensure that removing or deactivating a player never deletes historical participation data. Removed and unavailable players must be hidden from active planning by default but remain visible in historical views, snapshots, and reports.

## What already exists

- `Player.active` (Boolean, default true) — soft-active flag
- `Player.removedAt` (DateTime?, nullable) — soft-delete/archive timestamp
- Core team relation uses `onDelete: Restrict`
- Most child relations use `onDelete: Cascade` (selections, availabilities, etc.)
- Active planning queries already filter by `removedAt: null` and `active: true`

## What needs to change

### 1. Change cascade deletes to Restrict or SetNull on Player relations

**Problem**: When a Player is deleted, `onDelete: Cascade` on selections, availabilities, movement candidates, etc. would destroy historical data.

**Fix**: Change critical `onDelete: Cascade` to `onDelete: Restrict` or `onDelete: SetNull` on:
- `Selection` → player (Restrict — selections are historical records)
- `Availability` → player (Restrict — availability is historical context)
- `EventMatchLineupAssignment` → player (Restrict — already restricted in some cases)
- `EventMatchSupportAssignment` → player (Restrict)
- `EventSquadPlayer` → player (Restrict)
- `EventPlayerAvailability` → player (Restrict)
- `MovementCandidate` → player (Restrict)
- `MatchReportPlayerStat` → player (Restrict — stats are historical)
- `PostMatchReport` related records (Restrict)

**Migration**: This is a schema-only change (no data migration). Prisma will enforce that Player records with dependent historical records cannot be hard-deleted.

### 2. Soft-delete workflow (no hard delete)

- Remove or deprecate any "delete player" action that does a hard delete
- The player "remove" action sets `removedAt` to current timestamp and `active` to false
- The player "restore" action clears `removedAt` and sets `active` to true
- Server actions:
  - `removePlayer(playerId)` — sets `removedAt`, `active: false`
  - `restorePlayer(playerId)` — clears `removedAt`, `active: true`

### 3. Query filtering

- Active planning queries (squad generation, lineup, selection) already filter by `removedAt: null, active: true`
- Historical queries (season overview, match reports, finalized selections) must NOT filter by `removedAt` — they show all players including removed ones
- Player lists in UI:
  - Default view: show active players only (`removedAt: null, active: true`)
  - Optional toggle: "Show removed players" — includes `removedAt: not null`
  - Removed players visually marked (muted text, strikethrough, or "Removed" badge)

### 4. Player name snapshots in historical records

- `Selection` already has no player name snapshot field — it relies on joining to Player
- When a player is removed, their name is still accessible via the Player record
- If player name changes later, historical reports show the current name (acceptable for now)
- Future: add `playerNameSnapshot` to Selection and MatchReport records if needed

### 5. UI behavior

- Players page: default view shows active only; toggle to include removed
- Player profile: removed players show "Removed" status badge, "Restore" action
- Match reports: removed players appear with their name, marked as removed if needed
- Season overview: removed players appear in their historical teams with participation data
- Event player pool: removed players excluded from selection dropdowns by default

## Commands

- Build: `npm run build`
- Test: `npm test`
- Lint: `npm run lint`
- Typecheck: `npm run typecheck`

## Testing Strategy

- Unit tests: removePlayer sets removedAt and active=false
- Unit tests: restorePlayer clears removedAt and sets active=true
- Integration tests: removed player does not appear in active squad generation
- Integration tests: removed player appears in historical match reports
- Integration tests: hard delete of player with existing selections is blocked
- Integration tests: player list toggle shows/hides removed players

## Boundaries

- Always: Use `requireCoachAccess()` on player lifecycle actions
- Always: Never hard-delete a player with historical records
- Ask first: Schema changes to onDelete policies
- Never: Cascade-delete selections, reports, or stats when deactivating a player

## Success Criteria

- Removing a player sets `removedAt` and `active: false`; does not delete records
- Restoring a player clears `removedAt` and sets `active: true`
- Removed players are hidden from active planning by default
- Removed players remain visible in historical views, reports, and stats
- No cascade deletes on historical records when player is removed
- Player list supports showing removed players with visual distinction
- Typecheck, lint, tests, and build pass

## Open Questions

- Should we add `playerNameSnapshot` to Selection records now, or defer? (Deferring — current join approach is acceptable)
- Should removed players be completely hidden from player lists or shown with a toggle? (Shown with toggle per spec)