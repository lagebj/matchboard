# ADR-0151: Match-day roster changes and operational participation

**Status:** Proposed  
**Date:** 2026-09-23  

## Context

Matchboard distinguishes between the Round Board (intended/planned allocation) and Match Details (operational reality for a specific match). Currently, Match Details has no direct way to:

1. Mark a planned player as absent for a specific match (sick, injured, away, no-show, declined, other) — though `MatchReportAbsence` and `AbsenceControl` already exist, they are not surfaced prominently in the Match Details BEFORE-state operational surface.
2. Add a real Player from another team as a match-specific participant without mutating the Round Board Selection.
3. Add an emergency GuestPlayer from Match Details without first registering them on Round Board.

The effective roster resolver (`getEffectiveLeagueMatchRoster`) already computes: Selection + MatchHelperAssignment + LeagueMatchGuestAssignment - MatchReportAbsence. Match Insights and AI Advisor currently build `squad` from Selection only, which becomes insufficient once Match Details can modify operational participation.

The Today page "Follow live" button currently navigates to `/matches/{matchId}/live` (the Live Reporting editor) instead of `/matches/{matchId}/live/follow` (the read-only Follow Live viewer).

Match Details currently exposes "Create formation" and "Duplicate current formation" controls, which belong to the canonical formation management surface, not the match-planning task.

## Decisions

### 1. `MatchHelperAssignment.provenance` distinguishes helpers from match-day additions

Add a `HelperProvenance` enum with values `HELPER` and `MATCH_DAY_ADDITION` to `MatchHelperAssignment`. Existing rows default to `HELPER`.

This reuses the existing match-specific Player participation model rather than creating a parallel one. `MatchHelperAssignment` already represents "a real Player participating in a match without being part of the original Selection" — exactly what a match-day addition is. The `provenance` field preserves the semantic distinction.

`sourceTeamId` remains informational. For match-day additions, it records the player's current core team at assignment time (for context), not an authority relationship.

### 2. Emergency GuestPlayer from Match Details

Extend `addLeagueMatchGuestAction` to accept a `skipRoundRegistration` option. When `true`, the action creates or reuses a `LeagueRoundParticipant` for the guest before creating the `LeagueMatchGuestAssignment`. This allows a coach to add an emergency GuestPlayer without visiting Round Board first.

The `getLeagueMatchGuestCandidatesAction` is extended to include unassigned group GuestPlayers (not just round-registered ones), with context showing their current assignments if any.

### 3. Match Details "Add player" action

A single coherent Match Details action exposes three paths: (a) search and add an existing Player, (b) select an existing GuestPlayer, (c) create a new GuestPlayer and add them. Path (a) uses `MatchHelperAssignment` with `provenance: MATCH_DAY_ADDITION`. Paths (b) and (c) use `LeagueMatchGuestAssignment`.

### 4. Effective roster resolver gains provenance and operational state

`getEffectiveLeagueMatchRoster` already exposes `source: "planned" | "helper" | "guest"` and `absenceReason`. We add `provenance: "HELPER" | "MATCH_DAY_ADDITION"` for Player entries, and the existing `absenceReason` / `isActiveParticipant` fields already cover the absent/active distinction.

The provenance field allows the UI to display contextual labels:
- "Sick" / "Injured" / "Away" etc. for absent players
- "Added for this match" for `MATCH_DAY_ADDITION`
- No label for `HELPER` or `planned` entries (the normal case stays visually quiet)

### 5. Match Insights and AI Advisor distinguish planned from operational roster

`buildCurrentPlanInput` currently builds `squad` from `Selection` only. It is extended to accept an `operationalRoster` parameter (computed from `getEffectiveLeagueMatchRoster`) that provides the current operational participant state.

The `CurrentPlanInput` type gains:
- `operationalRoster`: the effective roster entries (absent players marked, match-day additions included)
- `plannedSquad`: the original `squad` from Selection (preserved for comparison)

New fact types are added to `MatchInsightFactType`:
- `MATCH_AVAILABILITY`: a planned player is unavailable for this match
- `MATCH_DAY_ADDITION`: a real Player was added for this match who was not in the original plan

Deterministic insights derive from the operational roster for active-participant reasoning (lineup, rotation, position exposure, combination context) and from the planned squad for historical/comparison reasoning.

### 6. AI context fingerprint changes on roster mutations

The fingerprint input in `match-prep.ts` must include operational roster state (absences, additions, formation, lineup, rotations). When any of these change, the fingerprint changes, triggering AI regeneration.

### 7. "Follow live" navigates to `/live/follow`

Fix the Today `TodayLiveNow` component's `matchHref` to use `/live/follow` instead of `/live`.

### 8. Formation controls simplified in Match Details

Remove "Create formation" and "Duplicate current formation" buttons from Match Details. Replace the formation card grid in the with-lineup state with a `<select>` dropdown. Retain "Manage formations" as a quiet secondary link.

### 9. Removal semantics

Match-day additions follow the same safety principle as league GuestPlayer assignments: removal is blocked if the participant has canonical participation data (PostMatchPlayerActual, LiveMatchEvent, ActualPositionInterval). A planned Selection is never deleted by this operation.

## Consequences

- `MatchHelperAssignment` gains a `provenance` field requiring a schema migration with a default of `HELPER` for existing rows.
- `buildCurrentPlanInput` and `buildMatchInsightFacts` gain an operational roster dimension, changing their signatures.
- AI fingerprint computation includes operational roster state, making roster mutations trigger regeneration.
- GuestPlayer flow from Match Details creates `LeagueRoundParticipant` entries as needed, slightly broadening the guest assignment pathway.
- Follow Live page must consume `getEffectiveLeagueMatchRoster` instead of assembling participants inline.
- Formation creation/duplication remains available at the canonical formation management surface.

## Supersedes

None. ADR-0106 (GuestPlayer and shared participant model) remains active; this extends it. ADR-0149 (Match Insights consolidation) remains active; this amends its `buildCurrentPlanInput` contract.

## Amended by

This ADR will be amended if the operational participation model evolves further.