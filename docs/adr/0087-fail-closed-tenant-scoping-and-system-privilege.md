# ADR-0087: Fail-closed tenant scoping and an explicit system-privilege capability

## Status

Accepted

## Date

2026-08-24

## Decision owners

- Matchboard engineering

## Context

ADR-0057 made Prisma where-clause injection (the `tenantRLS` extension in `src/lib/db.ts`) the
primary tenant isolation mechanism, and documented that it is a best-effort filter: when
`getTenantOrganisationId()` (an `AsyncLocalStorage` read) returns no organisation ID, the
extension has always executed the caller's query completely unscoped rather than refusing it.
ADR-0057 explicitly accepted this as a trust-boundary decision — "runtime role is used only
through the application which always sets context" — rather than an enforced guarantee.

ARR-0027 (Architecture Integrity Programme, AIP-0 baseline) confirmed this is still true and
identified it as the programme's outcome #2 gap: "Ordinary tenant-scoped database access fails
closed when trusted organisation context is absent" was not yet true. AIP-2's own re-verification
found three concrete classes of caller that currently depend on the unscoped fallthrough, beyond
the already-reviewed `organisationMembership` self-read case (ADR-0052/ARR-0052):

1. **A latent ordering bug**, not an intentional privileged path. `withTenantContext()`
   (`src/lib/tenancy/tenant-client.ts`) has always been misleadingly named — despite its name, it
   never established `AsyncLocalStorage` tenant context; it only wrapped a callback in
   `db.$transaction()`. Every caller relied on its own explicit `where: { organisationId }`
   clause. `getEffectiveGroupAccess()` (`src/lib/auth/group-context.ts`) is one such caller, and
   its `groupAccess.findMany({ where: { membershipId } })` query has no `organisationId` in its
   where clause at all — it was running fully unscoped, protected only by `membershipId` already
   belonging to exactly one organisation, not by any tenant filter. This call happens during
   `requireActorContext()` and `resolveOrganisationAccess()` (and therefore `(app)/layout.tsx`),
   before those functions had gotten around to calling `setTenantOrganisationId()`.
2. **Genuinely system/internal callers with no ordinary user session**: the signed Worker→Vercel
   internal live-match endpoints (`/api/internal/live-match/snapshot`,
   `recordEventForActor()` in `src/lib/live-match/live-match-event-store.ts`, called from
   `/api/internal/live-match/events`) authenticate via HMAC signature (ADR-0086 Stage 4), not a
   browser session — there is no `requireActorContext()` to call.
3. **A one-off maintainer script**: `scripts/bootstrap-organisation.ts` creates the very first
   `OrganisationMembership` row for a brand-new organisation, run directly against production by
   the maintainer (ADR-0085), with no application session at all.

### A more severe discovery while implementing this: the extension has never actually run (ARR-0029)

Writing the negative test ARR-0027 requires — the first test in this repository's history to
exercise the *real* extended `db` export from `src/lib/db.ts` at runtime, rather than the raw
`testDb` client every other test uses — surfaced two independent bugs that mean the `tenantRLS`
extension's where-clause injection has **never actually executed for any query, in any
environment**, since it was introduced (ADR-0057, 2026-08-05):

1. Prisma 7's `"prisma-client"` generator reports the extension hook's `model` argument in
   PascalCase (`"Team"`), but `RLS_TABLES` has always been keyed by lowerCamelCase (`"team"`) —
   confirmed as the intended convention by `security-audit.test.ts`'s own PascalCase→lowerCamelCase
   conversion. `RLS_TABLES.has(model)` therefore never matched anything, for any model, ever.
2. `AsyncLocalStorage` context set via `.run()` does not propagate into a Prisma call unless that
   call is `await`ed *inside* the `.run()` callback — Prisma queries are lazy, so a callback of
   the shape `() => db.team.findMany()` (returning the promise un-awaited) loses context before
   the query actually dispatches.

See ARR-0029 for full detail. Both bugs are fixed as part of this ADR's implementation, in the
same change — fail-closed enforcement is meaningless until the extension can recognize an
RLS-scoped model and until the scoping helpers this ADR adds actually propagate context to the
query they wrap.

## Decision

### 1. The `tenantRLS` extension fails closed by default

`src/lib/db.ts`'s extension now throws a `TenantContextError` when a query targets an RLS-scoped
model (`RLS_TABLES`) and no trusted organisation context is set (`orgId` absent, or present but
failing `ORG_ID_PATTERN` — a malformed/tampered value is refused the same way as an absent one,
not treated as a softer case) — **unless** one of the two already-existing/newly-added narrow
exceptions applies:

- The existing `organisationMembership` self-read-by-`userId` special case (ADR-0052) is
  unchanged — it remains a documented, narrow, already-tested exception, not touched by this ADR.
- An explicit **system privilege** opt-in (see below) is active for the current async context.

### 2. `runWithSystemPrivilege()` — the only unscoped escape hatch

`src/lib/tenancy/tenant-async-storage.ts` adds:

```ts
runWithSystemPrivilege<T>(reason: string, fn: () => Promise<T>): Promise<T>
```

A distinct `AsyncLocalStorage` channel, not merged into tenant context, so a system caller can
never accidentally "look like" a real organisation. `reason` is required (non-empty) and is
logged when `RLS_DEBUG` is on. The name is deliberately greppable — `grep -rn
runWithSystemPrivilege` finds every intentionally-unscoped call site in the repository. This is
the *only* new escape hatch; per the AIP-2 spec, it must not become a broad helper reached for out
of convenience.

**Only genuinely privileged system operations use it**, exactly one call site today:

- `/api/internal/live-match/snapshot/route.ts` — reconciliation reads with no actor identity at
  all (the caller is the Worker itself, keyed by `sessionId`/`matchId`, not any organisation).

### 3. Prefer scoping by an already-trusted ID over a privilege escape

Where a caller already possesses a trusted organisation ID (even without a full
`requireActorContext()` session), the fix is to **scope the query by that ID** via
`runWithTenantOrganisationId()`, not to bypass scoping entirely. This is strictly safer than a
privilege escape — a mismatched organisation now means "not found" at the query layer itself,
rather than "fetched, then checked in application code." Applied to:

- `recordEventForActor()` — wraps its whole body in
  `runWithTenantOrganisationId(actor.organisationId, ...)`, where `actor` was already
  authenticated by the caller (browser session via `requireActorContext()`, or the HMAC-verified
  internal endpoint).
- `resolveOrgFilterForMachine()` (`src/lib/tenancy/resolve-org-filter.ts`) — scopes its
  `machinePrincipal.findUnique` by the caller-supplied `organisationId` parameter.
- `scripts/bootstrap-organisation.ts` — scopes its `organisationMembership` lookup/create by the
  `orgId` it just resolved/created earlier in the same script.

### 4. Fix `withTenantContext()` itself, not each caller

Rather than reordering `setTenantOrganisationId()` calls in every affected caller individually,
`withTenantContext()` now actually establishes tenant context (via `runWithTenantOrganisationId`)
around the transaction it wraps. This closes the `getEffectiveGroupAccess()` gap — and every other
current and future caller of `withTenantContext()` — from one place, matching the AIP-2 spec's
"verify nested reads/writes and indirect lookups that can bypass obvious top-level filters."

## Rationale

- A best-effort filter that only activates when every caller has already done the right thing
  upstream is not the enforcement boundary AGENTS.md's "Tenant isolation" section describes it as.
  Making the extension itself refuse an unscoped RLS-scoped query closes that gap at the one place
  the guarantee is supposed to live, instead of depending on code-review discipline indefinitely.
- Scoping by an already-trusted, caller-supplied ID (`runWithTenantOrganisationId`) is preferred
  over a blanket privilege escape wherever one is available: it gets the extension's automatic
  `organisationId` injection as a second enforcement layer, not just permission to skip the check.
- `runWithSystemPrivilege()` is reserved for the residual case where no organisation identity
  exists at all to scope by — kept to exactly one call site today, each with a specific,
  greppable, logged reason, so privileged access stays searchable and reviewable rather than
  becoming a convenience escape hatch other code reaches for.
- Fixing `withTenantContext()`'s actual behavior (rather than patching each of its callers'
  ordering) closes today's known gap and prevents the same class of bug recurring the next time
  someone adds a new `withTenantContext()` caller that assumes — reasonably, given the name — that
  it already does what it says.

## Alternatives considered

### Patch each affected caller's `setTenantOrganisationId()` ordering individually

- Benefits: smaller diff per file, no change to `withTenantContext()`'s behavior/contract
- Costs: fixes only the specific call sites found during this investigation; the next new
  `withTenantContext()` caller reintroduces the exact same bug, since the helper's actual
  behavior still wouldn't match its name
- Reason not selected: fixing the shared helper closes the whole class of bug, not just today's
  known instances

### A single broad "privileged mode" flag usable anywhere

- Benefits: simplest to implement
- Costs: exactly what the AIP-2 spec forbids ("Do not add a broad escape helper used everywhere")
  — would become a convenience bypass for any future query that's inconvenient to scope properly
- Reason not selected: narrow, reason-required, per-call-site opt-in is the safer shape

### Return empty results instead of throwing when context is absent

- Benefits: caller gets no data rather than an exception to handle
- Costs: silently masks a real programming error (a route/action/script that should have
  established context but didn't) as "no data," making it far harder to notice and debug — this
  is the same reasoning ADR-0060 already used to reject an equivalent choice for
  `resolveOrgFilterForMachine`'s prior unscoped-empty-filter behavior
- Reason not selected: fail loud and explicit, consistent with ADR-0060's precedent

## Consequences

### Positive

- The `tenantRLS` extension is now the actual enforcement boundary for RLS-scoped models, not
  merely a best-effort filter that depends on every caller already being correct.
- `getEffectiveGroupAccess()`'s previously-unscoped `groupAccess` query is now genuinely
  org-scoped by the extension, closing a real (if not currently exploitable) gap.
- Every genuinely privileged/system call site is now explicit, greppable, and reason-documented.
- Future `withTenantContext()` callers get correct scoping by default instead of needing to
  remember to set context themselves first.

### Negative

- Any future code that reaches `db.<rlsModel>` before establishing context (a genuine bug) now
  throws instead of silently running unscoped — this is the intended behavior change, but it
  means a missed `requireActorContext()` call surfaces as a runtime error rather than passing
  silently, which could theoretically surface in a code path this investigation didn't cover.
  Mitigated by the negative/abuse tests added alongside this ADR and by `RLS_DEBUG` logging
  already existing for pre-launch verification.
- `runWithTenantOrganisationId()` replaces (not merges) the current `AsyncLocalStorage` store —
  nesting it inside a scope that had `userId` set transiently loses `userId` visibility for the
  duration of the nested call. Verified harmless for every current caller (none reads
  `getTenantUserId()` from inside a `withTenantContext()`/`runWithTenantOrganisationId()` scope).

### Risks and mitigations

- Risk: an as-yet-undiscovered call site depends on the unscoped fallthrough and starts throwing
  in production. Mitigation: AIP-2's investigation covered cron, webhooks, internal endpoints,
  scripts, seed, admin routes, and auth resolution — the two intentionally-remaining exceptions
  (`organisationMembership` self-read, the live-match snapshot endpoint) are exhaustively
  enumerated above. `RLS_DEBUG` logging remains available to surface any missed case during
  rollout.
- Risk: a future contributor reaches for `runWithSystemPrivilege()` out of convenience instead of
  fixing a missing `requireActorContext()` call. Mitigation: the function requires a non-empty
  reason, is documented as reserved for genuinely privileged operations, and its single current
  use is cited here as the pattern to match, not to multiply.

## Migration and compatibility

- No schema or data migration required — this is application-layer behavior only.
- No `RLS_TABLES` membership changes.
- Existing tests continue to pass; new negative/abuse tests added:
  `src/lib/__tests__/db-tenant-fail-closed.test.ts`.
- Rollback: revert `src/lib/db.ts`'s throw to the prior unconditional `return query(args)`, and
  revert `withTenantContext()` to its prior transaction-only behavior. Would re-open ARR-0027.

## Security and operations

- `TenantContextError` (exported from `src/lib/db.ts`) is distinct from `AuthorizationError` —
  it signals a programming/wiring defect (missing context establishment), not a legitimate
  access-denied outcome a user action should present to a coach.
- `runWithSystemPrivilege()` reasons are logged via the existing `RLS_DEBUG` channel; this ADR
  does not add a new persistent audit log, since the two current use sites are internal/system
  paths already covered by other logging (HMAC-verified request handling, script console output).

## Related records

- ADRs: ADR-0057 (Prisma where-clause injection — this ADR amends its "when context is absent"
  behavior; the where-clause-injection design itself is unchanged), ADR-0052 (organisation
  membership self-read scoping — unchanged), ADR-0060 (tenant isolation hardening phase 1 —
  established the fail-closed precedent for `resolveOrgFilterForMachine`'s empty-filter case,
  extended here to the extension itself), ADR-0086 (live match realtime — the internal endpoints
  this ADR scopes)
- ARRs: ARR-0027 (resolved by this ADR), ARR-0029 (discovered while implementing this ADR;
  resolved in the same change)
- Implementation: `src/lib/db.ts`, `src/lib/tenancy/tenant-async-storage.ts`,
  `src/lib/tenancy/tenant-client.ts`, `src/lib/tenancy/resolve-org-filter.ts`,
  `src/lib/live-match/live-match-event-store.ts`,
  `src/app/api/internal/live-match/snapshot/route.ts`, `scripts/bootstrap-organisation.ts`

## Supersedes

None. Amends ADR-0057 (see "Related records") without replacing its core decision.

## Superseded by

None.

## History

### 2026-08-24

Record created. Architecture Integrity Programme AIP-2 (Fail-closed tenancy). Resolves ARR-0027.
