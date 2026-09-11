/**
 * Opponent detail presentation view model (Touchline Design Atlas,
 * `09_ROUTE_COMPOSITION_OPPONENTS_TEAMS_SEASON.md §B`).
 *
 * Sources:
 * - identity          -> EXISTING_DIRECT (OpponentTeam.displayName)
 * - sportingLevel      -> EXISTING_QUERYABLE (aggregateSportingLevel(), categorical only — never a percentage)
 * - tacticalTendencies -> EXISTING_QUERYABLE (getOpponentTacticalTendencies(), src/lib/opponents/playing-style-query.ts)
 * - tendencyOutcomes   -> EXISTING_QUERYABLE (getOpponentTendencyOutcomes(), same module — factual goalsFor/goalsAgainst only, no win-probability)
 * - encounters         -> EXISTING_DIRECT (Match + PostMatchReport rows for this opponent)
 * - combinationEvidence -> EXISTING_QUERYABLE (getOpponentCombinationEvidence(), src/lib/evidence/combination-aggregation.ts)
 * Derived: none — this module orders/labels real evidence, it does not compute anything new.
 * No inferred win probability (`09§B`).
 */

export type ConfidenceLevel = "INSUFFICIENT" | "EMERGING" | "ESTABLISHED";
export type SportingLevelConfidence = "unknown" | "low" | "medium" | "high";

export interface OpponentEncounterInput {
  matchId: string;
  matchDate: string;
  ownGoals: number | null;
  opponentGoals: number | null;
  outcome: "won" | "drawn" | "lost" | null;
}

export interface OpponentTendencyInput {
  tag: string;
  occurrences: number;
  confidence: ConfidenceLevel;
}

export interface OpponentTendencyOutcomeInput {
  tag: string;
  matchCount: number;
  goalsFor: number;
  goalsAgainst: number;
}

export interface OpponentDetailViewModelInput {
  opponentTeamId: string;
  displayName: string;
  sportingLevel: SportingLevelConfidence;
  sportingLevelSampleCount: number;
  encounters: OpponentEncounterInput[]; // most recent first
  tendencies: OpponentTendencyInput[];
  tendencyOutcomes: OpponentTendencyOutcomeInput[];
  latestFactualSummary: string | null;
}

export interface OpponentDetailViewModel {
  opponentTeamId: string;
  displayName: string;
  sportingLevel: SportingLevelConfidence;
  sportingLevelSampleCount: number;
  recentEncounters: OpponentEncounterInput[];
  record: { wins: number; draws: number; losses: number };
  tendencies: (OpponentTendencyInput & { outcome: OpponentTendencyOutcomeInput | null })[];
  latestFactualSummary: string | null;
}

const RECENT_ENCOUNTER_LIMIT = 5;

export function buildOpponentDetailViewModel(input: OpponentDetailViewModelInput): OpponentDetailViewModel {
  const recentEncounters = input.encounters.slice(0, RECENT_ENCOUNTER_LIMIT);

  const record = input.encounters.reduce(
    (acc, e) => {
      if (e.outcome === "won") acc.wins += 1;
      else if (e.outcome === "drawn") acc.draws += 1;
      else if (e.outcome === "lost") acc.losses += 1;
      return acc;
    },
    { wins: 0, draws: 0, losses: 0 },
  );

  const outcomeByTag = new Map(input.tendencyOutcomes.map((o) => [o.tag, o]));
  const tendencies = input.tendencies
    .filter((t) => t.confidence !== "INSUFFICIENT")
    .map((t) => ({ ...t, outcome: outcomeByTag.get(t.tag) ?? null }));

  return {
    opponentTeamId: input.opponentTeamId,
    displayName: input.displayName,
    sportingLevel: input.sportingLevel,
    sportingLevelSampleCount: input.sportingLevelSampleCount,
    recentEncounters,
    record,
    tendencies,
    latestFactualSummary: input.latestFactualSummary,
  };
}
