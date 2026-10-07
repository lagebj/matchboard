import { buildSeasonReviewViewModel, type SeasonReviewViewModelInput } from "@/lib/season/season-review-view-model";

/**
 * ADR-0157 C9 golden-state fixture data — Season Review (`09_SEASON_REVIEW.md`). Deterministic,
 * in-memory only; the stories render through the real `buildSeasonReviewViewModel()` selection
 * the production route uses — the fixture demonstrates every accepted story family materially
 * qualifying, never an equal-card metric wall.
 */

const seasonReviewInput: SeasonReviewViewModelInput = {
  leagueSeasonId: "season-1",
  opportunityDistribution: {
    totalPlayers: 42,
    playersWithoutCoreOpportunity: 5,
  },
  supportMovementConcentration: {
    playersWithDisproportionateMovement: 3,
    totalMovements: 14,
    distinctMovementPaths: 6,
  },
  positionalBreadthDevelopment: {
    totalPlayers: 42,
    playersWithEstablishedTrend: 6,
    playersWithEmergingSignal: 9,
  },
  recurringTeamPatterns: {
    teamsConsidered: 4,
    recurringPatternCount: 2,
    newestObservationDate: new Date("2026-10-01T00:00:00Z"),
  },
  unresolvedCoachingThemes: {
    activeDevelopmentFocusCount: 3,
    mostCommonCategoryLabel: "Reset after error",
    mostCommonCategoryCount: 5,
  },
};

export const seasonReviewFixture = {
  leagueSeasonName: "G2015 · Autumn 2026",
  viewModel: buildSeasonReviewViewModel(seasonReviewInput),
};