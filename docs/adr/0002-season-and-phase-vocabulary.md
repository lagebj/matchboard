---
type: ADR
id: "0002"
title: User-facing scheduling vocabulary uses Season and Phase
status: active
date: 2026-05-29
supersedes:
superseded_by:
tags: [vocabulary, display-rules, planning-period]
---

## Context

Matchboard uses `PlanningPeriod` as the internal bounded operational scope. The existing user-facing label is "Planning period", which is often shown alongside a date-derived label like "April–June 2026". The term "Planning period" is not widely understood by coaches, and showing a single month label (e.g. "April 2026") for a multi-month scope is misleading.

A spring fixture block and an autumn fixture block are separate practical planning windows. A single season-wide scope would hide the break between them and make planning less precise.

## Decision

1. Keep `PlanningPeriod` as the internal data model. Do not rename the Prisma model or database table.

2. User-facing vocabulary replaces "Planning period" with "Phase":
   - Season = full football-year context
   - Phase = bounded spring/autumn operational window (internally a PlanningPeriod)

3. Phase display must always include an actual date-range cue. Examples:
   - `Spring 2026 · Apr–Jun`
   - `Autumn 2026 · Aug–Oct`

4. The stored PlanningPeriod `name` field may contain user-defined phase names like "Spring 2026" or legacy names like "April 2026". The display formatter uses the stored name when it appears meaningful (e.g. "Spring 2026"), but falls back to a date-derived label when the stored name misrepresents the time scope (e.g. "April 2026" covering April through June is never shown alone).

5. The top context bar shows Season and Phase context:
   - `2026 Season`
   - `Spring 2026 · Apr–Jun`

6. Existing misnamed production phases must be correctable through an authenticated rename action, not through silent automatic rename.

7. The `formatPhaseDisplay()` function replaces the previous `formatPlanningPeriodRange()` for user-facing labels. The old function remains available for simple date-range formatting where needed.

## Alternatives considered

- Option 1: Keep "Planning period" as visible label — rejected because coaches don't use this term and it doesn't convey the spring/autumn operational model
- Option 2: Rename the database model from PlanningPeriod to Phase — rejected because it requires a destructive migration for no functional benefit
- Option 3: Show only the stored name without date-range validation — rejected because stored names can misstate the visible time scope (ADR-0001 already decided this)

## Consequences

- Positive: Clear, coach-understandable vocabulary matching football operations
- Positive: Phase names like "Spring 2026" provide immediate context
- Positive: Date-range cue prevents scope misunderstanding
- Negative: Requires updating all visible "Planning period" labels across the application
- Negative: Stored legacy names may need manual correction
- Neutral trade-offs: Internal code continues using PlanningPeriod; only display layer changes

## Re-evaluation triggers

- If planning periods gain a required-type field (spring/autumn) that could automate the phase label
- If multi-phase season display needs to coexist in a single view