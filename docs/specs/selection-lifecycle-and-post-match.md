# Selection Lifecycle, Double-Load Policy, and Post-Match Registration

## Selection lifecycle

### States

| Status | Meaning | Available actions |
|--------|---------|-------------------|
| NOT_GENERATED | No selections exist | Create draft |
| DRAFT | Selections generated, not finalized | Recreate draft, Clear draft, Finalize |
| BLOCKED | Draft with hard-block warnings | Recreate draft, Clear draft, Finalize (with override) |
| READY | Draft with no blockers | Recreate draft, Clear draft, Finalize |
| FINALIZED | Locked history | Un-finalize |

### State transitions

```
NOT_GENERATED → create draft → DRAFT
DRAFT → finalize → FINALIZED
DRAFT → clear → NOT_GENERATED (draft data removed)
DRAFT → regenerate → DRAFT (manual edits preserved)
FINALIZED → un-finalize → DRAFT (selections revert to DRAFT, movement ledger reverts to isDraft=true)
```

### UI must update immediately after every mutation

After any selection action (create, recreate, clear, finalize, un-finalize), the UI must reflect the new state without requiring a manual page reload. This is achieved through:
- `revalidatePath` calls in server actions to invalidate Next.js router cache
- `router.refresh()` calls on the client side for mutations that don't redirect

### Un-finalize stale state fix

When a round is un-finalized:
1. The server action updates selections from FINALIZED to DRAFT
2. The server action updates movement ledger entries from isDraft=false to isDraft=true
3. The server action updates the round status from FINALIZED to the derived status
4. `revalidatePath` invalidates the path cache
5. The client calls `router.refresh()` to immediately reflect the state change
6. If the mutation fails, an error is shown and previous state is preserved

## Double-load policy

### Pre-planning: no double-load allowed

In pre-planning (draft and finalized selections), double-load is not an accepted state:
- A player can only appear in one match per round
- Dragging a player between match columns moves the player (not duplicates them)
- The `controlledDoubleLoad` field on Selection is reserved for future post-match registration
- No "double-load" warning or badge appears on player chips in the round board during pre-planning

### Post-match registration: double-load is reality

During post-match registration, a player may actually play in two matches in the same round. This is recorded as actual participation, not as pre-planned selection:
- The player has one MatchAppearance per match they actually played
- This is distinct from the planned Selection record
- Pre-planned Selection and actual MatchAppearance are separate data models

### Drag-and-drop behavior

When a player is dragged from one match column to another:
1. The player is added to the target match (via `addPlayerToDraftMatch`)
2. The player is removed from the source match (via `removePlayerFromDraftMatch`)
3. This is a move, not a copy
4. Backend enforces same-round uniqueness — if a player already exists in the target match, an override reason is required

## Post-match registration

### Purpose

Post-match registration records what actually happened, which may differ from what was planned. This is where reality diverges from the plan.

### Data model

Uses existing Prisma models extended with new fields and a Goal model:

**PostMatchReport** — the top-level registration for a single match's actual outcome:

| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| matchId | String (unique) | The match this registration belongs to |
| status | String | "NOT_STARTED", "IN_PROGRESS", or "COMPLETED" |
| homeGoals | Int? | Goals scored by the home team |
| awayGoals | Int? | Goals scored by the away team |
| teamNote | String? | Free-text coach notes |
| completedBy | String? | Who completed the report |
| completedAt | DateTime? | When the report was completed |
| createdAt | DateTime | Created timestamp |
| updatedAt | DateTime | Updated timestamp |

**PostMatchPlayerActual** — a player's actual participation in a match:

| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| matchId | String | The match (denormalized for query convenience) |
| playerId | String | FK to Player |
| source | String | "PLANNED" (seeded from selection) or "ADDED_POST_MATCH" (added manually) |
| attendanceStatus | String | "PRESENT", "NO_SHOW", "LATE_CANCELLATION", "ABSENT_CONFIRMED", "UNKNOWN" |
| actualPositions | Json? | Position data (reserved for future use) |
| note | String? | Per-player notes |
| createdAt | DateTime | Created timestamp |
| updatedAt | DateTime | Updated timestamp |

**Goal** — a goal scored in the match:

| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| reportId | String | FK to PostMatchReport |
| playerId | String? | FK to Player (nullable for unknown scorer / own goal) |
| minute | Int? | Minute the goal was scored |
| type | String | "NORMAL" or "OWN_GOAL" (default "NORMAL") |
| createdAt | DateTime | Created timestamp |
| updatedAt | DateTime | Updated timestamp |
| updatedAt | DateTime | Updated timestamp |

**MatchAppearance** — a player's actual participation in a match:

| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| matchRegistrationId | String | FK to MatchRegistration |
| matchId | String | The match (denormalized for query convenience) |
| playerId | String | FK to Player |
| source | "PLANNED" or "ADDED_POST_MATCH" | Whether this appearance was seeded from planned selection or added manually |
| played | Boolean | Whether the player actually played (default true; false for late scratch) |
| createdAt | DateTime | Created timestamp |
| updatedAt | DateTime | Updated timestamp |

**Goal** — a goal scored in the match:

| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| matchRegistrationId | String | FK to MatchRegistration |
| playerId | String? | FK to Player (nullable for unknown scorer / own goal) |
| minute | Int? | Minute the goal was scored |
| type | "NORMAL" or "OWN_GOAL" | Goal type |
| createdAt | DateTime | Created timestamp |

### Relationship to planned selection

Planned selection (Selection) and actual participation (PostMatchPlayerActual) are separate models:
- Selection = what was planned before the match
- PostMatchPlayerActual = what actually happened
- Seeding copies planned Selection data into PostMatchPlayerActual with source "PLANNED"
- The coach then edits the actuals to reflect reality
- Planned Selections remain unchanged when actuals are edited

### Seeding workflow

1. Coach navigates to a finalized match
2. Coach clicks "Post-match registration" link from match detail
3. If no report exists, coach clicks "Seed from plan"
4. System creates a PostMatchReport with status "IN_PROGRESS"
5. System copies all finalized Selections for that match into PostMatchPlayerActual records with source "PLANNED"
6. Coach can then edit actuals — remove players who didn't play, add players who did, enter goals and result

### UI requirements

- Post-match registration is available from match detail or round detail
- It shows planned squad vs actual squad side by side
- Actual squad can be edited (add/remove players)
- Result entry: home goals, away goals
- Goalscorer registration: select player from actual squad, optionally add minute
- Notes: free-text area
- Save is immediate; DRAFT registrations can be edited later

### Current limitations

- No locking/finalization of post-match registrations yet
- No connection between post-match goals and season statistics yet
- Post-match registration does not affect planned selections or round status

## Fixtures page selection actions

### Round-level actions

Visible near the round header/header area of each round card:
- **Generate squads** (when NOT_GENERATED) — calls `fixtureGenerateRoundAction`
- **Regenerate** (when DRAFT/BLOCKED/READY) — calls `fixtureRegenerateRoundAction`
- **Clear** (when DRAFT/BLOCKED/READY) — calls `fixtureClearRoundDraftAction` with confirmation
- **Finalize round** (when DRAFT/BLOCKED/READY) — calls `fixtureFinalizeRoundAction`
- **Un-finalize** (when FINALIZED) — calls `fixtureUnfinalizeRoundAction` with confirmation

### Match-level actions

Visible in each match row:
- **Generate squads** (when round NOT_GENERATED and no selections for this match) — triggers round-level generation
- **Regenerate** (when DRAFT) — calls `fixtureRegenerateMatchAction`
- **Clear** (when DRAFT) — calls `fixtureClearMatchDraftAction` with confirmation
- **Finalize** (when DRAFT/BLOCKED/READY) — calls `fixtureFinalizeMatchAction`
- No match-level actions within a FINALIZED round (use round-level un-finalize first)

### Period-level actions

Visible in the period header:
- **Populate all rounds** (when any NOT_GENERATED round exists)
- **Regenerate all drafts** (when any DRAFT/BLOCKED/READY round exists)
- **Clear all drafts** (when any draft exists)