# Spec: Opponent Registry and Match Linking

## Objective

Wire opponent search, selection, and creation into league match and event match forms so that every match links to an `OpponentTeam` entity. Normalize opponent names to prevent duplicates. Backfill existing `Match.opponent` strings into `OpponentTeam` records.

## What already exists

- `OpponentTeam` model with `id`, `displayName`, `normalizedName` (unique), `archivedAt`
- `Match.opponentTeamId` FK (required) + `Match.opponent` (legacy string snapshot)
- `OpponentEncounterObservation` model linked to `OpponentTeam`
- `EventMatch.opponentName` (string, no FK to OpponentTeam yet)

## What needs to be built

### 1. Normalization helper
- `src/lib/opponents/normalize-opponent-name.ts`
- `normalizeOpponentName(name: string): string` — trim, lowercase, collapse whitespace, strip common punctuation noise
- Used on create and search

### 2. Opponent search/selection server actions
- `src/app/(app)/opponents/actions.ts` (new file)
- `searchOpponents(query: string): Promise<OpponentTeam[]>` — search by `normalizedName` containing normalized query, exclude archived
- `createOpponent(name: string): Promise<OpponentTeam>` — normalize name, check for existing by `normalizedName`, create if not found, return existing if found
- All actions require `requireCoachAccess()`

### 3. EventMatch opponent FK
- Add `opponentTeamId String?` to `EventMatch` model in schema.prisma
- Add `opponentTeam OpponentTeam? @relation(fields: [opponentTeamId], references: [id])`
- Add `EventMatch` to `OpponentTeam` model's `matches Match[]` relation (rename to `opponentTeamMatches EventMatch[]` or use explicit relation name)
- Migration: `opponentTeamId` is nullable for backward compatibility; existing event matches keep their `opponentName` string
- When creating/editing an event match, if an opponent is selected, set `opponentTeamId`; if a new name is typed, create an OpponentTeam and link it

### 4. Match creation form update
- In match creation (`/matches/new`), add opponent search/select
- Show a searchable dropdown: type to search existing opponents, or type a new name to create
- On form submit: if existing opponent selected, use its id; if new name typed, call `createOpponent` then link
- Preserve `opponent` string snapshot from `OpponentTeam.displayName` at creation time

### 5. Event match creation form update
- In event match creation actions, add opponentTeamId handling similar to league matches
- When editing an event match, allow changing the linked opponent

### 6. Opponent list/admin page (minimal)
- `src/app/(app)/opponents/page.tsx` — list opponents with search, show match count
- Link from this page to opponent detail (future work)
- No full CRUD beyond what the match forms provide — creation happens in-match

### 7. Backfill migration
- Script or migration: for all `Match` rows where `opponentTeamId` is null but `opponent` string is non-empty
- Normalize the `opponent` string
- Find or create `OpponentTeam` by `normalizedName`
- Set `opponentTeamId` on the Match
- For `EventMatch` rows with `opponentName`, same process
- Run as a standalone script, not as a Prisma migration step

## Commands

- Build: `npm run build`
- Test: `npm test`
- Lint: `npm run lint`
- Typecheck: `npm run typecheck`
- Dev: `npm run dev`

## Testing Strategy

- Unit tests for `normalizeOpponentName`
- Unit tests for `searchOpponents` and `createOpponent`
- Integration tests for match creation with opponent linking
- Integration tests for event match creation with opponent linking
- Test that existing opponent is reused by normalized name
- Test that backfill creates OpponentTeam from existing match opponent strings

## Boundaries

- Always: Run typecheck + lint + test before commits
- Always: Use `requireCoachAccess()` on all opponent actions
- Always: Preserve `Match.opponent` and `EventMatch.opponentName` as display-name snapshots
- Ask first: Schema changes (adding `opponentTeamId` to EventMatch)
- Never: Hard-delete opponent records
- Never: Remove the legacy `opponent` string field from Match

## Success Criteria

- League match creation allows selecting or creating an opponent
- Event match creation allows selecting or creating an opponent
- Typing a new opponent name creates an OpponentTeam and links it
- Typing an existing opponent name (even with different case/whitespace) reuses the existing record
- Post-match reports show the opponent name from the linked OpponentTeam
- Existing match data is backfilled with opponentTeamId
- Typecheck, lint, tests, and build pass

## Open Questions

- Should the opponent admin page be a full CRUD surface or list-only for now? (Leaning: list-only, creation via match forms)
- Should we add opponent merge capability? (Deferring to later)