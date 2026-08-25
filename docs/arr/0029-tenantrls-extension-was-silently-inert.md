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

### Bug 1b (found 2026-08-25, live in CI): compound-unique-key `findUnique` shape rejected by `findFirst`

A third dormant instance of "this branch never ran until Bug 1 was fixed." The `findUnique` ->
`findFirst` conversion merges `organisationId` into the caller's `where` via `withOrgWhere`, but
never flattened Prisma's compound-unique-key shape first — e.g.
`db.organisationMembership.findUnique({ where: { userId_organisationId: { userId, organisationId
} } })`, generated from `@@unique([userId, organisationId])`. That shape is valid Prisma input for
`findUnique` (a unique-identifier lookup) but not for `findFirst`, whose `WhereInput` type has no
such key — Prisma rejects it with `PrismaClientValidationError: Unknown argument
userId_organisationId`.

Found live on `test.matchboard.football` (Vercel runtime-error log, `matchboard-test` project) the
day after ARR-0029's original fix shipped: 47 occurrences across `/o/[orgSlug]/{rounds,opponents,
players,fixtures,matches/new,today}` in a 28-minute window, causing every `/o/{orgSlug}/...` page
to crash during `resolveOrganisationAccess()` (`src/lib/organisations/organisation-resolver.ts`)
before it ever reached `setTenantOrganisationId()` — the exact class of failure this ARR exists to
document, still surfacing one bug at a time as previously-dead code paths go live for the first
time. Two more call sites share the identical pattern and were equally affected:
`organisation-invitation.ts` (`getExistingMembership`-style lookup) and
`organisation-domain.ts`'s `getOrganisationMembership()`. This is also what actually broke the
`e2e/live-reporting.spec.ts` and `e2e/follow-live.spec.ts` / `e2e/accessibility.spec.ts` CI
failures the user reported and cancelled (run `32759398542`) — not a genuine test flake, and not
(as first suspected) evidence the Neon "Launch" plan upgrade hadn't fixed EXT-003; the deploy and
migration steps in that run had in fact succeeded.

Fixed generically in `src/lib/db.ts` via `flattenCompoundUniqueWhere()`: any `where` key
containing `_` whose value is a plain object is treated as a Prisma compound-unique accessor and
spread to the top level before the `findFirst` conversion. Safe as a blanket heuristic in this
schema specifically — verified no real filter/relation field name contains a literal underscore
(the only snake_case fields in `schema.prisma` are Auth.js `Account` scalars, which are strings/
ints, never objects). Regression test: `db-tenant-fail-closed.test.ts`'s "findUnique with a
compound-unique where ... still works" case, which fails without the fix.

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

### Bug 2b (found 2026-08-25, live in CI, after Bug 1b was fixed): `enterWith()` does not
### reliably persist after prior `run()` calls, under concurrent request load

The most severe finding in this ARR. After Bug 1b's fix shipped, a re-triggered CI run still
failed — 8 Playwright tests across `accessibility.spec.ts`, `follow-live.spec.ts`,
`live-reporting.spec.ts`, `round-mutation.spec.ts`, `smoke.spec.ts` — and Vercel's runtime-error
log (`get_runtime_errors`, not local reasoning) showed `TenantContextError` on `LeagueSeason`,
`Team`, `Player`, `OpponentTeam`, `Season` across nearly every `/o/{orgSlug}/...` route, each
failing on the query *immediately following* a successful `requirePageActorContext()` call in the
very same function body (no intervening Server Component boundary, no un-awaited promise). The
failure was **intermittent** — 19 of 27 Playwright tests passed in the same run — ruling out "the
mechanism never works" and pointing at a race.

Isolated with a standalone Node.js timer-interleaving stress test (`node script.mjs`, no
Next.js/Vercel involved — see the investigation transcript, not reproduced as a committed test
since it does not reproduce deterministically inside vitest's own scheduler): calling
`store.enterWith()` in a continuation that has already passed through **two or more** earlier
`store.run()` call exits, while **20+ other independent async chains are doing the same thing
concurrently** (`Promise.all`), loses the `enterWith()`-set value 100% of the time — the store
reads back `undefined`, not a wrong-tenant value. A single `run()` followed by `enterWith()`, or
`enterWith()` alone, both stayed 100% correct under the identical concurrency stress. This matches
Node's own documented caution that `run()` "correctly restores the previous store" while
`enterWith()` "does not automatically restore state" — but the practical failure mode (silent
total loss, not a documented crash) only shows up under real concurrent load, which is exactly
what Vercel Fluid Compute's function-instance reuse produces and a local/low-concurrency dev
session does not.

`requireActorContext()`'s two branches exhibited exactly this composition:
`resolveOrganisationAccess()` (membership lookup) and `getEffectiveGroupAccess()` (called from
both branches) each wrapped their own query in `withTenantContext()`/`runWithTenantOrganisationId()`
(a `run()` call) — two or three `run()` calls per request — followed by a final
`setTenantOrganisationId()` (`enterWith()`) intended to persist context for the rest of the page
render. Under concurrent traffic this silently failed, and every subsequent RLS-scoped query in
that page's render saw no context at all.

Fixed by eliminating the dangerous composition rather than patching around it: `getEffectiveGroupAccess()`
(`src/lib/auth/group-context.ts`) no longer wraps its queries in `withTenantContext()` — it now
relies on the caller having already established context, documented as an explicit precondition.
Both `requireActorContext()` branches (`src/lib/auth/actor-context.ts`) and
`resolveOrganisationAccess()` (`src/lib/organisations/organisation-resolver.ts`) now call
`setTenantOrganisationId()` exactly once, as early as the organisation identity is known (right
after it's found/not-suspended, before membership is even verified), with every later query in
that call graph — including inside `getEffectiveGroupAccess()` — relying on that single
already-set context. No `run()` call happens anywhere in this call graph after that point.

`resolveOrgFilterForMachine()` (`resolve-org-filter.ts`) still uses a self-contained `run()` (safe
— nothing after it in the same continuation calls `enterWith()`, and it has no current callers in
application code); `recordEventForActor()` and the internal snapshot route wrap their *entire*
remaining body in one `run()` call and never call `enterWith()` afterward — also safe, matching the
"final `run()` wrap instead of a later `enterWith()`" pattern proven correct under the same stress
test. Any future caller that needs "resolve context once, then use it for arbitrarily more code
after this function returns" must follow the `setTenantOrganisationId()`-once, no-later-`run()`
pattern established here — never mix scoped `run()` calls with a later `enterWith()` in the same
request continuation.

Regression coverage: `src/lib/tenancy/__tests__/tenant-async-storage-concurrency.test.ts` exercises
the real `getEffectiveGroupAccess()` under `Promise.all` concurrency across 8 organisations, each
setting context once with no prior `run()` (mirroring the fixed call path), and asserts each
resolves only its own organisation's groups.

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

- `src/lib/db.ts` (`modelName` normalization, `findUnique` rawClient lookup fix,
  `flattenCompoundUniqueWhere()` for Bug 1b)
- `src/lib/tenancy/tenant-client.ts` (`withTenantContext` await-inside-callback fix)
- `src/lib/tenancy/resolve-org-filter.ts` (`resolveOrgFilterForMachine` await-inside-callback fix)
- `src/lib/auth/group-context.ts` (`getEffectiveGroupAccess` no longer wraps its own `run()` —
  Bug 2b)
- `src/lib/auth/actor-context.ts` (`requireActorContext`'s two branches set context once, early —
  Bug 2b)
- `src/lib/organisations/organisation-resolver.ts` (`resolveOrganisationAccess` sets context once,
  early — Bug 2b)
- `src/lib/__tests__/db-tenant-fail-closed.test.ts` (regression coverage for Bugs 1, 1b, 2)
- `src/lib/tenancy/__tests__/tenant-async-storage-concurrency.test.ts` (regression coverage for
  Bug 2b)

## Supersedes

None.

## Superseded by

None.

## History

### 2026-08-25

The user upgraded the Neon project to the "Launch" plan, resolving EXT-003. The re-triggered "Deploy
PR to Test slot" CI run (`32759398542`) deployed and migrated successfully, but the user observed
the Playwright job running far past its usual time and cancelled it, suspecting a genuine
regression. Live investigation (Vercel `get_runtime_errors` against the `matchboard-test` project,
not local reasoning) found Bug 1b above, plus confirmation the CI failures traced to it, not to
EXT-003 or a Playwright flake. Fixed and covered by a new regression test, committed and pushed to
PR #351's branch, and CI was re-triggered to confirm.

The re-run (`32819771904`) deployed cleanly (confirming Bug 1b's fix worked and no compound-key
crash recurred) but still failed — 8 Playwright tests, across a *wider* set of routes than before.
Live investigation again via `get_runtime_errors` found Bug 2b above: a far larger, previously
masked issue underneath Bug 1b. Asked the user how to proceed given the severity (nearly the whole
app affected, and PR #351 unmerged so nothing was live in production) rather than continuing to
push speculative fixes unasked; the user chose to have it investigated and fixed immediately.
Root-caused empirically (a standalone Node.js concurrency stress script, not guesswork) and fixed
by removing the dangerous `run()`-then-`enterWith()` composition from the actual auth-resolution
call graph. See Bug 2b for full detail. Re-validation against a fresh CI run is the natural next
step once this fix is committed and pushed.

### 2026-08-24

Identified and resolved in the same session, while implementing ADR-0087 / closing ARR-0027.
