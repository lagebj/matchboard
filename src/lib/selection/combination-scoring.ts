import type { ConfidenceLevel } from "@/lib/evidence/combination-topology";
import type { CoachingIntentCategory } from "@/generated/prisma/client";
import { capEvidenceBonus } from "@/lib/policies/evidence-guardrails";

export type CombinationScoringInput = {
  playerIds: string[];
  family: string;
  subtype: string | null;
  confidence: ConfidenceLevel;
  totalMinutesTogether: number;
  matchCount: number;
};

export const COMBINATION_SCORING_BONUS: Record<ConfidenceLevel, number> = {
  INSUFFICIENT: 0,
  EMERGING: 2,
  ESTABLISHED: 4,
};

export const MAX_COMBINATION_BONUS = 4;

/**
 * Combination evidence is used differently depending on why the coach is fielding this squad
 * (SELECTION_INTEGRATION.md "Intent-dependent behaviour"). Matchboard does not have a dedicated
 * "competitive/balanced/development" selection-risk field — this derives the mode from the
 * existing coach-facing `CoachingIntentCategory` (see AGENTS.md "Coaching intent and execution
 * model") rather than inventing a new coach-facing concept:
 *
 * - CHALLENGE_EXPOSURE, STABILIZE_WEAKER_TEAM: the coach is deliberately leaning on what's known
 *   to work (a harder match, or holding a weakened team together) — COMPETITIVE.
 * - CONFIDENCE_REBUILD, RESET_AFTER_ERROR: the coach wants a safer, exploratory context — known
 *   pairs must not get an automatic edge over untried ones — DEVELOPMENT.
 * - Everything else (including no intent set) is functionally neutral toward squad-selection
 *   risk appetite — BALANCED, the default.
 */
export type CombinationIntentMode = "COMPETITIVE" | "BALANCED" | "DEVELOPMENT";

const COMPETITIVE_INTENTS: CoachingIntentCategory[] = ["CHALLENGE_EXPOSURE", "STABILIZE_WEAKER_TEAM"];
const DEVELOPMENT_INTENTS: CoachingIntentCategory[] = ["CONFIDENCE_REBUILD", "RESET_AFTER_ERROR"];

export function deriveCombinationIntentMode(intentCategory: CoachingIntentCategory | null | undefined): CombinationIntentMode {
  if (intentCategory && COMPETITIVE_INTENTS.includes(intentCategory)) return "COMPETITIVE";
  if (intentCategory && DEVELOPMENT_INTENTS.includes(intentCategory)) return "DEVELOPMENT";
  return "BALANCED";
}

// COMPETITIVE: "established positive combination evidence can materially distinguish otherwise
// valid options" — amplified. DEVELOPMENT: "do not penalise unknown combinations... known good
// combinations remain context, not permanent locks" — the positive bonus is suppressed entirely
// so it cannot out-compete an unknown/unproven option on evidence alone. BALANCED: moderate,
// tie-breaker-strength influence (the existing default bonus scale).
const INTENT_MULTIPLIER: Record<CombinationIntentMode, number> = {
  COMPETITIVE: 1.5,
  BALANCED: 1,
  DEVELOPMENT: 0,
};

/**
 * Bounded advisory score modifier for placing `playerId` alongside `partnerIdsInSquad`. Unknown
 * pairs (no evidence row) contribute 0 — neutral, never negative — and the total is capped so a
 * single accumulating pair can never grow into a dominant, self-reinforcing signal (see
 * SELECTION_INTEGRATION.md "Anti-feedback-loop requirement").
 */
export function getCombinationScoreModifier(
  playerId: string,
  partnerIdsInSquad: string[],
  combinationEvidence: CombinationScoringInput[],
  intentMode: CombinationIntentMode = "BALANCED",
): number {
  if (partnerIdsInSquad.length === 0 || intentMode === "DEVELOPMENT") return 0;

  const partnerSet = new Set(partnerIdsInSquad);
  const multiplier = INTENT_MULTIPLIER[intentMode];

  let totalBonus = 0;

  for (const evidence of combinationEvidence) {
    if (evidence.family !== "PARTNERSHIP" || evidence.playerIds.length !== 2) continue;
    if (!evidence.playerIds.includes(playerId)) continue;

    const partnerId = evidence.playerIds.find((id) => id !== playerId);
    if (!partnerId || !partnerSet.has(partnerId)) continue;

    totalBonus += COMBINATION_SCORING_BONUS[evidence.confidence] ?? 0;
  }

  // Bundle 6 (ADR-0117): capping/rounding delegated to the shared evidence-guardrails primitive
  // — same behaviour as before (totalBonus is already non-negative here), now reused by every
  // future evidence-informed scoring signal instead of being reimplemented per signal.
  return capEvidenceBonus(totalBonus, MAX_COMBINATION_BONUS, multiplier);
}

export function findPartnerCombinations(
  playerId: string,
  combinationEvidence: CombinationScoringInput[],
): CombinationScoringInput[] {
  return combinationEvidence.filter(
    (e) => e.family === "PARTNERSHIP" && e.playerIds.includes(playerId) && e.playerIds.length === 2,
  );
}

/**
 * A factual, non-scored explanation of which partnership evidence contributed to a candidate's
 * score against the players already in the squad. Never mentions a synthesized score/percentage
 * — see SELECTION_INTEGRATION.md "Explanations".
 */
export function explainCombinationEvidence(
  playerId: string,
  partnerIdsInSquad: string[],
  combinationEvidence: CombinationScoringInput[],
): string[] {
  const partnerSet = new Set(partnerIdsInSquad);
  const relevant = findPartnerCombinations(playerId, combinationEvidence).filter((evidence) => {
    const partnerId = evidence.playerIds.find((id) => id !== playerId);
    return partnerId !== undefined && partnerSet.has(partnerId) && evidence.confidence !== "INSUFFICIENT";
  });

  return relevant.map((evidence) => {
    const confidenceLabel = evidence.confidence === "ESTABLISHED" ? "Established" : "Emerging";
    const subtypeLabel = evidence.subtype ? `${evidence.subtype.toLowerCase().replace(/_/g, " ")} partnership` : "partnership";
    return `${confidenceLabel} ${subtypeLabel}: ${Math.round(evidence.totalMinutesTogether)} min across ${evidence.matchCount} match${evidence.matchCount === 1 ? "" : "es"}.`;
  });
}
