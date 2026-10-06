# Navigation Model

> **Status:** This document is the canonical navigation model. Root `AGENTS.md` is deliberately a
> compact bootstrap (PR #576) and does not repeat this list — do not restore it there; keep this
> file (and `scripts/check-docs.mjs`'s `checkPrimaryNavConsistency` check against it) as the one
> source agents load for navigation specifics. Adaptive/compact composition rules are in
> `docs/product/adaptive-interaction-design.md` and **ADR-0124**.

## Planned convergence (ADR-0157, in progress — not yet implemented)

ADR-0157 (Contextual Coach Workspace Convergence) targets exactly **four** primary items —
Today, League, Events, Players — with `More` removed once every job it currently owns has a
verified contextual destination. This is a staged migration delivered as sequential slices
(C0-C9); the five-item model below, and every route `More` currently owns, remains the live,
accurate, current state until the final IA-convergence slice (C8) actually removes `More` from
`TOUCHLINE_NAV_META`/`TOUCHLINE_NAV_ORDER`, the mobile bottom nav, and the sidebar/navigation
rail, at which point this document's "Primary navigation" section below is updated in the same
change (and `checkPrimaryNavConsistency`'s cross-check against `features/matchboard.feature`
moves to four items in that same slice, not before).

Target route disposition (`contracts/route-disposition.json` in ADR-0157's bundle):

| Current `More` job | Target destination | Active primary nav |
|---|---|---|
| `/season` | Season Review, reached from League | League |
| `/opponents`, `/opponents/[id]` | Contextual domain object (League / Match Preparation / encounter history) | League |
| `/settings` | Expanded administration entry point | none (user/settings affordance) |
| `/groups`, `/rules` | Settings admin subroutes | discovered via Settings |
| `/formations` | Contextual formation management from Match Tactics; legacy route redirects once equivalent | contextual (Match Tactics) |
| `/reviews` | Peer-review initiation moves onto the reviewed object; due work moves onto Today; hub retires | n/a |
| `/simulation`, `/workbench`, rebuild/backfill tools | Settings > Advanced (admin only) | none |
| `/insights` | Match/Round/Player/Opponent/Season (see `11_INSIGHTS_ROUTE_DISPOSITION.md`), with redirects preserving selected-entity query params | n/a |
| `/history` | Match/Player/Opponent/Season, with export preserved | n/a |
| `/more` | Deleted/redirected last, once every job above has a verified destination | n/a |

Do not implement this section's target state early or out of slice order; do not remove a
legacy route before its job is demonstrably reachable in its new contextual destination. See
ADR-0157 for the full decision record and `14_DELIVERY_SEQUENCE.md` for the slice order.

## Primary navigation (5 items, in this order)

The primary navigation has five items in this order — the Today/League/Events/Players/More information architecture (UI/UX programme Phase 2.4, `.matchboard-work/ux-branding-language-ui/PROGRAMME.md` §6, gitignored working bundle):

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
