# ADR 0022: Historical Audit and Planned-vs-Actual Review

## Status

Proposed

## Context

Matchboard plans squads, commits selections, and generates fairness signals. But it currently lacks a structured way to compare what was planned against what actually happened. The `/history` page shows finalized selections but doesn't incorporate actual participation from post-match reports. The `/season` page shows planned data but not actual appearances. The assistant only checks if a post-match report exists, not whether it's complete or whether actual participation matches the plan.

Stages 1–7 established the planning and policy foundation. Stage 8 closes the loop: planned intent → committed selection → actual attendance → review.

## Decision

Add historical audit and planned-vs-actual review as a distinct service layer and UI surface, reusing existing data models (`PostMatchPlayerActual`, `Goal`, `Assist`, `MatchReportAbsence`, `PostMatchReport`) and existing stats services (`getPlayerCategoryStats`, `getLeagueTeamStats`).

### Core principles

1. **Planned is not actual.** Finalized selections show intent. Actual participation shows reality. Both must be visible, never conflated.
2. **Post-match reports are the source of truth for actuals.** `PostMatchPlayerActual` with `attendanceStatus = "PRESENT"` is the canonical source for "played". `Goal` and `Assist` events are canonical for goals and assists. `MatchReportPlayerStat` is a compatibility field, not independent truth.
3. **Removed/unavailable players remain historically visible.** Historical participation is immutable. Lifecycle changes do not delete history.
4. **Audit is neutral review, not ranking.** No player ranking, no shame/blame, no public-facing exposure. Tables and summary cards, not noisy charts.
5. **Simulation and audit close the planning loop.** Simulation predicts. Audit verifies. Both are coach-facing.
6. **No new competing data stores.** Extend existing models and services, don't duplicate them.

### Architecture

**Service layer** (`src/lib/audit/`):

- `audit-types.ts` — Planned-vs-actual types, delta types, review scope types
- `planned-vs-actual.ts` — `getPlannedVsActual()` for league matches; compares finalized selections to actual participation
- `audit-summary.ts` — `getAuditSummary()` for period/season summaries; missing reports, incomplete reports, participation gaps
- `season-review.ts` — `getSeasonReview()` for Spring/Fall/full-year review; planned opportunities, actual appearances, deltas
- `player-history.ts` — `getPlayerHistory()` for per-player timeline across periods
- `opponent-history.ts` — `getOpponentHistory()` for per-opponent match history

**Key types**:

```typescript
type PlannedVsActualMatch = {
  matchId: string;
  matchDate: Date | null;
  opponent: string;
  homeAway: string;
  plannedPlayers: PlannedSelectionSummary[];
  actualParticipants: ActualParticipationSummary[];
  plannedButAbsent: PlannedAbsentSummary[];
  unplannedParticipants: UnplannedParticipationSummary[];
  reportStatus: "NONE" | "DRAFT" | "REPORTED" | "LOCKED";
  isCancelled: boolean;
  deltaSummary: string;
};

type AuditWorkItem = {
  type: "missing_report" | "incomplete_report" | "unknown_attendance" | "missing_actuals";
  matchId: string;
  matchDate: Date;
  matchRoundId: string;
  description: string;
};
```

**UI routes**:

- `/season` — extended with actual participation columns and review toggle (already exists, extend)
- `/history` — extended with actual participation data (already exists, extend)
- Review panels within match detail — no new top-level routes needed initially

**Assistant integration**:

- Extend `getAssistantCommandCentre()` to surface:
  - `post_match_report` → already exists, but enhanced to check DRAFT/UNKNOWN attendance
  - `incomplete_report` → DRAFT report with UNKNOWN attendance
  - `missing_actuals` → LOCKED report with no actual participation recorded

### What we do NOT build

- A new `/review` top-level route (extend existing routes instead)
- A player ranking dashboard
- A public-facing stats page
- Generic analytics charts
- Predictive analytics beyond the simulation-audit loop

## Consequences

### Positive

- Coaches can see planned vs actual participation side by side
- Missing reports and incomplete actuals are surfaced as actionable work items
- Season review shows both planned opportunities and actual appearances
- Player history preserves participation across lifecycle changes
- Opponent history is queryable
- Simulation predictions can be compared to actual outcomes

### Negative

- Additional service layer complexity
- Season review queries may be expensive for large seasons (mitigation: pagination, caching)
- Must be careful not to conflate planned and actual in any view

## Rejected alternatives

- Treat planned lineup as actual participation (rejected: planned ≠ actual)
- Use current roster for historical views (rejected: roster changes break history)
- Delete removed players from history (rejected: AGENTS.md explicitly forbids this)
- Build a ranking dashboard (rejected: youth football context, AGENTS.md rules)
- Only track aggregate stats (rejected: coach needs per-match detail)