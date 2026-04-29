# Implementation Plan: Matchboard UX Overhaul

## Overview
Transform Matchboard into a coach command center with a persistent dark shell, command-center round page, reusable badge/warning/inspector components, and accessible status indicators.

## Architecture Decisions
- lucide-react for icons (tree-shakeable, professional, matches dark UI)
- Inspector panel uses client-side state (no URL routing needed)
- Keep existing secondary pages (assistant, matchday, tactics, etc.) — don't delete
- Badge/warning components are centralized in `src/components/ui/`
- Round page restructured as server component + client islands for interactivity
- No UI component tests initially (design debt acknowledged)
- Tailwind CSS v4 tokens extended in globals.css

## Task List

### Phase 1: Foundation (Design tokens + Icon library + Shared primitives)

- [ ] Task 1: Install lucide-react and update globals.css design tokens
  - Acceptance: `npm run build` succeeds; dark console tokens visible; lucide-react importable
  - Verify: `npx tsc --noEmit && npm run build`
  - Files: `package.json`, `src/app/globals.css`
  - Scope: S

- [ ] Task 2: Create shared UI primitives (RoleBadge, StatusBadge, SeverityBadge, EmptyState)
  - Acceptance: Each component renders with icon+label+text, no color-only states, accessible sr-only labels
  - Verify: `npx tsc --noEmit`
  - Files: `src/components/ui/role-badge.tsx`, `src/components/ui/status-badge.tsx`, `src/components/ui/severity-badge.tsx`, `src/components/ui/empty-state.tsx`
  - Scope: M

### Phase 2: App Shell (Sidebar + Top context bar)

- [ ] Task 3: Rebuild SidebarNav with Dashboard/Rounds/Players/Teams/Rules/History
  - Acceptance: Sidebar shows 6 items with icons, active state, warning/count badge support
  - Verify: `npm run build`
  - Files: `src/components/shell/sidebar-nav.tsx`, `src/app/layout.tsx`
  - Scope: S

- [ ] Task 4: Rebuild TopContextBar with round state, season/period, primary action
  - Acceptance: Top bar shows active season/period, round state badge (Draft/Warnings/Ready/Finalized), primary action button (Generate/Finalize)
  - Verify: `npm run build`
  - Files: `src/components/shell/top-context-bar.tsx`, `src/app/layout.tsx`
  - Scope: M

### Phase 3: Round Command Center (Primary workspace)

- [ ] Task 5: Create MatchSquadCard component
  - Acceptance: Card shows team name, opponent, date, squad count, role-grouped players (with RoleBadge), support/backfill status, warning count
  - Verify: `npx tsc --noEmit && npm run build`
  - Files: `src/components/round/match-squad-card.tsx`
  - Scope: M

- [ ] Task 6: Create WarningPanel + WarningCard components
  - Acceptance: WarningPanel shows blocking/high/info counts; WarningCard shows icon, severity label, title, message, affected object, finalization impact
  - Verify: `npx tsc --noEmit && npm run build`
  - Files: `src/components/round/warning-panel.tsx`, `src/components/round/warning-card.tsx`
  - Scope: M

- [ ] Task 7: Create FairnessSummary component
  - Acceptance: Shows total match load, support burden count, development exposure count, drops count, recent movement for selected players
  - Verify: `npx tsc --noEmit && npm run build`
  - Files: `src/components/round/fairness-summary.tsx`
  - Scope: M

- [ ] Task 8: Create InspectorPanel (right-side detail panel)
  - Acceptance: Panel shows context for selected player/movement/warning/match; player view shows name, core team, role, explanations, season load; empty state shows when nothing selected
  - Verify: `npx tsc --noEmit && npm run build`
  - Files: `src/components/round/inspector-panel.tsx`
  - Scope: L

- [ ] Task 9: Rebuild round page as command center
  - Acceptance: Round page shows warning summary at top, MatchSquadCards in workspace, fairness summary, inspector panel; existing actions (generate, finalize) still work; all existing tests pass
  - Verify: `npm test && npm run build && npx tsc --noEmit`
  - Files: `src/app/rounds/[matchRoundId]/page.tsx`, `src/app/rounds/[matchRoundId]/actions.ts` (if needed)
  - Scope: L

### Phase 4: Finalization + Override UX

- [ ] Task 10: Create ConfirmFinalizeDialog component
  - Acceptance: Dialog shows round info, match count, unresolved warnings, support/backfill status, fairness notes; blocking warnings prevent finalization; manual override requires reason input
  - Verify: `npx tsc --noEmit && npm run build`
  - Files: `src/components/round/confirm-finalize-dialog.tsx`
  - Scope: M

### Phase 5: Microcopy + Polish

- [ ] Task 11: Update microcopy across all pages to football-management language
  - Acceptance: No "workflow complete", "entity updated", "candidate entity", "optimization result" language; terms like "Round generated", "Support missing", "Backfill required", "Selection reason" used consistently
  - Verify: `npm run build`
  - Files: Multiple page files (scan and update)
  - Scope: M

- [ ] Task 12: Reduce heading sizes and border-radius across all pages
  - Acceptance: No `text-4xl` or `text-5xl` in app workflow pages; max border-radius `rounded-xl` for cards (not `rounded-[2rem]`); compact spacing
  - Verify: `npm run build`
  - Files: Multiple page files (scan and update)
  - Scope: M

### Checkpoint: After Phase 3
- [ ] All 44 domain tests pass
- [ ] `npm run build` succeeds
- [ ] Round page shows MatchSquadCards, warnings, fairness, inspector

### Checkpoint: Final
- [ ] All acceptance criteria met
- [ ] `npm test` passes
- [ ] `npm run build` succeeds
- [ ] `npx tsc --noEmit` clean
- [ ] Manual review of round page command center UX

## Risks and Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking existing round page actions | High | Keep existing server actions; refactor rendering only |
| Inspector panel state management complexity | Medium | Use URL search params for initial state, client state for interaction |
| Large page files slow build | Medium | Extract components early; keep pages thin |
| Missing icon library size | Low | lucide-react is tree-shakeable; import individually |

## Open Questions
- None remaining (resolved in spec)