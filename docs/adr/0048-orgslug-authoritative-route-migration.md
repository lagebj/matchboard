# ADR-0048: Migrate all protected routes to orgSlug-authoritative paths

## Status

Proposed

## Date

2026-08-03

## Decision owners

- Matchboard engineering

## Context

ADR-0035 (MT-1.6) mandates organisation-scoped routes `/o/{orgSlug}/...` and specifies that client-supplied organisation IDs are never authority. ADR-0036 (§3) states that server actions resolve the organisation slug from the route parameter.

Currently, only 4 routes use `/o/[orgSlug]`: org detail, attention, reviews, and settings. All core football routes (assistant, fixtures, teams, players, matches, rounds, season, events, history, rules, simulation, insights, workbench, formations, opponents, ownership, organisations) remain at global paths without orgSlug.

The auto-resolve fallback in `requireActorContext()` (without orgSlug) works for single-organisation users but throws `MultipleMembershipsError` for multi-org users. This blocks multi-org access entirely for global routes. The `/organisations` page serves as an org picker linking to `/o/{slug}`, but all football operations happen on global routes that bypass the slug-based auth path.

This gap means:
- Multi-org users cannot use core football features
- Client-supplied `organisationId` in server action calls is trusted as authority when it should not be
- The org context is derived from session rather than from the URL, breaking ADR-0035's mandate

## Decision

### 1. All protected routes migrate under `/o/[orgSlug]/...`

All routes that require authentication move under the `/o/[orgSlug]/` path segment. The canonical navigation structure becomes:

```
/o/{orgSlug}/assistant
/o/{orgSlug}/fixtures
/o/{orgSlug}/teams
/o/{orgSlug}/teams/new
/o/{orgSlug}/teams/{teamId}
/o/{orgSlug}/teams/{teamId}/configuration
/o/{orgSlug}/players
/o/{orgSlug}/players/new
/o/{orgSlug}/players/{playerId}
/o/{orgSlug}/matches/new
/o/{orgSlug}/matches/{matchId}
/o/{orgSlug}/matches/{matchId}/live
/o/{orgSlug}/rounds
/o/{orgSlug}/rounds/{matchRoundId}
/o/{orgSlug}/season
/o/{orgSlug}/events
/o/{orgSlug}/events/new
/o/{orgSlug}/events/{eventId}
/o/{orgSlug}/history
/o/{orgSlug}/rules
/o/{orgSlug}/formations
/o/{orgSlug}/formations/new
/o/{orgSlug}/formations/{formationId}/edit
/o/{orgSlug}/insights
/o/{orgSlug}/insights/player-pathways
/o/{orgSlug}/simulation
/o/{orgSlug}/workbench
/o/{orgSlug}/opponents
/o/{orgSlug}/opponents/{opponentTeamId}
/o/{orgSlug}/attention (existing)
/o/{orgSlug}/reviews (existing)
/o/{orgSlug}/settings (existing)
```

### 2. Root `/assistant` redirects to orgSlug route

When an authenticated user visits a legacy global path (e.g., `/assistant`, `/fixtures`), the app redirects to the orgSlug path:
- Single-org user: redirect to `/o/{their-org-slug}/assistant`
- Multi-org user: redirect to `/organisations` (org picker)

This redirect happens at the layout/middleware level, not per-action.

### 3. Server actions receive orgSlug from route params

Every page component under `/o/[orgSlug]/` passes `params.orgSlug` to its server actions. Server actions call `requireActorContext(orgSlug)` with the explicit slug argument, using the `resolveOrganisationAccess(slug)` path that validates membership and role.

The auto-resolve path (`requireActorContext()` without orgSlug) is retained only for:
- The `/organisations` page (org picker)
- Internal utilities that operate within an already-resolved context
- The redirect logic that needs to determine the user's org

### 4. Sidebar navigation is orgSlug-aware

The `SidebarNav` component receives the current `orgSlug` from the route context and generates links like `/o/{orgSlug}/assistant` instead of `/assistant`.

### 5. API routes remain orgSlug-authoritative

API routes (`/api/...`) that serve protected data resolve organisation context from the authenticated session. API routes that serve org-scoped data accept orgSlug as a query parameter or derive it from the session, but never trust client-supplied `organisationId` as authority.

### 5.5 Cookie-based orgSlug resolution for server actions

To avoid changing 190+ server action call sites immediately, `requireActorContext()` (without explicit orgSlug) falls back to an `x-matchboard-org-slug` cookie set by the `/o/[orgSlug]/` layout. This means:

- When a user navigates to `/o/{orgSlug}/teams`, the layout sets the cookie
- When a client component on that page calls a server action without passing orgSlug, `requireActorContext()` resolves the org from the cookie
- This eliminates the `MultipleMembershipsError` for multi-org users browsing org-scoped routes
- Explicit orgSlug parameters are still preferred and should be progressively added for defense-in-depth

### 6. Incremental migration with parallel routes

The migration is done incrementally. During migration, both global routes and orgSlug routes work. Once all pages and actions are migrated:
1. Global routes redirect to orgSlug equivalents
2. Server actions on global routes are deprecated
3. Global routes are removed in a subsequent cleanup

### 7. `MultipleMembershipsError` handling

When `requireActorContext()` (no slug) throws `MultipleMembershipsError`, the UI must redirect to `/organisations` with the list of organisations. This is the designated org-picker flow.

## Rationale

- ADR-0035 explicitly mandates orgSlug routes. The current global routes violate this decision.
- Multi-org users are currently blocked from all football features. The orgSlug route structure unblocks them.
- URL-authoritative org context is auditable, shareable, and consistent with the tenant-isolation model in ADR-0035 and ADR-0037.
- Incremental migration allows each route to be migrated and tested independently without a big-bang rewrite.

## Alternatives considered

### Keep global routes with session-based org resolution

- Benefits: No route migration needed. Works for single-org users.
- Costs: Multi-org users remain blocked. Client-supplied organisationId becomes de-facto authority. URL does not reflect org context. Violates ADR-0035 MT-1.6.
- Reason not selected: Fails the multi-org use case and violates accepted ADR.

### Global org-switcher UI without URL scoping

- Benefits: Single-page app experience. No URL changes.
- Costs: org context is hidden from URL, making links unshareable and debugging harder. Server actions still receive client-supplied organisationId. Violates ADR-0035 MT-1.6 ("organisation slug is never trusted from client-supplied form data or headers").
- Reason not selected: URL-authoritative org context is a binding decision.

### Big-bang migration of all routes at once

- Benefits: No transition period with dual routes.
- Costs: Very high risk. All routes, actions, links, and tests change simultaneously. Hard to roll back.
- Reason not selected: Incremental migration is safer and allows per-route verification.

## Consequences

### Positive

- Multi-org users can use core football features for the first time
- URL-authoritative org context is auditable and shareable
- Server actions receive orgSlug from route params, not client-supplied data
- Consistent with ADR-0035 and ADR-0036
- `requireActorContext(orgSlug)` validates membership, role, and expiry on every request

### Negative

- All internal links, sidebar navigation, and client-side navigations must include orgSlug
- Every page component must await `params` and pass orgSlug to server actions
- Bookmark and external link breakage during migration (mitigated by redirects)
- More verbose URLs

### Risks and mitigations

- Risk: Existing bookmarks break. Mitigation: Legacy global routes redirect to orgSlug equivalents with 302.
- Risk: Client-side navigation misses orgSlug. Mitigation: Next.js layout provides orgSlug to all child routes via context/params.
- Risk: Large migration scope. Mitigation: Incremental per-route migration, each route verified independently.
- Risk: orgSlug changes if org is renamed. Mitigation: Use a stable slug that doesn't change on rename (or redirect old slug to new slug).

## Migration and compatibility

### Phase 1: Route structure

1. Move page directories from `src/app/(app)/assistant/` to `src/app/(app)/o/[orgSlug]/assistant/` (and so on for each route).
2. Each page component receives `params.orgSlug` and passes it to server actions.
3. Server actions call `requireActorContext(orgSlug)` instead of `requireActorContext()`.
4. Remove local `requireXxxOrgAccess()` helpers that currently guard with `orgFilter.type !== "org"` fallbacks — the slug path always resolves to a verified org context.

### Phase 2: Redirects

1. Add redirect logic for legacy global paths: `/assistant` → `/o/{orgSlug}/assistant` (single-org) or `/organisations` (multi-org).
2. Sidebar and navigation links update to orgSlug-prefixed paths.

### Phase 3: Cleanup

1. Remove global route pages and actions that have been fully migrated.
2. Remove the auto-resolve path from `requireActorContext()` or reduce it to redirect-only use.
3. Remove local org-access guard helpers that are no longer needed.

### Rollback

Each phase can be rolled back independently by restoring the previous route structure. The redirect layer can be removed without data loss.

## Security and operations

- orgSlug is validated on every request through `resolveOrganisationAccess(slug)`, which checks membership, role, and SUPPORT expiry.
- Client-supplied orgSlug in URL is the only org authority source. Client-supplied organisationId in request bodies is never authority.
- RLS (ADR-0037) provides defence-in-depth at the database level.
- The `/organisations` org-picker page is the only page that does not require a specific org context.
- Rate limiting and audit logging continue to apply at the server-action level.

## Related records

- ADRs: ADR-0035 (multitenancy architecture), ADR-0036 (tenant context resolution), ADR-0037 (RLS), ADR-0040 (support access)
- ARRs: ARR-0009 (no org-scoped routes)
- Security findings: A-001 (orgSlug is authoritative)
- Issues or plans: A-001 in current-state remediation

## Implementation evidence

- Pull requests or commits: 5925afe4, 9dfb6c73, cd3e56b2
- Tests or verification: (to be added during implementation)
- Provider evidence: None required

## Supersedes

ADR-0036 §3 (route-level resolution partial implementation — global routes without orgSlug are superseded by this decision)

## Superseded by

None.

## History

### 2026-08-03

Record created. Supersedes ADR-0036's partial implementation where only 4 of many routes used orgSlug.

### 2026-08-28

Found and fixed two pockets of leftover unscoped-path residue from this migration while
investigating a recurring E2E flake (`e2e/live-reporting.spec.ts`'s round-card lookup): the
round-detail `<Link>` in `round-list-client.tsx` still pointed at the legacy `/rounds/[id]` route
instead of `/o/{orgSlug}/rounds/[id]`, and every `revalidatePath()`/`redirect()` call in
`src/app/(app)/matches/actions.ts` and `src/app/(app)/rounds/[matchRoundId]/actions.ts`
(`createMatchAction`, `deleteMatchAction`, `updateMatchAction`, `finalizeMatchAction`,
`cancelMatchAction`, `reopenMatchAction`, and the round-board actions file's finalize/unfinalize/
regenerate/clear actions) still targeted unscoped legacy paths (`/fixtures`, `/rounds`,
`/matches/[id]`, `/today`, `/`, and one now-nonexistent `/selection/[id]`). All fixed to the
`/o/{orgSlug}/...` equivalents. These were functionally silent (the target pages are all
`force-dynamic`, so a stale `revalidatePath()` target is a no-op, not a rendering bug) except for
the `<Link>` and the two `redirect()` calls in `createMatchAction`/`deleteMatchAction`, which
caused a real extra redirect hop through the global-route-redirect middleware on every match
creation/deletion — measurable added latency on the exact path that a documented, pre-existing
E2E timeout comment (`e2e/helpers/live-match-fixtures.ts`) already flagged as needing a longer
timeout for slow/cold Vercel deployments. This is evidence the ADR-0048 migration was executed in
substance (the pages themselves are canonically org-scoped, matching AGENTS.md's "Canonical
routes" table) but not fully swept for stale references in server-action cache-invalidation/
redirect code — Status is left as `Proposed` rather than updated here, since this fix covered only
the two files touched by this investigation, not a full repository audit for remaining instances.