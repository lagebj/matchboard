# Spec: Matchboard UX Overhaul — Coach Command Center

## Objective
Transform Matchboard from a scattered collection of pages into a focused coach command center where the primary workflow (generate → review → finalize a round) is immediately understandable at a glance. The round page becomes the primary workspace with visible warnings, fairness context, and an inspector panel.

## Tech Stack
- Next.js 16 App Router (server components preferred)
- React 19
- TypeScript
- Tailwind CSS v4 (existing)
- lucide-react (new — icon library)
- No component library — hand-built with shared primitives

## Commands
- Build: `npm run build`
- Dev: `npm run dev`
- Test: `npm test`
- Lint: `npm run lint`
- Type check: `npx tsc --noEmit`

## Project Structure
- `src/app/` — Pages (server components)
- `src/components/` — Reusable UI components
- `src/components/ui/` — Shared primitives (Badge, EmptyState, etc.)
- `src/components/shell/` — App shell components (Sidebar, TopBar, InspectorPanel)
- `src/components/round/` — Round-specific components (MatchSquadCard, WarningPanel, FairnessSummary)
- `src/lib/selection/` — Domain logic (unchanged)
- `src/test/` — Test infrastructure

## Code Style
Components follow existing pattern: Server components for data-fetching pages, Client components only for interactivity. Props typed inline. No comments.

```tsx
// Example: Badge component
type RoleBadgeProps = {
  role: "CORE" | "SUPPORT" | "BACKFILL" | "DEVELOPMENT" | "REDUCED_LOAD" | "DROPPED" | "UNAVAILABLE";
};

export function RoleBadge({ role }: RoleBadgeProps) {
  const config: Record<RoleBadgeProps["role"], { label: string; icon: React.ReactNode; className: string }> = {
    CORE: { label: "Core", icon: <ShieldCheck className="h-3 w-3" />, className: "bg-emerald-900/40 text-emerald-300 border-emerald-700/40" },
    // ...
  };
  const { label, icon, className } = config[role];
  return (
    <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider border ${className}`}>
      {icon}<span className="sr-only">{label}</span>{label}
    </span>
  );
}
```

## Testing Strategy
- Existing integration tests (44) cover domain logic
- No UI component tests (design debt — no React Testing Library installed)
- Verification via: `npm run build`, `npx tsc --noEmit`, `npm test`, manual dev server review
- Post-implementation: manual checklist for accessibility and visual review

## Boundaries
- Always: Run `npx tsc --noEmit` and `npm run build` after changes; preserve existing domain logic; keep server/client component boundaries correct
- Ask first: Adding npm dependencies; changing Prisma schema; removing pages/routes
- Never: Break existing API routes; commit secrets; touch `src/lib/selection/*` domain logic; add real player data

## Success Criteria
1. Round page shows MatchSquadCard per match with role-grouped players
2. Warning summary counts (blocking/high/info) visible above round workspace
3. Fairness summary visible on round page
4. Right-side inspector panel populates on player/warning/match click
5. Finalization shows confirmation dialog
6. Badge components are centralized (RoleBadge, StatusBadge, SeverityBadge)
7. App shell has persistent sidebar (Dashboard/Rounds/Players/Teams/Rules/History)
8. Top context bar shows active season, round state, primary action
9. Dark management-console aesthetic with compact typography (no 4xl/5xl headings)
10. No color-only status indicators (every status has icon + label + text)
11. No `docs/domain.md` references
12. All existing tests still pass
13. `npm run build` succeeds

## Open Questions
- Inspector panel: should it be a URL-routable panel or client-side state? → Client-side state (simpler, no routing needed)
- Should existing pages (assistant, matchday, tactics, rotation, planner, weeks) be removed? → No, keep as secondary routes accessible from sidebar or links; don't delete working pages
- Icon library choice? → lucide-react (lightweight, tree-shakeable, matches dark management UI)