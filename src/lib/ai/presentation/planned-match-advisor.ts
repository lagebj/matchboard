import "server-only";
import { db } from "@/lib/db";
import type { AiAdvisorCapability } from "@/generated/prisma/client";
import { computeSourceFingerprint } from "@/lib/ai/fingerprints";
import { buildLineupReviewContext } from "@/lib/ai/context/lineup-review";
import { buildMatchPrepContext } from "@/lib/ai/context/match-prep";
import { buildRefDisplayNameMap, resolveInsightText } from "@/lib/ai/presentation/resolve-insight-text";
import { getOrganisationAiSettings, isAiCapabilityEnabled } from "@/lib/ai/organisation-ai-settings";

const MAX_INSIGHTS = 5;

const CAPABILITY_LABEL: Record<"LINEUP_REVIEW" | "MATCH_PREP", string> = {
  LINEUP_REVIEW: "Line-up and rotation review",
  MATCH_PREP: "Match preparation",
};

const CONTEXT_BUILDER: Record<"LINEUP_REVIEW" | "MATCH_PREP", (params: { organisationId: string; scopeId: string }) => ReturnType<typeof buildLineupReviewContext>> = {
  LINEUP_REVIEW: buildLineupReviewContext,
  MATCH_PREP: buildMatchPrepContext,
};

export type PlannedMatchAdvisorViewModel =
  | {
      status: "fresh";
      capabilityLabel: string;
      // `kind`/`evidenceRefs` are additive (ADR-0149, Match Insights PR 4) -- already fetched on
      // every insight row (no `select` clause below), just not previously surfaced. Existing
      // consumers (`AdvisorPanel`) only read `title`/`body` and are unaffected.
      insights: { title: string; body: string; kind: string; evidenceRefs: string[] }[];
    }
  | { status: "stale" };

/**
 * Builds the "planned match" Advisor panel's view model (08_UI_UX_SPEC.md: "one compact Advisor
 * panel after primary plan facts when a useful persisted `lineup_review`/`match_prep` review
 * exists"). Returns `null` whenever there is nothing to show at all — no connection, no review,
 * or a review with zero active insights (01_LOCKED_DECISIONS.md #11: "no useful insights -> no
 * empty AI section").
 *
 * Freshness (`"Plan changed · Advisor update pending"` vs. showing the review) is decided by
 * rebuilding the same capability's context right now and comparing its fingerprint to the
 * persisted review's `sourceFingerprint` — never by trusting the review's age alone. Rebuilding
 * this context is also what makes locally resolving the review's `P01`/`M01`-style ref tokens
 * back to real names possible (see `resolve-insight-text.ts`): a fingerprint match guarantees the
 * freshly-rebuilt `refMap` is identical to the one the review was originally generated from.
 */
export async function getPlannedMatchAdvisorViewModel(params: {
  organisationId: string;
  matchId: string;
}): Promise<PlannedMatchAdvisorViewModel | null> {
  const settings = await getOrganisationAiSettings(params.organisationId);
  if (!settings || !settings.enabled || !settings.activeConnectionId) return null;
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
      capability: { in: ["LINEUP_REVIEW", "MATCH_PREP"] satisfies AiAdvisorCapability[] },
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
  if (!isAiCapabilityEnabled(settings, review.capability)) return null;

  const capability = review.capability as "LINEUP_REVIEW" | "MATCH_PREP";
  const context = await CONTEXT_BUILDER[capability]({ organisationId: params.organisationId, scopeId: params.matchId });
  if (!context) return { status: "stale" };

  const currentFingerprint = computeSourceFingerprint(context.normalizedContext);
  if (currentFingerprint !== review.sourceFingerprint) return { status: "stale" };

  const displayNameByRef = await buildRefDisplayNameMap(context.refMap);

  return {
    status: "fresh",
    capabilityLabel: CAPABILITY_LABEL[capability],
    insights: review.insights.map((insight) => ({
      title: resolveInsightText(insight.title, displayNameByRef),
      body: resolveInsightText(insight.body, displayNameByRef),
      kind: insight.kind,
      evidenceRefs: Array.isArray(insight.evidenceRefs) ? insight.evidenceRefs.filter((r): r is string => typeof r === "string") : [],
    })),
  };
}
