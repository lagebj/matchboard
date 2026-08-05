# ARR-0051: RLS extension wraps every query in a transaction

## State

Resolved

## Identified

2026-08-04

## Residue

The Prisma RLS extension in `src/lib/db.ts` wraps every RLS-protected table query in a `$transaction` with `SET LOCAL app.current_organization_id` when tenant context is set. This adds transaction overhead to every read/write operation against 50+ tenant-bearing tables.

## Intended architecture

RLS tenant context should be set with minimal overhead. The ideal approach would be a connection-level `SET` that persists for the session, but Prisma connection pooling and serverless environments (Neon HTTP) make this unreliable because connections are ephemeral.

## Evidence

- `src/lib/db.ts` — `$transaction` wrapper for every RLS-protected query when `getTenantOrganisationId()` returns a value
- 50+ tables in `RLS_TABLES` set trigger the transaction wrapper
- Local development uses superuser and bypasses RLS entirely (no performance impact locally)
- Production uses `matchboard_app_runtime` role (RLS enforced, every query wrapped)

## Impact

- Every read/write against tenant-bearing tables becomes a transaction in production
- Performance impact in production is unmeasured
- The alternative (no RLS extension, rely on application-level WHERE filters) leaves RLS as defense-in-depth that doesn't actually enforce tenant isolation

## Containment

- Do not add more tables to `RLS_TABLES` without measuring performance impact
- Monitor production query latency after deployment
- The extension falls through to `query(args)` when no tenant context is set (auth resolution, background jobs)

## Resolution criteria

- Production query latency is measured and acceptable (under 100ms p95 for typical reads)
- Or: alternative approach is benchmarked and adopted (e.g., Neon `set_config` via prepared statement, connection-level SET with connection pinning)

## Disposition

Resolved. The `$transaction` wrapper has been removed. The Prisma extension now uses where-clause injection (injecting `organisationId` into `where` and `data` clauses) instead of `SET LOCAL` inside transactions. This eliminates the per-query transaction overhead entirely. See ADR-0057.

## Related decisions

ADR-0037 (superseded), ADR-0057 (replacement)

## Related implementation

PR #202 (where-clause injection), migration 20260804160000 (permissive RLS policies)

## Supersedes

None

## Superseded by

None

## History

### 2026-08-05

Resolved. The `$transaction` + `SET LOCAL` approach was replaced with where-clause injection (ADR-0057). Transaction overhead is eliminated; no query wrapping is needed.

### 2026-08-04

Record created. Extension deployed, performance not yet measured.