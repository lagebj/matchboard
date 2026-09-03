# ADR-0115: Reactive Pre-Match Scenario Evaluation

## Status

Accepted

## Context

The Evidence-Informed Match Planning programme's Bundle 4
(`.matchboard-work/evidence-informed-match-planning/`, a temporary, gitignored implementation
work bundle) asks for a shared evaluator that projects a coach's hypothetical starting line-up
and planned rotation sequence as a full-match sequence, and attaches whatever historical evidence
(Bundles 1-3) is actually relevant to what changes at each point — reactively, so changing any
input (a starter, a position, an incoming/outgoing player, a transition's time, batch size, or an
earlier transition) recomputes everything downstream.

Repository audit before this bundle found the domain owner already substantially exists:

- `src/lib/planned-rotation/planned-rotation.ts`'s `projectPlannedLineup()` already projects the
  on-pitch snapshot at any single instant from starters + planned changes.
  `checkPlannedRotationCoverage()` already does basic structural checks. Both are already wired
  to real UI (`PlannedRotationPanel`, the match detail Rotations tab) via
  `checkPlannedRotationCoverageAction()` (`planned-rotation-actions.ts`), which already reruns on
  every plan mutation — the "reactive" mechanism this bundle needs already existed for coverage
  checks and starting-XI partnership evidence; it simply didn't yet cover the full rotation
  sequence or attach match-phase/opponent evidence.
- `src/lib/evidence/match-state-timeline.ts`'s `deriveMatchTransitions()` (Bundle 1) already
  computes the exact structural diff (players off/on/remaining, position-only changes,
  disruption descriptors) between two on-pitch states — for *actual* history. A planned,
  hypothetical transition needs the identical diff, just without a score/period/goal concept to
  attach.
- `checkPlannedRotationCoverageAction()`'s `totalMatchSeconds` was hardcoded to `0` ("no
  per-change duration model exists for League matches" — a stale comment; Bundle 1 already built
  the League period-config infrastructure this was missing).

## Decision

1. **`diffPlayerStates()` is extracted from `deriveMatchTransitions()`** as the shared
   structural-diff primitive (`match-state-timeline.ts`), taking two `MatchStatePlayer[]` sets
   and returning `PlayerStateDiff` (players off/on/remaining, position-only changes, substitution
   count, changed lines, disruption descriptors) with no score/period attached.
   `deriveMatchTransitions()` becomes a thin wrapper adding score/period/natural-break on top.
   `line`/`lane` are optional on the shared player-state shape and every line-based descriptor
   degrades gracefully when absent — a planned/hypothetical player state has no resolved
   formation-slot line/lane the way an actual `ActualPositionInterval` row does.

2. **`src/lib/planned-rotation/scenario-evaluation.ts`** is the new shared evaluator (extending
   `planned-rotation.ts`, not duplicating it):
   - `buildPlannedScenarioIntervals()` builds the full planned on-field sequence by calling the
     existing `projectPlannedLineup()` once per planned-change boundary — never re-implementing
     the projection.
   - `buildPlannedScenarioTransitions()` diffs consecutive intervals via the shared
     `diffPlayerStates()`.
   - `evaluatePlannedScenario()` is the top-level entry point: projects the sequence and attaches,
     per transition, whatever combination evidence (existing, pre-programme) and team-season
     match-phase pattern evidence (Bundle 2) is actually relevant and non-`INSUFFICIENT`; and,
     as match-level context (not per-transition — no role-fit/tactical-function reasoning exists
     yet, that is Bundle 5+), any non-`INSUFFICIENT` opponent tactical tendency (Bundle 2).
   - **`approximateMatchSeconds`** on a planned change is confirmed (via the existing UI's own
     placeholder text, "e.g. 1500 (25')") to already be one flat "minutes since kickoff" value, not
     period-relative like a live-recorded event — no period-offset conversion (unlike Bundle 1's
     fix for *live-recorded* timestamps) is needed for planned data.
   - Pure and read-only throughout: never writes to `PlannedRotation`/`PlannedRotationChange`.
     Reactivity is structural, not a caching/invalidation mechanism — the evaluator is a pure
     function of its inputs, so calling it again after any single-field plan edit naturally
     recomputes the full downstream sequence.

3. **Signal model**: two kinds only —
   `OBSERVED_FACT` (direct combination-evidence citation) and `HISTORICAL_PATTERN` (aggregated
   match-phase or opponent-tendency citation, always confidence-qualified). PROGRAMME.md's third
   tier, "planning implication", is deliberately **not** modeled as a distinct signal kind in this
   bundle — a genuine implication (e.g. "prefer this player because of opponent tendency X")
   requires role/tactical-function suitability reasoning that does not exist yet (Bundle 5). Bundle
   4 shows evidence: it does not advise.

4. **`checkPlannedRotationCoverageAction()` is extended, not replaced**, to compute
   `totalMatchSeconds` for real (via `getLeaguePeriodConfig`/`getTotalPeriodDurationMs`, Bundle 1)
   and call `evaluatePlannedScenario()`, returning a new `scenario` field alongside the existing
   `issues`/`partnershipEvidence`. `PlannedRotationPanel` renders it as a new, clearly-labeled
   "what happens with this plan" section, distinct from the existing starting-XI-only
   "Partnership evidence" section (which stays as-is — a complementary, not redundant, view).

## Consequences

- No schema changes. `PlannedRotationChange`'s existing fields (already coach-entered as one
  flat match-clock value) are sufficient; no new column was needed for period-awareness.
- `diffPlayerStates()` is now genuine shared infrastructure between Bundle 1 (actual history) and
  Bundle 4 (hypothetical planning) — any future bundle needing the same structural diff (Bundle 7's
  rotation-generation search is the obvious next consumer) should call it too, not re-derive it.
- The evaluator currently has no notion of tactical function or role suitability (Bundle 5) or
  transition-structure pattern frequency across matches (Bundle 7) — its signals are limited to
  what Bundles 1-3 actually built. This is a deliberate, disclosed scope boundary, not an
  oversight: PROGRAMME.md's own examples (e.g. "similar transitions have been observed 9 times")
  describe evidence types that later bundles introduce.

## Migration

None (additive; no schema change).

## Supersedes

None (extends ADR-0113's `MatchStateInterval`/transition primitives and the pre-existing planned
rotation domain; does not change either).
