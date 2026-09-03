import type { ConfidenceLevel } from "@/lib/evidence/combination-topology";

/**
 * Shared, reusable "evidence -> bounded scoring nudge" primitives (Evidence-Informed Match
 * Planning programme, Bundle 6, ADR-0117). Generalizes the pattern
 * `src/lib/selection/combination-scoring.ts` pioneered (bounded, confidence-gated,
 * additive-only, never a penalty for unknown/insufficient evidence) so future evidence-informed
 * scoring signals (match-phase pattern preference, opponent-tendency arrangement preference,
 * tactical-function preference — Bundle 7+) reuse ONE correct implementation instead of each
 * reinventing capping and confidence-gating from scratch.
 *
 * Hard behavioural invariants this module exists to make easy to satisfy correctly (PROGRAMME.md
 * "Bundle 6: Fairness, development and evidence policy guardrails" — see AGENTS.md's "Evidence
 * guardrails" section for the full contract and required precedence order):
 *  - Negative individual outcome evidence cannot exclude an eligible player.
 *  - Unknown combinations/evidence are neutral (0), never a penalty.
 *  - Evidence adjustments are bounded (capped), never unbounded.
 *  - Evidence is confidence-gated: INSUFFICIENT confidence never influences a decision.
 *
 * This module does not itself decide WHAT evidence means or how much weight it deserves — that
 * remains each evidence type's own scoring module (e.g. combination-scoring.ts). It only provides
 * the safe numeric/structural primitives every such module should build on.
 */

export function isEvidenceConfidentEnoughToInfluence(confidence: ConfidenceLevel): boolean {
  return confidence !== "INSUFFICIENT";
}

/**
 * Turns a raw accumulated bonus into one capped, intent-scaled adjustment. Never returns a
 * negative value and never exceeds `cap` in absolute magnitude, regardless of how many evidence
 * rows the caller summed into `rawBonus` — the caller is responsible for confidence-gating each
 * row before summing (see `isEvidenceConfidentEnoughToInfluence`).
 *
 * A negative `rawBonus` is clamped to 0 rather than passed through: this primitive is for
 * evidence *bonuses* only (unknown/negative outcome evidence must never become a penalty here —
 * see `assertEvidenceDidNotExcludeCandidates` below for the separate, structural half of that
 * same invariant).
 */
export function capEvidenceBonus(rawBonus: number, cap: number, multiplier: number = 1): number {
  const nonNegative = Math.max(rawBonus, 0);
  const capped = Math.min(nonNegative, cap);
  return Math.round(capped * multiplier);
}

/**
 * Guardrail: proves that an evidence-informed scoring/preference step never shrank the set of
 * candidates under consideration. Evidence may reorder or de-prioritise candidates; removing one
 * is an eligibility decision evidence must never make on its own (PROGRAMME.md: "Negative
 * individual outcome evidence alone can never exclude an otherwise eligible player from automatic
 * generation").
 *
 * Intended for Bundle 7+'s generation code to call immediately after any evidence-informed
 * scoring/preference step, comparing the candidate-id list just before and just after. Throws
 * with a descriptive message on violation — a bug here should fail loudly during development/CI,
 * not silently produce a plan with fewer opportunities than it should have.
 */
export function assertEvidenceDidNotExcludeCandidates(
  candidateIdsBeforeEvidence: readonly string[],
  candidateIdsAfterEvidence: readonly string[],
  context: string,
): void {
  const afterSet = new Set(candidateIdsAfterEvidence);
  const excluded = candidateIdsBeforeEvidence.filter((id) => !afterSet.has(id));
  if (excluded.length > 0) {
    throw new Error(
      `Evidence guardrail violation in ${context}: candidate(s) [${excluded.join(", ")}] were ` +
        "present before evidence-informed scoring and missing after. Evidence may reorder or " +
        "de-prioritise candidates, never exclude one.",
    );
  }
}
