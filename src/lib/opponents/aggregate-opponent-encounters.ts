import { computeMatchOutcome } from "@/lib/opponents/match-outcome";

/**
 * Opponents list (Touchline Design Atlas, `09_ROUTE_COMPOSITION_OPPONENTS_TEAMS_SEASON.md §A`):
 * groups already-loaded matches (assumed pre-sorted most-recent-first, matching every other
 * "first occurrence per group is the latest" grouping in this codebase) by opponent, counting
 * encounters and picking out the most recent encounter's date/result. Pure, DB-free.
 */
export interface OpponentEncounterMatchInput {
  opponentTeamId: string | null;
  startsAt: Date;
  homeAway: string;
  reportHomeGoals: number | null;
  reportAwayGoals: number | null;
  hasReport: boolean;
}

export interface OpponentEncounterSummary {
  encounterCount: number;
  lastEncounterDate: string | null;
  lastEncounterResult: "won" | "drawn" | "lost" | null;
}

export function aggregateOpponentEncounters(
  matches: OpponentEncounterMatchInput[],
): Map<string, OpponentEncounterSummary> {
  const byOpponentId = new Map<string, OpponentEncounterSummary>();

  for (const match of matches) {
    if (!match.opponentTeamId) continue;
    const existing = byOpponentId.get(match.opponentTeamId) ?? {
      encounterCount: 0,
      lastEncounterDate: null,
      lastEncounterResult: null,
    };
    existing.encounterCount += 1;
    if (!existing.lastEncounterDate) {
      existing.lastEncounterDate = match.startsAt.toISOString();
      existing.lastEncounterResult = match.hasReport
        ? computeMatchOutcome(match.homeAway, match.reportHomeGoals, match.reportAwayGoals)
        : null;
    }
    byOpponentId.set(match.opponentTeamId, existing);
  }

  return byOpponentId;
}
