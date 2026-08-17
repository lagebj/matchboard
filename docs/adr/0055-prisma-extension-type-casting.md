# ARR-0055: Prisma extension type casting loses type safety

## State

Resolved

## Identified

2026-08-04

## Residue

The Prisma RLS extension in `src/lib/db.ts` uses `as unknown as PrismaClient` to cast the extended client back to `PrismaClient`. This means all callers get the `PrismaClient` type, but the runtime behavior includes the RLS extension. If someone passes `db` to a function expecting `PrismaClient`, the types match but the runtime behavior includes the extension wrapper.

## Intended architecture

The exported `db` should be type-safe. Either the Prisma extension type should be propagated throughout the codebase, or the type cast should be explicitly documented and its implications understood.

## Evidence

- `src/lib/db.ts` line 124: `export const db = extendedClient as unknown as PrismaClient;`
- `withTenantContext(db, ...)` calls work because `$transaction` on the extended client delegates to the base client
- 13+ call sites use `withTenantContext(db, ...)` where `db` is the extended client cast as `PrismaClient`

## Impact

- Lost type safety — extension-specific methods are not visible on `db`
- If Prisma changes the extension API, the cast may silently break
- Functions expecting `PrismaClient` receive the extended client without knowing about the RLS wrapper

## Containment

- Do not add extension-specific methods that rely on the cast
- Add a code comment on the `db` export explaining the type cast and its purpose
- `withTenantContext()` continues to work correctly because `$transaction` delegates to `baseClient`

## Resolution criteria

- Evaluate whether Prisma extension types can be propagated without breaking existing code
- Or: accept the cast and add documentation

## Disposition

Resolved. Added documentation comment explaining the type cast rationale. Removed legacy `withUnscopedContext`, `clearTenantContext`, `createTenantContext`, `setTenantContext`, and `TenantContext` type from `tenant-client.ts` — these were remnants of the superseded SET LOCAL approach (ADR-0037 → ADR-0057). `withTenantContext` retained as a transaction wrapper but `SET LOCAL` call removed since where-clause injection is the primary isolation mechanism.

## Related decisions

None

## Related implementation

PR #192

## Supersedes

None

## Superseded by

None

## History

### 2026-08-17

Resolved. Added documentation comment on the `db` export in `src/lib/db.ts` explaining the `as unknown as PrismaClient` cast rationale. Removed legacy SET LOCAL functions (`setTenantContext`, `withUnscopedContext`, `clearTenantContext`, `createTenantContext`, `TenantContext` type) from `tenant-client.ts` and its re-exports. `withTenantContext` retained as a Prisma transaction wrapper without the redundant `SET LOCAL` call. Updated corresponding tests.