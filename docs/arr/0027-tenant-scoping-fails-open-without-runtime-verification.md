# ARR-0027: Tenant scoping fails open, not closed, when organisation context is absent

## State

Resolved

## Identified

2026-08-24 (Architecture Integrity Programme, AIP-0 baseline)

## Residue

The primary tenant-isolation mechanism (`tenantRLS`, the Prisma Client extension in
`src/lib/db.ts`, decision recorded in ADR-0057) injects `organisationId` into the `where`/`data`
of every query against an RLS-scoped model, but only when organisation context is actually
present:

```ts
const needsOrgFilter = isRlsTable && !!orgId && ORG_ID_PATTERN.test(orgId);
...
if (!needsOrgFilter) {
  return query(args);
}
```

When `getTenantOrganisationId()` (an `AsyncLocalStorage` read, `src/lib/tenancy/tenant-async-storage.ts`)
returns `undefined` — because a caller reached `db.<model>` before `requireActorContext()` /
`runWithTenantOrganisationId()` set it, or because of a coding mistake in a new route/action —
the query executes **completely unscoped**, not blocked and not throwing. Database-level Postgres
RLS is deliberately permissive in this same state (documented in AGENTS.md's "Tenant isolation"
section as a trust boundary decision), so there is currently no layer that fails closed
independently of caller discipline at the exact point (`db.ts`) where the guarantee is supposed
to live. Safety today depends entirely on every request/action entry point correctly calling
`requireActorContext()`/`requireCoachAccess()` before touching `db`, not on the extension itself.

A structurally identical but narrower instance of this same fallthrough was already found and
fixed once: `docs/adr/0052-organisation-membership-self-read-rls-overbroad.md` (ARR-0052,
resolved) hardened the one case where `organisationMembership` reads happened before org context
was known, by injecting `userId` instead. That fix is local to `organisationMembership` self-read
queries only (`src/lib/db.ts`'s `if (!needsOrgFilter && model === "organisationMembership" && userId)`
branch) — every other RLS-scoped model still falls straight through to an unscoped query when
`needsOrgFilter` is false, exactly as before ARR-0052.

## Intended architecture

Programme outcome #2 (`.matchboard-work/matchboard-architecture-integrity/PROGRAMME.md` §2):
"Ordinary tenant-scoped database access fails closed when trusted organisation context is
absent." AGENTS.md's "Tenant isolation (critical — do not regress)" section states Prisma
where-clause injection is "the primary tenant isolation mechanism" — the implication being that
mechanism itself should be the enforcement boundary, not merely a best-effort filter that only
activates when every caller has already done the right thing upstream.

## Evidence

- `src/lib/db.ts` (`tenantRLS` extension) — `needsOrgFilter` computed from `orgId` presence;
  `if (!needsOrgFilter) { return query(args); }` executes the caller's raw, unfiltered `args`
  against any RLS-scoped model with no organisationId constraint at all.
- `docs/adr/0057-prisma-where-clause-injection-for-tenant-isolation.md` — documents the
  where-clause-injection design and its Neon `SET LOCAL` limitation, but does not address
  behaviour when `orgId` is absent for an ordinary (non-privileged) caller.
- `docs/adr/0052-organisation-membership-self-read-rls-overbroad.md` — a prior, narrower instance
  of exactly this fallthrough, fixed only for `organisationMembership` self-reads via `userId`
  injection; every other RLS-scoped model is unaffected by that fix.
- `src/test/security-audit.test.ts` — verifies static schema/model coverage (every model with
  `organisationId` is listed in `RLS_TABLES` and vice versa); does not exercise the `tenantRLS`
  extension at runtime with tenant context deliberately absent to assert the query is blocked or
  returns zero rows.
- No test in `src/test/security-audit.test.ts`, `src/test/sec3-assurance.test.ts`, or the authz
  suite run by `npm run security:authz` simulates "ordinary code path calls a tenant-scoped model
  with no actor context resolved" and asserts a fail-closed outcome.

## Impact

- The correctness of tenant isolation for every RLS-scoped model currently rests entirely on
  disciplined, universal upstream use of `requireActorContext()`/`requireCoachAccess()` before
  any `db.<model>` call — a convention, not an enforced invariant. A single new route, server
  action, cron job, or refactor that reaches `db.<model>` before establishing tenant context would
  silently return or mutate cross-tenant/unscoped data, with no test currently positioned to catch
  it.
- This is architectural residue, not an ordinary bug: it is a gap in the one mechanism AGENTS.md
  designates as primary tenant-isolation enforcement, and the one precedent fix (ARR-0052) already
  demonstrates the fallthrough is a recurring pattern rather than a one-off mistake.

## Containment

- Do not add new RLS-scoped model callers that assume the `tenantRLS` extension itself will
  reject an unscoped query — every new/changed server action, API route, cron job, and script
  touching an RLS-scoped model must continue calling `requireActorContext()` /
  `requireCoachAccess()` (or an equivalent that establishes `AsyncLocalStorage` tenant context)
  before the first `db.<model>` call, and this should be verified in review until a structural
  fix lands.
- Do not extend the `organisationMembership`-style per-model fallthrough exception pattern to
  other models as a substitute for a general fail-closed fix.

## Resolution criteria

- The `tenantRLS` extension (or an equivalent enforcement point) rejects — rather than silently
  executes unscoped — a query against any RLS-scoped model when organisation context is absent
  for a non-privileged caller, OR every currently-unscoped-by-design caller is enumerated,
  explicitly marked privileged, and covered by its own narrow test (mirroring the
  `recordEventForActor` pattern already used for the live-match internal path).
- A negative/abuse test exists that calls a representative tenant-scoped model with tenant context
  deliberately absent and asserts the fail-closed outcome (block, throw, or zero rows), not merely
  static schema coverage.
- `docs/adr/0057-prisma-where-clause-injection-for-tenant-isolation.md` is updated (or a new ADR
  is created) to state explicitly what happens when organisation context is absent, closing the
  gap this ARR identifies.

## Disposition

Resolved by ADR-0087 (AIP-2, Architecture Integrity Programme). The `tenantRLS` extension
(`src/lib/db.ts`) now throws `TenantContextError` for any RLS-scoped model query with no trusted
organisation context, unless the existing narrow `organisationMembership` self-read exception
(ADR-0052) applies or the caller explicitly opts in via `runWithSystemPrivilege()` (one call site:
the internal live-match snapshot endpoint). `withTenantContext()` was also fixed to actually
establish tenant context (it previously only wrapped a transaction, despite its name), closing a
second, related gap in `getEffectiveGroupAccess()`. See ADR-0087 for the full design and
`src/lib/__tests__/db-tenant-fail-closed.test.ts` for negative/abuse test coverage.

Writing that test also surfaced a more severe, pre-existing bug: the extension's model-name
matching had a casing mismatch that meant it never actually recognized any RLS-scoped model in
the first place (silently inert since ADR-0057, 2026-08-05) — see ARR-0029, resolved in the same
change.

## History

### 2026-08-24

Resolved. See ADR-0087.
