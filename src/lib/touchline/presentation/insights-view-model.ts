/**
 * Insights overview presentation view model (Touchline Design Atlas,
 * `07_ROUTE_COMPOSITION_PLAYERS_INSIGHTS.md §C`, `03_DATA_PROVENANCE_AND_VIEW_MODELS.md §5`).
 *
 * Composes the existing evidence-family functions into four narrative groups — never a metrics
 * dashboard of equal-weight tiles. Each group carries at most one primary story and up to two
 * compact supporting stories, plus a route to the existing detail page. This module performs NO
 * evidence computation itself — every confidence/sample value below is read verbatim from the
 * real evidence engine output; only grouping/ordering is derived here.
 *
 * Sources:
 * - opportunityGap        -> EXISTING_QUERYABLE (getOpportunityGap(), src/lib/insights/opportunity-gap.ts)
 * - loadTimeline           -> EXISTING_QUERYABLE (getLoadTimeline(), src/lib/insights/load-timeline.ts)
 * - positionExposure       -> EXISTING_QUERYABLE (getPositionExposure(), src/lib/insights/position-exposure.ts)
 * - continuity             -> EXISTING_QUERYABLE (getContinuityReview(), src/lib/insights/continuity-review.ts)
 * - matchPhasePatterns     -> EXISTING_QUERYABLE (getTeamSeasonMatchPhasePatterns(), src/lib/evidence/match-phase-pattern-evidence.ts)
 * - playerCombinations     -> EXISTING_QUERYABLE (getPlayerCombinations(), src/lib/insights/player-combinations.ts)
 * - plannedVsActual        -> EXISTING_QUERYABLE (getPlannedVsActualDeltas(), src/lib/insights/planned-vs-actual-delta.ts)
 * - policyWarnings         -> EXISTING_QUERYABLE (getPolicyWarningReview(), src/lib/insights/policy-warning-review.ts)
 * - conflicts              -> EXISTING_QUERYABLE (getConflictReview(), src/lib/insights/conflict-review.ts)
 * - operationalHealth      -> EXISTING_QUERYABLE (getOperationalHealth(), src/lib/insights/operational-health.ts)
 * Derived:
 * - four narrative groups  -> DERIVED_PRESENTATION (grouping/story-selection only; no new numbers)
 */

export type EvidenceConfidence = "INSUFFICIENT" | "EMERGING" | "ESTABLISHED";

export interface InsightsStory {
  id: string;
  label: string;
  title: string;
  value?: string;
  valueCaption?: string;
  sample?: string;
  confidence?: EvidenceConfidence | null;
  interpretation?: string;
  detailHref: string;
}

export interface InsightsGroupInput {
  key: "opportunity_load" | "roles_development" | "match_patterns" | "planning_quality";
  title: string;
  exploreHref: string;
  stories: InsightsStory[]; // caller supplies already-ranked candidate stories for this group
}

export interface InsightsGroupViewModel {
  key: InsightsGroupInput["key"];
  title: string;
  exploreHref: string;
  primary: InsightsStory | null;
  supporting: InsightsStory[]; // at most 2
}

export interface InsightsViewModel {
  groups: InsightsGroupViewModel[];
}

const MAX_SUPPORTING = 2;

export function buildInsightsOverviewViewModel(inputGroups: InsightsGroupInput[]): InsightsViewModel {
  const groups = inputGroups.map((group): InsightsGroupViewModel => {
    const [primary, ...rest] = group.stories;
    return {
      key: group.key,
      title: group.title,
      exploreHref: group.exploreHref,
      primary: primary ?? null,
      supporting: rest.slice(0, MAX_SUPPORTING),
    };
  });
  return { groups };
}
