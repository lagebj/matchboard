---
type: ADR
id: "0012"
title: Position-first event generation with read-only lineup board and no tactic suggestion
status: active
date: 2026-07-08
supersedes: "0009"
supersedes_by:
tags: [selection-engine, event-squad, ui, domain-model]
---

## Context

ADR-0009 defined position-first tactical generation and canonical position resolution. The current `event-squad-generation.ts` implementation has partial position-first logic but several problems:

1. **Tactic suggestion overrides the selected event formation.** The event detail page shows "Best tactic fit" and per-squad suggestions. The feature requires that the event's selected default formation/tactic is the only formation used for generation and display. No alternative tactic suggestion should appear.

2. **Rating still dominates in balanced distribution.** The `distributeAllBalanced` function uses a snake-order slot fill that groups by role type, but within each group it still sorts by `overallLevel` first for candidate selection. The snake order also fills Squad 1 first, then Squad 2, etc., causing positional clustering.

3. **Tertiary positions are not treated as emergency-only.** The current code treats tertiary and secondary with similar priority gaps. The feature requires tertiary to be a last resort with visible emergency notes.

4. **Scarcity protection is incomplete.** The `computePositionScarcity` function exists but its output is passed but not used to protect scarce-role primary players from being consumed as flexible fill.

5. **No lineup assignment output.** The generation produces `EventSquadAssignment` with role type and position, but no formation slot placement (grid position, slot index, lineup order). The coach cannot see which player is intended where in the selected formation.

6. **No read-only lineup board.** Event squads show player lists but no tactical pitch view. The coach needs to immediately see position placement, fit tier badges, and emergency coverage notes.

## Decision

### 1. Use selected event formation only — remove tactic suggestion

- Event squad generation uses the event's `defaultFormationId` (or the event's game-format fallback).
- Per-squad formation overrides are not used for auto-suggestion. If a squad has a `formationId` set, that is used (for manual override), but generation does not auto-suggest a different formation.
- The UI displays "Event tactic: {formationName}" or "Using event tactic: {formationName}".
- The UI does not display "Suggested tactic", "Best tactic fit", or "Recommended formation".
- The `tacticSuggestion` and `squadTacticSuggestions` fields are removed from the event detail page.

### 2. Position-first staged selection algorithm

Generation fills slots in a strict tier order:

1. PRIMARY candidates for each slot, sorted by role-relevant rating
2. SECONDARY candidates only after all PRIMARY candidates are exhausted
3. TERTIARY candidates only after all PRIMARY and SECONDARY candidates are exhausted
4. NO_FIT emergency candidates as last resort

Within each tier, rating is the tie-breaker. Rating never overrides a higher fit tier.

Role-relevant rating for slot types:
- Goalkeeper slot: goalkeeperAbility first, then decisionMaking/concentration/positioning
- Defender slot: oneVOneDefending, positioning, decisionMaking, strength, effort
- Midfielder/central slot: passing, firstTouch, decisionMaking, positioning, teamplay
- Forward/striker slot: oneVOneAttacking, ballControl, firstTouch, speed, decisionMaking
- Flexible slot: overallLevel only after scarcity protection

### 3. Distribute primary positions across squads before rating optimization

For ALL_BALANCED mode:

1. Read required slots from the selected event formation (or game-format fallback).
2. Group slots by broad role (goalkeeper, defender, midfielder, forward, flexible).
3. Count available PRIMARY players per role.
4. Count required slots per role across all squads.
5. Assign scarce roles first across all squads (goalkeepers, then defenders, then midfielders, then forwards).
6. Use snake draft to distribute primary-position candidates across squads for each role.
7. Only then use SECONDARY candidates for squads still missing that role.
8. Only then use TERTIARY candidates.
9. Fill flexible/bench positions last.
10. Run a bounded swap pass to reduce rating imbalance without breaking position coverage.

### 4. Tertiary is emergency only

- Tertiary candidates receive a large selection penalty.
- Tertiary is never used while primary or secondary candidates remain for the slot.
- Tertiary assignment creates a visible planning note: "Assigned as emergency {position} cover because no primary or secondary {position} was available."
- Disallowed: "Selected as good fit" or "Selected as tertiary position" without emergency context.

### 5. Protect scarce natural roles

- Count primary-position availability per broad role.
- Count required slots per broad role across all squads.
- Mark roles as scarce when primary candidates ≤ required slots.
- Do not assign scarce-role primary players to flexible/bench slots until their natural role demand is covered.
- Generate notes: "Only {n} primary {role}s available for {m} squads. Secondary {role} cover is required."

### 6. Store lineup assignments from generation

Add to `EventSquadPlayer` if existing fields are insufficient:
- `assignedSlotIndex Int?` — formation slot position
- `assignedSlotLabel String?` — slot label (e.g., "Left back")
- `assignedRoleType FormationSlotRoleType?` — GK/DEF/MID/FWD/FREE
- `lineupOrder Int?` — starting lineup order

These are populated by generation. Manual/locked players without a slot remain visible but don't fake a slot.

### 7. Read-only lineup/tactics board per event squad

Each event squad view shows:
- Selected event formation name
- Pitch/tactics board with players placed in formation slots
- Unplaced/bench players below the board
- Fit tier badges: Primary, Secondary, Emergency, No fit
- Squad average rating (stars + number)
- Warnings/notes about position compromises

The board is read-only in this iteration. No drag/drop, no slot reassignment, no tactic editing.

### 8. Competitive squad is formation-first, not rating-first

For ONE_COMPETITIVE_BALANCED_REMAINDER:
- Build competitive squad by selected event tactic/role needs.
- Use primary-position candidates first.
- Use rating only within the same role/fit tier.
- After competitive squad is built, apply improved balanced algorithm to remaining squads.
- Warn if competitive squad consumes scarce coverage: "Competitive squad uses {n} of {m} primary {role}s. Balanced remainder needs emergency {role} coverage."

### 9. Balance scoring prioritizes role coverage

Balance scoring uses a penalty system:

```
sizePenalty + goalkeeperPenalty + missingPrimaryRolePenalty +
secondaryFallbackPenalty + tertiaryEmergencyPenalty + noFitPenalty +
ratingSpreadPenalty + unratedSpreadPenalty = totalPenalty
```

A squad with lower rating but correct role coverage is preferred over a higher-rated squad with no natural striker.

### 10. Lineup assignment utility

New file: `src/lib/events/event-lineup-assignment.ts`

API:
```ts
type EventLineupAssignment = {
  formationId: string | null;
  formationName: string | null;
  slots: EventLineupSlot[];
  benchPlayerIds: string[];
  notes: string[];
};

type EventLineupSlot = {
  slotIndex: number;
  slotLabel: string;
  roleType: string;
  playerId: string | null;
  positionFitTier: 'PRIMARY' | 'SECONDARY' | 'TERTIARY' | 'NO_FIT' | null;
  reason: string | null;
};
```

This utility receives the selected event formation and assigns players into it. It does not choose a different formation.

## Alternatives considered

- Keep tactic suggestion alongside selected formation — rejected because the feature explicitly says "Do not suggest alternative tactics/formations" and the coach already chose a formation at event creation.
- Use a weighted-score approach for fit tiers — rejected because weights can be tuned to bypass tiers. Staged selection with hard tier boundaries is the correct model.
- Allow per-squad formation overrides for auto-suggestion — rejected for this iteration. Squad `formationId` remains for manual override only.

## Consequences

- Positive: Coaches see exactly which formation their squads were built for
- Positive: No player with a natural position for a slot is skipped in favor of a higher-rated player in a secondary position
- Positive: Emergency coverage is explicitly visible, not hidden
- Positive: Balanced squads distribute natural roles across squads
- Positive: Lineup board gives immediate tactical overview
- Negative: Generation is more complex and slower than pure-rating sort
- Negative: Read-only lineup board means coaches cannot adjust lineups in this iteration
- Neutral: Per-squad formation override field exists but is not used for auto-suggestion

## Re-evaluation triggers

- If coaches need to edit lineups interactively (would require ADR for editable lineup board)
- If formation slot accepted positions need position code mapping beyond broad positions
- If competitive squad needs different formation than balanced remainder (would require per-squad tactic support ADR)