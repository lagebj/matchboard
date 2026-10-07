# Navigation Model

> **Status:** This document is the canonical navigation model. Root `AGENTS.md` is deliberately a
> compact bootstrap (PR #576) and does not repeat this list — do not restore it there; keep this
> file (and `scripts/check-docs.mjs`'s `checkPrimaryNavConsistency` check against it) as the one
> source agents load for navigation specifics. Adaptive/compact composition rules are in
> `docs/product/adaptive-interaction-design.md` and **ADR-0124**.

## Primary navigation (4 items, in this order)

ADR-0157 (Contextual Coach Workspace Convergence) C8 is implemented: `More` is removed. Every
job it used to own now has a verified contextual destination, a Settings subroute, or a redirect
that preserves the caller's selected-entity query params — see "Route disposition (post-More)"
below.

1. **Today** (`/o/{orgSlug}/today`) — next action, setup progress, blockers, urgent reviews and upcoming work. Renders the same command-centre content previously presented as "Assistant" — the underlying data and component are unchanged, only the canonical route and nav label.
2. **League** (`/o/{orgSlug}/fixtures`) — the one-stop shop for the period → round → match hierarchy with actions. League teams (`/o/{orgSlug}/teams`) are reachable from a link on this page, not their own sidebar item. Season Review (`/o/{orgSlug}/season`) and the opponent domain (`/o/{orgSlug}/opponents`, `/o/{orgSlug}/opponents/[id]`) are also reached from League and keep League active.
3. **Events** (`/o/{orgSlug}/events`) — event squads and planning.
4. **Players** (`/o/{orgSlug}/players`) — season participation, current planning attention, and base-group administration.

### Route disposition (post-More)

| Former `More` job | Destination | Active primary nav |
|---|---|---|
| `/season` | Season Review, reached from League | League |
| `/opponents`, `/opponents/[id]` | Contextual domain object (League / Match Preparation / encounter history) | League |
| `/settings` | Expanded administration entry point | none (user/settings affordance) |
| `/groups`, `/rules` | Settings admin subroutes | discovered via Settings |
| `/formations` | Contextual formation management drawer from Match Tactics; legacy list route redirects to League; builder routes keep `returnTo` | contextual (Match Tactics, under League/Events match context) |
| `/reviews` | Peer-review list embedded on Today (due work, resolve/cancel, resolved history); entries link to the reviewed object; route redirects to Today | n/a |
| `/simulation`, `/workbench`, rebuild/backfill tools | Discovered from Settings > Advanced (admin only); routes unchanged | none |
| `/insights/*` | Redirected per-route to its contextual owner (Today, Round Board, Match Preparation, Player Detail, Completed Match, or Season Review) with selected-entity query params preserved | n/a (destination's own active item) |
| `/history` | Redirected to Season Review's Players tab (same matrix/export) | League |
| `/more` | Redirects to `/settings` | none |

See ADR-0157 for the full decision record and delivery sequence (C0-C9).

### History: previous five-item model (superseded 2026-10-07, ADR-0157 C8)

Before C8, primary navigation had five items — Today, League, Events, Players, More — with More
as an analysis/admin hub (Insights, Season, History, Opponents, Groups, Formations, Rules,
Settings, Reviews, and admin-only Simulation/Policy workbench). Before that, and before UI/UX
programme Phase 2.4 (superseded 2026-08-21), primary navigation had four items — Assistant,
Fixtures, Teams, Players — and Events, Groups, Opponents, and Formations had drifted onto the
shipped sidebar as additional primary items without this document or `AGENTS.md` ever being
updated to match (found and recorded during the UI/UX programme's Phase 2.0 baseline audit).
Phase 2.4 resolved that inconsistency by adopting its target IA in full. ADR-0157 C8 then
converged the resulting five-item model back down to four once every job More owned had a
verified contextual destination.

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
- `/o/{orgSlug}/season` — reached from League; keeps League active
- `/o/{orgSlug}/opponents` — reached from League / Match Preparation / encounter history; keeps League active
- `/o/{orgSlug}/formations` — formation-library management is reachable from Match Tactics'
  formation-management drawer; the standalone list route redirects to League (the entry to the
  next match's Tactics flow). The create/edit builder routes remain, round-tripping via `returnTo`
- `/o/{orgSlug}/history` — redirects to Season Review's Players tab
- `/o/{orgSlug}/rules`, `/o/{orgSlug}/groups` — Settings admin subroutes, linked from Settings
- `/o/{orgSlug}/insights/*` — each redirects to its contextual owner (see "Route disposition"
  above); not a destination in its own right any more
- `/o/{orgSlug}/settings` — the administration entry point; no primary item activates
- `/o/{orgSlug}/reviews` — hub retired; the peer-review list (due work, resolve/cancel, resolved
  history) is embedded on Today, and each entry links to the reviewed object; the route redirects
  to Today
- `/o/{orgSlug}/simulation`, `/o/{orgSlug}/workbench` — discovered from Settings > Advanced
- `/o/{orgSlug}/more` — retired; redirects to `/o/{orgSlug}/settings`

These remain accessible through contextually appropriate links, buttons, tabs, or secondary navigation.

## League

League (at `/o/{orgSlug}/fixtures`) provides the league-season and round hierarchy. Primary
actions: populate all, generate round. There is **no** coach-operated finalize action (ADR-0109)
— a round/match becomes historical automatically once its planning boundary closes. Each level
shows readiness state, plan integrity signal counts, selected player counts. Actions cascade.

Compact League groups by round/date: past rounds are compact and result-oriented, current and
upcoming rounds are more open and planning-oriented, and unresolved conditions attach to the
affected match/round. Scheduled / live / final / report-incomplete / cancelled states are
distinguishable without opening match detail. See `docs/product/adaptive-interaction-design.md` §8.

## Players

The Players page has three internal modes:
1. **Season overview** (default) — factual player matrix with actual participation and recorded match statistics
2. **Current round attention** — canonical live plan-integrity state for a selected round
3. **Manage base groups** — stable core-team assignment and player registry administration

Players is not a drag-and-drop board. On expanded/desktop it may present a comparison table with
actionable empty states where comparison is useful. On compact (`<600px`) it renders a
purpose-built player summary per player (name, core-team/base-group context, attention state,
concise recent participation, role/position only where canonical data exists, clear entry to
detail) — never a generic card containing every desktop column. Omitted detail stays reachable
on player detail. No player score, ranking, or invented judgement logic. See
`docs/product/adaptive-interaction-design.md` §11.

## Teams (League teams)

Teams is a selected-league-season completed-results overview. Team rules, squad limits, support priority, and rotation paths belong in team detail (`/teams/[teamId]`), not in the main overview table. Reached from the League page's "League teams" link, not from the primary sidebar.

## Settings

Settings (`/o/{orgSlug}/settings`) is the non-football administration home (ADR-0157 C8,
superseding the retired More hub): Organisation/account, Season administration, Groups and
access, Rules/policy configuration, App installation / PWA, AI connections, and — admin roles
only — Advanced tools (Simulation, Policy workbench, and the transient
rebuild/backfill/population tools). Reached from a user/settings affordance, not primary
football navigation; no primary nav item activates on `/settings` or its subroutes.

## No duplicate paths

- `/matches` redirects to `/o/{orgSlug}/fixtures`, not `/rounds`
- `/rounds` works internally but is not a primary navigation entry
- `/rules` works internally but is not a primary navigation entry

## Active navigation state

- `/o/{orgSlug}/today` visibly activates Today
- `/o/{orgSlug}/fixtures` and fixture/round/match/team/season/opponent child contexts visibly
  activate League
- `/o/{orgSlug}/events` contexts visibly activate Events
- `/o/{orgSlug}/players` and `/o/{orgSlug}/players/[playerId]` contexts visibly activate Players
- `/o/{orgSlug}/settings` and its admin subroutes (`/groups`, `/rules`, `/simulation`,
  `/workbench`, and the transient rebuild/backfill/population tools) activate no primary item —
  there is no fifth nav item
- Redirected routes (former `/insights/*`, `/history`, `/more`) do not produce an unselected or
  misleading state at their landing destination; they resolve to that destination's own active
  item before the page renders

## Status vocabulary

**Not generated, Draft, Blocked, Ready, Finalized** are the internal/secondary
selection-planning-completeness vocabulary (round-level plan integrity, override requirements),
and the `RoundStatus` enum is unchanged. Since ADR-0101 they are **not** the primary label for a
single match. The primary, football-action-oriented per-match label is one of: **Planning open,
Planning closed, Live, Played, Report incomplete, Done, Cancelled**
(`deriveMatchLifecycleStatus()`). Report status wins over round-finalization status — a
finalized-but-unplayed match shows "Planning closed", never "Done". This is the one presentation
of match lifecycle used by the canonical match visual grammar across every surface
(`docs/product/adaptive-interaction-design.md` §6). No alternative visible status terms for the
same state may be introduced.
