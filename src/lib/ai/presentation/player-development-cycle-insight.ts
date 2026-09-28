import "server-only";
import { db } from "@/lib/db";
import { parseDevelopmentCycleScopeId } from "@/lib/ai/context/development-cycle-review";
import { buildRefDisplayNameMap, parsePersistedRefMap, resolveInsightText } from "@/lib/ai/presentation/resolve-insight-text";
import { getOrganisationAiSettings, isAiCapabilityEnabled } from "@/lib/ai/organisation-ai-settings";

/**
 * Player Detail > Development: the latest relevant player-specific cycle insight, with its date
 * window and an evidence link (bundle §13 "Presentation": "Player Detail > Development: show
 * latest relevant player-specific cycle insight with date window and evidence link"). The
 * evidence link points at the team's Review surface — the one place the full cycle summary and
 * its evidence refs are rendered (bundle §13 "Team: latest cycle summary appears in existing
 * Assistant Coach/team review surface"), so the player card links to the surrounding context
 * rather than duplicating it.
 *
 * "Latest relevant" = the newest ACTIVE `AiAdvisorInsight` with `subjectType: PLAYER` and this
 * player's `subjectId`, from the newest SUCCEEDED `DEVELOPMENT_CYCLE_REVIEW` for a team whose
 * scope parses to this organisation's teams. Insights are AI inference — presented as the
 * Assistant Coach's own voice, never mixed into the player's canonical development observations.
 * The insight's own state matters: a coach-dismissed insight is no longer "relevant".
 *
 * No staleness check, for the same reason the team cycle panel documents: a cycle review is an
 * immutable per-window snapshot — matches recorded after its window ended don't invalidate it.
 */

export type PlayerDevelopmentCycleInsight = {
  title: string;
  body: string;
  /** e.g. "24 Feb – 31 Mar 2025". */
  windowLabel: string;
  teamId: string;
};

export async function getPlayerDevelopmentCycleInsight(params: {
  organisationId: string;
  playerId: string;
}): Promise<PlayerDevelopmentCycleInsight | null> {
  const settings = await getOrganisationAiSettings(params.organisationId);
  if (!settings || !settings.enabled || !settings.activeConnectionId) return null;
  if (!isAiCapabilityEnabled(settings, "DEVELOPMENT_CYCLE_REVIEW")) return null;

  const activeConnection = await db.aiProviderConnection.findFirst({
    where: { id: settings.activeConnectionId, organisationId: params.organisationId },
    select: { status: true },
  });
  if (!activeConnection || activeConnection.status !== "READY") return null;

  const insight = await db.aiAdvisorInsight.findFirst({
    where: {
      organisationId: params.organisationId,
      subjectType: "PLAYER",
      subjectId: params.playerId,
      state: "ACTIVE",
      review: {
        capability: "DEVELOPMENT_CYCLE_REVIEW",
        scopeType: "TEAM_WINDOW",
        status: "SUCCEEDED",
      },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      body: true,
      review: { select: { scopeId: true, refMap: true } },
    },
  });
  if (!insight) return null;

  const parsed = parseDevelopmentCycleScopeId(insight.review.scopeId);
  if (!parsed) return null;

  // Resolve the review's own ephemeral ref tokens (P01 -> real name) against the review's
  // persisted refMap — the exact map the review was generated from (resolve-insight-text.ts's
  // persisted-first doctrine). A pre-column review falls back to raw tokens, same as every
  // other surface.
  const persistedRefMap = parsePersistedRefMap(insight.review.refMap);
  const displayNameByRef = persistedRefMap ? await buildRefDisplayNameMap(persistedRefMap) : new Map<string, string>();

  const sameYear = parsed.windowStart.getUTCFullYear() === parsed.windowEnd.getUTCFullYear();
  const startLabel = sameYear
    ? parsed.windowStart.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })
    : parsed.windowStart.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  const endLabel = parsed.windowEnd.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

  return {
    title: resolveInsightText(insight.title, displayNameByRef),
    body: resolveInsightText(insight.body, displayNameByRef),
    windowLabel: `${startLabel} – ${endLabel}`,
    teamId: parsed.teamId,
  };
}