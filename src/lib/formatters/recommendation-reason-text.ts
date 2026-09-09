import type { RecommendationReason } from "@/lib/explanations/recommendation-reason";

/**
 * The ONE place a `RecommendationReason` becomes coach-facing prose (Consolidation Programme
 * C6 / F6). Engines emit structured `RecommendationReason[]`; they never build sentences.
 *
 * Hard rules (enforced by `recommendation-reason-text.test.ts`):
 *  - Neutral language only — none of the banned coach-facing judgement words, no player ranking.
 *  - Never emit a number that is a score, weight, or delta. Only counts / minutes / tier names
 *    from `reason.params` may appear.
 *  - Correlational wording for evidence ("historically", "in this sample", "recorded"), never
 *    causal.
 */
export function renderReason(reason: RecommendationReason): string {
  const p = reason.params ?? {};
  const n = (k: string): number | undefined => (typeof p[k] === "number" ? (p[k] as number) : undefined);
  const s = (k: string): string | undefined => (typeof p[k] === "string" ? (p[k] as string) : undefined);
  const conf = reason.confidence ? ` (${reason.confidence.toLowerCase()} confidence)` : "";

  switch (reason.code) {
    // HARD_CONSTRAINT
    case "ELIGIBILITY_ROTATION_PATH":
      return "An active rotation path allows this movement";
    case "AVAILABILITY":
      return "Player availability was considered";
    case "PINNED_IN":
      return "Pinned into this round by the coach";
    case "PINNED_OUT":
      return "Pinned out of this round by the coach";
    case "GOALKEEPER_BOUNDARY":
      return "Goalkeeper slots are filled separately from outfield planning";
    case "PATH_COOLDOWN":
      return "The rotation path is within its cooldown window";
    case "NON_ROTATABLE":
      return "This player stays with their core team by configuration";

    // FAIRNESS_OPPORTUNITY
    case "FAIRNESS_UNDER_SHARE": {
      const mins = n("minutesBehind");
      return mins !== undefined
        ? `About ${mins} minute${mins === 1 ? "" : "s"} behind an equal share of playing time`
        : "Behind an equal share of playing time so far";
    }
    case "RECENT_LOAD":
      return "Recent match load was considered";
    case "MISSED_CORE_OPPORTUNITY":
      return "Has missed recent core match opportunities";
    case "CONSECUTIVE_SUPPORT_ROTATION":
      return "Rotating support so it is not carried by the same players every round";

    // ROLE_POSITION_SUITABILITY
    case "POSITION_PRIMARY_FIT":
      return "Fits this role as a registered primary position";
    case "POSITION_SECONDARY_FIT":
      return "Fits this role as a registered secondary position";
    case "POSITION_FALLBACK_FIT":
      return "A permitted fallback position for this role";
    case "POSITION_NO_FIT":
      return "No registered position match for this role";
    case "ROLE_EXPOSURE_SUPPORTS": {
      const tier = s("tier");
      return tier
        ? `Recorded exposure supports this role (${tier.toLowerCase()})`
        : "Recorded exposure supports this role";
    }

    // OPPONENT_EVIDENCE_CONTEXT
    case "OPPONENT_FUNCTION_CONTINUITY":
      return `Helps preserve a useful team function against a recorded opponent tendency${conf}`;
    case "PARTNERSHIP_EVIDENCE": {
      const mins = n("minutesTogether");
      const matches = n("matchCount");
      if (mins !== undefined && matches !== undefined) {
        return `Recorded partnership: ${mins} minutes together across ${matches} match${matches === 1 ? "" : "es"}${conf}`;
      }
      return `Recorded partnership evidence with an already-placed teammate${conf}`;
    }
    case "COMBINATION_EVIDENCE":
      return `Recorded on-field combination evidence for this grouping${conf}`;
    case "POSITION_CONTEXT_HISTORY":
      return `Recorded outcomes at this position have historically been more favourable for this player in this sample${conf}`;
    case "TRANSITION_STRUCTURE_CONTEXT": {
      const matches = n("occurrences");
      return matches !== undefined
        ? `Similar changes have been recorded ${matches} time${matches === 1 ? "" : "s"} before in this sample${conf}`
        : `Similar changes have been recorded before in this sample${conf}`;
    }
    case "NATURAL_BREAK":
      return "Timed to a natural break in play";

    // DOWNSTREAM_COVERAGE
    case "SUPPORT_REQUIREMENT":
      return "The receiving team needs support this round";
    case "SQUAD_REPAIR":
      return "Repairs a squad left short by support movement";
    case "DEVELOPMENT_ROUTING":
      return "A development movement opportunity";
    case "COVERAGE_RISK":
      return "Keeps the rest of the plan covered";
  }
}

/** Convenience — render several reasons, `material` first, as short lines. */
export function renderReasons(reasons: RecommendationReason[]): string[] {
  return [...reasons]
    .sort((a, b) => Number(b.material) - Number(a.material))
    .map(renderReason);
}
