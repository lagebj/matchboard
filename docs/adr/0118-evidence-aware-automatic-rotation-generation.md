# ADR-0118: Evidence-Aware Automatic Rotation Generation

## Status

Accepted

## Context

The Evidence-Informed Match Planning programme's Bundle 7
(`.matchboard-work/evidence-informed-match-planning/`, a temporary, gitignored implementation
work bundle) asks for a complete match rotation plan — a sequence of evolving on-field states,
not independent substitutions — generated automatically from role suitability, fairness, and
whatever evidence (Bundles 1-6) actually exists, with fairness structurally superior to outcome
optimisation throughout.

### Repository audit findings

- **No automatic rotation-sequence generator exists yet.** `src/lib/planned-rotation/` is
  entirely coach-authored: `createPlannedRotation()`/`updatePlannedRotation()` persist whatever
  changes the coach enters via the Rotations tab. Round-level selection (`generate-selection.ts`)
  decides *who* is in a match squad; Best Lineup (`best-lineup.ts`) fills formation slots *once*
  for a team; neither generates a *timed sequence* of on-field changes across a match. This bundle
  is genuinely new capability, not an extension of an existing generator.
- **Every projection primitive this bundle needs already exists and is reused unchanged**:
  `projectPlannedMinutes()`/`projectPlannedLineup()` (`planned-rotation.ts`) already compute
  accumulated minutes and on-pitch state from a starters list + a changes array — exactly what a
  generator needs to evaluate its own tentative output, with zero duplication.
  `computeOutfieldRoleSuitabilityProfile()`/`computeTacticalFunctionFit()` (Bundle 5) supply
  role/function reasoning. `capEvidenceBonus()`/`assertEvidenceDidNotExcludeCandidates()`
  (Bundle 6) supply the bounded, confidence-gated, never-exclusionary scoring primitives.
  `getOpponentTacticalTendencies()` (Bundle 2) supplies opponent context.
- **A real evidence gap, flagged by name in earlier bundles' own handoffs ("Bundle 7
  territory")**: no historical evidence source existed yet for "does this transition *shape*
  (batch size, disruption type, timing) correlate with goals conceded shortly after it" —
  TEST-MATRIX.md #5 ("Rotation-transition evidence"). Closed by a new module,
  `src/lib/evidence/transition-structure-evidence.ts`, built the same way Bundle 2 built
  match-phase-pattern evidence: aggregate Bundle 1's already-derived `MatchTransition`s, no new
  DB writes, no persisted rows.
- **A `position` string used throughout the planned-rotation call graph
  (`checkPlannedRotationCoverageAction`, `projectPlannedLineup`, etc.) is a raw
  `FormationSlotRoleType` enum value** (`DEFENDER`/`DEFENSIVE_MIDFIELDER`/`MIDFIELDER`/
  `ATTACKING_MIDFIELDER`/`FORWARD`/`FREE`, with `"GK"` substituted for `GOALKEEPER`) — **not**
  Bundle 5's `OutfieldStructuralRole` vocabulary (`DEFENCE`/`MIDFIELD`/`ATTACK`/`FLEXIBLE`).
  Caught only by an end-to-end integration test using real formation-slot fixtures (the pure unit
  tests, written first with the generator's own `"ATTACK"`/`"DEFENCE"` string literals, could not
  have caught this — a real, concrete instance of why an integration test against production
  data shapes is necessary alongside pure-function unit tests). Fixed via
  `mapPositionLabelToOutfieldRole()` inside the generator, accepting both conventions.
- **No "target minutes per player per match" concept exists anywhere in the codebase.** Rather
  than invent a persisted, calibrated fairness model (real scope risk — AGENTS.md: "don't design
  for hypothetical future requirements"), this bundle derives a *local, per-match-only* equal-share
  baseline: `fairShareSeconds = totalMatchSeconds × (startingOutfieldSlots / eligibleOutfieldPlayers)`,
  never persisted, scoped to the one match being planned.

## Decision

1. **`src/lib/evidence/transition-structure-evidence.ts`** (new). Pure
  `aggregateTransitionStructurePatterns()` buckets historical `MatchTransition`s by
  `(period, batchSizeBucket [SINGLE/DOUBLE/TRIPLE_PLUS], isAtNaturalBreak)` and sums goals conceded
  in a 5-minute window after each — the same granularity as the existing "opening 5" phase
  window. Confidence thresholds (`<2`/`2-3`/`4+` occurrences) match Bundle 2's
  *occurrence*-based `classifyTacticalConfidence()`, not its match-count-based
  `classifyMatchPhaseConfidence()` — a transition shape can recur multiple times within one
  match, so "occurrences" is an event count here, matching Bundle 2's own justification for using
  a separate threshold set for occurrence-based evidence. `getTeamSeasonTransitionPatterns()` is
  the DB-bound wrapper, following the exact loading pattern
  `getTeamSeasonMatchPhasePatterns()` established.

2. **`src/lib/planned-rotation/generate-rotation-plan.ts`** (new, pure, deterministic). Generates
  a full sequence of `PlannedRotationChangeData`-shaped proposals. Search strategy (disclosed in
  full, per PROGRAMME.md's explicit requirement to document candidate generation, pruning,
  scoring precedence, tie-breaking, and performance limits):
   - **Decision-point grid**: 1/3 and 2/3 of each playing period's own duration, plus the
     absolute start of every playing period after the first (a natural-break opportunity). This
     is an internal computational search bound — PROGRAMME.md explicitly permits this ("Time
     grids can bound search internally. They must not become product doctrine.") — not asserted
     footballing doctrine; nothing in the generated plan or its explanations claims "changes only
     happen at thirds."
   - **Batch size is emergent, not fixed.** At each decision point, every on-pitch outfield
     player with a stint at or above a minimum useful stint (5 minutes — waived entirely at
     natural-break points, matching TEST-MATRIX #5 Scenario C: "large halftime rotation is
     reasonable") *and* meaningfully ahead of their fair-share-to-date is "due." However many
     players are simultaneously due at one point become one batch — there is no `>N = bad` rule
     anywhere in the code.
   - **This is a deterministic GREEDY algorithm, not exhaustive backtracking search** — disclosed
     as a real, deliberate scope limit, not claimed to be optimal. "A locally good early
     substitution cannot be accepted if it creates impossible fairness problems later"
     (PROGRAMME.md) is addressed by scoring every decision against the *whole match's* fair-share
     curve (not just the moment at hand), not by multi-step lookahead across every possible
     future sequence. A future bundle could add real backtracking/lookahead on top of this same
     scoring model without changing its shape.
   - **Bench-candidate scoring** for a vacated role: role-suitability tier (Bundle 5,
     NATURAL/PLAUSIBLE/DEVELOPMENTAL/UNSUPPORTED — UNSUPPORTED scores 0, never excluded from
     candidacy) + fairness under-share (capped contribution) + a capped opponent-function-
     continuity bonus (Bundle 6's `capEvidenceBonus()`, gated on `STRONG_FIT` +
     `EMERGING`/`ESTABLISHED` opponent-tendency confidence) + a deterministic seed-based
     tie-break. `assertEvidenceDidNotExcludeCandidates()` (Bundle 6) is called after scoring at
     every decision point, verifying evidence-informed scoring never structurally dropped a
     candidate from consideration — a real, exercised application of the guardrail Bundle 6
     built ahead of this bundle specifically for this purpose.
   - **A small, explicit, disclosed opponent-tendency → tactical-function mapping**
     (`OPPONENT_TENDENCY_PREFERRED_FUNCTION`) covers 7 of 17 `OpponentPlayingStyleTag` values with
     a clear, stated footballing rationale each (e.g. `SLOW_BUILD_UP` → `FIRST_LINE_PRESS`,
     matching PROGRAMME.md's own worked example) — tags with no defensible functional response
     are deliberately left unmapped rather than guessed.
   - **Goalkeeper is never touched** — excluded from candidacy in both directions by construction
     (starters with position `"GK"` are filtered out before any scoring begins).
   - **Explanations are factual sentences** citing whichever factors were decisive (minutes
     behind target, role fit, opponent-function preservation, natural break, prior transition
     evidence with its own occurrence count) — never a synthesized score, matching every other
     evidence explanation in this programme.

3. **`generateRotationPlanAction()`** (`planned-rotation-actions.ts`, extended not replaced) is
  the DB-bound orchestrator: loads the match line-up (starters), squad (bench = squad minus
  starters), player attributes/positions, period config, opponent tendencies, and transition
  patterns, calls the pure generator, and persists via the *existing*
  `createPlannedRotation()` — never a new persistence path. **Deliberately offered only when no
  rotation plan exists yet** for that match/team: `createPlannedRotation()` already refuses when
  one exists ("Rotation plan already exists"), so a coach who wants to regenerate from scratch
  deletes the existing plan first — the same "clear first, then regenerate" convention already
  established for round-level draft generation, rather than adding a new MANUAL/AUTO source
  column to `PlannedRotationChange` (no schema change needed).

4. **UI**: one "Generate rotation plan" button next to the existing "Create rotation plan" button
  on `PlannedRotationPanel`'s empty state — the generated plan then flows through every existing
  Rotations-tab mechanism unchanged (edit, reorder, delete individual changes; Bundle 4's "what
  happens with this plan" evaluation; Bundle 6's guardrails already proven against the ranking
  formula this generator's scoring pattern mirrors).

## Consequences

- No schema changes.
- The generator's fairness model can produce aggressive early rotation for squads with a high
  bench-to-starter ratio (e.g., an 8-outfield-player squad for 4 starting slots implies each
  player's fair share is only half the match, so the linear target-to-date curve makes rotation
  "due" quite early) — a genuine, disclosed simplification of a linear proportional target rather
  than a smoothed/stint-aware curve. Not a bug: the math is internally consistent with the stated
  fairness definition; a future bundle could refine the target curve without changing the rest of
  the algorithm's shape.
- `TransitionStructureEvidenceRow` currently informs only bench-candidate *explanations* and
  contributes no scoring weight of its own in this bundle (opponent-function continuity is the
  only evidence signal that affects the *choice*) — a deliberate, disclosed scope cut. A fuller
  integration (actively avoiding a historically risky batch shape by re-partitioning a batch, not
  just describing it) is real future work, not attempted here to keep the search bounded and the
  bundle reviewable.
- `getTeamSeasonTransitionPatterns()`, like `position-exposure.ts`, carries a top-level `import
  "server-only"` guarding its DB-bound export. Testing pure functions from the same file (or any
  module that transitively imports it, including `generate-rotation-plan.ts`) requires importing
  `@/test/support/auth-mock` (which registers `vi.mock("server-only", ...)` as a side effect) —
  the same pre-existing convention `position-exposure.test.ts` already relies on, not a new
  pattern introduced here.

## Migration

None (additive; no schema change).

## Supersedes

None. Extends `planned-rotation.ts` (unchanged), `match-state-timeline.ts` (unchanged, read-only
consumer), and the Bundle 5/6 primitives (unchanged, first real consumers exercised here).
