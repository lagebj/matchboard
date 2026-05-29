---
type: ADR
id: "0001"
title: Overview surfaces derive results from canonical post-match report sources
status: active
date: 2026-05-29
supersedes:
superseded_by:
tags: [data-source, display-rules, overview]
---

## Context

Matchboard has three overview pages (/players, /teams, /fixtures) that surface match result information. Before this ADR, result data was inconsistently sourced, stale after mutations, and sometimes misleading — DRAFT report scores were shown as final, team GF/GA could be derived from player Goal events instead of report scores, and planning-period labels came from stored names that could misstate the visible time scope.

## Decision

All overview surfaces derive result data from canonical sources with strict boundaries:

1. **Planning-period display labels** are always derived from `startDate` and `endDate` using `formatPlanningPeriodRange()` — stored `title` is never displayed alone. Same month: "April 2026". Multi-month: "April–June 2026". Cross-year: "December 2026–February 2027".

2. **Team final results** (W-D-L, GF, GA, GD, clean sheets) are derived exclusively from `PostMatchReport.homeGoals` and `PostMatchReport.awayGoals` in REPORTED or LOCKED status. Player `Goal` events are never used as a source for team GF/GA. Home/away perspective is determined by `Match.homeAway`.

3. **Fixture result state model** uses `FixtureReportState`:
   - `NO_REPORT` — no post-match report exists; planning-state presentation
   - `DRAFT_REPORT_INCOMPLETE` — report exists but status is DRAFT; show "Report incomplete" with link to complete, never show draft score as final
   - `COMPLETED` — report status is REPORTED or LOCKED; show FT marker, final score, Won/Drawn/Lost outcome

4. **Players Season overview** is a factual player matrix. It does not render summary-statistics panels, movement-paths overviews, or automated fairness-judgement badges. Factual columns, sorting, and explicit filters replace automatic judgement.

5. **/teams overview** is a selected-planning-period completed-results table. It does not show configuration columns (squad limits, support priority, rotation paths). Configuration belongs in `/teams/[teamId]/configuration`.

6. **Revalidation** — post-match report mutations (submit, lock, reopen) and goal/assist mutations must revalidate `/teams`, `/players`, and `/fixtures` to prevent stale result display.

## Alternatives considered

- Option 1: Allow stored period titles as display labels — rejected because stored titles can misstate visible time scope
- Option 2: Derive team GF/GA from player Goal events — rejected because canonical source of truth for team results is the post-match report score, and player-scoring registration may be incomplete
- Option 3: Show DRAFT report scores as preliminary results — rejected because incomplete reports are not final results and presenting them as such is misleading
- Option 4: Keep automated fairness badges on /players — rejected per AGENTS.md rule: factual columns and explicit filters replace automatic seasonal judgement

## Consequences

- Positive: Consistent, accurate result display across all overview surfaces
- Positive: No stale data after post-match mutations due to revalidation
- Positive: Clear separation between planning state and result state in Fixtures
- Positive: /players shows verifiable facts, not hidden automatic judgement
- Negative: Period labels may differ from stored titles if the stored title was descriptive rather than date-based
- Negative: Team results are unavailable until a post-match report is REPORTED or LOCKED — DRAFT reports show nothing
- Neutral trade-offs: Home/away perspective logic must follow `Match.homeAway` consistently; any future display of opponent-centric results needs careful perspective handling

## Re-evaluation triggers

- If team results need to show DRAFT report scores as preliminary (would require new FixtureReportState value and clear visual differentiation)
- If planning periods gain a required-title field that must be shown alongside the date range
- If player-scoring registration becomes the canonical team-result source instead of report scores