import "server-only";
import { db } from "@/lib/db";
import { AiInsightSubjectType, type AiAdvisorCapability } from "@/generated/prisma/client";
import type { FootballMatchRef } from "@/lib/evidence/football-match-ref";

/**
 * "Select the actual pre-match expectation" (ADR-0152 §5, bundle
 * `05_ASSISTANT_COACH_LEARNING_PIPELINE.md`). Post-match plan-vs-reality comparison must use the
 * plan that existed *before* execution — never today's possibly-since-edited plan, and never a
 * retrospectively-generated one.
 *
 * Resolves each selected insight's subject through its already-persisted `subjectId` (a real,
 * stable database ID `runner.ts` resolved and stored at the time that review succeeded), not
 * through the review's ephemeral `P01`-style ref tokens still embedded in its raw prose. This is
 * deliberately different from `resolve-insight-text.ts`'s UI-display pattern (which requires
 * rebuilding the same capability's context and checking the fingerprint still matches, then
 * falls back to a "stale" placeholder when it doesn't): a historical plan snapshot being stale
 * relative to *today's* plan is expected and correct here — the match was played against
 * whatever the plan was at the time, not against today's edited version — so there is no
 * fingerprint to re-check and no "stale" case to handle. `subjectId` alone is enough to give the
 * consuming prompt an unambiguous real name regardless of whatever ref token happens to still
 * appear in the stored text.
 */

export type PreMatchExpectationInsight = {
  title: string;
  body: string;
  subjectName: string | null;
  secondarySubjectName: string | null;
};

export type PreMatchExpectationReview = {
  reviewId: string;
  completedAt: Date;
  sourceFingerprint: string;
  summary: string | null;
  insights: PreMatchExpectationInsight[];
};

export type PreMatchExpectations = {
  matchPrep: PreMatchExpectationReview | null;
  lineupReview: PreMatchExpectationReview | null;
};

export const EMPTY_PRE_MATCH_EXPECTATIONS: PreMatchExpectations = { matchPrep: null, lineupReview: null };

/**
 * Bundle §5: "For same match load latest successful MATCH_PREP and LINEUP_REVIEW reviews
 * created at or before `LiveMatchSession.startedAt`. If no live session exists, use latest
 * successful review created before `PostMatchReport.createdAt`. If none exists, use empty
 * preMatchExpectations. Never generate a retrospective 'pre-match' review to fill the gap."
 */
async function resolveCutoffTime(ref: FootballMatchRef, organisationId: string): Promise<Date | null> {
  if (ref.kind === "LEAGUE_MATCH") {
    const session = await db.liveMatchSession.findFirst({ where: { matchId: ref.matchId, organisationId }, select: { startedAt: true } });
    if (session) return session.startedAt;
    const report = await db.postMatchReport.findFirst({ where: { matchId: ref.matchId, organisationId }, select: { createdAt: true } });
    return report?.createdAt ?? null;
  }

  const session = await db.eventLiveMatchSession.findFirst({ where: { eventMatchId: ref.eventMatchId, organisationId }, select: { startedAt: true } });
  if (session) return session.startedAt;
  const report = await db.eventPostMatchReport.findFirst({ where: { eventMatchId: ref.eventMatchId, organisationId }, select: { createdAt: true } });
  return report?.createdAt ?? null;
}

async function resolveSubjectName(subjectType: AiInsightSubjectType, subjectId: string | null, cache: Map<string, string | null>): Promise<string | null> {
  if (!subjectId) return null;
  const cacheKey = `${subjectType}:${subjectId}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey) ?? null;

  let name: string | null = null;
  if (subjectType === AiInsightSubjectType.PLAYER) {
    const player = await db.player.findUnique({ where: { id: subjectId }, select: { firstName: true, lastName: true } });
    name = player ? `${player.firstName} ${player.lastName ?? ""}`.trim() : null;
  } else if (subjectType === AiInsightSubjectType.TEAM) {
    const team = await db.team.findUnique({ where: { id: subjectId }, select: { name: true } });
    name = team?.name ?? null;
  }
  cache.set(cacheKey, name);
  return name;
}

async function loadLatestSuccessfulReview(
  ref: FootballMatchRef,
  organisationId: string,
  capability: AiAdvisorCapability,
  cutoff: Date,
  nameCache: Map<string, string | null>,
): Promise<PreMatchExpectationReview | null> {
  const matchId = ref.kind === "LEAGUE_MATCH" ? ref.matchId : ref.eventMatchId;

  const review = await db.aiAdvisorReview.findFirst({
    where: { organisationId, scopeType: "MATCH", scopeId: matchId, capability, status: "SUCCEEDED", completedAt: { lte: cutoff } },
    orderBy: { completedAt: "desc" },
    include: { insights: { where: { state: "ACTIVE" }, orderBy: { displayOrder: "asc" } } },
  });
  if (!review || !review.completedAt) return null;

  const insights: PreMatchExpectationInsight[] = [];
  for (const insight of review.insights) {
    insights.push({
      title: insight.title,
      body: insight.body,
      subjectName: await resolveSubjectName(insight.subjectType, insight.subjectId, nameCache),
      secondarySubjectName: await resolveSubjectName(AiInsightSubjectType.PLAYER, insight.secondarySubjectId, nameCache),
    });
  }

  return { reviewId: review.id, completedAt: review.completedAt, sourceFingerprint: review.sourceFingerprint, summary: review.summary, insights };
}

export async function selectPreMatchExpectations(ref: FootballMatchRef, organisationId: string): Promise<PreMatchExpectations> {
  const cutoff = await resolveCutoffTime(ref, organisationId);
  if (!cutoff) return EMPTY_PRE_MATCH_EXPECTATIONS;

  const nameCache = new Map<string, string | null>();
  const [matchPrep, lineupReview] = await Promise.all([
    loadLatestSuccessfulReview(ref, organisationId, "MATCH_PREP", cutoff, nameCache),
    loadLatestSuccessfulReview(ref, organisationId, "LINEUP_REVIEW", cutoff, nameCache),
  ]);

  return { matchPrep, lineupReview };
}
