import type { PlayerMatchPositionUsage } from "@/lib/player-development/position-usage-history";
import type { CanonicalTacticalPosition } from "./roles";

/**
 * C06-B (Matchboard Experience Programme, Gate C W2 remediation — PR #829): the real Lineup
 * editor's traceable-evidence summary for ONE player at ONE exact canonical position.
 *
 * Pure, deterministic, no query — `usage` must already be real completed-match evidence
 * (`getPlayersActualPositionHistory()`, ADR-0096's `ActualPositionInterval`), never a
 * planned/suitability-derived source. This module never recomputes or re-derives evidence; it
 * only aggregates what that reader already returned, for exactly one position at a time, so a
 * caller can show "why" without a parallel evidence pipeline.
 *
 * Deliberately separate from `suitability.ts`'s `classifyExactSuitability` (ADR-0129 §5's own
 * invariant: "no parameter for fairness, evidence, opponent context... by construction, none of
 * those can create or upgrade positional eligibility") — evidence is additive display
 * information here, never blended into a suitability score or tier.
 */
export type PositionEvidenceSummary = {
  /** Total minutes actually played at this exact position, across every recorded match. */
  totalMinutes: number;
  /** Distinct matches with at least one recorded minute at this position. */
  matchCount: number;
  /** Most recent match date this position was recorded, or `null` if never recorded. */
  mostRecentPlayedAt: Date | null;
};

export const NO_POSITION_EVIDENCE: PositionEvidenceSummary = {
  totalMinutes: 0,
  matchCount: 0,
  mostRecentPlayedAt: null,
};

export function summarizePositionEvidence(
  usage: readonly PlayerMatchPositionUsage[],
  position: CanonicalTacticalPosition,
): PositionEvidenceSummary {
  let totalMinutes = 0;
  let matchCount = 0;
  let mostRecentPlayedAt: Date | null = null;

  for (const match of usage) {
    const minutes = match.minutesByPosition[position];
    if (!minutes) continue;
    totalMinutes += minutes;
    matchCount += 1;
    if (!mostRecentPlayedAt || match.playedAt > mostRecentPlayedAt) {
      mostRecentPlayedAt = match.playedAt;
    }
  }

  if (matchCount === 0) return NO_POSITION_EVIDENCE;
  return { totalMinutes: Math.round(totalMinutes), matchCount, mostRecentPlayedAt };
}
