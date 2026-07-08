# ADR 0011: Event Match and Category-Aware Statistics

## Status

Proposed

## Context

Matchboard currently supports league matches attached to teams and match rounds. Events (cups, tournaments, friendly days) have squads and player assignments but no match results, post-match reports, or statistics.

Coaches need to:
- Register matches played by event squads
- Record post-match results for event matches
- Track player statistics by category (League, Cup, Other)
- View event squad results separately from league team results

League teams and event squads are fundamentally different entities:
- League teams are stable, persistent groups used for league planning
- Event squads are temporary, event-scoped groups
- Forcing event squads into the league `Team` model would conflate different lifecycles

## Decision

### 1. Separate EventMatch model (not extending league Match)

Create `EventMatch` as a distinct model, not a polymorphic extension of `Match`.

Rationale:
- League Match has a `MatchRound` and `Team` ownership chain
- EventMatch has an `EventSquad` and `Event` ownership chain
- Their lifecycles, validation rules, and relations differ fundamentally
- A shared base table would require complex polymorphic foreign keys or nullable columns
- Separate tables keep each domain clean and avoid ambiguous ownership

### 2. MatchCategory enum for statistics

Add `MatchCategory` enum: `LEAGUE`, `CUP`, `OTHER`.

- Existing league `Match` records get `category MatchCategory @default(LEAGUE)`
- `EventMatch` uses `category MatchCategory` (CUP or OTHER, never LEAGUE)
- Category drives statistics aggregation and filtering
- Category is stored on the match, not inferred from entity type

### 3. Separate event post-match report models

Create `EventPostMatchReport`, `EventPostMatchPlayer`, `EventGoalEvent` (for event matches).

These mirror the league report structure but are owned by `EventMatch`, not by the league `Match`. This avoids:
- Polymorphic ownership on `PostMatchReport`
- Ambiguous queries about which match type a report belongs to
- Risk of contaminating league report lifecycle with event concerns

### 4. Statistics aggregated by category

Player statistics separate League, Cup, and Other appearances, goals, and assists.

Team statistics remain league-only. Event squad statistics are shown in the event context, not merged into league team overviews.

Aggregation services normalize across league and event sources but never pretend event squads are league teams.

## Consequences

### Positive
- Clean separation of league and event match lifecycles
- No risk of event squad data contaminating league fairness or movement ledger
- Category-aware stats are queryable and filterable
- Event matches support their own post-match workflow without conflicting with league reports
- Existing league match behavior is unchanged

### Negative
- Two parallel report model hierarchies (league and event) increase schema surface
- UI components need category-aware stat display
- Some code duplication between league and event post-match flows (mitigated by shared utility functions)

## Schema Changes

### New enum
```
enum MatchCategory { LEAGUE, CUP, OTHER }
```

### Added to existing Match model
```
category MatchCategory @default(LEAGUE)
```

### New models
```
EventMatch
EventPostMatchReport
EventPostMatchPlayer
EventGoalEvent
```

### Migration
- All existing `Match` rows get `category = LEAGUE` (the default)
- No data backfill needed for event matches (none exist yet)

## References

- ADR 0008: Event squad planning
- AGENTS.md: Canonical data truth, event squad planning section
- features/matchboard.feature: Post-match reporting, event squad planning