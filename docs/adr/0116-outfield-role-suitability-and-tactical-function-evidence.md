# ADR-0116: Outfield Role Suitability and Tactical-Function Evidence

## Status

Accepted

## Context

The Evidence-Informed Match Planning programme's Bundle 5
(`.matchboard-work/evidence-informed-match-planning/`, a temporary, gitignored implementation
work bundle) asks for outfield planning flexible enough to solve whole-squad problems without
treating a declared position as a rigid queue — the "five-striker case": if five selected players
are all configured primarily as Striker, automation must not solve fairness by rotating those
five through one ST slot while every other player stays on all match. It must consider reasonable
alternate outfield roles supported by attributes, declared secondary/tertiary positions, evidence,
and development opportunity — never a role the player has no support for, merely to equalise
minutes.

PROGRAMME.md explicitly instructs extending "the existing role-suitability owner ... use current
equivalents of team-composition `RoleSuitabilityProfile` and position-suitability logic. Do not
create a second engine."

### Repository audit finding: the existing owner's semantics don't fit this question

`src/domain/team-composition/position-suitability.ts`'s `getPositionFit()` (feeding
`RoleSuitabilityProfile`, used today by league-team cross-team composition and Event squad
generation) has a deliberate, documented floor: *"A role that accepts 'flexible' can be filled by
any player, but at TERTIARY fit — not PRIMARY."* Since every non-goalkeeper structural role's
accepted-positions list includes `"flexible"`, this floor means **every player gets at least
TERTIARY fit for DEFENCE/MIDFIELD/ATTACK/FLEXIBLE, unconditionally** — `NO_FIT` is structurally
unreachable for those four roles. That is correct and load-bearing for team-composition's actual
problem (distributing a whole pool of players across a fixed number of teams — every player must
land somewhere, so a "nobody is truly unplaceable" floor is the right behaviour there).

It is the wrong behaviour for Bundle 5's question. If every outfield role is at minimum
`TERTIARY` → `PLAUSIBLE` for every player by construction, `UNSUPPORTED` becomes unreachable, and
the five-striker case's central requirement — *"unsupported defensive roles are not forced only to
equalize minutes"* (TEST-MATRIX.md #8) — has nothing to test against. Reusing
`RoleSuitabilityProfile` directly here would silently launder "no evidence, no declared support"
into "plausible."

## Decision

1. **A new, narrower declared-fit calculation, not a second engine.** `src/domain/team-composition/outfield-role-evidence.ts`
   adds `declaredFitForOutfieldRole()`: compares a player's own declared broad positions
   (primary/secondary/tertiary) against one target role directly, with **no** "accepts flexible ⇒
   floor at TERTIARY" fallback. It reuses the genuinely shared primitives from
   `position-suitability.ts`/`team-composition-types.ts` — `BroadPosition`,
   `STRUCTURAL_ROLE_TO_BROAD_POSITION`, `mapPositionCodeToBroad()` — so both the team-composition
   floor and this stricter comparison are two *documented, deliberately different* aggregation
   rules over the *same* underlying declared-position facts, not two independent
   position-mapping engines. `getPositionFit()`/`RoleSuitabilityProfile` are unchanged and remain
   exactly correct for team-composition's own use.

2. **`buildRoleSuitability()` (the declared-position → `RoleSuitabilityProfile` builder) moved
   from a private function inside `league-team-adapter.ts` into `position-suitability.ts` as a
   shared, exported owner**, decoupled from `PlayerAttributeProfile` down to a minimal
   `{ primaryPosition, secondaryPosition, tertiaryPosition }` shape. This is unrelated
   mechanical hygiene (removing a duplication risk — the function's logic was previously
   reachable only through one adapter) that happened to surface naturally while auditing this
   area; it is not itself the fix for finding #1 above (`buildRoleSuitability()` still carries
   the same flexible-floor semantics `getPositionFit()` does, correctly, for its own
   team-composition callers).

3. **`OutfieldStructuralRole = Exclude<StructuralRole, "GOALKEEPER">`.** The goalkeeper boundary
   (AGENTS.md D-011, PRINCIPLES.md "Goalkeeper boundary") is enforced at the type level, not just
   by runtime discipline: this module's return shape cannot express a goalkeeper role, regardless
   of a player's attributes, `goalkeeperAbility`, or declared primary position.

4. **Four-tier evidence-aware suitability**: `NATURAL` (primary declared fit) → `PLAUSIBLE`
   (secondary/tertiary declared fit) → `DEVELOPMENTAL` (no declared fit, but demonstrated
   realised-position exposure at `EMERGING` confidence or above) → `UNSUPPORTED` (no declared fit,
   no exposure). Confidence reuses the same three-level `INSUFFICIENT`/`EMERGING`/`ESTABLISHED`
   vocabulary and the same match-count thresholds (<3 / 3-5 / 6+) as Bundle 2's
   `classifyMatchPhaseConfidence()`, declared independently (not imported) per this domain
   directory's existing decoupling convention from `src/lib/evidence/`.

5. **Historical positional evidence is the existing I-004 owner, not a new query.**
   `src/lib/players/get-player-outfield-role-suitability.ts` (the DB-bound adapter; the domain
   module itself stays pure and DB-free) calls the existing `getPositionExposure()`
   (`src/lib/insights/position-exposure.ts`) and summarises its `realisedPositions` by broad
   outfield role — never a second position-exposure query. The league season used is resolved via
   the same `resolveActiveLeagueSeason()` heuristic the Rounds list page already uses, not a new
   "current season" concept.

6. **Tactical functions are derived from explicit attributes and the role-suitability gate, never
   a vague AI label.** Six functions (first-line press, pace in behind, hold-up/link play, central
   defensive continuity, ball progression, width) are each a fixed, documented weighted average
   over existing raw `Player` attribute fields (the same fields `computeCompositeRatings()`
   already reads), gated by `applicableRoles`: a function is `NOT_APPLICABLE` when none of its
   applicable outfield roles are supported (tier ≠ `UNSUPPORTED`) for that player, or when no
   relevant attribute is recorded. This lets two Strikers show different fits for the same
   function (PROGRAMME.md's worked example) without inventing a taxonomy beyond what current data
   supports.

7. **Read-only, additive, coach-facing.** `PlayerOutfieldRoleSuitabilityPanel` renders on the
   Player Profile page (`/o/{orgSlug}/players/[playerId]`) — factual explanations, never an opaque
   score, matching AGENTS.md's Explanation model. Nothing here mutates
   `Player.primaryPosition`/`secondaryPosition`/`tertiaryPosition` (the existing position-evidence
   mechanism remains the sole owner of that persistent mutation, per D-010/"Long-term position
   loop"), and nothing here changes team-composition or Event squad generation output — this
   bundle is infrastructure and observability only. Consuming this to actually change *what
   automation selects* is Bundle 7 (evidence-aware rotation generation), not this bundle.

## Consequences

- `RoleSuitabilityProfile`/`getPositionFit()` keep their exact existing behaviour and callers
  (team-composition, Event squad generation) — zero behavioural change there.
- A pre-existing, unrelated architectural residue was found while auditing this area — a second,
  independent declared-position-fit implementation in `src/lib/players/player-position-resolver.ts`
  (used by the Event squad/lineup pipeline) duplicating `position-suitability.ts`'s
  `getPositionFit()`/`computePositionScarcity()` almost line-for-line. Recorded as ARR-0040
  rather than fixed in this bundle — consolidating it touches the production-critical Event
  generation pipeline and is out of this bundle's scope.
- `OutfieldRoleSuitabilityResult`/`TacticalFunctionFit` are not yet consumed by any generation
  engine. Bundle 7 is the first consumer that would use these to change automatic rotation
  output; until then this is purely descriptive, matching Bundle 1-3's own precedent of shipping
  evidence infrastructure ahead of the automation that will use it.
- `TacticalFunctionDefinition`'s attribute weights are a first, deliberately simple version — not
  claimed to be tuned or validated against real outcomes. They are a documented, inspectable
  starting point per PRINCIPLES.md's explainability principle, not a hidden scoring model.

## Migration

None (additive; no schema change).

## Supersedes

None. Extends `position-suitability.ts`/`team-composition-types.ts` (unchanged callers) and the
existing I-004 Position & Formation Exposure owner (unchanged).
