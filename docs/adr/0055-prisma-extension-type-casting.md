# ARR-0055: Prisma extension type casting loses type safety

## State

Identified

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

Pending. Low priority, current approach works correctly at runtime.

## Related decisions

None

## Related implementation

PR #192

## Supersedes

None

## Superseded by

None

## History

### 2026-08-04

Record created. Type cast is intentional but undocumented.