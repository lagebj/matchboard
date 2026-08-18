# 0064: Tenant Isolation Hardening — Phase 1 Closure

## Status

Accepted

## Context

The consolidation programme's Phase 1 audit identified several tenant isolation gaps:

1. **`clearBestLineupSlot` missing org filter.** The library function `clearBestLineupSlot(lineupId, slotId)` deleted `TeamBestLineupAssignment` records without verifying the lineup belongs to the authenticated user's organisation. The server action `clearBestLineupSlotAction` checked auth context and mutation role but did not pass `orgFilter` to this function. An authenticated coach could clear best lineup slots in another organisation by supplying a valid foreign `lineupId`.

2. **`hasTeamAccess` missing org filter.** The `hasTeamAccess()` function in `actor-context.ts` queried `db.team.findFirst({ where: { id: teamId } })` without including `organisationId` or `orgFilter`. While currently unused in server actions, it was a latent inconsistency with `requireTeamGroupAccess()` which uses `orgFilter`.

3. **Missing models in `RLS_TABLES`.** Five models with `organisationId` were not in the Prisma `tenantRLS` extension's `RLS_TABLES` set, meaning queries on these tables would not be automatically tenant-filtered: `TeamBestLineup`, `TeamBestLineupAssignment`, `EventLiveMatchSession`, `EventLiveMatchEvent`, and `NotificationOutbox`.

4. **`NotificationOutbox` is a documented exception.** ARR-0050 explicitly resolved that `NotificationOutbox` should NOT be in `RLS_TABLES` because it is a cross-tenant batch table processed by cron across all organisations. It was found in `RLS_TABLES` and removed.

5. **No automated schema/tenant invariant.** No CI check verified that `organisation-owned Prisma models == organisation-enforced models`, leaving gaps to recur silently.

## Decision

1. Fix `clearBestLineupSlot` to accept and use `orgFilter`, verifying the lineup belongs to the authenticated organisation before deleting assignments. The server action now passes `ctx.orgFilter`.

2. Fix `hasTeamAccess` to include `...ctx.orgFilter.filter` in the team query, consistent with `requireTeamGroupAccess`.

3. Add `TeamBestLineup`, `TeamBestLineupAssignment`, `EventLiveMatchSession`, and `EventLiveMatchEvent` to `RLS_TABLES`. These are organisation-scoped data that must be tenant-filtered.

4. Remove `NotificationOutbox` from `RLS_TABLES` per ARR-0050 resolution. It remains a documented exception with a dedicated test asserting its absence.

5. Add an automated CI test that checks every Prisma model with `organisationId` is in `RLS_TABLES` (with documented exceptions) and that every model in `RLS_TABLES` has `organisationId`. Export `RLS_TABLES` from `src/lib/db.ts` so the test can access it.

6. Add security audit tests verifying `clearBestLineupSlot` uses org filter and the server action passes it through.

7. Event live-match authorization was verified as correct — all event live actions check org access before data access, with defense-in-depth re-verification in library functions.

8. Event actions' group-level access design is documented as an explicit choice: `requireEventOrgAccess` checks organisation membership because events in Matchboard span football groups within an organisation. This is not a gap but an intentional product design decision.

9. `setBestLineupFormation` formation lookup without org filter is accepted as low-impact — formations can be SYSTEM-sourced (global) or CUSTOM (team-scoped), and the formation reference only affects the best lineup visual.

## Consequences

- `clearBestLineupSlot` now requires `orgFilter` and will silently return (no-op) if the lineup doesn't belong to the authenticated organisation, consistent with other clear/delete functions.
- `hasTeamAccess` now includes org-level filtering, eliminating a latent cross-tenant data access risk.
- Four additional models receive automatic tenant filtering via the Prisma `tenantRLS` extension.
- The schema/tenant invariant is now automatically verified in CI.
- `NotificationOutbox` remains outside `RLS_TABLES` per its cross-tenant batch processing design.
- The `RLS_TABLES` set is now exported for test verification.