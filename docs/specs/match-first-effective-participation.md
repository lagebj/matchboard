# Spec: Match-First Effective Participation Model

## Objective

Refactor the Matchboard selection engine and all related calculations/UI surfaces around a simpler match-first model with a central effective participation layer.

The app must stop having each page invent its own interpretation of participation. It must have one coherent domain model for what counts.

## Core Domain Principles

### Match is the real unit

The match is the real unit of planning and participation.
The round/week is only a collision boundary — it prevents a player being planned for two matches in the same week.
The period/season is only a memory window — it provides fairness context across weeks.

### Planned selection is archived intent

`Selection` with `status = FINALIZED` means "the coach approved this squad before the match."
It does NOT mean the match was played.
It does NOT mean the actual squad is known.

`Selection` with `status = DRAFT` means "a generated or partially edited plan exists."
Draft selections can be regenerated.
Draft data must not count as actual participation.

### Match report is match truth

`PostMatchReport` with `status = REPORTED` or `LOCKED` means "actual match data has been submitted."
Actual appearances, goals, assists, and absences are the source of truth for:
- Season statistics
- Fairness calculations
- Load history
- Future planning context

`DRAFT` report data must not count as actual participation.
`NOT_STARTED` (no report row) means no actual data exists.

### The engine is a weekly match allocator with memory

It should:
- Generate good planned match opportunities
- Respect support priority
- Avoid planned double-load
- Use history to avoid unfair patterns
- Record reality after the match
- Let reality influence future weeks

It should NOT:
- Simulate RSVP/backfill chaos
- Assign players to two matches in the same week
- Generate BACKFILL as a planning role
- Generate controlled double-load

## Planned Roles

The selection engine must only produce three planned roles:

| Role | Meaning |
|------|---------|
| CORE | Player is selected for their own team |
| SUPPORT | Player is moved to help another team that needs players |
| DEVELOPMENT | Player is moved to another team for development/challenge |

Priority: SUPPORT need > DEVELOPMENT opportunity.

One planned match opportunity per player per round/week.

### Removed from planned generation

| Concept | Reason |
|---------|--------|
| BACKFILL | Backfill is handled manually outside Matchboard close to match date. Not generated. |
| CONTROLLED_DOUBLE_LOAD | A player must not be planned for two matches in the same round/week. |
| CONFIDENCE_REBUILD | Not a planning role. If needed, a DEVELOPMENT path serves this purpose. |

### What happens to existing data

- `SelectionRole.BACKFILL` remains in the Prisma enum for backward compatibility of historical data.
- `SelectionRole.CONFIDENCE_REBUILD` remains in the Prisma enum for backward compatibility.
- `SelectionRole.DOUBLE_LOAD` is already removed (migrated).
- `controlledDoubleLoad` field on `Selection` is marked as legacy. No new `true` values should be written.
- The generation engine must not create selections with these roles or flags.
- Historical data with these values must still be readable for season overview and audit.

### Manual override

Manual draft edits can still assign any role (including BACKFILL, CONFIDENCE_REBUILD) if the coach explicitly overrides with a reason. The engine will not generate these, but a coach can.

## Actual Appearance Source

Post-match reporting records what actually happened:

| Source | Meaning |
|--------|---------|
| PLANNED | Player was in the planned squad and actually played |
| ADDED_POST_MATCH | Player was not in the planned squad but actually played |
| EMERGENCY_BACKFILL | Player was manually drafted outside Matchboard close to match date |

Emergency backfill is actual history, not planned generation.

## Actual Double-Load

Planned double-load is NOT allowed. The engine must never assign a player to two matches in the same round/week.

Actual double-load may happen because reality forced it (late sickness, injury, no-show). When a player appears in two post-match reports in the same round/week, that is actual double-load. It:
- Must affect future fairness/load
- Must NOT mutate finalized planned selections
- Must be recorded as actual history

## Effective Participation Layer

A central domain module provides the single source of truth for all derived calculations, warnings, stats, badges, summaries, and UI surfaces.

### Module: `src/lib/selection/effective-participation.ts`

#### Core types

```typescript
type ParticipationSource =
  | "PLANNED_DRAFT"
  | "PLANNED_FINALIZED"
  | "ACTUAL_REPORTED"
  | "ACTUAL_LOCKED";

type EffectiveParticipationRow = {
  playerId: string;
  matchId: string;
  matchRoundId: string;
  teamId: string;
  plannedRole: SelectionRole | null;
  actualSource: "PLANNED" | "ADDED_POST_MATCH" | "EMERGENCY_BACKFILL" | null;
  plannedSelectionStatus: "DRAFT" | "FINALIZED" | null;
  reportStatus: "NOT_STARTED" | "DRAFT" | "REPORTED" | "LOCKED" | null;
  played: boolean;
  absenceReason: string | null;
  countsForLoad: boolean;
  countsForFairness: boolean;
  countsForSeasonStats: boolean;
  source: ParticipationSource;
  goals: number;
  assists: number;
};
```

#### Rules

For REPORTED or LOCKED matches:
- Actual appearances count as participation
- Planned-but-absent players do NOT count as having played
- Post-match-added players count as having played
- Emergency backfill players count as having played
- Actual double-load is allowed as historical fact
- Actual double-load affects later fairness/load
- Planned selection remains archived intent
- Do NOT double-count planned plus actual

For matches with NOT_STARTED or DRAFT report:
- Finalized planned selections count as expected participation
- Draft planned selections may count as future planning context
- Draft report data must NOT count as actual participation
- Draft report data must NOT affect season stats

For finalized planned selections:
- They are archived intent
- Regeneration must NOT mutate them

For reported/locked match reports:
- They are archived reality
- Regeneration must NOT mutate them

For future draft/unselected matches:
- They may be regenerated
- They should use effective history from previous played/reported/finalized data

#### Exported functions

```typescript
getEffectiveParticipationHistory(playerId: string, options: { planningPeriodId?: string; beforeDate?: Date }): Promise<EffectiveParticipationRow[]>
getEffectivePlayerParticipation(playerId: string, matchId: string): Promise<EffectiveParticipationRow | null>
getEffectiveMatchParticipation(matchId: string): Promise<EffectiveParticipationRow[]>
getEffectiveRoundParticipation(matchRoundId: string): Promise<EffectiveParticipationRow[]>
getEffectivePlanningContext(matchRoundId: string): Promise<EffectiveParticipationRow[]>
getEffectiveSeasonStats(playerId: string, planningPeriodId: string): Promise<PlayerSeasonStats>
```

All consumers of participation data must use these functions instead of querying `Selection`, `PostMatchPlayerActual`, or other tables directly. Exceptions:
- Raw audit views
- Migration/backward compatibility
- Planned-selection-only display
- Explicit admin/debug views
- Persistence/write operations

## Selection Engine Behavior

### Generation rules

Planned generation:
- Never assigns BACKFILL
- Never assigns controlled double-load
- Never assigns CONFIDENCE_REBUILD
- Never assigns a player to two matches in the same round/week
- Only produces CORE, SUPPORT, DEVELOPMENT
- Support need has priority over development opportunity
- Lower/most vulnerable team support need has priority

### Regeneration rules

- Uses effective participation history for load/fairness calculations
- Only affects future DRAFT or unselected matches
- Must NOT modify FINALIZED planned selections
- Must NOT modify REPORTED or LOCKED match reports
- Must account for actual emergency backfill from already reported matches
- Must account for actual double-load from already reported matches
- Planned-but-absent players must NOT be treated as if they played
- Post-match-added players must count in future load/fairness
- Manual draft overrides: user must choose preserve or discard explicitly

### What gets removed/quarantined from generation

| Component | Action |
|-----------|--------|
| `evaluate-controlled-double-load.ts` | Remove from pipeline. Keep file as quarantine. |
| `DOUBLE_LOAD_NEEDED` override reason | Keep in OverrideReasonCategory enum for backward compat. Do not generate. |
| BACKFILL as generated category | Remove from generation categories. Keep in Prisma enum. |
| CONFIDENCE_REBUILD as generated category | Remove from generation categories. Keep in Prisma enum. |
| `controlledDoubleLoad` flag on `SelectedPlayer` | Remove from generation. Keep field in DB as legacy. |
| Double-load warning codes | Remove `double_load_exceeded_max`, `double_load_squad_full`, `controlled_double_load` from generation. Keep codes in warning catalog for backward compat. |

## Fairness/Load Behavior

Effective participation layer feeds all fairness and load calculations:
- Use actual appearances for REPORTED/LOCKED matches
- Use finalized planned appearances for non-reported past/fixed matches
- Use draft planned appearances only as future planning context, not historical truth
- Count post-match-added players
- Count emergency backfill players
- Do NOT count planned-but-absent players as played
- Actual double-load counts as real load and must influence future fairness
- Planned double-load must NOT exist

## Warnings Behavior

Separate planned warnings from actual-history warnings.

Planned warnings answer: "Is this plan valid?"
Actual-history warnings answer: "What happened that future plans should account for?"

Rules:
- Planned warnings must NOT show controlled double-load
- Planned warnings must NOT show double-load for the generated plan
- If a player is planned into two matches in same round/week, treat as hard validation failure
- Actual double-load may be shown as historical context after reporting
- Actual double-load should affect future fairness
- Actual double-load must NOT retroactively mutate planned selections
- Planned-but-absent players should NOT trigger load warnings as if they played
- Post-match-added players should affect future load/fairness warnings

## UI/Page Requirements

### Fixtures page
- Show planned selection status alongside match report status
- Correct squad counts/load indicators from effective participation
- Correct warning summaries from effective participation

### Round review / round board
- Use effective participation for player board, unassigned list, warnings, squad counts
- No pre-planning double-load warning badges
- No controlled double-load planning state
- Player can only appear in one planned match per round/week
- Emergency backfill belongs in post-match report, not round review planning

### Match detail/report
- Clearly separate planned squad from actual squad
- Show planned-but-did-not-play with absence reason
- Show added post-match players
- Show goals, assists, report status, selection status
- Reporting must NOT mutate planned selection
- Reopening a report must NOT mutate planned selection

### Player profile
- Use effective participation and actual reported stats
- Show actual appearances, planned appearances separately if useful
- Show goals, assists
- Show missed planned matches by reason
- Show added post-match appearances
- Show emergency backfill appearances
- Show actual double-load history
- Season stats use only REPORTED/LOCKED actual appearances
- Goals/assists count only from REPORTED/LOCKED reports
- DRAFT report data must NOT count as final season stats
- If no actual report, planned data shown separately as planned/pending

### Planning period / season fairness
- Use effective participation for load counts, fairness scores, support counts, development counts
- Count emergency backfill appearances separately
- Count actual double-load
- Show planned vs actual participation

## Data Model

### What stays

- `Selection` model with `status = DRAFT | FINALIZED` remains distinct from actual appearance
- `PostMatchPlayerActual` linked to Player
- `MatchReportPlayerStat` linked to Player
- `MatchReportAbsence` linked to Player
- `MatchReportStatus` enum (DRAFT, REPORTED, LOCKED) separate from planned selection status
- `PlannedAbsenceReason` enum with controlled values
- `ActualAppearanceSource` concept via `PostMatchPlayerActual.source` field
- `MovementLedger` for non-core movement tracking

### What gets quarantined

- `SelectionRole.BACKFILL` in Prisma enum — marked as legacy, no new generation writes
- `SelectionRole.CONFIDENCE_REBUILD` in Prisma enum — marked as legacy, no new generation writes
- `Selection.controlledDoubleLoad` field — marked as legacy, no new generation writes `true`

### Schema changes

None required at this point. The Prisma enum values BACKFILL and CONFIDENCE_REBUILD remain for backward compatibility. The generation engine simply stops producing them.

## Current Limitations

1. The effective participation layer is new code that needs to be written and integrated
2. Existing season overview (`get-season-overview.ts`) is 791 lines of complex code that will need careful refactoring
3. The round board UI (`round-board.tsx`) likely has embedded BACKFILL/double-load logic that needs audit
4. Some warning codes reference BACKFILL/controlled-double-load and need updating
5. Manual draft edit validation allows BACKFILL role assignment — this is acceptable as manual override
6. The `get-target-team-eligibility.ts` returns BACKFILL/CONFIDENCE_REBUILD categories — these need to be limited to manual override only
7. Migration scripts (`migrate-double-load-roles.ts`, `migrate-squad-repair-roles.ts`, `backfill-movement-ledger.ts`) are maintenance utilities that should remain available but not be part of the generation pipeline