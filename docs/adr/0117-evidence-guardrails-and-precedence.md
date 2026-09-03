# ADR-0117: Evidence Guardrails and Precedence

## Status

Accepted

## Context

The Evidence-Informed Match Planning programme's Bundle 6
(`.matchboard-work/evidence-informed-match-planning/`, a temporary, gitignored implementation
work bundle) asks for explicit protection against evidence-aware planning producing
self-reinforcing exclusion loops, before Bundle 7 adds any new evidence-informed automatic
generation. PROGRAMME.md's required precedence order:

```text
Eligibility/domain invariants
        -> Fairness + development obligations
        -> Position/formation viability
        -> Structural balance + role suitability
        -> Evidence-informed guardrails/preferences
        -> Opponent/context preferences
```

### Repository audit findings

- **Matchboard already has exactly one wired-in evidence-informed scoring signal**:
  `src/lib/selection/combination-scoring.ts`'s `getCombinationScoreModifier()`, consumed by
  `rotation-candidate-ranking.ts`'s `getRotationCandidatePriorityScore()`. It already implements
  every one of PROGRAMME.md's "Hard behavioural invariants" correctly: bounded
  (`MAX_COMBINATION_BONUS`), confidence-gated (`INSUFFICIENT` contributes 0), never a penalty for
  unknown evidence, and intent-aware (suppressed entirely under `DEVELOPMENT` coaching intent so
  known pairs cannot out-compete unproven ones — the anti-feedback-loop protection PRINCIPLES.md
  asks for). It already has thorough unit tests
  (`src/lib/selection/__tests__/combination-scoring.test.ts`, 21 cases) proving this in isolation.
- **What was missing was two things, not a new scoring engine**: (1) this correct pattern was
  implemented once, inline, with no shared, reusable primitive for a future evidence type (match-
  phase pattern preference, opponent-tendency arrangement preference, tactical-function
  preference — Bundle 7+) to build on without re-deriving the same capping/confidence-gating
  logic from scratch; and (2) no test proved the invariant *in combination with* the real fairness
  scoring formula (`selection-fairness.ts`'s `getLeagueSeasonFairnessBonus()`) — every existing
  test exercised `combination-scoring.ts` in isolation, not its actual interaction inside
  `getRotationCandidatePriorityScore()`. `src/lib/selection/rotation-candidate-ranking.ts` itself
  had no dedicated test file at all before this bundle.
- **Bundles 4 and 5's new evidence types are not wired into any scoring/selection decision yet**
  (confirmed in both bundles' own handoffs: "no generation engine consumes it yet"). There is
  therefore nothing yet for a guardrail to *guard* for match-phase patterns, opponent tendency, or
  outfield-role-suitability/tactical-function fit — Bundle 7 is where that wiring happens.
- **The OPA/Rego policy layer (`SelectionPolicyInput`, `src/lib/policies/types.ts`) carries no
  evidence fields today**, and no current Rego rule or default policy reacts to any evidence
  signal. Extending that normalized contract now, with no concrete consumer, would be exactly the
  kind of speculative plumbing AGENTS.md's implementation style explicitly warns against ("don't
  design for hypothetical future requirements").

## Decision

1. **`src/lib/policies/evidence-guardrails.ts`** (new) is the one shared, reusable "evidence ->
   bounded scoring nudge" primitive family, generalizing `combination-scoring.ts`'s
   already-correct pattern:
   - `isEvidenceConfidentEnoughToInfluence(confidence)` — `false` for `INSUFFICIENT`.
   - `capEvidenceBonus(rawBonus, cap, multiplier?)` — clamps to `[0, cap]` before applying an
     optional intent-style multiplier and rounding. A negative `rawBonus` is clamped to 0, not
     passed through — this primitive is for bonuses only.
   - `assertEvidenceDidNotExcludeCandidates(before, after, context)` — a structural guardrail
     comparing a candidate-id list just before and just after an evidence-informed
     scoring/preference step; throws (loudly, in development/CI) if any candidate present before
     is missing after. Intended for Bundle 7+'s generation code to call directly.
   - `combination-scoring.ts`'s `getCombinationScoreModifier()` is refactored to call
     `capEvidenceBonus()` for its own capping/rounding — a mechanical, zero-behaviour-change
     refactor (all 21 existing tests pass unchanged) that makes it the reference *consumer* of
     the shared primitive rather than the only implementation of the pattern.

2. **New regression tests prove the precedence holds in the real, shipped ranking function**, not
   only in `combination-scoring.ts`'s own isolated tests:
   `src/lib/selection/__tests__/evidence-fairness-precedence.test.ts` constructs a heavily-used
   candidate with a strong `ESTABLISHED` partnership (capped bonus, `COMPETITIVE` intent
   amplified) against a rarely-used candidate with zero combination evidence, and proves the
   rarely-used candidate still ranks first through `getRotationCandidatePriorityScore()`/
   `getRankedRotationCandidates()` end-to-end — `selection-fairness.ts`'s existing, unbounded-with-
   usage fairness penalty dominates the bounded (max effectively 6, at `MAX_COMBINATION_BONUS=4`
   x `COMPETITIVE`'s 1.5 multiplier) combination bonus once real-world match-count gaps
   accumulate. A second test proves `getRankedRotationCandidates()` never drops a candidate
   (structural, by construction — it only maps then sorts), using
   `assertEvidenceDidNotExcludeCandidates()` against its real before/after candidate-id lists.

3. **The OPA/Rego `SelectionPolicyInput` contract is deliberately NOT extended in this bundle.**
   No evidence fields are added to `PolicyPlayer`/`SelectionPolicyInput`, and no Rego rule or
   default policy is changed. PROGRAMME.md's "only extend normalized policy inputs after the
   evidence contract is stable" is read as permission, not a mandate to do so immediately with no
   concrete consumer — adding unused fields now would be speculative plumbing with real risk of
   being wrong by the time Bundle 7/8 actually needs it. This extension is deferred to whichever
   of Bundle 7/8 first has a concrete new scoring signal that genuinely needs Rego/default-policy
   visibility into evidence.

4. **The required precedence order (PROGRAMME.md) is documented as a contract in AGENTS.md**
   ("Evidence guardrails" section) that Bundle 7's generation work must follow: this bundle's
   guardrail primitives sit at the "evidence-informed guardrails/preferences" layer, strictly
   below eligibility, fairness/development, and position/structural viability — Bundle 7 must
   apply evidence-informed scoring *after* those are resolved, exactly as
   `getRotationCandidatePriorityScore()` already does for combination evidence today.

## Consequences

- No schema changes. No behavioural change to any existing generation output — `combination-
  scoring.ts`'s refactor is proven zero-diff via its unchanged existing test suite.
- Future evidence-informed scoring signals (Bundle 7+) have one correct, tested, reusable
  primitive to build on (`evidence-guardrails.ts`) instead of re-deriving capping/confidence-
  gating logic per signal, and one structural assertion
  (`assertEvidenceDidNotExcludeCandidates()`) to call as a defensive regression guard.
- `SelectionPolicyInput`/Rego remain evidence-blind for now — a deliberate, disclosed scope
  boundary, not an oversight. Whoever implements Bundle 7/8's opponent-aware or role-suitability-
  aware generation must decide then whether that logic belongs in TypeScript scoring (following
  `combination-scoring.ts`'s pattern) or needs a genuine Rego-visible policy input extension.
- Bundle 5's `OutfieldRoleSuitabilityResult`/`TacticalFunctionFit` remain descriptive-only and are
  not touched by this bundle — there is no eligibility/scoring code path for them to guard yet.

## Migration

None (additive; no schema change).

## Supersedes

None. Extends `combination-scoring.ts` (ADR-0094) without changing its behaviour, and documents
(without changing) the existing OPA/Rego policy layer (ADR-0107).
