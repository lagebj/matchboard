/**
 * League / Fixtures presentation view model (Touchline Design Atlas,
 * `05_ROUTE_COMPOSITION_TODAY_LEAGUE_HISTORY.md §B`).
 *
 * Pure, DB-free. Consumes the existing `FixturesOverview` shape unchanged
 * (`src/domain/fixtures/service.ts`, `getFixturesOverview()`) and only decides which round is the
 * "current/upcoming feature" section versus which are dense scorebook history — a presentation
 * ordering decision, not a new data source.
 *
 * Sources:
 * - periods/rounds/matches -> EXISTING_DIRECT (FixturesOverview, src/domain/fixtures/service.ts)
 * Derived:
 * - featureRoundId         -> DERIVED_PRESENTATION (first round with isCurrent, else first non-finalized round)
 * - historyRounds          -> DERIVED_PRESENTATION (remaining rounds, most recent first)
 */

export type LeagueSelectionState = "NOT_GENERATED" | "DRAFT" | "BLOCKED" | "READY" | "FINALIZED";
export type LeagueReadinessState = "READY" | "WATCH" | "AT_RISK" | "NOT_PLAYABLE" | null;

export interface LeagueMatchInput {
  id: string;
  title: string;
  teamName: string;
  opponent?: string;
  startsAt?: string;
  readinessState?: LeagueReadinessState;
  selectionState: LeagueSelectionState;
  blockerCount: number;
  decisionRequiredCount: number;
  matchStatus: "SCHEDULED" | "CANCELLED";
}

export interface LeagueRoundInput {
  id: string;
  title: string;
  dateRange?: string;
  readinessState?: LeagueReadinessState;
  selectionState: LeagueSelectionState;
  blockerCount: number;
  decisionRequiredCount: number;
  matches: LeagueMatchInput[];
  isCurrent: boolean;
}

export interface LeaguePeriodInput {
  id: string;
  title: string;
  dateRange?: string;
  rounds: LeagueRoundInput[];
  isCurrent: boolean;
}

export interface LeagueViewModel {
  activePeriod: LeaguePeriodInput | null;
  featureRound: LeagueRoundInput | null;
  historyRounds: LeagueRoundInput[];
  totalBlockerCount: number;
  totalDecisionRequiredCount: number;
}

export function buildLeagueViewModel(periods: LeaguePeriodInput[]): LeagueViewModel {
  const activePeriod = periods.find((p) => p.isCurrent) ?? periods[0] ?? null;
  const rounds = activePeriod?.rounds ?? [];

  // No unconditional `rounds[0]` fallback: when every round is already finalized there is
  // genuinely nothing to feature as "current/upcoming" (05§B) — falling back to the first round
  // regardless of its state would misleadingly present a finished round as needing attention.
  const featureRound =
    rounds.find((r) => r.isCurrent) ??
    rounds.find((r) => r.selectionState !== "FINALIZED") ??
    null;

  const historyRounds = rounds.filter((r) => r.id !== featureRound?.id);

  let totalBlockerCount = 0;
  let totalDecisionRequiredCount = 0;
  for (const round of rounds) {
    totalBlockerCount += round.blockerCount;
    totalDecisionRequiredCount += round.decisionRequiredCount;
  }

  return { activePeriod, featureRound, historyRounds, totalBlockerCount, totalDecisionRequiredCount };
}
