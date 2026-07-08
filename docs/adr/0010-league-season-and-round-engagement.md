# ADR 0010: League season model and round engagement

## Status

Proposed

## Context

Matchboard currently uses `PlanningPeriod` as the primary time-scoping concept for fixtures, fairness, and selection. Coach-facing language calls this "Phase" or "Planning period." This creates several problems:

1. Coaches must manually create and assign planning periods to rounds, adding unnecessary overhead.
2. The "phase" concept is confusing — coaches think in terms of Spring and Fall seasons, not arbitrary date ranges.
3. `PlanningPeriod` names like "April 2026" mislead coaches into thinking the scope is a single month, when fairness requires a half-year boundary.
4. Events/cups are loosely attached to `PlanningPeriod` via `sourcePlanningPeriodId`, conflating league planning with temporary event contexts.
5. There is no enforcement ensuring every available player gets at least one opportunity per weekly round.
6. Fairness is scoped to `PlanningPeriod` but the term doesn't convey "fairness window" clearly.

## Decision

### 1. Replace PlanningPeriod with LeagueSeason

Rename the `PlanningPeriod` model to `LeagueSeason` and add a `part` enum (`SPRING` | `FALL`).

- A `Season` represents a calendar year (e.g., 2026).
- Each `Season` has two `LeagueSeason` rows: Spring (Jan 1–Jun 30) and Fall (Jul 1–Dec 31).
- League matches are automatically assigned to Spring or Fall based on their date.
- Match rounds derive their `leagueSeasonId` from their matches' dates.
- Coaches never manually select "Spring" or "Fall" for normal league match creation.

### 2. Automatic date-derived assignment

A shared utility (`src/lib/seasons/league-season.ts`) classifies dates:
- January 1 through June 30 = SPRING
- July 1 through December 31 = FALL

All season classification must go through this utility. Date changes/rescheduling automatically update the derived league season.

### 3. Events are independent

Remove `Event.sourcePlanningPeriodId`. Events/cups are temporary planning contexts with their own availability and squad generation. They do not belong to Spring/Fall and do not affect league fairness calculations.

### 4. Round engagement enforcement

Add a weekly round engagement rule: every available active player must receive at least one match opportunity across any team in the round.

- Missing opportunities produce a HARD_BLOCK condition (existing blocker model).
- Coaches can override with a required reason.
- Cancelled matches do not count as opportunities.
- Capacity conflicts are shown when full engagement is impossible.

### 5. Fairness window

Fairness is calculated within a derived league season by default:
- Spring league fairness: Jan–Jun matches only.
- Fall league fairness: Jul–Dec matches only.
- Full-year view aggregates Spring + Fall when explicitly selected.
- Events are excluded.

### 6. Coach-facing language

Use:
- Season = calendar year (e.g., 2026)
- League season = Spring 2026 or Fall 2026
- Fairness window = calculation scope, defaulting to derived league season

Avoid in coach-facing UI:
- Planning period
- Phase
- Source phase
- Source planning period

## Consequences

### Positive

- Coaches never manually assign Spring/Fall to league matches.
- Fairness boundaries are clear and date-derived.
- Language matches how coaches think about their season.
- Every available player is checked for weekly opportunity.
- Events are cleanly separated from league planning.

### Negative

- Schema migration required: PlanningPeriod → LeagueSeason with part enum.
- Existing PlanningPeriod data must be migrated into Spring/Fall LeagueSeason rows.
- Mixed-date rounds (matches spanning Jun/Jul boundary) need special handling.
- ~40+ files reference PlanningPeriod and must be updated.
- Coach-facing language changes require updating many components.

### Migration strategy

Option A (chosen): Full rename to `LeagueSeason` with `LeagueSeasonPart` enum.

1. Add `Season` model (year, name).
2. Rename `PlanningPeriod` to `LeagueSeason`, add `part` enum.
3. Add migration to create Season/LeagueSeason rows from existing data.
4. Update `MatchRound` to reference `LeagueSeason`.
5. Remove `Event.sourcePlanningPeriodId`.
6. Update all domain services, UI components, API routes.
7. Create round engagement module and blocker.

Mixed-date rounds: flag for review rather than silently assigning to one season.

## References

- AGENTS.md: Season/Phase vocabulary, fairness boundaries, cancelled match rules
- features/matchboard.feature: Existing season/round/selection scenarios
- Previous ADRs: ADR-0009 (position-first generation)