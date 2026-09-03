# ARR-0040: Declared-position fit tier logic is implemented twice

## State

Open (recorded, not consolidated — see Resolution criteria)

## Identified

2026-09-03, while implementing the Evidence-Informed Match Planning programme's Bundle 5
(outfield role suitability and tactical-function evidence, ADR-0116). Bundle 5's own instructions
required auditing "team-composition `RoleSuitabilityProfile` and position-suitability logic" as
the one existing owner to extend; that audit surfaced a second, independent implementation of the
same business rule elsewhere in the codebase.

## Residue

Two files independently implement "map a player's declared primary/secondary/tertiary position
to a `PRIMARY`/`SECONDARY`/`TERTIARY`/`NO_FIT` fit tier against a target role's accepted broad
positions", with near-identical logic and even shared constant names:

- `src/domain/team-composition/position-suitability.ts` — `getPositionFit()`,
  `computePositionScarcity()`, `PositionFitTier`, `FIT_TIER_PRIORITY`. Consumed by league-team
  composition (`league-team-adapter.ts`) and Event squad generation
  (`src/lib/events/event-squad-generation.ts`, `event-lineup-assignment.ts`, `event-types.ts`).
- `src/lib/players/player-position-resolver.ts` — `getPositionFitTier()`,
  `computePositionScarcity()`, `PositionFitTier`, `FIT_TIER_PRIORITY`. Also consumed by the Event
  squad/lineup pipeline (imported alongside the team-composition version in several of the same
  files — `event-types.ts`, `event-squad-generation.ts`, `event-lineup-assignment.ts` import
  *both* modules).

Both files independently declare `PositionFitTier` (identical string union) and
`FIT_TIER_PRIORITY` (identical numeric mapping) as separate types/constants rather than one
sharing the other. `computePositionScarcity()` exists in both with slightly different signatures
(one operates on `CompositionPlayer[]`, the other on a raw `{ primaryPosition, secondaryPosition,
tertiaryPosition, goalkeeperAbility }[]` shape) but computes the same fact.

## Intended architecture

AGENTS.md's "one business operation, one owning implementation, multiple adapters" and the
programme's own operating rule ("do not create a second player-position engine") both name this
exact pattern as the thing to avoid. "Declared position fit tier" is one business rule; it should
have one owning implementation that both team-composition and the Event pipeline call into, not
two independently-maintained copies that can silently drift (e.g. a future rule change applied to
one and not the other).

## Evidence

- `grep -rln "PositionFitTier\|getPositionFit"` across `src/` returns both files as independent
  definitions, not one importing from the other.
- `src/lib/events/event-types.ts`, `event-squad-generation.ts`, and
  `event-lineup-assignment.ts` each import from *both*
  `@/domain/team-composition/position-suitability` (or re-export it) and
  `@/lib/players/player-position-resolver` in the same file — direct evidence both are live,
  simultaneously-consumed implementations, not one superseding the other.

## Impact

No observed behavioural bug from this today (both implementations currently express the same
floor: "a role accepting `flexible` gets at least `TERTIARY`" — verified structurally identical
in intent from reading both). The risk is latent: a future change to one fit-tier rule (e.g.
tightening or loosening the `flexible` floor, adding a new broad position) applied to only one of
the two copies would silently desync team-composition's and Event's position-fit behaviour
without either test suite noticing, since they exercise separate code paths.

This is also why Bundle 5 (ADR-0116) deliberately built its new, *stricter* declared-fit
comparison (`declaredFitForOutfieldRole()`, no `flexible` floor) as a third function reusing only
the shared primitives (`BroadPosition`, `mapPositionCodeToBroad()`) rather than trying to extend
either existing copy in place — extending one silently-duplicated implementation would have left
the other equally stale.

## Containment

Not consolidated in this pass. Merging the two implementations means changing
`event-types.ts`/`event-squad-generation.ts`/`event-lineup-assignment.ts` — the production-critical
Event squad/lineup generation pipeline — which is a real, non-trivial, and separately-testable
change on its own, out of scope for a bundle whose actual deliverable is new outfield-role-evidence
infrastructure, not an Event-pipeline refactor.

## Resolution criteria

Resolved when `src/lib/players/player-position-resolver.ts`'s `getPositionFitTier()`/
`computePositionScarcity()`/`PositionFitTier`/`FIT_TIER_PRIORITY` are replaced with imports from
`src/domain/team-composition/position-suitability.ts` (or vice versa, whichever direction proves
less invasive to the Event pipeline's existing call sites), with the full Event squad generation
and lineup assignment test suites passing unchanged.

## Disposition

Open. Recorded per the architectural-residue-records skill's "record before continuing" rule,
discovered while extending this domain area for Bundle 5 — not fixed in the same change that
introduced the new outfield-role-evidence code, to keep that change reviewable and to avoid
touching the production-critical Event generation pipeline without dedicated scope.

## Related decisions

ADR-0116 (Outfield Role Suitability and Tactical-Function Evidence — the bundle that discovered
this while auditing the same area)

## Related implementation

- `src/domain/team-composition/position-suitability.ts`
- `src/lib/players/player-position-resolver.ts`
- `src/lib/events/event-types.ts`, `src/lib/events/event-squad-generation.ts`,
  `src/lib/events/event-lineup-assignment.ts` (consumers of both)

## Supersedes

None.

## Superseded by

None.

## History

### 2026-09-03

Recorded during the Evidence-Informed Match Planning programme's Bundle 5 implementation, while
auditing "team-composition `RoleSuitabilityProfile` and position-suitability logic" as instructed
by the programme's own operating rule.
