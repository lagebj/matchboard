# ARR-0054: Layout-level runWithTenantOrganisationId does not propagate to child server components

## State

Identified

## Identified

2026-08-04

## Residue

Both `(app)/layout.tsx` and `o/[orgSlug]/layout.tsx` wrap their rendered children in `runWithTenantOrganisationId()`, but Next.js App Router renders server components as separate async operations. `AsyncLocalStorage.run()` does NOT propagate across server component boundaries. This means the layout's tenant context does not reach child page components.

The effective RLS context mechanism is `setTenantOrganisationId()` via `enterWith()` in `requireActorContext()`, which is called by every server action and page component that needs auth.

## Intended architecture

Every authenticated `db` query should have RLS tenant context set. The primary mechanism is `requireActorContext()` calling `setTenantOrganisationId()` via `enterWith()`.

## Evidence

- `src/app/(app)/layout.tsx` — calls `runWithTenantOrganisationId(organisationId, async () => content)` and `resolveOrganisationAccess(orgSlug)`
- `src/app/(app)/o/[orgSlug]/layout.tsx` — calls `runWithTenantOrganisationId(organisationId, async () => content)` and `resolveOrganisationAccess(orgSlug)`
- These layout-level context calls DO cover the layout's own `resolveOrganisationAccess()` queries
- But the `runWithTenantOrganisationId()` wrapping of `{children}` does NOT propagate to child server components in Next.js App Router

## Impact

- Not a functional bug: `requireActorContext()` in child components sets context via `enterWith()`
- The layout-level `runWithTenantOrganisationId()` calls are misleading — they appear to set context for children but don't
- The `resolveOrganisationAccess()` calls in layouts are redundant with `requireActorContext()` in most child components (double auth resolution)

## Containment

- Document that layout-level `runWithTenantOrganisationId()` only covers the layout's own queries
- Do not rely on layout-level context for child component queries
- Consider removing `resolveOrganisationAccess()` from layouts if `requireActorContext()` in child components covers auth

## Resolution criteria

- Remove or simplify layout-level tenant context setup
- Add comments explaining the `enterWith()` mechanism in `requireActorContext()`
- Ensure no code path relies on layout-level context propagation to children

## Disposition

Pending. Not a functional bug, but misleading code that should be cleaned up.

## Related decisions

None

## Related implementation

PR #192, PR #193

## Supersedes

None

## Superseded by

None

## History

### 2026-08-04

Record created. Layout context calls are misleading but not harmful.