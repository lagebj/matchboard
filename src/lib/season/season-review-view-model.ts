/**
 * Season Review's `buildSeasonReviewViewModel()` story selector (ADR-0157 slice C7,
 * `09_SEASON_REVIEW.md` "Narrative story selection"). Pure, DB-free: every input here is an
 * already-computed fact/count from an existing canonical owner (`get-season-overview.ts`,
 * `get-season-trend-rollup.ts`, `recurring-theme-facts.ts`, a `DevelopmentThread` count). This
 * module only decides, per fixed semantic family, whether a story is materially eligible and
 * what plain-language sentence to show -- it never calls AI and never invents one composite
 * season score.
 *
 * Family order below IS the stable tiebreak the spec asks for ("semantic categories and stable
 * tiebreaks, not opaque numeric ranking") -- each family is independently eligible or not; when
 * eligible they are emitted in this fixed order, never resorted by a magnitude score.
 */

export type SeasonReviewStoryFamily =
  | "OPPORTUNITY_DISTRIBUTION"
  | "SUPPORT_MOVEMENT_CONCENTRATION"
  | "POSITIONAL_BREADTH_DEVELOPMENT"
  | "RECURRING_TEAM_PATTERNS"
  | "UNRESOLVED_COACHING_THEMES";

export type SeasonReviewStorySupportingVisual = {
  kind: "SIMPLE_SPLIT";
  parts: Array<{ label: string; value: number }>;
};

export type SeasonReviewStory = {
  family: SeasonReviewStoryFamily;
  title: string;
  evidenceStatement: string;
  /** Sample/maturity/coverage disclosure (spec: "A story contains: ... sample/maturity/coverage"). */
  coverageNote: string;
  supportingVisual: SeasonReviewStorySupportingVisual | null;
  exploreHref: string;
};

export type OpportunityDistributionInput = {
  totalPlayers: number;
  playersWithoutCoreOpportunity: number;
};

export type SupportMovementConcentrationInput = {
  playersWithDisproportionateMovement: number;
  totalMovements: number;
  distinctMovementPaths: number;
};

export type PositionalBreadthDevelopmentInput = {
  totalPlayers: number;
  playersWithEstablishedTrend: number;
  playersWithEmergingSignal: number;
};

export type RecurringTeamPatternsInput = {
  teamsConsidered: number;
  recurringPatternCount: number;
  newestObservationDate: Date | null;
};

export type UnresolvedCoachingThemesInput = {
  activeDevelopmentFocusCount: number;
  mostCommonCategoryLabel: string | null;
  mostCommonCategoryCount: number;
};

export type SeasonReviewViewModelInput = {
  leagueSeasonId: string;
  opportunityDistribution: OpportunityDistributionInput;
  supportMovementConcentration: SupportMovementConcentrationInput;
  positionalBreadthDevelopment: PositionalBreadthDevelopmentInput;
  recurringTeamPatterns: RecurringTeamPatternsInput;
  unresolvedCoachingThemes: UnresolvedCoachingThemesInput;
};

export type SeasonReviewViewModel = {
  leagueSeasonId: string;
  stories: SeasonReviewStory[];
};

function tabHref(leagueSeasonId: string, tab: "teams" | "players" | "development" | "opportunity"): string {
  return `?leagueSeasonId=${encodeURIComponent(leagueSeasonId)}&tab=${tab}`;
}

function buildOpportunityDistributionStory(leagueSeasonId: string, input: OpportunityDistributionInput): SeasonReviewStory | null {
  if (input.totalPlayers === 0 || input.playersWithoutCoreOpportunity === 0) return null;
  return {
    family: "OPPORTUNITY_DISTRIBUTION",
    title: "Opportunity distribution",
    evidenceStatement: `${input.playersWithoutCoreOpportunity} of ${input.totalPlayers} players recorded no core-team opportunity this league season.`,
    coverageNote: `Based on finalised selections across ${input.totalPlayers} players this season.`,
    supportingVisual: {
      kind: "SIMPLE_SPLIT",
      parts: [
        { label: "With core opportunity", value: input.totalPlayers - input.playersWithoutCoreOpportunity },
        { label: "Without core opportunity", value: input.playersWithoutCoreOpportunity },
      ],
    },
    exploreHref: tabHref(leagueSeasonId, "opportunity"),
  };
}

function buildSupportMovementConcentrationStory(leagueSeasonId: string, input: SupportMovementConcentrationInput): SeasonReviewStory | null {
  if (input.totalMovements === 0 && input.playersWithDisproportionateMovement === 0) return null;
  return {
    family: "SUPPORT_MOVEMENT_CONCENTRATION",
    title: "Support and movement concentration",
    evidenceStatement:
      input.playersWithDisproportionateMovement > 0
        ? `${input.playersWithDisproportionateMovement} player${input.playersWithDisproportionateMovement === 1 ? "" : "s"} carried a disproportionate share of support or movement assignments, across ${input.distinctMovementPaths} recorded movement path${input.distinctMovementPaths === 1 ? "" : "s"} this season.`
        : `${input.totalMovements} recorded movement${input.totalMovements === 1 ? "" : "s"} across ${input.distinctMovementPaths} path${input.distinctMovementPaths === 1 ? "" : "s"} this season, with no single player carrying a disproportionate share.`,
    coverageNote: `Based on finalised movement-ledger entries this season.`,
    supportingVisual:
      input.totalMovements > 0
        ? { kind: "SIMPLE_SPLIT", parts: [{ label: "Recorded movements", value: input.totalMovements }, { label: "Movement paths", value: input.distinctMovementPaths }] }
        : null,
    exploreHref: tabHref(leagueSeasonId, "teams"),
  };
}

function buildPositionalBreadthDevelopmentStory(leagueSeasonId: string, input: PositionalBreadthDevelopmentInput): SeasonReviewStory | null {
  if (input.playersWithEstablishedTrend === 0 && input.playersWithEmergingSignal === 0) return null;
  const parts: string[] = [];
  if (input.playersWithEstablishedTrend > 0) {
    parts.push(`${input.playersWithEstablishedTrend} player${input.playersWithEstablishedTrend === 1 ? "" : "s"} with an established ADR-0155 trend`);
  }
  if (input.playersWithEmergingSignal > 0) {
    parts.push(`${input.playersWithEmergingSignal} player${input.playersWithEmergingSignal === 1 ? "" : "s"} with an emerging (not-yet-established) signal`);
  }
  return {
    family: "POSITIONAL_BREADTH_DEVELOPMENT",
    title: "Positional breadth and development exposure",
    evidenceStatement: `${parts.join(" and ")} this season.`,
    coverageNote: `Established trends require 6 eligible matches; emerging signals are still accumulating evidence. Out of ${input.totalPlayers} players considered.`,
    supportingVisual: {
      kind: "SIMPLE_SPLIT",
      parts: [
        { label: "Established trend", value: input.playersWithEstablishedTrend },
        { label: "Emerging signal", value: input.playersWithEmergingSignal },
      ],
    },
    exploreHref: tabHref(leagueSeasonId, "development"),
  };
}

function buildRecurringTeamPatternsStory(leagueSeasonId: string, input: RecurringTeamPatternsInput): SeasonReviewStory | null {
  if (input.recurringPatternCount === 0) return null;
  return {
    family: "RECURRING_TEAM_PATTERNS",
    title: "Recurring tactical and team patterns",
    evidenceStatement: `${input.recurringPatternCount} recurring tactical pattern${input.recurringPatternCount === 1 ? "" : "s"} identified across ${input.teamsConsidered} team${input.teamsConsidered === 1 ? "" : "s"} this season (the same phase evidenced in 2 or more matches).`,
    coverageNote: input.newestObservationDate
      ? `Newest contributing observation recorded ${input.newestObservationDate.toISOString().slice(0, 10)}.`
      : "Based on deduplicated coach-reported qualitative evidence from recent locked matches.",
    supportingVisual: null,
    exploreHref: tabHref(leagueSeasonId, "teams"),
  };
}

function buildUnresolvedCoachingThemesStory(leagueSeasonId: string, input: UnresolvedCoachingThemesInput): SeasonReviewStory | null {
  if (input.activeDevelopmentFocusCount === 0) return null;
  return {
    family: "UNRESOLVED_COACHING_THEMES",
    title: "Unresolved coaching and development themes",
    evidenceStatement:
      input.mostCommonCategoryLabel && input.mostCommonCategoryCount > 0
        ? `${input.activeDevelopmentFocusCount} active development focus${input.activeDevelopmentFocusCount === 1 ? "" : "es"} are being tracked across the squad, most commonly ${input.mostCommonCategoryLabel} (${input.mostCommonCategoryCount}).`
        : `${input.activeDevelopmentFocusCount} active development focus${input.activeDevelopmentFocusCount === 1 ? "" : "es"} are being tracked across the squad.`,
    coverageNote: "Based on currently active development threads.",
    supportingVisual: null,
    exploreHref: tabHref(leagueSeasonId, "development"),
  };
}

/** Three to five evidence-backed Overview stories, in fixed family order, omitting any family
 * whose underlying evidence is not materially different from the neutral/expected state (the
 * spec's own eligibility rule -- a count of zero is never padded into a story). */
export function buildSeasonReviewViewModel(input: SeasonReviewViewModelInput): SeasonReviewViewModel {
  const stories = [
    buildOpportunityDistributionStory(input.leagueSeasonId, input.opportunityDistribution),
    buildSupportMovementConcentrationStory(input.leagueSeasonId, input.supportMovementConcentration),
    buildPositionalBreadthDevelopmentStory(input.leagueSeasonId, input.positionalBreadthDevelopment),
    buildRecurringTeamPatternsStory(input.leagueSeasonId, input.recurringTeamPatterns),
    buildUnresolvedCoachingThemesStory(input.leagueSeasonId, input.unresolvedCoachingThemes),
  ].filter((s): s is SeasonReviewStory => s !== null);

  return { leagueSeasonId: input.leagueSeasonId, stories };
}
