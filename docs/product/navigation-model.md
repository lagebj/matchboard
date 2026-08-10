# Navigation Model

> **Status:** This document is a historical product framing reference. The canonical navigation model is defined in `AGENTS.md`.

## Primary navigation

The canonical primary navigation (from AGENTS.md) has four items in this order:

1. **Assistant** (`/o/{orgSlug}/assistant`) — next action, setup progress, blockers, urgent reviews and upcoming work
2. **Fixtures** (`/o/{orgSlug}/fixtures`) — the one-stop shop for the period → round → match hierarchy with actions
3. **Teams** (`/o/{orgSlug}/teams`) — team registry and access to team detail
4. **Players** (`/o/{orgSlug}/players`) — season participation, current planning attention, and base-group administration

## Canonical redirects

- `/` → `/o/{orgSlug}/assistant` (resolves orgSlug from session)
- `/today` → `/o/{orgSlug}/assistant`
- `/matches` → `/o/{orgSlug}/fixtures`
- Global routes redirect to `/o/{orgSlug}/` equivalents

## Not primary navigation

The following must not be primary sidebar items:
- `/o/{orgSlug}/rounds`
- `/o/{orgSlug}/matches`
- `/o/{orgSlug}/season`
- `/o/{orgSlug}/history`
- `/o/{orgSlug}/rules`

These remain accessible through contextually appropriate links, buttons, tabs, or secondary navigation.

## Fixtures

Fixtures provides the league-season and round hierarchy. Primary actions: populate all, generate round, finalize. Each level shows readiness state, plan integrity signal counts, selected player counts. Actions cascade.

## Players

The Players page has three internal modes:
1. **Season overview** (default) — factual player matrix with actual participation and recorded match statistics
2. **Current round attention** — canonical live plan-integrity state for a selected round
3. **Manage base groups** — stable core-team assignment and player registry administration

Players is not a drag-and-drop board. It is a table-first registry with actionable empty states.

## Teams

Teams is a selected-league-season completed-results overview. Team rules, squad limits, support priority, and rotation paths belong in team detail (`/teams/[teamId]`), not in the main overview table.

## No duplicate paths

- `/matches` redirects to `/o/{orgSlug}/fixtures`, not `/rounds`
- `/rounds` works internally but is not a primary navigation entry
- `/rules` works internally but is not a primary navigation entry

## Active navigation state

- `/o/{orgSlug}/assistant` visibly activates Assistant
- `/o/{orgSlug}/fixtures` and fixture child/detail contexts visibly activate Fixtures
- `/o/{orgSlug}/teams` and `/o/{orgSlug}/teams/[teamId]` contexts visibly activate Teams
- `/o/{orgSlug}/players` and `/o/{orgSlug}/players/[playerId]` contexts visibly activate Players
- Redirected routes do not produce an unselected or misleading sidebar state

## Status vocabulary

The app uses exactly these visible status labels: Not generated, Draft, Blocked, Ready, Finalized. No alternative visible status terms for the same state may be introduced.