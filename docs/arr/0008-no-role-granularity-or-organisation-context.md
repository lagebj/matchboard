# ARR-0008: requireCoachAccess() provides no role granularity or organisation context

## Status

Resolved (2026-08-22)

## Final resolution (2026-08-22, platform-integrity-programme Phase 16)

Re-investigated the "2 remaining production call sites" before touching them, since blindly
migrating to `requireActorContext()` would have been wrong: `requireActorContext()` requires an
*existing* organisation membership, but `acceptInvitationAction`/`declineInvitationAction`
operate on users who explicitly do **not** have membership yet (that's the point of accepting an
invitation), and `listUserOrganisationsAction` is deliberately cross-tenant (it lists every org a
user belongs to, analogous to `/organisations` itself). These three call sites are genuinely
auth-only — no organisation context exists to resolve — and correctly keep `requireCoachAccess()`
per this ARR's own resolution criterion ("`requireCoachAccess()` is removed or reduced to a thin
wrapper for auth-only checks where org context is not needed"). No change needed here.

The real, fixable residue was different from what the ARR's history section implied: in both
files, every OTHER call site already called a real org-scoped resolver
(`resolveOrganisationOwner`/`resolveOrganisationAdminOrOwner`, which itself calls
`requireCoachAccess()` internally) *and* called `requireCoachAccess()` a second time, purely to
get `coach.email`/`coach.name` for audit logging — a redundant second auth/session check, not a
missing one. Removed the redundant calls in `machine-principal-actions.ts` (5 functions) and
`organisations/actions.ts`'s `createInvitationAction`, replacing `coach.email` with the resolver
context's `ctx.userEmail` (already available, no extra lookup), and replacing `coach.name` with a
direct `auth()` session read (display-name enrichment only, not an authorization decision).

No test changes required — the underlying authorization (`resolveOrganisationOwner`/
`resolveOrganisationAdminOrOwner`) is unchanged and already covered by
`src/lib/organisations/__tests__/organisation-access.test.ts`; this was a pure redundancy
removal, not new logic.

## Discovered

2026-07-30

## Residue

The `requireCoachAccess()` function in `src/lib/auth.ts` returns a coach object with no role, no organisation context, and no team delegation. Every server action that uses it treats the authenticated user identically — as a full-access coach.

Per ADR-0035, the target model has four roles (OWNER, ADMIN, COACH, VIEWER) with organisation membership and team-level delegation.

**Partial resolution**: `requireActorContext()` in `src/lib/auth/actor-context.ts` now provides `userId`, `email`, `membershipId`, `organisationId`, `organisationSlug`, `role`, `delegatedTeamIds`, and `orgFilter` in a single call. All production server actions, API routes, and page components that previously called both `requireCoachAccess()` and `resolveOrgFilterForUser()` now use `requireActorContext()` instead.

**Remaining residue** (re-verified 2026-08-20, consolidation programme residue reconciliation
pass — down from 14 files recorded 2026-08-17 to 2 real production call sites now, real
progress this ARR hadn't recorded): `requireCoachAccess()` is still called directly (not via
`requireActorContext()`) in exactly 2 production files — `src/app/(app)/organisations/actions.ts`
and `src/app/(app)/organisations/machine-principal-actions.ts` — plus 2 infrastructure
references (`src/lib/auth.ts` itself, `organisation-resolver.ts`) and the test-mock support file,
none of which are residue in the same sense. This ARR's own resolution criterion
("`requireCoachAccess()` is removed or reduced to a thin wrapper for auth-only checks where org
context is not needed") is now close to directly achievable given how few call sites remain.

Separately, various action files still carry `ctx.orgFilter.type === "org"` conditionals that
are now always true (dead code, not security holes — RLS provides defense-in-depth); not
re-audited in this pass.

## Containment

- `requireActorContext()` is the mandatory auth + org context entry point for all new code that needs organisation scoping
- `requireCoachAccess()` must not be combined with `resolveOrgFilterForUser()` in new code — use `requireActorContext()` instead
- No new call sites may call `requireCoachAccess()` + `resolveOrgFilterForUser()` as a pair
- Insights library functions must receive org context as a parameter, not resolve it internally (see ARR-0011)
- Admin routes should use a distinct admin auth pattern, not `requireCoachAccess()` (see ARR-0012)

## Resolution criteria

- `requireActorContext()` replaces `requireCoachAccess()` for all protected routes and actions that need org context
- No production code calls `requireCoachAccess()` + `resolveOrgFilterForUser()` as a pair
- `requireCoachAccess()` is removed or reduced to a thin wrapper for auth-only checks where org context is not needed
- User → OrganisationMembership → role resolution is mandatory for all org-scoped operations
- COACH and VIEWER roles have explicit team delegation via TeamAccess
- OWNER and ADMIN roles have organisation-wide access
- Every mutation validates the user's role and permitted teams before executing

## Affected ADRs

- ADR-0032 (authentication, session and authorisation baseline — deferred database-backed membership)
- ADR-0035 (multitenancy architecture and product decisions)

## Related

- `src/lib/auth.ts` — current auth implementation
- `src/lib/auth/actor-context.ts` — new `requireActorContext()` implementation
- `src/lib/tenancy/resolve-org-filter.ts` — `resolveOrgFilterForUser()` still exported, only used by test files and `actor-context.ts` internally
- Threat model gaps G-03 (no resource-level authorisation) and G-04 (no role granularity)

## Supersedes

None

## Superseded by

None

## History

### 2026-07-30

Record created from IMPROVE-0A architecture assessment.

### 2026-08-17

Further resolution: All 7 insights library functions now use `requireActorContext()` with explicit `organisationId` filters (ARR-0011 resolved). All 4 live-match library functions now use `requireActorContext()` with org ownership checks. `OrgFilterMode.unscoped` type variant removed — no code path can return an unscoped filter. Various `ctx.orgFilter.type === "org"` conditionals remain as dead code (always true) but are not security holes since RLS provides defense-in-depth.