# ARR-0010: Unique constraints will become composite with organizationId

## Status

Active

## Discovered

2026-07-30

## Residue

Several Prisma models have global `@unique` constraints that must become composite `@@unique([organizationId, ...])` constraints when `organizationId` is added. The most significant:

1. `Team.name` — currently globally unique, must become `@@unique([organizationId, name])`
2. `Player.playerCode` — currently globally unique, must become scoped to `organizationId`
3. `OpponentTeam.name` — likely needs `@@unique([organizationId, name])`
4. `LeagueSeason.name` — likely needs `@@unique([organizationId, name])`

These constraints will require migration steps: add nullable `organizationId`, populate all rows, add composite unique, remove global unique, make `organizationId` NOT NULL.

## Containment

- Single-tenant deployment means these global unique constraints currently work correctly
- No cross-organisation data can violate the future composite constraints yet

## Resolution criteria

- All global unique constraints on tenant-bearing models are converted to composite unique constraints including `organizationId`
- The migration is idempotent and safe to rerun
- Existing data integrity is preserved through the migration

## Affected ADRs

- ADR-0035 (multitenancy architecture and product decisions — MT-2.7, MT-2.8)

## Related

- `prisma/schema.prisma` — current unique constraints
- Data-ownership matrix: `docs/mt/mt0-data-ownership-matrix.md`