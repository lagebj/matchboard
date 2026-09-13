import type { TouchlinePositionMapEntry } from "@/components/touchline/pitch/touchline-position-map";
import { describeOpportunityTrend, type PlayerRecentOpportunityInput } from "./player-detail-view-model";

/**
 * Player Detail's Overview tab (Atlas Follow-up, `04_PLAYER_DETAIL_CONTRACT.md §4`). Distinct
 * from `players-overview-view-model.ts` (the Player *list* page's Overview mode, Phase F5) — this
 * is one player's own detail-page Overview tab.
 *
 * Reuses `describeOpportunityTrend()` from the pre-existing `player-detail-view-model.ts`
 * (ADR-0136 Atlas) rather than a second implementation of the same factual, non-causal
 * opportunity-trend sentence.
 */
export type PlayerRecentMatchRow = {
  matchId: string;
  opponent: string;
  matchDate: string;
  role: "Core" | "Support" | "Development" | null;
  goals: number;
  assists: number;
  href: string;
};

export type PlayerOverviewViewModelInput = {
  participation: { matches: number; minutes: number; starts: number; goals: number; assists: number };
  recentOpportunity: PlayerRecentOpportunityInput | null;
  /**
   * Already-resolved from `computeEffectivePlayerPositionProfile(...).positions` — this view
   * model never computes position evidence itself (contract `08_...md §6`).
   */
  effectivePositions: TouchlinePositionMapEntry[];
  activeDevelopmentFocus: { id: string; focus: string; category: string | null; href: string } | null;
  latestObservation: { id: string; note: string; createdAt: string; sourceLabel: string; themes: string[] } | null;
  recentMatches: PlayerRecentMatchRow[];
};

export type PlayerOverviewViewModel = {
  participation: PlayerOverviewViewModelInput["participation"];
  opportunity: { ratioLabel: string; sparkline: number[]; periodLabels: string[]; trendLabel: string } | null;
  effectivePositions: TouchlinePositionMapEntry[];
  activeDevelopmentFocus: PlayerOverviewViewModelInput["activeDevelopmentFocus"];
  latestObservation: PlayerOverviewViewModelInput["latestObservation"];
  recentMatches: PlayerRecentMatchRow[];
};

export function buildPlayerOverviewViewModel(input: PlayerOverviewViewModelInput): PlayerOverviewViewModel {
  const opportunity = input.recentOpportunity
    ? {
        ratioLabel: `${input.recentOpportunity.recentCount} / ${input.recentOpportunity.recentTotal}`,
        sparkline: input.recentOpportunity.perRound.map((r) => (r.hadOpportunity ? 100 : 0)),
        periodLabels: input.recentOpportunity.perRound.map((r) => r.roundLabel),
        trendLabel: describeOpportunityTrend(input.recentOpportunity),
      }
    : null;

  return {
    participation: input.participation,
    opportunity,
    effectivePositions: input.effectivePositions,
    activeDevelopmentFocus: input.activeDevelopmentFocus,
    latestObservation: input.latestObservation,
    recentMatches: input.recentMatches,
  };
}
