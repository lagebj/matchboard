# ARR-0004: Domain logic leaks into route handlers and server actions

## State

Partially resolved

## Identified

2026-07-29

## Residue

Business logic that belongs in owned domain modules is embedded directly in:
1. API route handlers (`src/app/api/*/route.ts`) — direct Prisma calls, selection logic, validation
2. Server actions (`src/app/(app)/*/actions.ts`) — embedded business logic mixed with I/O
3. React components — selection rules duplicated in UI

No central command/query layer exists. Server actions contain embedded business logic that should be extracted into owned domain modules per ADR-0030.

## Intended architecture

Per ADR-0030, each domain capability has one owning module. Server actions are thin adapters that authenticate, validate input, call domain logic, and return results. They must not contain business logic or make direct Prisma calls for domain behaviour that has an owning module.

## Evidence

- API routes in `src/app/api/` contain direct Prisma calls and validation logic (e.g., `generate-round/route.ts` does DB lookup and persistence)
- Server actions in `src/app/(app)/` contain embedded business logic
- Selection rules appear in both engine (`src/lib/selection/`) and UI components
- No central command layer exists — each route/action independently implements validation, auth, and business logic

## Impact

- Same business logic implemented differently in different routes
- No single owner for domain operations
- Business logic changes require updating multiple files
- Testing requires setting up full HTTP context instead of testing domain functions directly
- Security validation is inconsistent (some routes validated, others not)

## Containment

- New domain logic must not be added directly to route handlers or server actions
- New server actions must call domain modules, not implement business logic inline
- Selection rules must not be duplicated in React components
- Existing domain modules (`src/lib/selection/`, `src/lib/policies/`, etc.) must remain the single owners of their respective logic

## Resolution criteria

- All API routes are thin adapters: auth, input validation (Zod), call domain module, return result
- All server actions are thin adapters: auth, call domain module, return result
- Direct Prisma calls in routes are removed or extracted to repository/command modules
- Business logic is testable without HTTP context
- Each domain capability has a clear owning module per ADR-0030

## Disposition

Partially resolved. Spot-checked directly (2026-08-20, consolidation programme residue
reconciliation pass): this ARR's own cited example, `src/app/api/generate-round/route.ts`, is
now a clean thin adapter — auth (`requireActorContext`/`requireMutationRole`), rate limiting,
Zod validation, one org-ownership lookup, then full delegation to `src/lib/selection/*` domain
functions, no embedded selection logic. A second spot-check, `src/app/(app)/teams/actions.ts`
(231 lines, only 2 direct `db.*` calls), shows the same thin-adapter pattern delegating to
`src/lib/teams/team-domain.ts`. Claims 1 (routes) and 2 (server actions) both look substantially
improved from the original IMPROVE-0A assessment, at least at these two sampled points — not a
full sweep of every route/action file. Claim 3 (selection rules duplicated in React components)
was **not verified** in this pass — remains open and unconfirmed either way.

## Related decisions

ADR-0030 (application boundaries and domain ownership)

## Related implementation

SEC-1 input validation schemas in `src/lib/security/validation.ts` are the first step — API routes now validate input through Zod before calling business logic.

## Supersedes

None

## Superseded by

None

## History

### 2026-07-29

Record created from IMPROVE-0A architecture assessment.