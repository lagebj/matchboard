# Gate C W2 — Data Truth and Fixture Definitions

## Architecture

```
src/app/dev/ui-lab/gate-c/
  w2-shared/
    round-identities.ts            # team/kit/name identities, deterministic roster builder
    round-board-fixture-harness.tsx # client command boundary — see below
  c04-planning-open/{fixtures.ts, page.tsx, __tests__/page.test.tsx}
  c05-planning-closed/{fixtures.ts, page.tsx, __tests__/page.test.tsx}
  c06-dense-allocation/{fixtures.ts, page.tsx, __tests__/page.test.tsx}
```

`w2-shared/` is a **new** directory, not a reuse of `gate-c/shared/fixtures.ts` (owned by the already-approved C01-C03 candidates). ADR-0159's fingerprint covers fixture content; issue #827 showed a shared-fixture edit silently invalidating a prior wave's approval. Nothing in `w2-shared/` is imported by, or imports from, C01-C03's fixtures.

## Hydration-mismatch precedent, applied

Gate C W1 hit a real hydration mismatch from a `"use client"` page component computing fixture data directly (re-evaluated once during SSR, again during hydration). Every C04-C06 `page.tsx` is a plain server component — matching the real production round page's own shape — that computes its fixture exactly once per request via a pure function and hands the already-resolved, serializable result to `RoundBoardFixtureHarness` (the client boundary). No fixture builder reads `Date.now()` or any other non-deterministic input; every date is a fixed constant from `round-identities.ts`.

## Command boundary (why it exists, what it guarantees)

`round-board.tsx` imports five server actions directly. The brief requires UI Lab never call live database mutations. `RoundBoardFixtureHarness` supplies an in-memory `RoundBoardCommands` implementation instead, via the production component's own `commands` prop (added this wave, default = the real actions, so production — which never passes it — is unaffected):

- `addPlayerToMatch` / `removePlayerFromMatch`: mutate local React state (the `matches` array), reconstructing a full player row from a roster lookup built at render time. Supports a deterministic **denial** path (`deniedAssignments`) for proving rejected attempts leave state unchanged.
- `generateEmergencyRepairOptions`: deterministic empty-options response. Emergency repair is not any C04-C06 acceptance question — fabricating repair candidates here would be inventing data, not demonstrating it.
- `clearRoundDraft` / `regenerateRound`: no-ops. Rendered whenever planning is open (matching production), but never mutate fixture state and never touch the network/DB.

The "Available" panel and the allocation matrix both derive purely from the `matches`/`availablePlayers` props `RoundBoard` is given — so updating `matches` in the harness is sufficient for every dependent view to reflect a fixture mutation truthfully. There is no second, parallel view-model the harness must keep in sync.

The `coverage` tile is recomputed in the harness from the same `eligiblePlayerIds` + current `matches` state after every mutation, using the identical "is this eligible player currently assigned to any match" logic the real `compute-plan-integrity.ts` uses for its two count fields (see `OPPORTUNITY_COVERAGE_SEMANTICS.md` — those two fields are not availability-filtered, so neither is this recomputation).

## A real fixture-design defect found and fixed during this wave

`buildRoster()` originally drew every team's Nth player from the same global name list with no per-team offset, so two different real players (different IDs, different teams, different kit colors) could render with the identical display name in the same round — invisible in a two-team fixture (C04/C05, where the colliding name was usually already assigned and so never rendered twice as a "Select" button), but immediately broke C06's four-team, 54-player fixture (ambiguous "Select Aksel"/"Jonas in Rød" queries resolving to multiple elements). Fixed by giving each `FixtureTeam` a `nameOffset` into a 60-name list, with a 15-wide non-overlapping window per team — comfortably covering the largest roster any Gate C W2 fixture uses (14). This is now correct for all three scenarios, not patched around with scoped queries alone (scoping is still used where two *legitimately* identical labels exist in different DOM regions, e.g. desktop vs. compact "Select {name}" buttons for the same real player).

## Fixture-to-contract fidelity

Every fixture is built from the same shapes `round-board.tsx`'s real props require — types are not hand-duplicated; `RoundBoardFixtureInitial` is derived via `React.ComponentProps<typeof RoundBoard>`, so a future change to `RoundBoardProps` surfaces as a type error here rather than silently drifting. `warnings` entries use the real `WarningSeverity` enum from `@/generated/prisma/client`. Roles use the real `SelectionRole` union from `@/components/ui/role-badge`. Rotation paths use the real `rotationPathMap` shape `determineAutomaticRoleFromPaths` consumes.
