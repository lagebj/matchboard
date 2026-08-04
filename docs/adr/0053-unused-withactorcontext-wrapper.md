# ARR-0053: withActorContext() wrapper is defined but unused

## State

Identified

## Identified

2026-08-04

## Residue

`withActorContext()` was added to `src/lib/auth/actor-context.ts` as a convenience wrapper combining `requireActorContext()` + `runWithTenantOrganisationId()`. After PR #193 switched to `enterWith()` in `requireActorContext()`, the `withActorContext()` wrapper is redundant because `requireActorContext()` already sets the tenant context for the rest of the request.

## Intended architecture

There should be one clear way to set up auth + RLS context. Currently there are two: `requireActorContext()` (sets context via `enterWith()`) and `withActorContext()` (sets context via `runWithTenantOrganisationId()` callback wrapping). The `enterWith()` approach is more appropriate for the request lifecycle.

## Evidence

- `src/lib/auth/actor-context.ts` lines 97-103 — `withActorContext()` definition
- No callers found in the codebase (grep confirms)
- `requireActorContext()` lines 51 and 92 call `setTenantOrganisationId()` via `enterWith()`

## Impact

- Developer confusion about which function to use
- `withActorContext()` uses `runWithTenantOrganisationId()` which only covers its callback, while `requireActorContext()` uses `enterWith()` which covers the rest of the request

## Containment

- Document that `requireActorContext()` sets tenant context automatically
- `withActorContext()` may be useful for background jobs that need both auth resolution and explicit callback-scoped context

## Resolution criteria

- Remove `withActorContext()` if no use case emerges, or document its intended purpose clearly
- Ensure all callers use `requireActorContext()` as the primary mechanism

## Disposition

Pending. Low priority, can be cleaned up in a refactor pass.

## Related decisions

None

## Related implementation

PR #192, PR #193

## Supersedes

None

## Superseded by

None

## History

### 2026-08-04

Record created. Wrapper is redundant after `enterWith()` adoption.