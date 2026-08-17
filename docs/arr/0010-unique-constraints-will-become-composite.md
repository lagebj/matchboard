# ARR-0010: Unique constraints will become composite with organizationId

## Status

Resolved

## Discovered

2026-07-30

## Resolved

2026-08-17

## Residue

Several Prisma models had global `@unique` constraints that needed to become composite `@@unique([organizationId, ...])` constraints when `organizationId` was added. The most significant:

1. `Team.name` — was globally unique, now `@@unique([organizationId, name])`
2. `Player.playerCode` — was globally unique, now `@@unique([organizationId, playerCode])`
3. `OpponentTeam.normalizedName` — was globally unique, now `@@unique([organizationId, normalizedName])`
4. `LeagueSeason.name` — was globally unique, now `@@unique([organizationId, name])`

## Additional findings during resolution (2026-08-17)

### Schema constraints — already composite

All four models listed above already had composite unique constraints in the Prisma schema. The ARR described a future state that had already been partially implemented. The migration `20260803160000_make_organisation_id_required_and_drop_global_player_code_unique` and `20260817130000_remove_global_unique_opponent_team_normalized_name` had already addressed the global-to-composite migration.

### Application code — org-scoped lookups missing

Despite composite constraints being in place, several application code paths performed lookups without scoping by `organisationId`, which would return wrong-org data in a multi-tenant environment:

1. **HIGH: `matches/actions.ts`** — `leagueSeason.findFirst` by date range without `organisationId` filter. Cross-tenant league season could be selected. **Fixed:** Added `organisationId` filter.
2. **HIGH: `ensure-match-round.ts`** — `season.findFirst` and `leagueSeason.findFirst` without `organisationId`. Cross-tenant season/period could be selected. **Fixed:** Added `organisationId` parameter and filter to both functions.
3. **MEDIUM: `players/actions.ts`** — `player.aggregate({ _max: { playerCode: true } })` without `organisationId` filter. Generated globally sequential codes instead of per-org. **Fixed:** Added `where: { organisationId }` filter to aggregate.
4. **MEDIUM-HIGH: `matches/actions.ts`** — `opponentTeam.findUnique({ where: { id } })` without `organisationId` check. **Fixed:** Changed to `findFirst` with `organisationId` filter.
5. **MEDIUM-HIGH: `events/event-match-actions.ts`** — `resolveOpponent` used `opponentTeam.findUnique({ where: { id } })` without org check. **Fixed:** Added `orgId` parameter and `findFirst` with `organisationId` filter.
6. **LOW: `event-match-actions.ts`** — Dead `OrgFilterMode.unscoped` conditionals in `requireEventOrgAccess` and `requireMatchOrgAccess`. **Fixed:** Simplified to always use `orgFilter.filter`.

### Schema addition — MatchRound unique constraint

`MatchRound` lacked a `@@unique([leagueSeasonId, name])` constraint. While functionally scoped by `leagueSeasonId` in application code, there was no database-level guarantee against duplicate round names. **Fixed:** Added composite unique constraint and migration.

### Dead code removal

`ensure-match-round.ts` was entirely unused (no importers). The function signature was updated to accept `organisationId` for correctness, but the module should be evaluated for removal in a future cleanup pass.

## Resolution

- All four originally listed models have composite `@@unique([organisationId, ...])` constraints
- All application code paths that performed unsorged lookups have been fixed
- `MatchRound` now has `@@unique([leagueSeasonId, name])` for data integrity
- Migration `20260817140000_add_matchround_unique_league_season_name` adds the MatchRound composite unique

## Containment

- Single-tenant deployment means these issues had no production impact
- No cross-organisation data violations were possible in single-tenant use
- The fixes are defensive hardening for future multi-tenant correctness

## Affected ADRs

- ADR-0035 (multitenancy architecture and product decisions — MT-2.7, MT-2.8)

## Related

- `prisma/schema.prisma` — current unique constraints
- Data-ownership matrix: `docs/mt/mt0-data-ownership-matrix.md`
- PR #261: OrgFilterMode conditional cleanup
- PR #262: Org-scoped lookups and MatchRound unique constraint