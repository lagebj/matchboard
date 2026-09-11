/**
 * Opponents list presentation view model (Touchline Design Atlas,
 * `09_ROUTE_COMPOSITION_OPPONENTS_TEAMS_SEASON.md §A`).
 *
 * Sources:
 * - opponents -> EXISTING_DIRECT (db.opponentTeam.findMany with _count.matches/_count.eventMatches)
 * - sportingLevel -> EXISTING_QUERYABLE (aggregateSportingLevel(), src/lib/opponents/sporting-level-aggregation.ts — categorical only, never a percentage: see provenance §0.7)
 * - followUp -> EXISTING_QUERYABLE (OpponentEncounterObservation.followUp, most recent per opponent)
 * Derived:
 * - recentlyFacedCount -> DERIVED_PRESENTATION (encounters within a 3-month window)
 * - needsFollowUpCount -> DERIVED_PRESENTATION (count of opponents whose latest followUp is not a terminal state)
 */

export type SportingLevelConfidence = "unknown" | "low" | "medium" | "high";

const TERMINAL_FOLLOW_UP = new Set(["NONE", "NO_FURTHER_ACTION_REQUIRED"]);

export interface OpponentRowInput {
  opponentTeamId: string;
  displayName: string;
  encounterCount: number;
  lastEncounterDate: string | null;
  lastEncounterResult: "won" | "drawn" | "lost" | null;
  sportingLevel: SportingLevelConfidence;
  latestFollowUp: string | null; // OpponentObservationFollowUp value, or null if never assessed
}

export interface OpponentsViewModelInput {
  opponents: OpponentRowInput[];
  nowIso: string;
}

export interface OpponentsViewModel {
  opponents: OpponentRowInput[];
  recentlyFacedCount: number;
  needsFollowUpCount: number;
}

const RECENT_WINDOW_DAYS = 90;

export function buildOpponentsViewModel(input: OpponentsViewModelInput): OpponentsViewModel {
  const now = new Date(input.nowIso).getTime();

  const recentlyFacedCount = input.opponents.filter((o) => {
    if (!o.lastEncounterDate) return false;
    const days = (now - new Date(o.lastEncounterDate).getTime()) / (1000 * 60 * 60 * 24);
    return days >= 0 && days <= RECENT_WINDOW_DAYS;
  }).length;

  const needsFollowUpCount = input.opponents.filter(
    (o) => o.latestFollowUp != null && !TERMINAL_FOLLOW_UP.has(o.latestFollowUp),
  ).length;

  return { opponents: input.opponents, recentlyFacedCount, needsFollowUpCount };
}
