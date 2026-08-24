# ARR-0029: The tenantRLS Prisma extension has been silently inert since it was introduced

## State

Resolved

## Identified

2026-08-24 (Architecture Integrity Programme, AIP-2, discovered while adding the negative test
required by ARR-0027's resolution criteria — no prior test ever exercised the real extended
client at runtime)

## Residue

Two independent bugs, both root-caused while writing the first-ever runtime test against the
real `db` export from `src/lib/db.ts` (`src/lib/__tests__/db-tenant-fail-closed.test.ts`).
Together they mean the `tenantRLS` Prisma extension — documented in ADR-0057 and AGENTS.md as
"the primary tenant isolation mechanism" — has never actually injected `organisationId` into a
single query, in any environment, since it was introduced (PR #202, ADR-0057, 2026-08-05).

### Bug 1: model-name casing mismatch

Prisma 7's `"prisma-client"` generator (the one this repo uses — confirmed via
`prisma/schema.prisma`'s `generator client { provider = "prisma-client" }`, unchanged since this
repo's first commit) reports the `model` argument in a client extension's `$allOperations` hook
in **PascalCase**, matching the schema declaration exactly (`"Team"`, `"FootballGroup"`,
`"OrganisationMembership"`) — empirically confirmed with a temporary debug log during this
investigation. `RLS_TABLES` (`src/lib/db.ts`) has always been keyed by **lowerCamelCase** names
(`"team"`, `"footballGroup"`, `"organisationMembership"`), matching the Prisma **client accessor**
convention (`db.team`, `db.footballGroup`) — confirmed as the intentionally correct convention by
`src/test/security-audit.test.ts`'s own `getPrismaModels()` test, which explicitly converts
PascalCase schema names to lowerCamelCase before comparing against `RLS_TABLES`.

`isRlsTable = model != null && RLS_TABLES.has(model)` therefore compared `"Team"` against a set
containing `"team"` — **never true, for any model, ever**. Consequences:

- `needsOrgFilter` was always `false`, so the entire where-clause-injection branch
  (`withOrgWhere`/`withOrgData`/`withOrgWhereAndData`) never executed for any query.
- The `organisationMembership` self-read-by-`userId` special case (`model ===
  "organisationMembership"`, added to resolve ARR-0052/ADR-0052) also never matched — that fix
  has been inert too, for the same reason.
- A second, dormant instance of the identical bug existed in the `findUnique` → `findFirst`
  conversion: `(rawClient as ...)[model as string]` indexed `rawClient` (whose properties are the
  lowerCamelCase client accessors) using the raw PascalCase `model`, which would resolve to
  `undefined` and crash with "Cannot read property 'findFirst' of undefined" — this was never
  observed in production only because `needsOrgFilter` was always false, so this branch was never
  reached. Fixing Bug 1 without also fixing this second instance would have caused the ADR-0087
  fail-closed change to crash (not merely fail closed) on the first `findUnique` against any
  RLS-scoped table with valid organisation context — i.e., on most ordinary authenticated
  requests.

### Bug 2: AsyncLocalStorage context does not propagate through an un-awaited Prisma call

Prisma queries (and `$transaction()`) are lazy — calling `db.team.findMany()` synchronously
returns a thenable that only actually dispatches when awaited/`.then()`'d. `AsyncLocalStorage`
context established via `.run(store, callback)` is only visible to work that happens within
`callback`'s own continuation. A callback of the shape `() => db.team.findMany()` (or
`() => db.$transaction(...)`) returns the un-awaited promise immediately, `.run()` exits, and the
context reverts to whatever it was *before* the caller's later `await` actually triggers the
query — so the extension sees no context at all when the query really runs.

`runWithTenantOrganisationId()`/`runWithSystemPrivilege()` themselves are correct — this is a
call-site pattern bug. Two of the fixes written earlier in this same AIP-2 change had exactly this
shape and would have been silently non-functional in production despite passing a superficial
code read:

- `withTenantContext()` (`src/lib/tenancy/tenant-client.ts`) — `runWithTenantOrganisationId(id, ()
  => db.$transaction(...))`.
- `resolveOrgFilterForMachine()` (`src/lib/tenancy/resolve-org-filter.ts`) —
  `runWithTenantOrganisationId(id, () => client.machinePrincipal.findUnique(...))`.

Both now `await` the Prisma call *inside* an `async` callback passed to `.run()`.
`recordEventForActor()`, the internal snapshot route, and `scripts/bootstrap-organisation.ts`
were already written with internal `await`s inside their `async` callbacks and were not affected.

## Intended architecture

Programme outcome #2 and ADR-0087 both assume the `tenantRLS` extension's where-clause injection
actually runs. Bug 1 meant it never did; Bug 2 meant a naive fix (matching the existing codebase's
prevailing call-site style) would not have actually worked either. Both are prerequisites for
ADR-0087's fail-closed behavior to mean anything.

## Evidence

- Temporary debug logging added and removed during this investigation, empirically showing
  `$allOperations` receiving `{ model: 'Team', operation: 'findMany' }`,
  `{ model: 'FootballGroup', operation: 'create' }`, `{ model: 'Organisation', operation: 'create'
  }` — all PascalCase.
- `src/test/security-audit.test.ts`'s `getPrismaModels()` test (`name.charAt(0).toLowerCase() +
  name.slice(1)`) — proves the lowerCamelCase convention was always the intended one, and that
  this static-schema-coverage test could never have caught Bug 1 (it checks *set membership*, not
  *runtime matching against the live Prisma client's actual argument casing*).
- `src/lib/__tests__/db-tenant-fail-closed.test.ts` — before the fix, `db.team.findMany()` with no
  tenant context resolved to `[]` (silently unscoped success) instead of throwing; after fixing
  Bug 1 alone, `runWithSystemPrivilege(...)`/`runWithTenantOrganisationId(...)`-wrapped queries
  still failed until Bug 2 was also fixed.
- No prior test in the repository ever imported the real extended `db` export from
  `src/lib/db.ts` and exercised a query through it — confirmed during the AIP-2 investigation
  (`sec3-assurance.test.ts`'s tests use `testDb`, the raw unwrapped client, despite similarly-named
  tests like "unscoped query (no tenant filter) returns data from all organisations").

## Impact

- Real-world exploitability is bounded, not eliminated, by the codebase's pervasive practice of
  writing an explicit `where: { organisationId }` / `ctx.orgFilter.filter` clause at most call
  sites (confirmed extensively throughout `src/lib/auth/actor-context.ts` and elsewhere) and by
  database-level RLS as defence-in-depth (itself permissive when the session variable is unset,
  per ADR-0057). The extension was never the *only* protection, but it was documented and relied
  upon as the primary, deterministic one — and for any query that omitted its own explicit filter
  (the exact class of gap ARR-0027 and this ADR-0087 change target, e.g.
  `getEffectiveGroupAccess()`'s `groupAccess.findMany({ where: { membershipId } })`), there was in
  fact **no enforcement at all** from the mechanism responsible for it, the entire time.
- This is precisely why ADR-0087's fail-closed behavior and this ARR's fix must ship together:
  fail-closed only matters once the extension can actually recognize an RLS-scoped model.

## Containment

- `RLS_TABLES` membership checks and the `organisationMembership` special case now compare against
  a normalized `modelName` (`model.charAt(0).toLowerCase() + model.slice(1)`), computed once at
  the top of `$allOperations`.
- Any future `AsyncLocalStorage`-scoped Prisma call (`runWithTenantOrganisationId`,
  `runWithSystemPrivilege`, or a future equivalent) must `await` the query *inside* its callback,
  not return an un-awaited promise. Documented in ADR-0087 and in this ARR as a pattern to follow.

## Resolution criteria

- `isRlsTable`/`needsOrgFilter`/the `organisationMembership` special case/the `findUnique` rawClient
  lookup all match Prisma's actual PascalCase `model` argument correctly (verified by
  `src/lib/__tests__/db-tenant-fail-closed.test.ts`'s real cross-tenant isolation tests, which
  create data in two organisations and assert queries are actually scoped — not merely that
  `RLS_TABLES` contains the right strings statically).
- `withTenantContext()` and `resolveOrgFilterForMachine()` `await` their Prisma calls inside the
  `runWithTenantOrganisationId()` callback.
- A regression test exists that would fail if either bug reappeared (it does — the "real
  cross-tenant isolation" describe block in the same test file).

## Disposition

Resolved. Both bugs fixed as part of ADR-0087 (AIP-2, Architecture Integrity Programme), in the
same change as ARR-0027's fail-closed behavior — the two are inseparable, since fail-closed
enforcement is meaningless if the extension never recognized an RLS-scoped model in the first
place.

## Related decisions

ADR-0057 (introduced the extension), ADR-0052 (organisationMembership self-read — its fix was
inert due to Bug 1), ADR-0087 (fail-closed tenant scoping — ships together with this fix)

## Related implementation

- `src/lib/db.ts` (`modelName` normalization, `findUnique` rawClient lookup fix)
- `src/lib/tenancy/tenant-client.ts` (`withTenantContext` await-inside-callback fix)
- `src/lib/tenancy/resolve-org-filter.ts` (`resolveOrgFilterForMachine` await-inside-callback fix)
- `src/lib/__tests__/db-tenant-fail-closed.test.ts` (regression coverage for both bugs)

## Supersedes

None.

## Superseded by

None.

## History

### 2026-08-24

Identified and resolved in the same session, while implementing ADR-0087 / closing ARR-0027.
