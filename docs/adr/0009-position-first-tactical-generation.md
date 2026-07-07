---
type: ADR
id: "0009"
title: Position-first tactical squad generation with canonical position resolution
status: proposed
date: 2026-07-07
supersedes:
supersedes_by:
tags: [selection-engine, schema, domain-model, event-squad]
---

## Context

ADR-0008 defined event squad planning with formation/tactic-driven generation. The current implementation sorts players by overall rating first, then distributes — making it rating-first despite the ADR stating "competitive squad generation prioritizes tactic/formation fit over raw overall score."

Three problems must be solved:

1. **Rating-first generation contradicts ADR-0008.** The engine sorts by `overallLevel` and picks top-N, only considering position as a tiebreaker. The feature file (lines 5424-5443) requires position/formation fit to be weighted high and overall level medium/high. Generation must fill tactical slots by position fit tier first, then decide within tiers by skill.

2. **Player position has no canonical source of truth.** The `Player` model has flat string fields (`primaryPosition`, `secondaryPosition`, `tertiaryPosition`) and a separate `PlayerPosition` relational model with `PlayerPositionPriority` (PRIMARY/SECONDARY/CAN_PLAY). Neither is authoritative. The generation engine reads flat strings. The formation/lineup system reads flat strings. The `PlayerPosition` table is unused. This dual system will diverge.

3. **CAN_PLAY is ambiguous.** The `PlayerPositionPriority` enum has `CAN_PLAY` instead of `TERTIARY`. The AGENTS.md and feature file use "primary, secondary, and tertiary positions" language. `CAN_PLAY` doesn't match the product vocabulary.

## Decision

### 1. PlayerPosition is the canonical source of truth for player positions

The `PlayerPosition` relational model becomes the single authoritative source for player positions. The flat string fields (`primaryPosition`, `secondaryPosition`, `tertiaryPosition`) on the `Player` model are read-only denormalized caches, kept in sync from `PlayerPosition`.

A new utility `src/lib/players/player-position-resolver.ts` provides:
- `getPlayerPositionProfile(playerId)` — returns ordered position list with priorities from `PlayerPosition`
- `getPositionFitTier(player, broadPosition)` — returns PRIMARY | SECONDARY | TERTIARY | NO_FIT
- `getPlayerBroadPositions(player)` — canonical mapping, replaces the duplicate in `event-types.ts`
- `mapPositionCodeToBroad(positionCode)` — single source of truth for position code → BroadPosition mapping

The position fit tier hierarchy for generation:
- **PRIMARY** — player's primary position maps to the slot's accepted broad positions
- **SECONDARY** — player's secondary position maps to the slot's accepted broad positions
- **TERTIARY** — player's tertiary position maps to the slot's accepted broad positions
- **NO_FIT** — none of the player's positions map to the slot's accepted broad positions

Within each tier, skill ratings decide order. Tiers are never bypassed by skill — a PRIMARY-fit player is always preferred over a SECONDARY-fit player for that slot, regardless of overall rating.

### 2. Rename CAN_PLAY to TERTIARY

The `PlayerPositionPriority` enum value `CAN_PLAY` is renamed to `TERTIARY`. This aligns with the product vocabulary ("primary, secondary, and tertiary positions") used in the feature file and AGENTS.md.

Migration: update existing `CAN_PLAY` rows to `TERTIARY`. The enum value change is a schema migration, not a data migration — existing rows with `CAN_PLAY` are updated.

### 3. Position-first tactical generation algorithm

The generation engine (`event-squad-generation.ts`) is rewritten with a slot-first algorithm:

**Competitive squad (ONE_COMPETITIVE_BALANCED_REMAINDER):**
1. For each formation slot (in tactical priority order: GK → DEF → MID → ATT → FLEX):
   a. Find all unassigned players whose best position fit tier for this slot is PRIMARY
   b. Among PRIMARY-fit candidates, rank by composite skill (overallLevel, then relevant sub-ratings)
   c. If no PRIMARY-fit candidate, try SECONDARY-fit, then TERTIARY-fit
   d. If no fit candidate, mark as uncovered slot (planning note, not blocked)
2. After all slots filled, remaining competitive slots filled by best available

**Balanced distribution (ALL_BALANCED and balanced remainder):**
1. For each squad, identify uncovered tactical slots from formation
2. Assign players to slots using position fit tier (PRIMARY preferred over SECONDARY over TERTIARY)
3. Within same fit tier, rank by skill
4. After slots filled, distribute remaining players for balance
5. Protect scarce-position players from being consumed as flexible fill if another squad needs that position

**Scarcity handling:**
- Count primary candidates per broad position across the pool
- If only 1 GK-capable player exists across N squads, emit a planning note
- If a position has fewer primary candidates than squads needing that position, protect primary-fit players from flexible assignment to other positions first
- Scarcity produces planning notes, never blocked conditions

### 4. Position validation constraints

- One PRIMARY position per player (required)
- One SECONDARY position per player (optional)
- One TERTIARY position per player (optional)
- No duplicate positions across priorities (same position cannot be both PRIMARY and SECONDARY)
- Position values are from the supported list: GK, CB, CM, W, ST (expandable later)

### 5. Selection reasons include position fit tier

Every `EventSquadPlayer.selectionReason` must include the position fit tier that determined the assignment:
- "Selected for goalkeeper coverage (primary fit)"
- "Selected as defensive fit for selected formation (secondary fit)"
- "Selected to balance remaining squads (tertiary fit)"
- "Selected as flexible player after core tactical roles were covered"
- "Rating uncertainty: player has missing attributes"

Disallowed language unchanged: weak player, bad player, low quality, leftover, not good enough, punishment, B team player.

## Alternatives considered

- Option 1: Keep flat string fields as source of truth — rejected because PlayerPosition relational model already exists and provides structured priority, uniqueness constraints, and future extensibility. Flat strings cannot enforce "one primary, no duplicates."
- Option 2: Keep CAN_PLAY as enum value — rejected because it conflicts with the product vocabulary ("primary, secondary, tertiary") and makes fit tier logic confusing (CAN_PLAY doesn't map cleanly to a tier name).
- Option 3: Use overall rating as primary sort with position as tiebreaker (current implementation) — rejected because this is explicitly what ADR-0008 and the feature file prohibit. The competitive squad must be built from formation/role needs first.
- Option 4: Allow position values beyond the 5-code set — rejected for now. The feature file specifies GK, CB, CM, W, ST as the default supported list. Extension is a separate decision requiring ADR update.

## Consequences

- Positive: Generation engine now matches ADR-0008 and the feature file — formation/tactic fit first, skill within tier
- Positive: Canonical position resolution eliminates dual-source ambiguity
- Positive: Position fit tier gives coaches clear explanations for why players were placed where
- Positive: Scarcity handling prevents tactical holes when rare positions (especially GK) are spread thin
- Negative: Schema migration for CAN_PLAY → TERTIARY requires database update
- Negative: PlayerPosition table must be kept in sync with Player flat fields — denormalization requires write-through logic
- Negative: More complex generation algorithm — position-first slot filling is harder to implement than rating-sort
- Neutral: The 5-position code set (GK, CB, CM, W, ST) may need expansion for more granular positions, but that requires a separate ADR

## Re-evaluation triggers

- If coaches need more granular position codes (LB, RB, DM, AM, LW, RW, CF, WM) beyond the current 5
- If formation slot acceptedPositionIds need to map to specific position codes rather than broad positions
- If position fit tiers need weighting within a tier (e.g., PRIMARY GK preferred over PRIMARY CB for a GK slot)
- If the PlayerPosition model needs additional attributes per position (e.g., confidence level, preferred side)