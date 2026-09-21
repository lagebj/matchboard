import "server-only";
import { db } from "@/lib/db";
import { computeSourceFingerprint } from "@/lib/ai/fingerprints";
import { buildPostMatchReviewContext } from "@/lib/ai/context/post-match-review";
import { buildRefDisplayNameMap, resolveInsightText } from "@/lib/ai/presentation/resolve-insight-text";
import { getOrganisationAiSettings, isAiCapabilityEnabled } from "@/lib/ai/organisation-ai-settings";

const MAX_INSIGHTS = 5;

export type DevelopmentSuggestionViewModel = {
  insightId: string;
  /** e.g. "Henrik · positional understanding" (08_UI_UX_SPEC.md: "locally resolved player name"). */
  title: string;
  body: string;
};

export type CompletedMatchAdvisorViewModel =
  | {
      status: "fresh";
      insights: { title: string; body: string }[];
      suggestions: DevelopmentSuggestionViewModel[];
    }
  | { status: "stale" };

/**
 * Builds the "completed match" Advisor panel's view model (08_UI_UX_SPEC.md "Completed match":
 * canonical result/report facts first, Post-match AI Advisor after them). Returns `null` when
 * there is nothing to show at all — same empty/disabled rules as the planned-match panel (no
 * connection, AI disabled, `postMatchReviewEnabled` off, or zero useful ACTIVE insights).
 *
 * Unlike the planned-match panel, a "development suggestion" insight
 * (`kind: DEVELOPMENT_SUGGESTION`, `actionType: CONFIRM_DEVELOPMENT_OBSERVATION`) is not just
 * displayed — it carries a real, already-resolved `actionPayload.playerId`/`category`/
 * `observation` the coach can act on via `ai-insight-actions.ts`. It is surfaced separately from
 * plain observation insights so the panel/UI can render its distinct "Confirm as development
 * observation" / "Dismiss" affordance (01_LOCKED_DECISIONS.md #15: "becomes canonical only after
 * explicit coach confirmation").
 */
export async function getCompletedMatchAdvisorViewModel(params: {
  organisationId: string;
  matchId: string;
}): Promise<CompletedMatchAdvisorViewModel | null> {
  const settings = await getOrganisationAiSettings(params.organisationId);
  if (!settings || !settings.enabled || !settings.activeConnectionId) return null;
  if (!isAiCapabilityEnabled(settings, "POST_MATCH_REVIEW")) return null;

  const activeConnection = await db.aiProviderConnection.findFirst({
    where: { id: settings.activeConnectionId, organisationId: params.organisationId },
    select: { status: true },
  });
  if (!activeConnection || activeConnection.status !== "READY") return null;

  const review = await db.aiAdvisorReview.findFirst({
    where: {
      organisationId: params.organisationId,
      scopeType: "MATCH",
      scopeId: params.matchId,
      capability: "POST_MATCH_REVIEW",
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

  const context = await buildPostMatchReviewContext({ organisationId: params.organisationId, scopeId: params.matchId });
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
