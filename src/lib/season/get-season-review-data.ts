import { db } from "@/lib/db";
import {
  getSeasonPlayerRoundMatrix,
  getSeasonFairnessWarnings,
  getMovementPathSummary,
  type MovementPathRow,
} from "@/lib/selection/get-season-overview";
import { getSeasonTrendRollup, type SeasonTrendRollup } from "@/lib/season/get-season-trend-rollup";
import {
  findRecentLockedMatches,
  getQualitativeEvidenceForMatches,
  dedupeQualitativeObservationsByStatement,
} from "@/lib/evidence/qualitative-evidence-service";
import { computeRecurringThemePhaseSummaries, type RecurringThemePhaseSummary } from "@/lib/evidence/recurring-theme-facts";
import { getDevelopmentCycleReviewAdvisorViewModel } from "@/lib/ai/presentation/development-cycle-review-advisor";
import { DEVELOPMENT_FOCUS_CATEGORY_LABELS, type DevelopmentFocusCategory } from "@/lib/coaching/development-thread-categories";
import type { SeasonReviewViewModelInput } from "@/lib/season/season-review-view-model";

/**
 * Season Review's server-side data assembly (ADR-0157 slice C7). Composes already-existing
 * canonical owners only -- `get-season-overview.ts` (matrix/fairness/movement),
 * `get-season-trend-rollup.ts` (ADR-0155 persisted trends), `recurring-theme-facts.ts` (weekly
 * team review's deterministic accumulation), `development-cycle-review-advisor.ts` (ADR-0156
 * cycle reviews). It never recomputes domain truth and never issues one query per player -- the
 * only per-row loop here is over this organisation's teams, a small, bounded set (unlike player
 * count, team count does not grow with season length), matching the same discipline
 * `get-movement-path-summary` and `getSeasonFairnessWarnings` already use at season scope.
 */

// Same window/cap weekly_team_review's own recurring-theme aggregate uses (bundle §18) -- kept
// local rather than re-exported from that AI-context module, which is not a presentation-layer
// dependency Season Review should take on.
const RECURRING_THEME_WINDOW_DAYS = 42;
const RECURRING_THEME_MAX_MATCHES = 8;
const RECURRING_THEME_MIN_MATCH_COUNT = 2;
const RECURRING_THEME_MAX_ITEMS = 10;

export type SeasonReviewTeamSummary = {
  teamId: string;
  teamName: string;
  supportSent: number;
  supportReceived: number;
  recurringPatterns: RecurringThemePhaseSummary[];
};

export type SeasonReviewDevelopmentFocusCategoryCount = {
  category: DevelopmentFocusCategory;
  label: string;
  count: number;
};

export type SeasonReviewNextFocusItem = {
  title: string;
  body: string;
};

export type SeasonReviewDevelopmentCycleReviewSummary = {
  teamId: string;
  teamName: string;
  windowLabel: string;
  summary: string | null;
};

export type SeasonReviewDevelopmentData = {
  trendRollup: SeasonTrendRollup;
  activeDevelopmentFocusCount: number;
  developmentFocusByCategory: SeasonReviewDevelopmentFocusCategoryCount[];
  /** AI-sourced (`AiAdvisorInsight.analysisRole = NEXT_FOCUS`) -- the UI must label this clearly
   * as AI/hypothesis content, never deterministic evidence. */
  unresolvedNextFocus: SeasonReviewNextFocusItem[];
  /** AI-sourced (ADR-0156 development-cycle review) -- same labelling requirement. */
  developmentCycleReviews: SeasonReviewDevelopmentCycleReviewSummary[];
};

export type SeasonReviewData = {
  leagueSeasonId: string;
  leagueSeasonName: string;
  overviewInput: SeasonReviewViewModelInput;
  teams: SeasonReviewTeamSummary[];
  movementPaths: MovementPathRow[];
  development: SeasonReviewDevelopmentData;
};

export async function getSeasonReviewData(organisationId: string, leagueSeasonId: string): Promise<SeasonReviewData | null> {
  const leagueSeason = await db.leagueSeason.findFirst({
    where: { id: leagueSeasonId, organisationId },
    select: { id: true, name: true, endDate: true },
  });
  if (!leagueSeason) return null;

  const teams = await db.team.findMany({
    where: { organisationId, archivedAt: null },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const [matrix, fairnessWarnings, movementPaths, seasonMatches] = await Promise.all([
    getSeasonPlayerRoundMatrix(leagueSeasonId, false),
    getSeasonFairnessWarnings(leagueSeasonId, false),
    getMovementPathSummary(leagueSeasonId, false),
    db.match.findMany({ where: { organisationId, matchRound: { leagueSeasonId } }, select: { id: true } }),
  ]);

  const totalPlayers = matrix.players.length;
  const playersWithoutCoreOpportunity = matrix.players.filter((p) => p.coreMatches === 0).length;

  const CONCENTRATION_RULES = new Set(["team_disproportionate_support", "repeated_double_load", "team_round_disproportionate_support"]);
  const playersWithDisproportionateMovement = new Set(
    fairnessWarnings.filter((w) => w.playerId && CONCENTRATION_RULES.has(w.rule)).map((w) => w.playerId!),
  ).size;
  const totalMovements = movementPaths.reduce((sum, p) => sum + p.count, 0);

  // Batched -- one `getSeasonTrendRollup` call across every player in scope, never one call per player.
  const trendRollup = await getSeasonTrendRollup(organisationId, matrix.players.map((p) => p.playerId));

  // Bounded per-team loop (team count, not player/match count) for the deterministic recurring-
  // theme accumulation already owned by `weekly_team_review`'s context builder.
  const teamSummaries: SeasonReviewTeamSummary[] = [];
  let totalRecurringPatterns = 0;
  let newestObservationDate: Date | null = null;

  for (const team of teams) {
    const recentMatches = await findRecentLockedMatches(team.id, organisationId, leagueSeason.endDate, RECURRING_THEME_WINDOW_DAYS, RECURRING_THEME_MAX_MATCHES);
    const observations =
      recentMatches.length > 0
        ? dedupeQualitativeObservationsByStatement(await getQualitativeEvidenceForMatches(recentMatches.map((m) => m.id), organisationId))
        : [];
    const recurringPatterns = computeRecurringThemePhaseSummaries(observations, recentMatches, {
      minMatchCount: RECURRING_THEME_MIN_MATCH_COUNT,
      maxItems: RECURRING_THEME_MAX_ITEMS,
    });
    totalRecurringPatterns += recurringPatterns.length;
    for (const pattern of recurringPatterns) {
      if (!newestObservationDate || pattern.newestObservationDate > newestObservationDate) {
        newestObservationDate = pattern.newestObservationDate;
      }
    }

    const supportSent = movementPaths.filter((p) => p.fromTeamId === team.id).reduce((sum, p) => sum + p.count, 0);
    const supportReceived = movementPaths.filter((p) => p.toTeamId === team.id).reduce((sum, p) => sum + p.count, 0);

    teamSummaries.push({ teamId: team.id, teamName: team.name, supportSent, supportReceived, recurringPatterns });
  }

  const activeDevelopmentThreads = await db.developmentThread.findMany({
    where: { organisationId, status: "ACTIVE" },
    select: { category: true },
  });
  const categoryCounts = new Map<string, number>();
  for (const t of activeDevelopmentThreads) {
    if (!t.category) continue;
    categoryCounts.set(t.category, (categoryCounts.get(t.category) ?? 0) + 1);
  }
  const developmentFocusByCategory: SeasonReviewDevelopmentFocusCategoryCount[] = [...categoryCounts.entries()]
    .map(([category, count]) => ({ category: category as DevelopmentFocusCategory, label: DEVELOPMENT_FOCUS_CATEGORY_LABELS[category as DevelopmentFocusCategory] ?? category, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  const mostCommonCategory = developmentFocusByCategory[0] ?? null;

  const matchIds = seasonMatches.map((m) => m.id);
  const unresolvedNextFocusInsights = matchIds.length
    ? await db.aiAdvisorInsight.findMany({
        where: {
          organisationId,
          analysisRole: "NEXT_FOCUS",
          state: "ACTIVE",
          review: { scopeType: "MATCH", scopeId: { in: matchIds }, capability: "POST_MATCH_REVIEW", status: "SUCCEEDED" },
        },
        select: { title: true, body: true },
        take: 20,
      })
    : [];

  // Bounded per-team loop, same team-count discipline as the recurring-theme block above.
  const developmentCycleReviews: SeasonReviewDevelopmentCycleReviewSummary[] = [];
  for (const team of teams) {
    const review = await getDevelopmentCycleReviewAdvisorViewModel({ organisationId, teamId: team.id });
    if (review) developmentCycleReviews.push({ teamId: team.id, teamName: team.name, windowLabel: review.windowLabel, summary: review.summary });
  }

  const overviewInput: SeasonReviewViewModelInput = {
    leagueSeasonId,
    opportunityDistribution: { totalPlayers, playersWithoutCoreOpportunity },
    supportMovementConcentration: {
      playersWithDisproportionateMovement,
      totalMovements,
      distinctMovementPaths: movementPaths.length,
    },
    positionalBreadthDevelopment: {
      totalPlayers,
      playersWithEstablishedTrend: trendRollup.playersWithEstablishedTrend,
      playersWithEmergingSignal: trendRollup.playersWithEmergingSignal,
    },
    recurringTeamPatterns: { teamsConsidered: teams.length, recurringPatternCount: totalRecurringPatterns, newestObservationDate },
    unresolvedCoachingThemes: {
      activeDevelopmentFocusCount: activeDevelopmentThreads.length,
      mostCommonCategoryLabel: mostCommonCategory?.label ?? null,
      mostCommonCategoryCount: mostCommonCategory?.count ?? 0,
    },
  };

  return {
    leagueSeasonId,
    leagueSeasonName: leagueSeason.name,
    overviewInput,
    teams: teamSummaries,
    movementPaths,
    development: {
      trendRollup,
      activeDevelopmentFocusCount: activeDevelopmentThreads.length,
      developmentFocusByCategory,
      unresolvedNextFocus: unresolvedNextFocusInsights,
      developmentCycleReviews,
    },
  };
}
