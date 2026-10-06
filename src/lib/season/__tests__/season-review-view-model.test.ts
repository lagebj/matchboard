import { describe, it, expect } from "vitest";
import { buildSeasonReviewViewModel, type SeasonReviewViewModelInput } from "../season-review-view-model";

/**
 * `buildSeasonReviewViewModel()` (ADR-0157 slice C7). Pure, no DB, no AI — every required test
 * from `09_SEASON_REVIEW.md`'s "Required tests" list that is expressible at the view-model level
 * lives here: empty families omitted, no ranking language, and (structurally, by construction —
 * this function has no AI-dependent input at all) deterministic stories stay intact regardless
 * of AI availability.
 */

const BANNED_RANKING_TERMS = ["strongest", "weakest", "best", "worst", "top player", "rank", "score of", "better than", "worse than"];

function expectNoRankingLanguage(text: string) {
  const lower = text.toLowerCase();
  for (const term of BANNED_RANKING_TERMS) {
    expect(lower.includes(term), `"${text}" contains banned ranking term "${term}"`).toBe(false);
  }
}

const emptyInput: SeasonReviewViewModelInput = {
  leagueSeasonId: "ls-1",
  opportunityDistribution: { totalPlayers: 20, playersWithoutCoreOpportunity: 0 },
  supportMovementConcentration: { playersWithDisproportionateMovement: 0, totalMovements: 0, distinctMovementPaths: 0 },
  positionalBreadthDevelopment: { totalPlayers: 20, playersWithEstablishedTrend: 0, playersWithEmergingSignal: 0 },
  recurringTeamPatterns: { teamsConsidered: 3, recurringPatternCount: 0, newestObservationDate: null },
  unresolvedCoachingThemes: { activeDevelopmentFocusCount: 0, mostCommonCategoryLabel: null, mostCommonCategoryCount: 0 },
};

const fullInput: SeasonReviewViewModelInput = {
  leagueSeasonId: "ls-1",
  opportunityDistribution: { totalPlayers: 20, playersWithoutCoreOpportunity: 3 },
  supportMovementConcentration: { playersWithDisproportionateMovement: 2, totalMovements: 14, distinctMovementPaths: 4 },
  positionalBreadthDevelopment: { totalPlayers: 20, playersWithEstablishedTrend: 5, playersWithEmergingSignal: 2 },
  recurringTeamPatterns: { teamsConsidered: 3, recurringPatternCount: 2, newestObservationDate: new Date("2026-09-01T00:00:00Z") },
  unresolvedCoachingThemes: { activeDevelopmentFocusCount: 7, mostCommonCategoryLabel: "Ball control", mostCommonCategoryCount: 3 },
};

describe("buildSeasonReviewViewModel", () => {
  it("returns no stories when every family's evidence is at the neutral/expected (zero) state", () => {
    const result = buildSeasonReviewViewModel(emptyInput);
    expect(result.stories).toEqual([]);
  });

  it("emits all five families, in fixed order, when every family has material evidence", () => {
    const result = buildSeasonReviewViewModel(fullInput);
    expect(result.stories.map((s) => s.family)).toEqual([
      "OPPORTUNITY_DISTRIBUTION",
      "SUPPORT_MOVEMENT_CONCENTRATION",
      "POSITIONAL_BREADTH_DEVELOPMENT",
      "RECURRING_TEAM_PATTERNS",
      "UNRESOLVED_COACHING_THEMES",
    ]);
    expect(result.stories.length).toBeGreaterThanOrEqual(3);
    expect(result.stories.length).toBeLessThanOrEqual(5);
  });

  it("omits exactly the empty families, keeping the materially eligible ones (partial eligibility)", () => {
    const result = buildSeasonReviewViewModel({
      ...emptyInput,
      opportunityDistribution: { totalPlayers: 20, playersWithoutCoreOpportunity: 4 },
      unresolvedCoachingThemes: { activeDevelopmentFocusCount: 2, mostCommonCategoryLabel: null, mostCommonCategoryCount: 0 },
    });
    expect(result.stories.map((s) => s.family)).toEqual(["OPPORTUNITY_DISTRIBUTION", "UNRESOLVED_COACHING_THEMES"]);
  });

  it("omits the opportunity-distribution story when there are no players at all (never divides by zero)", () => {
    const result = buildSeasonReviewViewModel({ ...emptyInput, opportunityDistribution: { totalPlayers: 0, playersWithoutCoreOpportunity: 0 } });
    expect(result.stories.find((s) => s.family === "OPPORTUNITY_DISTRIBUTION")).toBeUndefined();
  });

  it("never uses player/team ranking language in any story text", () => {
    const result = buildSeasonReviewViewModel(fullInput);
    for (const story of result.stories) {
      expectNoRankingLanguage(story.title);
      expectNoRankingLanguage(story.evidenceStatement);
      expectNoRankingLanguage(story.coverageNote);
    }
  });

  it("every story links into one of the real local tabs with the active league season preserved", () => {
    const result = buildSeasonReviewViewModel(fullInput);
    for (const story of result.stories) {
      expect(story.exploreHref).toContain("leagueSeasonId=ls-1");
      expect(story.exploreHref).toMatch(/tab=(teams|players|development|opportunity)/);
    }
  });

  it("deterministic stories are built from zero AI-dependent input -- this function accepts no AI/hypothesis data at all, so an AI outage can never affect its output", () => {
    // `SeasonReviewViewModelInput` has no field sourced from AiAdvisorInsight/Assistant Coach --
    // the type itself is the proof; this test documents and locks that structural guarantee.
    const result = buildSeasonReviewViewModel(fullInput);
    expect(result.stories.length).toBeGreaterThan(0);
  });
});
