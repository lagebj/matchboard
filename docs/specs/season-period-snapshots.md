# Spec: Season Period Snapshots and Finalization

## Objective

Support finalizing and preserving historical season state. A team like Blå can exist across a full year, but its squad composition may differ between Spring and Fall. Looking back at Spring matches must show the Spring squad, not the current/Fall version.

## What already exists

- `Season` model — top-level year container (id, name, year)
- `LeagueSeason` model — bounded spring/fall operational window (id, name, seasonId, part: SPRING/FALL, startDate, endDate)
- `MatchRound` links to `LeagueSeason`
- Selection, Availability, MovementCandidate, etc. are all point-in-time records but not frozen
- No `status` field on LeagueSeason (all are implicitly open)
- No snapshot/archival mechanism

## What needs to be built

### 1. LeagueSeason status field

Add `status` enum to LeagueSeason:
```prisma
enum LeagueSeasonStatus {
  OPEN
  FINALIZED
}

model LeagueSeason {
  // ... existing fields
  status     LeagueSeasonStatus @default(OPEN)
  finalizedAt DateTime?
  finalizedBy String?           // coach user id if auth provides it
}
```

### 2. Season snapshot model

```prisma
model SeasonPeriodSnapshot {
  id              String   @id @default(cuid())
  leagueSeasonId  String
  leagueSeason    LeagueSeason @relation(fields: [leagueSeasonId], references: [id])
  finalizedAt     DateTime
  finalizedBy     String?

  teamSnapshots   TeamSeasonSnapshot[]

  @@index([leagueSeasonId])
  @@map("SeasonPeriodSnapshot")
}

model TeamSeasonSnapshot {
  id                        String   @id @default(cuid())
  seasonPeriodSnapshotId    String
  seasonPeriodSnapshot      SeasonPeriodSnapshot @relation(fields: [seasonPeriodSnapshotId], references: [id])
  teamId                    String
  team                      Team @relation(fields: [teamId], references: [id])
  teamNameSnapshot          String   // team name at time of snapshot

  playerSnapshots           TeamSeasonSnapshotPlayer[]

  @@index([seasonPeriodSnapshotId])
  @@index([teamId])
  @@map("TeamSeasonSnapshot")
}

model TeamSeasonSnapshotPlayer {
  id                        String   @id @default(cuid())
  teamSeasonSnapshotId      String
  teamSeasonSnapshot        TeamSeasonSnapshot @relation(fields: [teamSeasonSnapshotId], references: [id])
  playerId                  String
  player                    Player @relation(fields: [playerId], references: [id])
  playerNameSnapshot        String
  primaryPositionSnapshot   String?
  secondaryPositionSnapshot String?
  tertiaryPositionSnapshot  String?
  shirtNumberSnapshot       Int?
  activeAtSnapshot          Boolean

  @@index([teamSeasonSnapshotId])
  @@index([playerId])
  @@map("TeamSeasonSnapshotPlayer")
}
```

### 3. Finalization server action

`src/lib/seasons/finalize-league-season.ts`

- `finalizeLeagueSeason(leagueSeasonId: string): Promise<SeasonPeriodSnapshot>`
- Validates: period exists, is OPEN, has matches
- Creates SeasonPeriodSnapshot with TeamSeasonSnapshot for each team in the league season
- Each TeamSeasonSnapshot includes current player roster (core team + active players)
- Snapshots player name, position, shirt number, active status
- Sets LeagueSeason.status to FINALIZED, finalizedAt, finalizedBy
- Returns the snapshot record

### 4. Un-finalization server action

- `unfinalizeLeagueSeason(leagueSeasonId: string): Promise<void>`
- Sets LeagueSeason.status back to OPEN, clears finalizedAt
- Does NOT delete snapshots (they remain as historical records)
- Requires confirmation

### 5. Snapshot query layer

- `getLeagueSeasonSnapshot(leagueSeasonId: string): Promise<SeasonPeriodSnapshot | null>`
- Returns null if not finalized
- Returns full snapshot with team compositions and player details

### 6. Historical view behavior

When viewing a finalized LeagueSeason:
- Season overview uses snapshot data for team compositions
- Matches and selections remain as-is (they are already point-in-time)
- Player lists show snapshot composition, not current roster
- UI shows "Finalized YYYY-MM-DD" marker

When viewing an OPEN LeagueSeason:
- Current roster data is used (existing behavior)
- No finalized marker shown

### 7. Full-year aggregation

A full-year view aggregates Spring + Fall snapshots:
- `getSeasonOverview(seasonId)` — combines both LeagueSeason snapshots if both exist
- Shows Spring involvement and Fall involvement side by side
- A player who was in Blå in Spring but not Fall still shows their Spring involvement correctly

### 8. UI entry points

- Season page: show "Finalize" button for OPEN league seasons with matches
- Season page: show "Finalized" badge with date for FINALIZED league seasons
- Season page: show "Unfinalize" option (with confirmation) for FINALIZED league seasons
- Season overview: when viewing a finalized period, show snapshot marker

## Commands

- Build: `npm run build`
- Test: `npm test`
- Lint: `npm run lint`
- Typecheck: `npm run typecheck`

## Testing Strategy

- Unit tests: finalizeLeagueSeason creates snapshot with team compositions
- Unit tests: finalizeLeagueSeason sets status to FINALIZED
- Unit tests: Fall roster changes do not affect finalized Spring snapshot
- Unit tests: unfinalizeLeagueSeason sets status to OPEN, preserves snapshots
- Unit tests: full-year view includes both Spring and Fall involvement
- Unit tests: viewing Spring match uses Spring squad composition
- Integration tests: finalization fails for non-existent or already-finalized periods

## Boundaries

- Always: Use `requireCoachAccess()` on finalization actions
- Always: Preserve snapshot data immutably — never mutate after creation
- Always: Current planning flows must continue working for OPEN periods
- Ask first: Schema changes for snapshot models
- Never: Delete snapshot data on un-finalization
- Never: Freeze team identity — only freeze period-specific composition

## Success Criteria

- Spring/Fall finalization exists as a server action
- Team compositions are preserved per finalized period
- Blå can have different Spring and Fall squad compositions
- Looking at Spring matches uses Spring squad/history, not current roster
- Full-year snapshots preserve historical involvement across the year
- Finalized snapshots are not accidentally mutated by later roster changes
- Un-finalization reopens the period without deleting snapshots
- Existing current planning flows still work for OPEN periods
- Typecheck, lint, tests, and build pass

## Open Questions

- Should finalization require all matches to have post-match reports? (Deferring — can be added as a warning)
- Should the snapshot include match results and selection details, or just team composition? (Starting with team composition + player details; match data is already preserved via Selection records)