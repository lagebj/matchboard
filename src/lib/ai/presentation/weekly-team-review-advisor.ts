import "server-only";
import { db } from "@/lib/db";
import { computeSourceFingerprint } from "@/lib/ai/fingerprints";
import { buildWeeklyTeamReviewContext, buildWeeklyTeamReviewScopeId } from "@/lib/ai/context/weekly-team-review";
import { previousCompletedIsoWeekKey } from "@/lib/ai/jobs/scheduled-triggers";
import { buildRefDisplayNameMap, resolveInsightText } from "@/lib/ai/presentation/resolve-insight-text";
import { getOrganisationAiSettings, isAiCapabilityEnabled } from "@/lib/ai/organisation-ai-settings";

const MAX_INSIGHTS = 5;

export type WeeklyTeamReviewDevelopmentSuggestionViewModel = {
  insightId: string;
  /** e.g. "Henrik · positional understanding" (08_UI_UX_SPEC.md: "locally resolved player name"). */
  title: string;
  body: string;
};

export type WeeklyTeamReviewAdvisorViewModel =
  | {
      status: "fresh";
      insights: { title: string; body: string }[];
      suggestions: WeeklyTeamReviewDevelopmentSuggestionViewModel[];
    }
  | { status: "stale" };

/**
 * Builds the "Weekly team review" Advisor block's view model (08_UI_UX_SPEC.md "Weekly review":
 * "Place useful content in existing Insights/Attention-oriented surfaces. Do not add a new
 * top-level navigation item solely for AI.") — folded into the existing Team Review surface
 * (`teams/[teamId]/review`), after its deterministic readiness/rule-impact panels.
 *
 * Always targets the same "previous completed ISO week" the cron scan
 * (`enqueueDueWeeklyTeamReviewJobs`) enqueues reviews for, so the panel and the job that produced
 * its content are always looking at the same week.
 *
 * Returns `null` when there is nothing to show — same empty/disabled rules as the other
 * contextual panels (no connection, AI disabled, `weeklyTeamReviewEnabled` off, or zero useful
 * ACTIVE insights): "no empty Advisor card".
 */
export async function getWeeklyTeamReviewAdvisorViewModel(params: {
  organisationId: string;
  teamId: string;
}): Promise<WeeklyTeamReviewAdvisorViewModel | null> {
  const settings = await getOrganisationAiSettings(params.organisationId);
  if (!settings || !settings.enabled || !settings.activeConnectionId) return null;
  if (!isAiCapabilityEnabled(settings, "WEEKLY_TEAM_REVIEW")) return null;

  const activeConnection = await db.aiProviderConnection.findFirst({
    where: { id: settings.activeConnectionId, organisationId: params.organisationId },
    select: { status: true },
  });
  if (!activeConnection || activeConnection.status !== "READY") return null;

  const weekKey = previousCompletedIsoWeekKey(new Date());
  const scopeId = buildWeeklyTeamReviewScopeId(params.teamId, weekKey);

  const review = await db.aiAdvisorReview.findFirst({
    where: {
      organisationId: params.organisationId,
      scopeType: "TEAM_WEEK",
      scopeId,
      capability: "WEEKLY_TEAM_REVIEW",
      status: "SUCCEEDED",
    },
    orderBy: { completedAt: "desc" },
    include: {
      insights: {
        where: { state: "ACTIVE" },
        orderBy: { createdAt: "asc" },
        take: MAX_INSIGHTS,
      },
    },
  });

  if (!review || review.insights.length === 0) return null;

  const context = await buildWeeklyTeamReviewContext({ organisationId: params.organisationId, scopeId });
  if (!context) return { status: "stale" };

  const currentFingerprint = computeSourceFingerprint(context.normalizedContext);
  if (currentFingerprint !== review.sourceFingerprint) return { status: "stale" };

  const displayNameByRef = await buildRefDisplayNameMap(context.refMap);

  const suggestionInsights = review.insights.filter((i) => i.actionType === "CONFIRM_DEVELOPMENT_OBSERVATION" && i.actionPayload != null);
  const plainInsights = review.insights.filter((i) => i.actionType !== "CONFIRM_DEVELOPMENT_OBSERVATION");

  const suggestionPlayerIds = suggestionInsights
    .map((i) => (i.actionPayload as { playerId?: string } | null)?.playerId)
    .filter((id): id is string => typeof id === "string");
  const suggestionPlayers = suggestionPlayerIds.length
    ? await db.player.findMany({ where: { id: { in: suggestionPlayerIds } }, select: { id: true, firstName: true, lastName: true } })
    : [];
  const suggestionPlayerNameById = new Map(suggestionPlayers.map((p) => [p.id, `${p.firstName} ${p.lastName ?? ""}`.trim()]));

  const insights = plainInsights.map((insight) => ({
    title: resolveInsightText(insight.title, displayNameByRef),
    body: resolveInsightText(insight.body, displayNameByRef),
  }));
  const suggestions = suggestionInsights.flatMap((insight) => {
    const payload = insight.actionPayload as { playerId: string; category: string };
    const playerName = suggestionPlayerNameById.get(payload.playerId);
    if (!playerName) return [];
    return [
      {
        insightId: insight.id,
        title: `${playerName} · ${payload.category}`,
        body: resolveInsightText(insight.body, displayNameByRef),
      },
    ];
  });

  // A player whose suggestion couldn't be resolved (e.g. deleted since the review ran) must not
  // produce a dead/broken affordance — but if that leaves nothing at all to show, this is the
  // same "no useful insights" case as an empty review (08_UI_UX_SPEC.md: "no empty Advisor card").
  if (insights.length === 0 && suggestions.length === 0) return null;

  return { status: "fresh", insights, suggestions };
}
