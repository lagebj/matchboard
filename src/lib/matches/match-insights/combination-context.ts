import "server-only";
import {
  getSeasonCombinationEvidence,
  aggregateSeasonCombinations,
  selectRelevantPartnerships,
  type SeasonCombinationSummary,
} from "@/lib/evidence/combination-aggregation";
import type { CombinationEvidenceRow, ConfidenceLevel } from "@/lib/evidence/combination-topology";
import type { CurrentPlanSquadEntry, PairCombinationSummary } from "./types";

/**
 * Combination/partnership facts (ADR-0149 Decision 1/4; ADR-0094). Reuses
 * `getSeasonCombinationEvidence`/`aggregateSeasonCombinations`/`selectRelevantPartnerships`
 * exactly as `getPlannedPartnershipEvidenceAction()` already does — this module folds that same
 * calculation into the Match Insight domain layer rather than reimplementing it, per ADR-0149
 * Decision 1 ("useful calculations currently supporting Partnership Evidence can remain
 * internally and should feed Match Insights").
 */

/** Exported for `opponent-context.ts` — one mapping from `SeasonCombinationSummary` to this
 * domain layer's leaner `PairCombinationSummary`, not duplicated per module. */
export function toPairCombinationSummary(s: SeasonCombinationSummary): PairCombinationSummary | null {
  if (s.playerIds.length !== 2) return null;
  return {
    playerIds: [s.playerIds[0], s.playerIds[1]],
    family: s.family,
    subtype: s.subtype,
    totalMinutesTogether: s.totalMinutesTogether,
    matchCount: s.matchCount,
    goalsForTotal: s.goalsForTotal,
    directGoalContributionsTotal: s.directGoalContributionsTotal,
    directAssistContributionsTotal: s.directAssistContributionsTotal,
    confidence: s.confidence,
  };
}

function pairKey(a: string, b: string): string {
  return [a, b].sort().join(":");
}

export type CombinationInsightInput = {
  /** Established (non-`INSUFFICIENT`) `PARTNERSHIP` pairs among the current squad — the same
   * facts `PlannedPartnershipEvidenceList` rendered standalone; now one input among several. */
  establishedPartnerships: PairCombinationSummary[];
  /** Currently-planned CORE pairs sharing the same planned position with zero recorded
   * `PARTNERSHIP` evidence at all (not merely `INSUFFICIENT` — genuinely absent). Restricted to
   * same-position pairs: the clearest, current-plan-derivable proxy for "positionally adjacent"
   * without needing post-play line/lane inference (`combination-topology.ts`, ADR-0094 Phase 3),
   * which only exists for positions actually played, not planned ones. */
  newCombinations: [string, string][];
  /** Established pairs whose combination evidence includes at least one direct goal or assist
   * contribution while playing together — "goal/assist combinations" (bundle §6). */
  goalCombinations: PairCombinationSummary[];
};

export async function buildCombinationContext(params: {
  leagueSeasonId: string;
  currentSquad: CurrentPlanSquadEntry[];
}): Promise<{ pairCombinations: PairCombinationSummary[]; insightInput: CombinationInsightInput }> {
  const rows: CombinationEvidenceRow[] = await getSeasonCombinationEvidence(params.leagueSeasonId);
  const summaries = aggregateSeasonCombinations(rows);
  const squadPlayerIds = params.currentSquad.map((s) => s.playerId);

  const relevant = selectRelevantPartnerships(squadPlayerIds, summaries)
    .map(toPairCombinationSummary)
    .filter((s): s is PairCombinationSummary => s !== null);

  const goalCombinations = relevant.filter(
    (s) => s.directGoalContributionsTotal > 0 || s.directAssistContributionsTotal > 0,
  );

  // Every recorded PARTNERSHIP pair for these players, regardless of confidence -- needed to
  // detect a genuinely absent (not just INSUFFICIENT) pairing below.
  const anyPartnershipKeys = new Set(
    summaries
      .filter((s) => s.family === "PARTNERSHIP" && s.playerIds.length === 2)
      .map((s) => pairKey(s.playerIds[0], s.playerIds[1])),
  );

  const corePlayersByPosition = new Map<string, string[]>();
  for (const entry of params.currentSquad) {
    if (entry.role !== "CORE" || !entry.position) continue;
    const existing = corePlayersByPosition.get(entry.position);
    if (existing) existing.push(entry.playerId);
    else corePlayersByPosition.set(entry.position, [entry.playerId]);
  }

  const newCombinations: [string, string][] = [];
  for (const playersAtPosition of corePlayersByPosition.values()) {
    for (let i = 0; i < playersAtPosition.length; i++) {
      for (let j = i + 1; j < playersAtPosition.length; j++) {
        const a = playersAtPosition[i];
        const b = playersAtPosition[j];
        if (!anyPartnershipKeys.has(pairKey(a, b))) {
          newCombinations.push([a, b]);
        }
      }
    }
  }

  const pairCombinations: PairCombinationSummary[] = summaries
    .map(toPairCombinationSummary)
    .filter((s): s is PairCombinationSummary => s !== null);

  return {
    pairCombinations,
    insightInput: { establishedPartnerships: relevant, newCombinations, goalCombinations },
  };
}

export type { ConfidenceLevel };
