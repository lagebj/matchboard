# Spec: Canonical Data Truth Follow-ups

## Objective

Implement three follow-ups to the canonical data truth work:

1. **Assist events** — Mirror the `Goal` model pattern: a new `Assist` Prisma model, migration, add/remove UI, canonical read paths, and reconciliation from `Assist` events to `MatchReportPlayerStat.assists`.
2. **Reconciliation & audit API** — Coach-only admin endpoints for running `auditDataIntegrity` (GET) and `reconcileCanonicalDerivedData` (POST with dry-run/apply), following the existing `/api/admin/migrate` pattern.
3. **Opponent snapshot reconciliation** — Extend the reconciliation module to detect and optionally fix `Match.opponent` divergences from `OpponentTeam.displayName`, with dry-run support.

## Commands

```
Build: npm run build
Test: npm test
Lint: npm run lint
Typecheck: npx tsc --noEmit
Dev: npm run dev
Migrate: npx prisma migrate dev --name <name>
```

## Project Structure

- `prisma/schema.prisma` — Assist model
- `prisma/migrations/` — New migration for Assist
- `src/lib/data-integrity/` — Audit, reconcile, types (existing)
- `src/lib/selection/` — Read paths for assists
- `src/app/(app)/matches/[matchId]/post-match/` — Assist UI actions
- `src/app/(app)/matches/[matchId]/post-match/page.tsx` — Assist UI page
- `src/components/assistant/post-match-page.tsx` — Assist buttons
- `src/app/api/admin/audit/route.ts` — New: audit API
- `src/app/api/admin/reconcile/route.ts` — New: reconcile API
- `src/lib/data-integrity/reconcile-canonical-derived-data.ts` — Extended

## Code Style

Follow existing patterns:
- Goal model as the reference pattern for Assist
- `/api/admin/migrate/route.ts` as the reference pattern for API endpoints
- `requireCoachAccess()` on all data-mutating endpoints
- Prisma model field naming follows existing conventions
- Feature scenarios in `features/matchboard.feature`

## Testing Strategy

- Vitest for unit/integration tests
- All new Prisma model changes require a migration
- Assist add/remove tests follow the existing goal lifecycle test pattern
- API endpoint tests follow existing admin/migrate test pattern (if any) or new test directory
- Reconciliation dry-run must never modify data

## Boundaries

- Always: Run lint, typecheck, tests before commits
- Always: `requireCoachAccess()` on all admin endpoints
- Always: Assist events follow the same canonical-truth rules as goals
- Always: Reconciliation is idempotent
- Ask first: Adding new API routes beyond admin/audit and admin/reconcile
- Never: Auto-migrate opponent snapshots without coach confirmation
- Never: Remove `MatchReportPlayerStat.assists` field (it becomes a compatibility field like goals)

## Success Criteria

1. `Assist` model exists in Prisma schema with fields: `id`, `reportId`, `playerId`, `type`, `createdAt`, `updatedAt`, plus relations to `PostMatchReport` and `Player`
2. Migration creates the `Assist` table
3. Coach can add and remove assists from the post-match report UI
4. `get-players-overview.ts`, `effective-participation.ts`, `get-effective-appearances.ts` read assists from `Assist` events (not `playerStats.assists`)
5. Audit detects when `playerStats.assists` diverges from `Assist` event count
6. Reconciliation can fix `playerStats.assists` from `Assist` events (dry-run and apply)
7. `GET /api/admin/audit` returns integrity audit results
8. `POST /api/admin/reconcile` with `dryRun: true` returns proposed changes; with `dryRun: false` applies them
9. Reconciliation can update `Match.opponent` to match `OpponentTeam.displayName` (dry-run and apply)
10. All existing tests still pass

## Open Questions

None — all three features have clear analogs in the existing codebase.