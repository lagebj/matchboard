# Spec: Matchboard UX Overhaul

## Objective

Redesign Matchboard's shell, navigation, copy, dashboard, and primary workbench so the user always knows:
1. Where am I?
2. Which round am I working on?
3. What state is the round in?
4. What blocks progress?
5. Which team needs support?
6. Was support fulfilled?
7. Was backfill needed?
8. What fairness impact did this create?
9. What is the next safe action?

This is not a styling pass. This is a control, orientation, and workflow clarity overhaul.

The primary user is a youth football coach resolving real constraints under time pressure. The app must feel like a cockpit, not a brochure.

## Tech Stack

- Next.js 16 App Router (Turbopack)
- TypeScript
- Tailwind CSS
- Prisma + SQLite (local-first)
- lucide-react for icons
- Vitest for tests

## Commands

```
Dev:      npm run dev
Build:    npm run build
Test:     npm test
Lint:     npm run lint
Typecheck: npx tsc --noEmit
```

## Project Structure

```
src/app/                        -> Route pages (App Router)
src/components/shell/           -> Shell: sidebar, top bar, mobile nav
src/components/round/           -> Round workbench components
src/components/dashboard/       -> Dashboard/Today components
src/components/ui/              -> Reusable UI primitives
src/components/inspector/      -> Inspector panel components
src/lib/selection/              -> Domain logic (untouched by this spec)
src/lib/ux/                     -> UX utilities: status model, copy, nav config
```

## Code Style

Follow existing conventions:
- Server components by default, client components only when needed (useState, useEffect, event handlers)
- Props interfaces defined inline or in types.ts near the component
- Tailwind utility classes, no CSS modules
- lucide-react icons, never custom SVG icons
- Consistent icon size: 16px for inline, 20px for section headers, 24px for nav
- Compact typography, tabular numbers for counts

## Testing Strategy

- Existing Vitest tests in `src/lib/selection/` must continue to pass
- New component behavior verified through type checking and build
- Where practical, add integration tests for UX-critical paths
- Mark test gaps as debt in verification notes

## Boundaries

- **Always do:** Run `npm test` and `npx tsc --noEmit` after changes, keep domain logic out of React components, use existing Tailwind setup, preserve local-first SQLite model
- **Ask first:** Adding new npm dependencies, changing Prisma schema, changing API endpoints
- **Never do:** Commit real player data, reference docs/domain.md, break features/matchboard.feature expectations, introduce auth or multi-user concepts, add pages beyond the 6 canonical routes

## Route Architecture

### Canonical routes (6 only)

| Route | Title | Subtitle | Purpose |
|-------|-------|----------|---------|
| `/` | Today | Review the active round, blockers, and the next safe action. | Dashboard with Next Action, active round, blockers |
| `/rounds` | Rounds | Generate, review, and finalize squads per match round. | Round list + filters |
| `/rounds/[matchRoundId]` | Round W19 | N matches · status · blockers | Round workbench (main product screen) |
| `/players` | Players | Availability, load, and movement history. | Dense sortable table |
| `/teams` | Teams | Core groups, support needs, and movement paths. | Lightweight directory linking to team detail pages |
| `/rules` | Rules | Selection rules, support priority, and backfill behavior. | Rule config |
| `/history` | History | Finalized rounds, movement, and fairness over time. | Dense sortable table |

### Removed routes (delete page files)

- `/assistant` — functionality folded into Round Review inspector and Today
- `/matchday` — functionality is the round workbench
- `/planner` — history + round workbench cover this
- `/rotation` — movement is visible in round workbench and history
- `/tactics` — not a primary workflow
- `/availability` — availability is in Players
- `/matches` — redirect to `/rounds`
- `/weeks/[weekKey]` — redirect to `/rounds`
- `/selection/[matchId]` — redirect to relevant round

### Detail push routes (no top-level nav)

- `/players/[playerId]` — Player profile (inspector on desktop, push on mobile)
- `/teams/[teamId]` — Team detail workspace (primary team view)
- `/rounds/[matchRoundId]` — Round workbench

## Navigation Model

### Sidebar (canonical)

6 items, no groups:

| Icon | Label | href | Badge |
|------|-------|------|-------|
| LayoutDashboard | Today | `/` | — |
| CalendarRange | Rounds | `/rounds` | Warning count |
| Users | Players | `/players` | — |
| Shield | Teams | `/teams` | — |
| Sliders | Rules | `/rules` | — |
| History | History | `/history` | — |

Brand: "Matchboard" / "Squad planning"
Footer: version tag

### Top context bar (cockpit status bar)

Left side:
- Current season name
- Planning period date range
- Active round name + status badge
- Breadcrumb when inside detail

Right side — Primary action (state machine):
- No round selected → "Select round" (navigates to /rounds)
- Round not generated → "Generate squads" (triggers generation)
- Draft with blockers → "Review blockers" (scrolls to blockers)
- Draft without blockers → "Finalize round"
- Finalized → "View history"

Secondary action group (compact dropdown):
- Re-run, Edit round, Export, Reset draft, Manual override

### Mobile nav

5 items matching sidebar order:

| Icon | Label | href |
|------|-------|------|
| LayoutDashboard | Today | `/` |
| CalendarRange | Rounds | `/rounds` |
| Users | Players | `/players` |
| Shield | Teams | `/teams` |
| History | History | `/history` |

## Copy Rewrite

### Navigation labels

| Old | New |
|-----|-----|
| Dashboard | Today |
| Manager Desk | Today |
| Decision inbox | (removed) |
| Decision Cards | Needs Action |
| Assistant Advice | Round Review |
| Structured review room | Round Checks |
| Fairness Watch | Fairness Checks |
| Rotation story | Movement History |
| Rule Studio | Rules |
| Match Room | Match Selection |
| Dossier | Player Profile |
| Workspace | Board |
| Command center | (removed) |
| Operations workspace | Squad planning |
| Desk | Today |

### Action labels

| Context | Label |
|---------|-------|
| Generate | Generate squads |
| Review blockers | Review blockers |
| Finalize | Finalize round |
| Finalized | View history |
| Support fulfilled | Support fulfilled |
| Support missing | Support missing |
| Backfill required | Backfill required |
| Backfill resolved | Backfill resolved |
| Selected because | Selected because |
| Fairness impact | Fairness impact |
| Movement history | Movement history |
| Manual override reason | Manual override reason |
| Ready to finalize | Ready to finalize |

### Prohibited copy

Never use: decision debt, structured review room, rotation story, workspace, optimization, entity, resource, candidate entity, automated allocation, command center.

## Warning and Status Model

### Round status (5-state)

| Status | Label | Icon | Color |
|--------|-------|------|-------|
| NOT_GENERATED | Not generated | CircleDashed | gray |
| DRAFT | Draft | FilePenLine | amber |
| BLOCKED | Blocked | OctagonAlert | red |
| READY | Ready | CheckCircle2 | green |
| FINALIZED | Finalized | FileCheck | green |

BLOCKED and READY are derived: BLOCKED = draft + HARD_BLOCK warnings. READY = draft + no blockers.

### Warning severity (4-level)

| Severity | Label | Icon | Effect |
|----------|-------|------|--------|
| blocking | Blocking | OctagonAlert | Finalization blocked |
| high | High | AlertTriangle | Review before finalizing |
| medium | Medium | AlertCircle | Review when time allows |
| info | Info | Info | Explains a decision |

Every warning display MUST include: icon + label + text + semantic HTML. Never color alone.

## Component Architecture

### Shell (src/components/shell/)
- `sidebar-nav.tsx` — canonical sidebar (6 items)
- `top-context-bar.tsx` — cockpit status bar
- `mobile-nav.tsx` — canonical 5-item mobile nav

### Deleted shell
- `app-sidebar.tsx` — remove
- `app-top-bar.tsx` — remove
- `app-mobile-nav.tsx` — remove

### Dashboard (src/components/dashboard/)
- `next-action-card.tsx` — primary next action
- `active-round-summary.tsx` — round state at a glance
- `blocking-warnings-panel.tsx` — blocking warnings list
- `fairness-checks-card.tsx` — fairness impact
- `recent-finalized-card.tsx` — last 3 finalized rounds

### Round workbench (src/components/round/)
- `round-command-center.tsx` — keep, overhaul
- `match-squad-card.tsx` — keep, overhaul
- `inspector-panel.tsx` — keep, overhaul
- `warning-panel.tsx` — keep, overhaul
- `fairness-summary.tsx` — keep, adjust copy
- `confirm-finalize-dialog.tsx` — keep, add blocker summary
- `movement-chain.tsx` — NEW
- `round-status-strip.tsx` — NEW

### Inspector (src/components/inspector/)
- `player-inspector.tsx` — NEW
- `warning-inspector.tsx` — NEW
- `match-inspector.tsx` — NEW
- `movement-inspector.tsx` — NEW

### UI primitives (src/components/ui/)
- `status-badge.tsx` — keep, update to 5-state model
- `severity-badge.tsx` — keep, ensure icon+label
- `role-badge.tsx` — keep
- `empty-state.tsx` — keep
- `warning-card.tsx` — NEW

### Teams (src/components/team/)
- `team-header.tsx` — team name, squad limits, support priority
- `team-summary-strip.tsx` — current round status, core count, sent/received counts, warning count
- `team-squad-tab.tsx` — core roster, planning status groups
- `team-current-round-tab.tsx` — selected, sent, received, dropped with movement language
- `team-movement-tab.tsx` — movement history across rounds
- `team-history-tab.tsx` — finalized rounds for this team
- `team-rules-tab.tsx` — rotation paths, config, link to Rules page

## Implementation Phases

### Phase 1: Shell cleanup and route consolidation

Remove legacy shell. Unify navigation. Add redirects. Update layout.

Files:
- DELETE: src/components/app-sidebar.tsx, app-top-bar.tsx, app-mobile-nav.tsx
- MOD: src/app/layout.tsx
- MOD: src/components/shell/sidebar-nav.tsx
- MOD: src/components/shell/top-context-bar.tsx
- ADD: src/components/shell/mobile-nav.tsx
- ADD: next.config redirects

### Phase 2: Copy and content rewrite

Update all labels across surviving pages and components.

Files: all page.tsx files, all shell components, all round components

### Phase 3: Dashboard as Today

Rewrite dashboard page with Next Action, Active Round Summary, Blocking Warnings, Fairness Checks, Recently Finalized.

Files:
- MOD: src/app/page.tsx
- ADD: src/components/dashboard/ (5 new files)

### Phase 4: Top context bar cockpit

Rewrite top-context-bar with state machine primary action.

Files:
- MOD: src/components/shell/top-context-bar.tsx

### Phase 5: Round workbench overhaul

Overhaul round command center with status strip, improved squad cards, movement chains.

Files:
- MOD: src/components/round/round-command-center.tsx
- MOD: src/components/round/match-squad-card.tsx
- MOD: src/components/round/warning-panel.tsx
- ADD: src/components/round/round-status-strip.tsx
- ADD: src/components/round/movement-chain.tsx
- ADD: src/components/ui/warning-card.tsx

### Phase 6: Inspector panels

Add right inspector panel for player/warning/match/movement detail.

Files:
- MOD: src/components/round/inspector-panel.tsx
- ADD: src/components/inspector/ (4 new files)

### Phase 7: Round list with filters

Update /rounds list with filter UI.

Files: MOD: src/app/rounds/page.tsx

### Phase 8: Visual system cleanup

Consistent icons, spacing, typography, card discipline across all components.

### Phase 9: Players and History dense tables

Upgrade to dense sortable filterable tables.

### Phase 9b: Team detail workspace

Create team detail page with header, summary strip, Squad tab, Current Round tab, Movement tab, History tab, Rules tab.

Files:
- ADD: src/app/teams/[teamId]/page.tsx
- ADD: src/components/team/ (7 new files)

The all-teams page (`/teams`) must remain a lightweight directory linking to detail pages. It must not become a catch-all dashboard.

### Phase 10: Delete orphaned pages and final redirects

Remove 10 page files, add Next.js redirects.

### Phase 11: Verification and tests

Full test suite, build, type check, manual verification checklist.

## Success Criteria

1. Six canonical routes only
2. No competing navigation systems
3. Every page has clear title and operational subtitle
4. Prohibited copy never appears
5. Dashboard shows exactly one primary Next Action
6. Round status always visible (5-state model)
7. Warning severity shows icon + label + text (never color alone)
8. Support missing and backfill required impossible to miss on round workbench
9. Movement chains replace prose blocks
10. Inspector panel shows detail for players, warnings, matches, movements
11. All selection engine tests pass unchanged
12. TypeScript strict, no build errors

## Open Questions

1. Inspector panel: shared layout component or local to round page? → Shared `src/components/inspector/`
2. Removed pages: 404 or redirect? → Redirect to nearest canonical page
3. Round filters: query-string for shareable URLs? → Yes
4. Next Action state machine: shared hook? → Yes, `src/lib/ux/next-action.ts`

## Implementation Gaps (discovered during doc audit)

1. **~~Warnings are not persisted.~~** FIXED. Warnings are now persisted via `persist-warnings.ts` after generation. Both `generate-round` API and `populate-all` write warnings to the DB. `refreshDraftRound` also persists warnings.

2. **~~No populate-all endpoint.~~** FIXED. `POST /api/populate-all` accepts `planningPeriodId`. Generates drafts for all non-finalized rounds in chronological order using round-level orchestration. Skips finalized. Reports partial failures.

3. **~~Today page next-action state machine needs extension.~~** PARTIALLY DONE. Today page now has Setup Progress section showing round generation status across the planning period with a Populate-all button. The top-context-bar state machine still needs the "no rounds" → "create matches" and "multiple ungenerated" → "populate all" transitions.

4. **Prohibited copy still present in some component labels.** The feature file uses "decision inbox" and "assistant advice" in its Gherkin scenarios. The implementation must map these to the canonical terms (Needs Action, Round Checks) per the copy rewrite table above.

5. **No team detail workspace.** `/teams/[teamId]` does not exist yet. The all-teams page is the only team view. The team detail workspace with tabs (Squad, Current Round, Movement, History, Rules) needs to be built per the feature file scenarios and AGENTS.md specification.