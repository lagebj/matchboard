import type { SeasonCombinationSummary } from "@/lib/evidence/combination-aggregation";
import type { CoachDecisionCandidate } from "../situation-types";

/**
 * Second genuine LONG_TERM candidate source with real evidence data (Phase 7 pattern extended).
 * Adapts `getOpponentCombinationEvidence()`'s factual, descriptive combination-evidence summaries
 * (AGENTS.md "Combination evidence": "never a chemistry score") into normalized candidates.
 *
 * Pure and DB-free: takes summaries already loaded by the existing owner
 * (`getOpponentCombinationEvidence()`), never recomputes them. The opponent detail page already
 * calls that function for its own `OpponentCombinationEvidenceSection` -- this provider reuses
 * the exact same result, adding zero new queries.
 *
 * Never includes a player's name (AGENTS.md: "Use player IDs. Resolve names for display only") --
 * only `family`/`subtype`/`playerIds`/counts, exactly like every other provider in this
 * programme. The UI resolves display names from its own already-loaded player-name map.
 */
export const OPPONENT_COMBINATION_CANDIDATE_PROVIDER_ID = "opponent-combination-evidence";

/** Bounded, "small set" analytical signal, matching opportunity-gap's own cap -- not a full
 * historical dump. INSUFFICIENT-confidence summaries are excluded, matching
 * `OpponentCombinationEvidenceSection`'s own display filter (they're not yet meaningful evidence). */
const MAX_CANDIDATES = 8;

const FAMILY_LABELS: Record<string, string> = {
  PARTNERSHIP: "Partnership",
  TRIANGLE: "Triangle",
  LINE: "Line",
  CORRIDOR: "Corridor",
  FUNCTIONAL_UNIT: "Functional unit",
  FULL_CONFIGURATION: "Full configuration",
};

export function opponentCombinationEvidenceToCandidates(
  summaries: SeasonCombinationSummary[],
  opponentTeamId: string,
): CoachDecisionCandidate[] {
  return summaries
    .filter((s) => s.confidence !== "INSUFFICIENT")
    .slice(0, MAX_CANDIDATES)
    .map((summary) => toCandidate(summary, opponentTeamId));
}

function toCandidate(summary: SeasonCombinationSummary, opponentTeamId: string): CoachDecisionCandidate {
  const sortedPlayerIds = [...summary.playerIds].sort();
  const familyLabel = FAMILY_LABELS[summary.family] ?? summary.family;

  return {
    id: `${OPPONENT_COMBINATION_CANDIDATE_PROVIDER_ID}|${opponentTeamId}|${summary.family}|${sortedPlayerIds.join(":")}`,
    source: OPPONENT_COMBINATION_CANDIDATE_PROVIDER_ID,
    entityType: "TEAM",
    entityId: opponentTeamId,
    title: `${familyLabel} evidence vs this opponent`,
    summary: `${Math.round(summary.totalMinutesTogether)} min together across ${summary.matchCount} match${summary.matchCount === 1 ? "" : "es"} vs this opponent · ${summary.confidence.toLowerCase()} confidence.`,
    facts: [
      { code: "MINUTES_TOGETHER", numericValue: Math.round(summary.totalMinutesTogether) },
      { code: "MATCH_COUNT", numericValue: summary.matchCount },
    ],
    consequences: ["DEVELOPMENT_SIGNAL"],
    affectedMatchIds: [],
    affectedTeamIds: [],
    affectedPlayerIds: sortedPlayerIds,
    alternativeActions: [],
    defaultDeepLink: `/opponents/${opponentTeamId}`,
    sourceConfidence: summary.confidence === "ESTABLISHED" ? "HIGH" : "MEDIUM",
    isLongTermSignal: true,
    affectsNextRoundDecision: false,
    requiresReview: false,
  };
}
