# 0056: Football Group Table RLS Policies and Missing RLS_TABLES Entries

## Status

Accepted

## Context

After deploying RLS and the Prisma tenant context extension (ARR-0050 through ARR-0055), the production app shows no data on the Groups page and other pages that query football group tables or work ownership data.

Root cause analysis identified two problems:

1. **Missing RLS policies on football group tables.** The tables `FootballGroup`, `FootballGroupPlayer`, `GroupMovementPath`, and `GroupAccess` were created in migration `20260804000000` AFTER the dynamic RLS policy migrations (`20260802150000` and `20260803160000`) ran. These tables had RLS enabled and forced (applied manually per session notes), but lacked tenant-scoped RLS policies for `matchboard_app_runtime`. Without policies, `FORCE ROW LEVEL SECURITY` blocks all access from the runtime role, returning 0 rows.

2. **Missing RLS_TABLES entries.** The Prisma RLS extension in `src/lib/db.ts` wraps queries in `$transaction` with `SET LOCAL app.current_organization_id` only for tables in the `RLS_TABLES` set. Seven tables with `organisationId` were missing: `liveMatchSession`, `liveMatchEvent`, `matchRotation`, `fairPlayObservation`, `opponentSportingEvidence`, `playerDevelopmentObservation`, `playerProfileSuggestion`, and `workOwnership`. These tables have RLS policies in the database but the extension doesn't set tenant context for them, causing all queries to return 0 rows.

## Decision

1. Add a migration (`20260804150000`) that enables and forces RLS on `FootballGroup`, `FootballGroupPlayer`, `GroupMovementPath`, and `GroupAccess`, and creates tenant-scoped RLS policies for `matchboard_app_runtime` and admin-all policies for `matchboard_admin_migration`. For `GroupAccess` (no `organisationId` column), use a subquery join through `FootballGroup.organisationId`.

2. Add the 8 missing tables to `RLS_TABLES` in `src/lib/db.ts` so the Prisma extension sets tenant context for queries against them.

3. Grant table-level and enum-level privileges to `matchboard_app_runtime` and `matchboard_admin_migration` for the football group tables.

4. Transfer table ownership to `matchboard_admin_migration` to ensure `FORCE ROW LEVEL SECURITY` applies to the table owner.

## Consequences

- Football group tables will return data scoped to the current organisation.
- Work ownership, live match, fair play, opponent sporting evidence, player development, and player profile suggestion queries will now correctly filter by organisation.
- `GroupAccess` uses a subquery join through `FootballGroup`, which adds a small query overhead per access check.
- The `Organisation` table remains in `RLS_TABLES` without RLS enabled; the `$transaction` wrapper is unnecessary overhead but harmless.