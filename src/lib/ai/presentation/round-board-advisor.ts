import "server-only";
import { db } from "@/lib/db";
import { computeSourceFingerprint } from "@/lib/ai/fingerprints";
import { buildRoundReviewContext } from "@/lib/ai/context/round-review";
import { buildRefDisplayNameMap, resolveInsightText } from "@/lib/ai/presentation/resolve-insight-text";
import { getOrganisationAiSettings, isAiCapabilityEnabled } from "@/lib/ai/organisation-ai-settings";

const MAX_INSIGHTS = 5;

export type RoundBoardAdvisorViewModel =
  | { status: "fresh"; insights: { title: string; body: string }[] }
  | { status: "stale" };

/**
 * Builds the Round Board's compact "AI Advisor" block (08_UI_UX_SPEC.md "Round Board": "Do not
 * add an always-present AI lane. If `round_review` has useful insights, show a compact Advisor
 * block in the decision/exception area. Deterministic allocation exceptions remain primary.").
 *
 * Returns `null` when there is nothing to show — same empty/disabled rules as the other
 * contextual panels (no connection, AI disabled, `roundReviewEnabled` off, or zero useful
 * ACTIVE insights): "no empty Advisor card".
 */
export async function getRoundBoardAdvisorViewModel(params: {
  organisationId: string;
  matchRoundId: string;
}): Promise<RoundBoardAdvisorViewModel | null> {
  const settings = await getOrganisationAiSettings(params.organisationId);
  if (!settings || !settings.enabled || !settings.activeConnectionId) return null;
  if (!isAiCapabilityEnabled(settings, "ROUND_REVIEW")) return null;

  const activeConnection = await db.aiProviderConnection.findFirst({
    where: { id: settings.activeConnectionId, organisationId: params.organisationId },
    select: { status: true },
  });
  if (!activeConnection || activeConnection.status !== "READY") return null;

  const review = await db.aiAdvisorReview.findFirst({
    where: {
      organisationId: params.organisationId,
      scopeType: "MATCH_ROUND",
      scopeId: params.matchRoundId,
      capability: "ROUND_REVIEW",
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

  const context = await buildRoundReviewContext({ organisationId: params.organisationId, scopeId: params.matchRoundId });
  if (!context) return { status: "stale" };

  const currentFingerprint = computeSourceFingerprint(context.normalizedContext);
  if (currentFingerprint !== review.sourceFingerprint) return { status: "stale" };

  const displayNameByRef = await buildRefDisplayNameMap(context.refMap);

  const insights = review.insights.map((insight) => ({
    title: resolveInsightText(insight.title, displayNameByRef),
    body: resolveInsightText(insight.body, displayNameByRef),
  }));

  return { status: "fresh", insights };
}
