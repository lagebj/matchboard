# Navigation Model

> **Status:** This document is a historical product framing reference. The canonical navigation model is defined in `AGENTS.md`.

## Primary navigation

The canonical primary navigation (from `AGENTS.md`) has five items in this order — the Today/League/Events/Players/More information architecture (UI/UX programme Phase 2.4, `.matchboard-work/ux-branding-language-ui/PROGRAMME.md` §6, gitignored working bundle):

1. **Today** (`/o/{orgSlug}/today`) — next action, setup progress, blockers, urgent reviews and upcoming work. Renders the same command-centre content previously presented as "Assistant" — the underlying data and component are unchanged, only the canonical route and nav label.
2. **League** (`/o/{orgSlug}/fixtures`) — the one-stop shop for the period → round → match hierarchy with actions. League teams (`/o/{orgSlug}/teams`) are reachable from a link on this page, not their own sidebar item.
3. **Events** (`/o/{orgSlug}/events`) — event squads and planning.
4. **Players** (`/o/{orgSlug}/players`) — season participation, current planning attention, and base-group administration.
5. **More** (`/o/{orgSlug}/more`) — analysis and administration hub: Insights, Season, History, Opponents, Groups, Formations, Rules, Settings, Reviews, and (admin roles only) Simulation and Policy workbench.

### History: previous four-item model (superseded 2026-08-21)

Before Phase 2.4, primary navigation had four items — Assistant, Fixtures, Teams, Players — and Events, Groups, Opponents, and Formations had drifted onto the shipped sidebar as additional primary items without this document or `AGENTS.md` ever being updated to match (found and recorded during the UI/UX programme's Phase 2.0 baseline audit). Phase 2.4 resolved that inconsistency by adopting the programme's target IA in full, rather than only trimming the sidebar back to the stale four-item documentation.

## Canonical redirects

- `/` → `/o/{orgSlug}/today` (resolves orgSlug from session)
- `/assistant` → `/today`; `/o/{orgSlug}/assistant` → `/o/{orgSlug}/today` (deep-link aliases — Today is canonical, Assistant is the historical name)
- `/matches` → `/o/{orgSlug}/fixtures`
- Global routes redirect to `/o/{orgSlug}/` equivalents

## Not primary navigation

The following must not be primary sidebar items:
- `/o/{orgSlug}/teams` — reachable via a "League teams" link on League (Fixtures)
- `/o/{orgSlug}/rounds`
- `/o/{orgSlug}/matches`
- `/o/{orgSlug}/season` — via More
- `/o/{orgSlug}/history` — via More
- `/o/{orgSlug}/rules` — via More
- `/o/{orgSlug}/groups` — via More
- `/o/{orgSlug}/opponents` — via More
- `/o/{orgSlug}/formations` — via More
- `/o/{orgSlug}/insights` — via More
- `/o/{orgSlug}/settings` — via More
- `/o/{orgSlug}/reviews`, `/o/{orgSlug}/simulation`, `/o/{orgSlug}/workbench` — via More

These remain accessible through contextually appropriate links, buttons, tabs, or secondary navigation.

## League

League (at `/o/{orgSlug}/fixtures`) provides the league-season and round hierarchy. Primary actions: populate all, generate round, finalize. Each level shows readiness state, plan integrity signal counts, selected player counts. Actions cascade.

## Players

The Players page has three internal modes:
1. **Season overview** (default) — factual player matrix with actual participation and recorded match statistics
2. **Current round attention** — canonical live plan-integrity state for a selected round
3. **Manage base groups** — stable core-team assignment and player registry administration

Players is not a drag-and-drop board. It is a table-first registry with actionable empty states.

## Teams (League teams)

Teams is a selected-league-season completed-results overview. Team rules, squad limits, support priority, and rotation paths belong in team detail (`/teams/[teamId]`), not in the main overview table. Reached from the League page's "League teams" link, not from the primary sidebar.

## More

More (`/o/{orgSlug}/more`) is a hub page: a grid of link cards grouped into Analysis (Insights, Season, History, Opponents), Administration (Groups, Formations, Rules, Settings), Workflow (Reviews), and — for admin roles only — Advanced (Simulation, Policy workbench). It replaces having Groups, Opponents, and Formations compete for primary sidebar space.

## No duplicate paths

- `/matches` redirects to `/o/{orgSlug}/fixtures`, not `/rounds`
- `/rounds` works internally but is not a primary navigation entry
- `/rules` works internally but is not a primary navigation entry

## Active navigation state

- `/o/{orgSlug}/today` visibly activates Today
- `/o/{orgSlug}/fixtures` and fixture/round/match/team/season child contexts visibly activate League
- `/o/{orgSlug}/events` contexts visibly activate Events
- `/o/{orgSlug}/players` and `/o/{orgSlug}/players/[playerId]` contexts visibly activate Players
- `/o/{orgSlug}/more` and its linked destinations visibly activate More
- Redirected routes do not produce an unselected or misleading sidebar state

## Status vocabulary

The app uses exactly these visible status labels: Not generated, Draft, Blocked, Ready, Finalized. No alternative visible status terms for the same state may be introduced.
