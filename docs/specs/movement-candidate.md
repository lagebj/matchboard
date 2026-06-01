# Spec: MovementCandidate

## Objective

Add a new coach-facing domain concept: **MovementCandidate** — a temporary, reviewable relationship indicating that a specific player may be considered for movement from their core team into a specific team context through an active rotation path, for a defined support or development purpose.

MovementCandidate fills the gap between RotationPath (permitted movement direction) and match selection (concrete fixture decision). It answers: "Which specific players are currently reasonable candidates for that movement?" without creating a hidden ranking system, permanent labels, or fixed hierarchy.

### User stories

- As a coach, I want to mark specific players as candidates for specific movement paths so I can plan appropriate challenge and team function.
- As a coach, I want to see which players may move into my team (incoming candidates) and which of my players may move elsewhere (outgoing candidates) on the team detail page.
- As a coach, I want movement candidates preferred during automatic generation but not guaranteed, so the engine helps without becoming rigid.
- As a coach, I want to be prompted when candidate relationships become stale, unreviewed, or one-directional, so I can reflect and adjust.
- As a coach, I want manual override to remain possible — selecting a non-candidate player with a reason, not a hard block.

### What this is NOT

- NOT a ranking system, skill level, or player score
- NOT a replacement for core team belonging
- NOT a guarantee of selection
- NOT a permanent label (temporary and reviewable)
- NOT parent/player-facing

## Tech Stack

- Next.js 16 App Router, TypeScript, Tailwind, Prisma, PostgreSQL (Neon), Auth.js
- Existing selection engine architecture in `src/lib/selection/*`

## Commands

```
Build:      npm run build
Test:       npm test
Lint:       npm run lint
Typecheck:  npm run typecheck
Dev:        npm run dev
Migration:  npx prisma migrate dev --name add_movement_candidate
```

## Project Structure

```
prisma/schema.prisma                          → New MovementCandidate model + enums
prisma/migrations/                            → Migration for new table
src/lib/selection/movement-candidate.ts       → Movement candidate queries and validation
src/lib/selection/movement-candidate-drift.ts → Drift/review detection
src/app/(app)/teams/actions.ts               → Add movement candidate server actions
src/app/api/movement-candidate/route.ts       → API route for candidate CRUD
src/components/team/movement-candidates-tab.tsx → Team detail candidates UI
src/lib/selection/generate-selection.ts       → Candidate-aware filtering integration
src/lib/selection/selection-eligibility.ts     → Candidate preference scoring
src/test/test-db.ts                           → Update cleanTestDb with MovementCandidate
```

## Code Style

Follow existing project conventions:

```typescript
// Server action pattern
export async function createMovementCandidateAction(formData: FormData) {
  await requireCoachAccess();
  // ... validate, prisma op, revalidatePath, redirect
}

// Data layer pattern — pure functions with db parameter or module-level
export async function getIncomingCandidates(teamId: string): Promise<MovementCandidateSummary[]> {
  // db query, transform, return
}

// Selection engine integration — optional filter, not hard gate
const activeCandidates = await getActiveMovementCandidatesForPath(rotationPathId, role);
// Prefer candidates; fall back to all eligible players on path
```

## Testing Strategy

- **Unit tests**: MovementCandidate validation, drift detection, candidate-aware eligibility logic (Vitest, `src/**/*.test.ts`)
- **Integration tests**: CRUD via server actions, selection engine with/without candidates
- **Regression tests**: Existing rotation path behaviour, match generation, post-match reporting all still work with zero candidates

## Boundaries

- Always: Run `npm test`, `npm run typecheck`, `npm run lint` before commits; validate all inputs; use `requireCoachAccess()` on all data-mutating endpoints; use player IDs in stored/external payloads; use neutral language
- Ask first: Changes to existing selection engine scoring; new Prisma enums that might overlap existing ones
- Never: Auto-generate candidates from match history; expose candidates to parents/players; add numeric player scores or skill levels; bypass rotation path rules; make MovementCandidate a hard gate for manual overrides

## Data Model

```prisma
model MovementCandidate {
  id              String                    @id @default(cuid())
  playerId        String
  rotationPathId  String
  role            MovementCandidateRole
  status          MovementCandidateStatus   @default(ACTIVE)
  activeFrom      DateTime                  @default(now())
  reviewBy        DateTime?
  rationaleCategory MovementCandidateRationale
  rationaleNote   String?
  createdAt       DateTime                  @default(now())
  updatedAt       DateTime                  @updatedAt

  player          Player                    @relation(fields: [playerId], references: [id], onDelete: Cascade)
  rotationPath    RotationPath              @relation(fields: [rotationPathId], references: [id], onDelete: Cascade)

  @@unique([playerId, rotationPathId, role])
  @@index([playerId])
  @@index([rotationPathId])
  @@index([status])
}

enum MovementCandidateRole {
  SUPPORT
  DEVELOPMENT
}

enum MovementCandidateStatus {
  ACTIVE
  PAUSED
}

enum MovementCandidateRationale {
  CHALLENGE_EXPOSURE
  CONFIDENCE_AND_INVOLVEMENT
  STABILISE_TEAM_FUNCTION
  SUPPORT_TEAMMATES
  POSITIONAL_LEARNING
  RESET_AND_RESPONSIBILITY
  COACH_JUDGEMENT
}
```

### Validation rules

- `playerId` must reference an existing active player
- `rotationPathId` must reference an existing active rotation path
- `role` must match the rotation path's role (SUPPORT candidate on SUPPORT path, DEVELOPMENT candidate on DEVELOPMENT path; BACKFILL paths authorize SUPPORT candidates per existing convention)
- Player must belong to the source team of the rotation path (player.coreTeamId === rotationPath.fromTeamId)
- Unique constraint: one candidate per (player, rotationPath, role) combination
- Cannot create ACTIVE candidate if rotation path is inactive
- Cannot create candidate for non-rotatable player

## Selection Engine Integration

### Candidate-aware filtering

When generating non-core selections, the engine should:

1. Determine which active MovementCandidates exist for the target match's team, the relevant rotation path, and role
2. **Prefer** active candidates over non-candidate eligible players
3. If no active candidates exist or all candidates are exhausted, **fall back** to existing behaviour (any eligible player on the rotation path)
4. Record whether fallback was used in the explanation
5. Never block selection for lack of a candidate — manual override not needed for fallback, just flagged

### Scoring modifier

Add a small positive score modifier for active MovementCandidates when ranking rotation candidates. This is a scoring preference, not a hard rule.

### Manual override behaviour

When a coach manually adds a non-core player who is NOT an active MovementCandidate for the relevant path+role:
- Allow with override reason (existing `overrideReasonCategory` + `overrideReasonDetail`)
- Record explanation: "Player is not an active movement candidate for this path"

## Drift Detection

Surface as Planning notes (not Blocked or Decision required):

| Pattern | Detection | Wording |
|---------|-----------|---------|
| Review overdue | `reviewBy` in the past | "Review overdue" |
| Long-running without review | ACTIVE, `reviewBy` null, active for > 8 weeks | "Long-running candidate relationship" |
| Repeated non-core selection | Player moved away from core team in ≥3 consecutive finalized rounds | "Repeated non-core selection" |
| One-way movement | Player only ever moves in one direction across season | "One-way movement pattern" |
| Core replacement | Team's core players replaced by candidates ≥3 rounds | "Core players repeatedly replaced by candidates" |
| Never used | ACTIVE candidate never selected in any finalized round | "Candidate has not been used" |

## UI Requirements

### Team detail: Movement Candidates tab

Add a new tab "Movement candidates" to the team detail page (after "Movement" tab).

Show:

1. **Incoming candidates** — players from other teams who may move into this team
   - Grouped by role: Support candidates / Development candidates
   - Per candidate: player name, source team, role, rationale category, rationale note, active from, review by, status, last used (from movement history), movement count in current planning period

2. **Outgoing candidates** — core players from this team who may move elsewhere
   - Per candidate: player name, target team, role, rationale category, rationale note, active from, review by, status, last used, movement count in current planning period

3. **Add candidate form**
   - Choose player, rotation path, role, rationale category
   - Optional rationale note, optional reviewBy date
   - Helper text: "Candidate status means this player may be considered for this movement path. It does not change core team, guarantee selection, rank the player, or remove normal match opportunities."

4. **Candidate management actions**
   - Pause / Reactivate (toggle status)
   - Edit rationale category, rationale note, reviewBy
   - Delete (hard delete following project convention)

## Migration / Backwards Compatibility

- Create the `MovementCandidate` table empty
- No existing data migration
- Do not infer candidates from match history
- Existing planning periods and teams continue to work with zero candidates
- All existing tests must pass without modification (candidates are additive)

## Success Criteria

1. Coaches can create, pause, reactivate, edit, and delete MovementCandidate records
2. Team detail page shows incoming and outgoing movement candidates
3. Selection engine prefers active candidates but falls back when none exist
4. Manual override works with and without candidate status (reason required when non-candidate)
5. Drift/review warnings surface as Planning notes
6. Existing rotation path, selection, match generation, and post-match behaviour unchanged with zero candidates
7. Language is neutral, coach-facing, and never labels players
8. All existing tests pass

## Open Questions

None — all assumptions confirmed by stakeholder.