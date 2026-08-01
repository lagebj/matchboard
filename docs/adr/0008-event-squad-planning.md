---
type: ADR
id: "0008"
title: Event-specific temporary squad planning for cups and tournaments
status: active
supersedes_by: "0009"
date: 2026-07-07
supersedes:
supersedes_by:
tags: [schema, selection-engine, ui, domain-model]
---

## Context

Matchboard currently plans squads for league match rounds. Coaches need temporary event squad planning for cups, tournaments, and friendly days where multiple squads must be formed from a shared player pool in one event — not tied to league teams or match rounds.

Key constraints:
- Event squads are temporary planning artifacts, not permanent Team rows
- Player attributes are needed for event generation but currently default to 0 (falsely treated as skill values)
- Events use availability-gated player pools separate from league MatchRound availability
- Squad generation uses formation/tactic coverage, not just raw skill sorting
- "Competitive squad" must be tactic-aware, not "top N by overall"
- Player ratings are coach-facing internal planning context — never parent-facing or public

Current state:
- Player attributes are `Int` with default `0`, making "not rated" indistinguishable from "rated 0"
- No Event, EventSquad, or EventPlayerAvailability models exist
- Formation infrastructure exists (Formation, FormationSlot, FormationSlotRoleType) but is not connected to squad generation
- The selection engine operates per-MatchRound with RotationPath-driven movement — a fundamentally different model from event squad balancing

## Decision

### 1. Player attributes: nullable with explicit "Not rated" state

Migrate the 12 Player numeric attribute fields from `Int @default(0)` to `Int?` (nullable). Add a `goalkeeperAbility` enum field (`NO`, `EMERGENCY`, `YES`) and a `lastRatedAt DateTime?` timestamp.

UI rules:
- `null` displays as "Not rated" — never as 0 or max skill
- Event generation treats unrated attributes as uncertainty, not low ability
- Rating scale is 1–10 with explicit meaning: 2 = needs support, 4 = developing, 6 = steady, 8 = strong, 10 = standout in this group
- Goals, assists, and post-match stats must never directly become skill ratings
- Ratings are internal coach-facing planning context, not parent-facing or public
- Server-side validation: null or integer 1–10 only

Composite attribute mapping for event generation:
- `overallLevel`: average of all non-null attributes (or null if all null)
- `defending`: average of `oneVOneDefending` + `positioning` (or null)
- `attacking`: average of `oneVOneAttacking` + `ballControl` (or null)
- `gameUnderstanding`: average of `decisionMaking` + `positioning` (or null)
- `intensity`: average of `effort` + `concentration` (or null)
- `teamplay`: direct value (or null)
- `goalkeeperAbility`: enum field, not a numeric rating

### 2. Event models as separate temporary planning objects

New Prisma models:

- **Event**: top-level container with name, type (CUP/TOURNAMENT/FRIENDLY_DAY/OTHER), date range, game format, source planning period, default formation, selection pattern, notes
- **EventPlayerAvailability**: per-player availability for this event (AVAILABLE/UNAVAILABLE/UNKNOWN/RESERVE/LATE_ADDITION/WITHDRAWN)
- **EventSquad**: named squad within an event with intent (COMPETITIVE/BALANCED/MANUAL), target/min/max sizes, formation override, generation order, balance summary
- **EventSquadPlayer**: player assignment within a squad with role type, position, source (AUTO/MANUAL/LOCKED), locked flag, selection reason

Event squads are NOT normal Team rows. They are temporary event artifacts with no league identity.

### 3. Event availability gates generation

- Only AVAILABLE players are included by default
- RESERVE and LATE_ADDITION are included only when the coach explicitly enables them
- UNAVAILABLE, UNKNOWN, and WITHDRAWN players are excluded from generation
- Before generation, show validation: available count, target sizes, missing ratings, goalkeeper coverage, position coverage

### 4. Formation/tactic selection drives squad generation

- Event has optional default formation
- Each EventSquad may override the default formation
- Generation fills formation slot requirements first (goalkeeper, defender, midfielder, forward), then optimizes for balance or competitiveness
- If no formation is selected, fall back to a role template based on GameFormat
- Competitive squad generation prioritizes tactic/formation fit over raw overall score

### 5. Three generation modes

- **ALL_BALANCED**: Distribute all players evenly across squads by skill spread, position coverage, goalkeeper coverage
- **ONE_COMPETITIVE_BALANCED_REMAINDER**: Build one competitive squad by filling formation needs first, then balance remaining players across other squads
- **MANUAL_SEED_AUTO_BALANCE**: Coach locks specific players to squads, generator distributes the rest around those anchors

Generation output includes per-player selection reasons and per-squad balance summaries. No parent-facing labels. No "leftover" language.

### 6. Explainability requirements

Every EventSquadPlayer has a selection reason. Examples:
- "Selected for goalkeeper coverage"
- "Selected as defensive fit for selected formation"
- "Selected to balance remaining squads"
- "Rating uncertainty: player has missing attributes"

Disallowed language: weak player, bad player, low quality, leftover, not good enough, punishment, B team player.

### 7. Integration boundaries

Event squad generation is entirely separate from league Selection, MatchRound, and Availability:
- Does not create Selection rows
- Does not create MatchRound rows
- Does not write to normal Availability
- Does not affect league fairness metrics unless explicitly added later
- Does not mutate finalized match history
- May READ player attributes, positions, formations, and readiness for context

### 8. Navigation and UI

- `/events` added as secondary destination (accessible from Fixtures or a sensible navigation entry)
- Event list page, event detail/planning page, create/edit flow
- Event detail includes: availability pool editor, formation selector, selection pattern selector, squad setup cards, generate button, squad result board, balance summary, missing data notes
- No parent-facing export from events in this iteration

### 9. Product language rules

- Use "Event" for cup/tournament/friendly-day context
- Use "Event squad" for temporary squads
- Use "Competitive squad", not "topped team" or "A team"
- Use "Balanced remainder", not "leftover players" or "B team"
- Use "Not rated", not default max rating
- Do not expose player ratings in parent-facing exports

## Alternatives considered

- Option 1: Reuse Team model for event squads — rejected because event squads are temporary artifacts with different lifecycle (create, generate, adjust, discard) and should not pollute the permanent team registry
- Option 2: Add event squads to the existing match-round selection pipeline — rejected because the selection engine operates on league-specific concepts (RotationPath, same-round conflict, core team membership) that don't apply to event squad balancing
- Option 3: Keep player attributes as Int with a sentinel value for "not rated" (e.g. -1) — rejected because nullable Int? is the standard database pattern for optional values and avoids ambiguity
- Option 4: Create a parallel tactic system — rejected because existing Formation/FormationSlot infrastructure already covers the need; extend it rather than duplicate
- Option 5: Use a single "skill rating" number per player — rejected because event generation needs tactic-aware coverage (goalkeeper, defending, attacking, game understanding) not a single scalar

## Consequences

- Positive: Coaches can plan cup/tournament squads with proper availability gating, formation awareness, and balance controls
- Positive: Player attributes become editable with explicit unrated state — no more false max/zero defaults
- Positive: Event squads are fully separated from league planning — no risk of polluting match-round selection
- Positive: Competitive squad generation is role/tactic-aware, not raw top-N ranking
- Positive: Balanced remainder players are deliberately distributed, not dumped
- Negative: New schema models add complexity — Event, EventPlayerAvailability, EventSquad, EventSquadPlayer
- Negative: Player attribute migration from Int default(0) to Int? requires data migration for existing 0 values (treat existing 0 as null/Not rated)
- Negative: Additional UI surface to build and maintain (event list, detail, availability editor, squad board)
- Neutral trade-offs: Event squads don't affect league fairness metrics yet; this may be added later as an explicit feature

## Re-evaluation triggers

- If event squads need to feed into league planning (would require explicit ADR for cross-boundary integration)
- If player attribute ratings need to become visible to parents (would require new ADR for privacy boundaries)
- If competitive squad generation needs more sophisticated optimization than formation-fit-first (may need tuning ADR)
- If event squad snapshots need to be preserved as historical records (would need finalization/snapshot ADR)