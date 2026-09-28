import "server-only";
import { db } from "@/lib/db";
import { parseDevelopmentCycleScopeId } from "@/lib/ai/context/development-cycle-review";
import { buildRefDisplayNameMap, parsePersistedRefMap, resolveInsightText } from "@/lib/ai/presentation/resolve-insight-text";
import { getOrganisationAiSettings, isAiCapabilityEnabled } from "@/lib/ai/organisation-ai-settings";

/**
 * Builds the "Learning cycle" Advisor block's view model (bundle §13 "Presentation": "Team:
 * latest cycle summary appears in existing Assistant Coach/team review surface. Do not create a
 * new top-level navigation page") — folded into the same Team Review surface
 * (`teams/[teamId]/review`) that renders the weekly review panel, after it.
 *
 * Unlike the weekly view model (which always targets the one previous-completed ISO week both
 * it and the cron scan agree on), a team's cycle reviews are immutable per-window snapshots
 * (bundle §14): the panel always shows the *latest SUCCEEDED* review for this team, whatever
 * window it belongs to, plus that window's own date range — history is never rewritten, and a
 * newer window with no review yet never hides the last real one. There is deliberately no
 * staleness/freshness check here: an older window's review being "stale" relative to matches
 * recorded *after* its window ended is exactly what an immutable snapshot is supposed to be.
 *
 * Returns `null` when there is nothing to show — same empty/disabled rules as every other
 * contextual panel (AI disabled, capability off, no active READY connection, or no SUCCEEDED
 * review with ACTIVE insights): "no empty Advisor card".
 */

const MAX_INSIGHTS = 10;

export type DevelopmentCycleReviewAdvisorViewModel = {
  status: "fresh";
  /** e.g. "Learning cycle · 31 Mar – 5 May 2025" (bundle 08_UI_STATES_AND_COPY.md "Learning
   * cycle: Title: `Learning cycle · <date range>`"). */
  windowLabel: string;
  summary: string | null;
  insights: { title: string; body: string }[];
};

function formatRangeLabel(windowStart: Date, windowEnd: Date): string {
  const sameYear = windowStart.getUTCFullYear() === windowEnd.getUTCFullYear();
  const startLabel = sameYear
    ? windowStart.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })
    : windowStart.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  const endLabel = windowEnd.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  return `Learning cycle · ${startLabel} – ${endLabel}`;
}

export async function getDevelopmentCycleReviewAdvisorViewModel(params: {
  organisationId: string;
  teamId: string;
}): Promise<DevelopmentCycleReviewAdvisorViewModel | null> {
  const settings = await getOrganisationAiSettings(params.organisationId);
  if (!settings || !settings.enabled || !settings.activeConnectionId) return null;
  if (!isAiCapabilityEnabled(settings, "DEVELOPMENT_CYCLE_REVIEW")) return null;

  const activeConnection = await db.aiProviderConnection.findFirst({
    where: { id: settings.activeConnectionId, organisationId: params.organisationId },
    select: { status: true },
  });
  if (!activeConnection || activeConnection.status !== "READY") return null;

  const review = await db.aiAdvisorReview.findFirst({
    where: {
      organisationId: params.organisationId,
      scopeType: "TEAM_WINDOW",
      capability: "DEVELOPMENT_CYCLE_REVIEW",
      status: "SUCCEEDED",
    },
    orderBy: { completedAt: "desc" },
    include: {
      insights: {
        where: { state: "ACTIVE", actionType: "NONE" },
        orderBy: { displayOrder: "asc" },
        take: MAX_INSIGHTS,
      },
    },
  });

  // Every insight in a cycle review whose subject parses to this team's scope — a multi-team
  // organisation could in principle hold another team's review; the parse keeps us scoped.
  if (!review || review.insights.length === 0) return null;
  const parsed = parseDevelopmentCycleScopeId(review.scopeId);
  if (!parsed || parsed.teamId !== params.teamId) return null;

  // Resolve against the review's own persisted refMap (the exact map this review's ref tokens
  // were assigned from — correct even though the current date's window differs from the
  // review's historical one, which is exactly why the context is NOT rebuilt here). A
  // pre-column review (null refMap) falls back to raw tokens rather than a rebuilt map that
  // would be built from a *different* window's participant set.
  const persistedRefMap = parsePersistedRefMap(review.refMap);
  const displayNameByRef = persistedRefMap ? await buildRefDisplayNameMap(persistedRefMap) : new Map<string, string>();

  const insights = review.insights.map((insight) => ({
    title: resolveInsightText(insight.title, displayNameByRef),
    body: resolveInsightText(insight.body, displayNameByRef),
  }));

  if (insights.length === 0) return null;

  return {
    status: "fresh",
    windowLabel: formatRangeLabel(parsed.windowStart, parsed.windowEnd),
    summary: review.summary,
    insights,
  };
}