# ARR-0001: Player position has two writable representations

## State

Resolved (2026-08-22)

## Identified

2026-07-29

## Residue

Player position priority is stored in two places:
1. `Player.primaryPosition`, `Player.secondaryPosition`, `Player.tertiaryPosition` — direct string fields on the Player model
2. `PlayerPosition` table — relational table with `playerId`, `positionId`, `priority`, `approvedAt`, `approvedBy`, `version`

The `PlayerPosition` table is written to by `syncPlayerPositions()` but is never read by any active code path. All selection engine and display code reads from the Player string fields.

This creates a dual-write situation where the two representations can diverge.

## Intended architecture

One authoritative writable representation for player position priority. The canonical source is documented in the source-of-truth register: `Player.primaryPosition/secondaryPosition/tertiaryPosition` are the canonical fields. The `PlayerPosition` table was intended for approved position management but is currently write-only.

## Evidence

- `prisma/schema.prisma`: Player model has `primaryPosition String`, `secondaryPosition String?`, `tertiaryPosition String?` and `positions PlayerPosition[]`
- `prisma/schema.prisma`: PlayerPosition model with `playerId`, `positionId`, `priority`
- `src/lib/selection/selection-types.ts` and selection engine read from Player string fields
- No active read path uses PlayerPosition table

## Impact

- Divergence between Player fields and PlayerPosition rows
- Sync logic must run on every position change
- New code may accidentally read from the wrong source
- Approved position workflow is incomplete (PlayerPosition has approval fields but they are never enforced)

## Containment

- Do not add new read paths to the PlayerPosition table until it is made canonical or removed
- Do not add new write paths to PlayerPosition without updating the source-of-truth register
- All position reads for selection, display, and export must use Player string fields

## Resolution criteria

- One representation is designated canonical and all others are read-only or removed
- All read paths use the canonical source
- PlayerPosition either becomes the canonical source with all reads migrated, or is removed
- Reconciliation check confirms no divergence
- Related ADR updated

## Disposition

Resolved by removal. The 2026-08-02/2026-08-20 decision to retain `PlayerPosition` for a future
approved-position workflow was explicitly reversed by the maintainer on 2026-08-22: given the
table had zero read consumers across its entire lifetime and no approved-position workflow was
ever built against it, keeping it around as speculative future capacity contradicted the "don't
design for hypothetical future requirements" principle. The table, its `PlayerPositionPriority`
enum, both relation fields (`Player.positions`, `Organisation.playerPositions`), and
`syncPlayerPositions()` (and its three call sites in `players/actions.ts` and
`players/[playerId]/inline-actions.ts`) were removed. `Player.primaryPosition`/
`secondaryPosition`/`tertiaryPosition` remain the sole representation, exactly as they already
were in practice.

## Resolution

- Removed `model PlayerPosition` and `enum PlayerPositionPriority` from `prisma/schema.prisma`
- Removed `Player.positions` and `Organisation.playerPositions` relation fields
- Removed `src/lib/players/sync-player-positions.ts` and its 3 call sites
- Removed `"playerPosition"` from `RLS_TABLES` in `src/lib/db.ts`
- Migration: `prisma/migrations/20260822153000_drop_player_position_table/` — `DROP TABLE` +
  `DROP TYPE`, applied to local dev + test databases; production applies via the standard CI
  pipeline (ADR-0084)
- `npm run typecheck` clean after removal (no dangling references)

## History

### 2026-08-02

- Confirmed: `PlayerPosition` table has zero active read paths. Only `syncPlayerPositions()` writes to it.
- Confirmed: All selection engine, display, and export code reads from Player scalar fields.
- Decision: Player scalar fields remain canonical. PlayerPosition table retained for future approved-position workflow but documented as secondary derived store.
- Updated source-of-truth register to reflect canonical status.

### 2026-08-20

- Re-verified independently (consolidation programme residue reconciliation pass): zero read
  paths for `PlayerPosition` anywhere outside `sync-player-positions.ts` and generated Prisma
  code — the 2026-08-02 decision still holds. Disposition corrected from "In progress" to
  "Accepted" to match the substance of that decision; `State` intentionally remains `Confirmed`
  (the dual representation still literally exists, by design — matches ARR-0019's precedent for
  a verified, accepted, non-code-resolved residue).

### 2026-08-22

Maintainer reversed the 2026-08-02 decision: remove `PlayerPosition` rather than keep it for a
never-built future workflow. Resolved by removal — see `## Resolution` above.

## Related decisions

ADR-0029 (source-of-truth inventory and deprecation map)

## Related implementation

Source-of-truth register audit candidate entry for `PlayerPosition` table vs `Player.primaryPosition`

## Supersedes

None

## Superseded by

None

## History

### 2026-07-29

Record created from IMPROVE-0A source-of-truth assessment.