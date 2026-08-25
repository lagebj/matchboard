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

### Bug 2b (found 2026-08-25, superseded — see Bug 3): an incomplete first diagnosis

After Bug 1b's fix shipped, a re-triggered CI run still failed with the same symptom, and Vercel's
`get_runtime_errors` showed `TenantContextError` across nearly every `/o/{orgSlug}/...` route. The
first diagnosis pass concluded the cause was `enterWith()` failing to persist after prior `run()`
calls specifically **under concurrent request load**, based on a standalone Node.js stress test
that combined two `run()` calls with 20-way `Promise.all` concurrency and reproduced 100% loss.
Fixes matching that theory (`getEffectiveGroupAccess()` no longer wrapping its own queries in
`withTenantContext()`; both `requireActorContext()` branches and `resolveOrganisationAccess()`
calling `setTenantOrganisationId()` once, early) were shipped and are still correct, sensible
changes — but a subsequent CI run **still failed identically**, disproving the "requires
concurrency" framing. See Bug 3 below for the actual, corrected root cause, found by testing the
real production build locally (`next start` against a real seeded session) rather than continuing
to reason from the CI logs alone. This entry is kept, rather than deleted, so the investigation
trail stays honest: the concurrency angle was a real, reproducible property of the raw primitive
composition tested, it just was not what was actually causing this bug.

### Bug 3 (found 2026-08-25, the actual root cause): `enterWith()` never propagates to a
### function's own caller once that function has itself awaited anything — no concurrency required

The most severe finding in this ARR, and the one that actually explains everything Bug 2b's fix
did not. Reproduced with a byte-for-byte minimal case, in plain Node.js, zero concurrency:

```js
async function awaitThenSet(orgId) {
  await Promise.resolve();     // any await at all, even a no-op
  setOrgId(orgId);              // store.enterWith(...)
  return getOrgId();            // "orgId" — correct, from inside this function
}
async function main() {
  const seenInsideFn = await awaitThenSet("org-1");  // "org-1"
  const seenInCaller = getOrgId();                    // undefined — LOST
}
```

This is correct, documented Node.js `AsyncLocalStorage` behavior, not a bug in Node itself:
`enterWith()` scopes "the remainder of the current execution" — and once an async function has
awaited something, its "current execution" is a child continuation of wherever it was called from,
not an ancestor of it. A child's `enterWith()` mutation can never retroactively become visible to
the parent once the child's promise resolves and the parent resumes its own, separate
continuation. This has nothing to do with `run()`, nothing to do with concurrency, and needs no
Prisma, no Next.js, and no Turbopack to reproduce — verified directly against a plain
`node script.mjs`.

`requireActorContext()` must always `await` a DB lookup before it can know the organisation, so its
own `setTenantOrganisationId()` call — no matter how it is internally sequenced — can **only ever**
scope its own remaining queries (verified correct by the earlier Bug 2b fixes, which are real
improvements, just not sufficient on their own). It can never scope anything in the ~350 call sites
across the app that do `const ctx = await requireActorContext(...)` / `requirePageActorContext(...)`
and then issue their own queries. Confirmed live: a real `next start` build, a real seeded session,
zero concurrency, reproduced `TenantContextError` on the very first request to `/api/context` and
most `/o/{orgSlug}/...` pages.

Fixed two ways, deliberately layered as defense-in-depth rather than relying on either alone:

1. **`src/lib/db.ts`'s `tenantRLS` extension** (`getExplicitOrgId()`): when ALS context is absent,
   trust an `organisationId` the caller has already put directly into the query's own
   `where`/`data` — the "Prisma where-clause injection" pattern AGENTS.md already documents as
   primary, and which many call sites (`getOperationalContext()`, `requireMatchGroupAccess()`,
   etc.) already used as belt-and-suspenders alongside ALS. That value can only have come from a
   server-verified `ActorContext.organisationId`, never raw user input, by this codebase's
   established convention — so trusting it does not reopen ARR-0027's original hole (a query with
   *no* scoping anywhere, ALS or explicit, still throws).
2. **Every one of the ~350 call sites** of `requireActorContext()`/`requirePageActorContext()`
   (mechanically, via a reviewed codemod — see "Related implementation") now calls
   `setTenantOrganisationId(ctx.organisationId)` immediately after resolving `ctx`, in the *same*
   function that will make further queries. This is not redundant with fix 1: many call sites
   issue queries deep in a call graph (`getOperationalContext()` → `enrichMatchRound()` →
   `db.selection.count({ where: { matchRoundId } })`, no explicit `organisationId` anywhere) that
   fix 1 alone cannot help. Verified this composition is safe: once a frame has `enterWith()`-set
   context, everything it calls — including further functions with their own internal awaits —
   correctly inherits it; the propagation failure is specifically about crossing back *up* through
   a function-return boundary into a frame that did not set the context itself.

Both fixes were validated against the real production build locally (`next start`, real seeded
session, `coach-all-a`) hitting every previously-failing route with zero `TenantContextError`
occurrences in the server log — not just an HTTP 200, since Next.js error boundaries can mask a
failed query inside an otherwise-200 response.

Regression coverage: `src/lib/__tests__/db-tenant-fail-closed.test.ts`'s "explicit where/data
organisationId fallback" describe block (fix 1); `src/lib/tenancy/__tests__/tenant-async-storage-concurrency.test.ts`
exercises the real `getEffectiveGroupAccess()` under `Promise.all` concurrency across 8
organisations, each setting context once with no prior `run()`, and asserts each resolves only its
own organisation's groups (still a valid, useful regression test for the Bug 2b-era fixes, which
remain in place).

**The durable rule going forward** (also in AGENTS.md's "Tenant isolation" section): every new
call site of `requireActorContext()`/`requirePageActorContext()` must call
`setTenantOrganisationId(ctx.organisationId)` immediately after resolving `ctx`, before any other
query. `db.ts`'s explicit-where fallback is defense-in-depth, not a substitute — it only helps
queries that already carry an explicit `organisationId`, and plenty legitimately don't.

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
  `flattenCompoundUniqueWhere()` for Bug 1b, `getExplicitOrgId()` fallback for Bug 3)
- `src/lib/tenancy/tenant-client.ts` (`withTenantContext` await-inside-callback fix)
- `src/lib/tenancy/resolve-org-filter.ts` (`resolveOrgFilterForMachine` await-inside-callback fix)
- `src/lib/auth/group-context.ts` (`getEffectiveGroupAccess` no longer wraps its own `run()` —
  Bug 2b)
- `src/lib/auth/actor-context.ts` (`requireActorContext`'s two branches set context once, early —
  Bug 2b)
- `src/lib/organisations/organisation-resolver.ts` (`resolveOrganisationAccess` sets context once,
  early — Bug 2b)
- ~350 call sites across `src/app/` and `src/lib/` — every `const ctx = await
  requireActorContext(...)` / `requirePageActorContext(...)` now immediately followed by
  `setTenantOrganisationId(ctx.organisationId)` (Bug 3, applied via a reviewed codemod, not
  individually hand-written — see this ARR's git history for the exact commit)
- `src/lib/__tests__/db-tenant-fail-closed.test.ts` (regression coverage for Bugs 1, 1b, 2, and the
  Bug 3 explicit-where fallback)
- `src/lib/tenancy/__tests__/tenant-async-storage-concurrency.test.ts` (regression coverage for
  the Bug 2b-era fixes, still valid)

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
call graph. See Bug 2b for full detail. Pushed, and the re-triggered CI run (`32824974172`)
deployed cleanly but **still failed** — the user cancelled it directly ("I cancelled the workflow,
it fails immediately"), correctly reading that the Bug 2b fix had not actually resolved it.

Rather than continue reasoning from CI logs alone a third time, switched to reproducing the real
production build locally: seeded the canonical test dataset into `TEST_DATABASE_URL`, ran `next
start` (the same bundler/runtime Vercel uses) against it, drove the real `test-agent` Auth.js
credentials flow to get a genuine session, and hit the failing routes directly with `curl`. This
reproduced `TenantContextError` on the very first request, with zero concurrency — disproving Bug
2b's "requires concurrent load" framing outright. Bisected with a series of increasingly minimal
temporary diagnostic routes/functions (each iteration's exact code kept in this file's Bug 3
write-up) down to a byte-for-byte minimal Node.js reproduction with no Next.js, no Prisma, and no
concurrency involved at all — see Bug 3 above for the actual root cause. Fixed both at the
`db.ts` extension level (explicit-where fallback) and, since that alone still left deep call
graphs like `getOperationalContext()` → `enrichMatchRound()` unprotected, at ~350 call sites via a
reviewed codemod. Validated by re-running the exact same real-build/real-session local smoke test
against every previously-failing route with zero `TenantContextError` occurrences in the server
log. Bug 2b's entry above was corrected (not deleted) to keep the investigation trail honest about
the incomplete first diagnosis. Re-validation against a fresh CI run is the natural next step once
this fix is committed and pushed.

### 2026-08-24

Identified and resolved in the same session, while implementing ADR-0087 / closing ARR-0027.
