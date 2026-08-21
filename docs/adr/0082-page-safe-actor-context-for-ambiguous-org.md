# ADR-0082: Page-safe actor context for ambiguous/missing organisation context

## Status

Accepted

## Date

2026-08-21

## Context

The consolidation programme's residue sweep (Phase 2's long-open "MultipleMembershipsError
org-selection UX needs product design" item — flagged repeatedly since Phase 2, never actioned)
prompted investigating what actually happens today when a user's organisation context is
ambiguous (2+ memberships) or missing (0 memberships).

Investigation found the real gap was narrower than "design an org-picker from scratch." A real,
reasonably complete `/organisations` page already exists (`src/app/(app)/organisations/page.tsx`)
— it lists pending invitations, lists the user's organisations as clickable cards, and shows a
friendly zero-membership empty state. The two canonical entry points, `(app)/page.tsx` and
`(app)/assistant/page.tsx`, already redirect there gracefully via `resolveOrgSlugForLayout()` /
`getOrgSlugForUser()` (`src/lib/auth/resolve-org-slug.ts`), which returns `null` for both the
zero- and multi-membership case without distinguishing them, and `(app)/layout.tsx` deliberately
never redirects itself when this happens (AGENTS.md's "Auth layout rules" — fixed a real
infinite-redirect-loop bug, issue #296).

The actual gap: every *other* protected page and server action — 89 files, confirmed by grep —
calls `requireActorContext()` (`src/lib/auth/actor-context.ts`), which throws
`MultipleMembershipsError` (with a structured `organisations: Array<{id, name, slug, role}>`
payload — clearly intended to drive a picker, but nothing ever read it) or a plain
`AuthorizationError("No active organisation membership")` for the zero-membership case. Neither
is caught anywhere in application code; both propagate uncaught to the generic `(app)/error.tsx`
boundary ("Something went wrong"). A user who lands directly on any page other than the two
canonical entry points — a bookmark, a shared link, a stale tab, any in-app link followed before
an org context is established — hits a dead-end crash screen instead of the working
`/organisations` picker.

Separately, `requireActorContext()` is also called from 45 API route handlers
(`src/app/api/**/route.ts`), which must return a JSON error response on ambiguous/missing org
context, not trigger a browser redirect — ruling out simply changing `requireActorContext()`
itself to redirect unconditionally.

## Decision

Add `requirePageActorContext()` (`src/lib/auth/actor-context.ts`) as a thin wrapper: identical
behavior to `requireActorContext()`, except it catches `MultipleMembershipsError` and the
zero-membership `AuthorizationError` and calls `redirect("/organisations")` instead of letting
either propagate. `requireActorContext()` itself is unchanged and remains what API routes call.

Migrated all 89 real call sites under `src/app/(app)/**` (page components and `actions.ts`
files) from `requireActorContext` to `requirePageActorContext` — a single mechanical,
same-shape-of-change PR, not staged incrementally, since each site's fix is independent and
low-risk (the wrapper is a pure pass-through on the success path; behavior only changes for the
two specific error cases). One deliberate exclusion: `(app)/layout.tsx` — it only *mentions*
`requireActorContext()` in a comment describing what child components should call, and per the
existing, tested "Auth layout rules," the layout itself must never redirect on this condition.

`requireCoachAccess()`-only call sites (e.g. `createOrganisationAction`, which a user with zero
memberships must be able to call) were left untouched — they don't need an established
organisation context at all.

Also fixed the same investigation surfaced: `/organisations`' zero-membership empty state told
the user to "create a new organisation" with no way to do so — `createOrganisationAction`
existed and worked, nothing in the UI called it. Added `CreateOrganisationForm` (a small client
component) to that empty state.

## Consequences

- A multi-org or zero-org user hitting any of the 89 migrated pages/actions directly now lands
  on the working `/organisations` picker instead of a crash screen — closes the actual gap
  without needing a new UI design, since one already existed and just wasn't reachable from most
  of the app.
- `MultipleMembershipsError`'s structured `organisations` payload remains unused by
  `requirePageActorContext()` itself (it redirects rather than rendering inline) — `/organisations`
  re-queries the same data itself rather than needing it passed through the redirect. Revisit
  only if a future design wants the redirect target to skip a query round-trip.
- `src/test/support/auth-mock.ts` (the shared `mockAuthContext()` test helper) now also exports
  `requirePageActorContext` pointing at the same mock function as `requireActorContext`, so
  existing tests didn't need individual changes — confirmed by a full test run (2628/2628 pass)
  after the migration. One test file with its own inline mock
  (`src/app/(app)/matches/__tests__/match-reschedule.test.ts`) needed the same addition directly.
- API routes are unaffected — they still call `requireActorContext()` directly and return their
  own JSON error responses on `MultipleMembershipsError`/`AuthorizationError`, unchanged by this
  decision.
- Closes the Phase 2 "MultipleMembershipsError UX" residue item that had been flagged and left
  open since early in the consolidation programme.
