import type { MatchInsightCandidate, MatchInsightCategory, MatchInsightFactType, MatchInsightRelevance } from "./types";

/**
 * Deterministic relevance/category derivation (ADR-0149 Decision 2). Both deterministic insights
 * and, later, AI-produced insights (PR 4) are ranked and categorized through these same two
 * functions — the AI never emits a `category`/`relevance` field itself; Matchboard always derives
 * it from which fact/evidence-ref namespace an insight actually cites. No fake numeric precision
 * is ever surfaced (bundle §5): everything downstream of these functions works with the
 * three-value `MatchInsightRelevance` enum, never a raw score.
 */

/** Priority tiers, not a score shown to the coach — thresholds chosen so the facts this domain
 * layer already flags as attention-worthy (a CORE player with zero recent starts, a genuinely new
 * combination, exact-opponent history) land HIGH, established/expected confirmations land MEDIUM,
 * and passive provenance-only facts land CONTEXTUAL. */
export function deriveRelevanceFromPriority(priority: number): MatchInsightRelevance {
  if (priority >= 70) return "HIGH";
  if (priority >= 35) return "MEDIUM";
  return "CONTEXTUAL";
}

const CATEGORY_BY_FACT_TYPE: Record<MatchInsightFactType, MatchInsightCategory> = {
  STARTING_PATTERN: "OPPORTUNITY",
  POSITION_PATTERN: "POSITION",
  POSITION_EXPOSURE: "POSITION",
  ATTRIBUTE_PROFILE: "PLAYER_PROFILE",
  GOAL_INVOLVEMENT: "PLAYER_PROFILE",
  GOAL_COMBINATION: "COMBINATION",
  STARTS_TOGETHER: "COMBINATION",
  NEW_COMBINATION: "COMBINATION",
  LINEUP_CONTINUITY: "CURRENT_PLAN",
  FORMATION_PATTERN: "TEAM_PATTERN",
  DEVELOPMENT_CONTEXT: "DEVELOPMENT",
  OPPONENT_ENCOUNTER: "OPPONENT_HISTORY",
  OPPONENT_OBSERVATION: "OPPONENT_HISTORY",
  OPPONENT_TREND: "OPPONENT_HISTORY",
  ROTATION_CONTEXT: "CURRENT_PLAN",
};

export function categoryForFactType(type: MatchInsightFactType): MatchInsightCategory {
  return CATEGORY_BY_FACT_TYPE[type];
}

/** `fact:<slug>:...` -> the fact type that slug names, the inverse of
 * `build-match-insight-facts.ts`'s `factRefKey()` naming. Kept as one explicit table (not derived
 * by string-transforming the enum) so a future fact type must deliberately register its slug
 * here, rather than a rename silently breaking evidence-ref -> category resolution. */
const FACT_TYPE_BY_SLUG: Record<string, MatchInsightFactType> = {
  "starting-pattern": "STARTING_PATTERN",
  "position-pattern": "POSITION_PATTERN",
  "position-exposure": "POSITION_EXPOSURE",
  "attribute-profile": "ATTRIBUTE_PROFILE",
  "goal-involvement": "GOAL_INVOLVEMENT",
  "goal-combination": "GOAL_COMBINATION",
  "starts-together": "STARTS_TOGETHER",
  "new-combination": "NEW_COMBINATION",
  "lineup-continuity": "LINEUP_CONTINUITY",
  "formation-pattern": "FORMATION_PATTERN",
  "development-context": "DEVELOPMENT_CONTEXT",
  "opponent-encounter": "OPPONENT_ENCOUNTER",
  "opponent-observation": "OPPONENT_OBSERVATION",
  "opponent-trend": "OPPONENT_TREND",
  "rotation-context": "ROTATION_CONTEXT",
};

/** Category for an insight identified only by the evidence refs it cites — the path a future AI
 * insight (PR 4) uses, since the AI never emits its own category. Falls back to the least-specific
 * category rather than guessing when no recognized namespace is cited. */
export function categoryForEvidenceRefs(evidenceRefs: string[]): MatchInsightCategory {
  for (const ref of evidenceRefs) {
    const slug = ref.split(":")[1];
    const factType = slug ? FACT_TYPE_BY_SLUG[slug] : undefined;
    if (factType) return categoryForFactType(factType);
  }
  return "OBSERVATION_FOCUS";
}

const RELEVANCE_ORDER: Record<MatchInsightRelevance, number> = { HIGH: 0, MEDIUM: 1, CONTEXTUAL: 2 };

/** Stable ordering: relevance tier first, then `id` as a deterministic tiebreak — never raw
 * insertion order alone, so the same inputs always produce the same displayed order. */
export function rankInsightCandidates(candidates: MatchInsightCandidate[]): MatchInsightCandidate[] {
  return [...candidates].sort((a, b) => {
    const relevanceDiff = RELEVANCE_ORDER[a.relevance] - RELEVANCE_ORDER[b.relevance];
    return relevanceDiff !== 0 ? relevanceDiff : a.id.localeCompare(b.id);
  });
}
