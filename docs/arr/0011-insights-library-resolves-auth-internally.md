# ARR-0011: Insights library functions resolve auth and org context internally instead of receiving them as parameters

## State

Confirmed

## Identified

2026-08-02

## Residue

Seven insights library functions in `src/lib/insights/` call `requireCoachAccess()` internally to obtain user identity and resolve organisation context. This duplicates the auth + org resolution pattern that `requireActorContext()` now centralises, and violates the principle that domain library functions should receive context rather than resolve it.

These functions also accept `orgFilter` as an explicit parameter in some paths while calling `requireCoachAccess()` + `resolveOrgFilterForUser()` in others, creating two entry paths to the same org context.

Affected files:
- `src/lib/insights/policy-warning-review.ts`
- `src/lib/insights/conflict-review.ts`
- `src/lib/insights/load-timeline.ts`
- `src/lib/insights/planned-vs-actual-delta.ts`
- `src/lib/insights/squad-coverage.ts`
- `src/lib/insights/opportunity-matrix.ts`
- `src/lib/insights/insights-overview.ts`

Additionally, `src/lib/seasons/finalize-league-season.ts` calls `requireCoachAccess()` for user identity in a domain function.

## Intended architecture

Per ARR-0004 and ADR-0030, domain library functions should receive context as parameters, not resolve auth or org context internally. The calling adapter (server action, API route, or page component) should use `requireActorContext()` and pass the relevant context to the domain function.

This aligns with the centralisation principle: one business operation, one owning implementation, multiple adapters. Auth resolution is an adapter concern, not a domain concern.

## Evidence

- Each of the 7 insights files calls `requireCoachAccess()` directly (2 calls each)
- `finalize-league-season.ts` calls `requireCoachAccess()` (3 calls) for user identity in domain logic
- `organisation-resolver.ts` calls both `requireCoachAccess()` and `resolveOrganisationAccess()` (2 calls each) — already partially centralised but still resolves auth internally
- All API routes that call these insights functions have already been migrated to `requireActorContext()` but pass `ctx.orgFilter` to the library function while the library function still calls `requireCoachAccess()` internally

## Impact

- Auth resolution is duplicated: the caller resolves context via `requireActorContext()`, then the library function resolves it again via `requireCoachAccess()`
- Two sources of truth for user identity in the same call chain
- Library functions cannot be tested without mocking the auth module
- Library functions cannot receive org context from a different source (e.g., admin override, test fixture)
- Inconsistent: some library functions accept `orgFilter` as a parameter while others resolve it internally

## Containment

- No new insights library function may call `requireCoachAccess()` or `resolveOrgFilterForUser()` directly
- All new insights library functions must receive org context as an explicit parameter
- Existing functions must not gain additional internal auth resolution call sites
- The `requireActorContext()` → pass `ctx.orgFilter` pattern established in the API route migration is the correct caller pattern

## Resolution criteria

- All 7 insights library functions accept org context (at minimum `OrgFilterMode` and `userId`) as explicit parameters
- No insights library function calls `requireCoachAccess()` or `resolveOrgFilterForUser()` internally
- `finalize-league-season.ts` receives user identity as a parameter instead of resolving it internally
- `organisation-resolver.ts` receives user identity as a parameter instead of resolving it internally
- Callers pass `ctx.orgFilter` and `ctx.userId` from `requireActorContext()`

## Disposition

Pending. Migrate in a follow-up pass after the `requireActorContext()` migration stabilises.

## Related decisions

- ADR-0030 (application boundaries and domain ownership)
- ARR-0004 (domain logic leaks into route handlers and server actions)

## Related implementation

- `src/lib/auth/actor-context.ts` — `requireActorContext()` now centralises auth + org resolution
- API route migration (2026-08-02): all routes now call `requireActorContext()` and pass `ctx.orgFilter` to insights functions

## Supersedes

None

## Superseded by

None

## History

### 2026-08-02

Record created after `requireActorContext()` migration revealed that insights library functions still resolve auth internally, creating duplicated auth resolution in the same call chain.