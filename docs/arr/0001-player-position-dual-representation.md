# ARR-0001: Player position has two writable representations

## State

Confirmed

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

In progress. Player scalar fields (`primaryPosition`, `secondaryPosition`, `tertiaryPosition`) are confirmed canonical. `PlayerPosition` table is a secondary derived store written by `syncPlayerPositions()` with no active read paths. The table is retained for future approved-position workflow but must not be read as canonical position source. All position reads for selection, display, and export use Player scalar fields.

## History

### 2026-08-02

- Confirmed: `PlayerPosition` table has zero active read paths. Only `syncPlayerPositions()` writes to it.
- Confirmed: All selection engine, display, and export code reads from Player scalar fields.
- Decision: Player scalar fields remain canonical. PlayerPosition table retained for future approved-position workflow but documented as secondary derived store.
- Updated source-of-truth register to reflect canonical status.

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