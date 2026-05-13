# Matchboard UI Principles and Page Responsibilities

## Design Principles

1. **Important state stays visible where the coach acts.** Blockers, support gaps, finalization readiness must be visible on the relevant work surface, not buried in logs.

2. **The eye lands first on what can break the round.** Blockers visually dominate neutral information. Missing support, squad repair needs, and finalization readiness are obvious.

3. **Dashboards are action surfaces, not reporting surfaces.** If a section does not change a decision, it should be removed or redesigned.

4. **One dominant next action at each decision point.** Secondary actions are grouped away from the main decision.

5. **Familiar expert-app structure.** Persistent left nav, top context bar, central work area. The user learns the layout once.

6. **One card = one subject.** One match, one warning, one player. Avoid mixed-subject cards.

7. **Consistent layout grammar.** Same spacing, typography, badge placement, and table density across pages.

8. **Do not rely on color alone.** Statuses need color + icon + text. Warnings need readable labels.

9. **Every pixel informs, explains, or enables action.** No decorative charts, no filler metrics.

10. **FM-inspired operating model, not professional football assumptions.** No wages, contracts, market value, permanent ability scores, or "best XI" framing.

## Age Context

- Current usage: youth football, currently U11.
- Design must not hard-code U11 as a permanent product boundary.
- Language must be age-appropriate: no permanent ranking of children, no total ability scores.
- Use contextual terms: "projected shape", "current match shape", "position coverage", "squad readiness", "development focus".
- Player IDs for external payloads, names only where internal UI permission allows.

## Navigation Model

Primary navigation (4 items): Assistant, Fixtures, Teams, Players.

Canonical routes:
- `/assistant` — Smart inbox for what needs action now
- `/fixtures` — Period → round → match hierarchy with actions
- `/teams` — Team registry
- `/players` — Player assignment board and registry
- `/teams/[teamId]` — Team detail workspace
- `/teams/[teamId]/configuration` — Team configuration and rules
- `/rounds/[matchRoundId]` — Round board (accessible from fixtures/assistant links)
- `/rounds` — Rounds list (accessible from fixtures/assistant links)
- `/matches/[matchId]` — Match detail (accessible from fixtures/rounds)
- `/season` — Season overview (accessible from fixtures/assistant links)
- `/rules` — Rules configuration (accessible from team config links)
- `/history` — Audit of finalized selections and movement
- `/teams/new`, `/players/new`, `/matches/new` — Create forms

Redirects: `/` → `/assistant`, `/today` → `/assistant`, `/matches` → `/fixtures`

## Page Responsibilities

### Assistant (`/assistant`)
Smart inbox for what needs action now.
- Next actionable round/match work
- Problems requiring coach action
- Upcoming matches grouped by urgency
- Drafts needing review
- Availability gaps / unknown RSVPs
- Hard blockers
- Collapsed diagnostics: warnings, fairness checks

### Fixtures (`/fixtures`)
Period → round → match hierarchy.
- Period cards with readiness state and issue counts
- Round sections with generate/review links
- Match rows with readiness badge, selected count, issue count, post-match link

### Rounds (`/rounds`)
Round action dashboard.
- Each round row shows status and primary actions visibly
- Actions: Open, Generate draft, Review selections, Finalize, Reopen
- Round state visually obvious: Not started / Draft / Needs review / Blocked / Finalized

### Round Board (`/rounds/[matchRoundId]`)
Round workbench — the primary planning surface.
- Drag-and-drop squad selection
- Available players column + match columns
- Warnings surfaced inline
- Finalization controls

### Players (`/players`)
Player assignment board and registry.
- Drag-and-drop team assignment columns
- Unassigned column for players without a team
- Group by team/core group
- Quick access to player profile
- Primary actions: Add player, Edit player, Manage assignments

### Player Profile (`/players/[playerId]`)
The microscope — compact operating view of one player.
- Header: identity, group, status, quick actions
- Selection status and blockers visible high on page
- Match load, availability, position fit
- Development focus and signals
- Recent match history
- Coach notes
- Three-column desktop layout, stacked mobile

### Teams (`/teams`)
Team registry linking to team detail pages.
- Dense table with core player count, squad limits, support priority
- Link to `/teams/[teamId]` for detail
- Link to `/teams/new` for creation

### Team Detail (`/teams/[teamId]`)
The control tower — single operating view for one squad.
- Can this team play the next match?
- Who is missing, blocked, or overloaded?
- Squad table with tabbed views
- Position coverage and depth
- Support need, rotation pressure, rule impact
- Development summary
- Cross-team impact for support changes

### Team Configuration (`/teams/[teamId]/configuration`)
Team squad settings and rule display.
- Editable: target squad size, max squad size, support priority
- Read-only: global rules list with current values
- Audit trail via DecisionRecord

### Matches (`/matches/[matchId]`)
Match detail view.
- Match info, opponent, date, venue
- Squad selection summary
- Warnings and blockers
- Post-match report link

### Rules (`/rules`)
Advanced global rule configuration.
- Keep for: global selection constraints, hard fairness limits, engine settings
- Rotation paths also visible on Teams page
- Avoid duplicate configuration

### Season (`/season`)
Season-level load/fairness mirror.
- Player x round matrix (primary)
- Movement path summary
- Fairness warnings
- Double-load counting must match match detail data
- Double-load definition: same player with controlledDoubleLoad=true in the same round

### History (`/history`)
Audit of finalized selections and movement.

## Double-Load Definition

A double-load occurs when a player has `controlledDoubleLoad = true` on a Selection row. This means the player is assigned to a second match in the same round. The Season page must count double-loads the same way match details count them: by checking the `controlledDoubleLoad` field on Selection records.

## Section Usefulness Heuristic

Every visible section must pass at least one:
1. It helps the coach make a decision.
2. It exposes a problem.
3. It allows immediate action.
4. It explains a rule/result.
5. It supports maintenance.
6. It connects training, match selection, or development work.

Sections that fail all six should be removed.