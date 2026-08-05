"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireActorContext, requireMutationRole, requireMatchTeamAccess } from "@/lib/auth/actor-context";
import type { FairPlayCategory } from "@/generated/prisma/client";

const PERIOD_TO_INT: Record<string, number> = {
  BEFORE: 0,
  FIRST_HALF: 1,
  HALF_TIME: 2,
  SECOND_HALF: 3,
  EXTRA_FIRST_HALF: 4,
  EXTRA_HALF_TIME: 5,
  EXTRA_SECOND_HALF: 6,
  FULL_TIME: 7,
};

const FAIR_PLAY_POSITIVE_CATEGORIES = new Set([
  "HELPED_OPPONENT",
  "CHECKED_ON_INJURED_PLAYER",
  "ACCEPTED_REFEREE_DECISION",
  "ENCOURAGED_TEAMMATE",
  "CALMED_DIFFICULT_SITUATION",
  "OTHER_POSITIVE",
]);

const FAIR_PLAY_CONCERN_CATEGORIES = new Set([
  "RETALIATION",
  "ABUSIVE_LANGUAGE",
  "DISSENT_TOWARD_REFEREE",
  "TAUNTING_OR_PROVOKING",
  "DISRESPECT_TOWARD_TEAMMATE",
  "OTHER_CONCERN",
]);

const ALL_FAIR_PLAY_CATEGORIES = new Set([...FAIR_PLAY_POSITIVE_CATEGORIES, ...FAIR_PLAY_CONCERN_CATEGORIES]);

function fairPlayCategoryFromEvent(eventType: string, payload: Record<string, unknown> | null): string {
  const category = (payload as Record<string, unknown> | null)?.category;
  if (typeof category === "string" && ALL_FAIR_PLAY_CATEGORIES.has(category)) {
    return category;
  }
  return eventType === "FAIR_PLAY_POSITIVE" ? "OTHER_POSITIVE" : "OTHER_CONCERN";
}

export async function endLiveSessionAndCreateReportAction(sessionId: string, matchId: string) {
  try {
    const ctx = await requireActorContext();
    requireMutationRole(ctx);

    const session = await db.liveMatchSession.findUnique({
      where: { id: sessionId },
      select: { id: true, matchId: true, status: true, organisationId: true },
    });

    if (!session) {
      return { success: false as const, error: "Session not found." };
    }

    if (session.status !== "ACTIVE") {
      return { success: false as const, error: "Session is not active." };
    }

    if (session.matchId !== matchId) {
      return { success: false as const, error: "Session does not belong to this match." };
    }

    if (ctx.orgFilter.type === "org" && session.organisationId !== ctx.orgFilter.organisationId) {
      return { success: false as const, error: "Session not found or access denied." };
    }

    await requireMatchTeamAccess(ctx, matchId);

    await db.liveMatchSession.update({
      where: { id: sessionId },
      data: { status: "ENDED", endedAt: new Date() },
    });

    const existingReport = await db.postMatchReport.findUnique({
      where: { matchId },
      select: { id: true, status: true },
    });

    let reportResult: { id: string; status: string; matchId: string };

    if (existingReport) {
      reportResult = {
        id: existingReport.id,
        status: existingReport.status,
        matchId,
      };
    } else {
      const selections = await db.selection.findMany({
        where: { matchId, status: "FINALIZED" },
        select: { playerId: true },
      });

      const liveEvents = await db.liveMatchEvent.findMany({
        where: {
          matchId,
          OR: [
            { correctionType: null },
            { correctionType: "CORRECTION" },
          ],
          eventType: { in: ["GOAL_FOR", "GOAL_AGAINST", "SCORER_SET", "ASSIST_SET", "FAIR_PLAY_POSITIVE", "FAIR_PLAY_CONCERN", "ROTATION_OUT", "ROTATION_IN"] },
        },
        select: {
          id: true,
          eventType: true,
          playerId: true,
          secondaryPlayerId: true,
          period: true,
          matchSeconds: true,
          payload: true,
        },
        orderBy: { createdAt: "asc" },
      });

      const goalsFor = liveEvents.filter((e) => e.eventType === "GOAL_FOR").length;
      const goalsAgainst = liveEvents.filter((e) => e.eventType === "GOAL_AGAINST").length;

      const scorerEvents = liveEvents.filter((e) => e.eventType === "SCORER_SET" && e.playerId !== null);
      const assistEvents = liveEvents.filter((e) => e.eventType === "ASSIST_SET" && e.playerId !== null);

      const fairPlayEvents = liveEvents.filter(
        (e) => (e.eventType === "FAIR_PLAY_POSITIVE" || e.eventType === "FAIR_PLAY_CONCERN") && e.playerId !== null,
      );

      const rotationPairs: { outPlayerId: string; inPlayerId: string; period: number | null; matchSeconds: number | null }[] = [];
      const rotationOutEvents = liveEvents.filter((e) => e.eventType === "ROTATION_OUT");
      const rotationInEvents = liveEvents.filter((e) => e.eventType === "ROTATION_IN");

      for (const outEvent of rotationOutEvents) {
        if (!outEvent.playerId) continue;
        const matchingIn = rotationInEvents.find(
          (inEvent) =>
            inEvent.playerId &&
            inEvent.period === outEvent.period &&
            inEvent.matchSeconds !== null &&
            outEvent.matchSeconds !== null &&
            Math.abs((inEvent.matchSeconds ?? 0) - (outEvent.matchSeconds ?? 0)) < 30000 &&
            !rotationPairs.some((rp) => rp.outPlayerId === outEvent.playerId),
        );
        if (matchingIn && matchingIn.playerId) {
          rotationPairs.push({
            outPlayerId: outEvent.playerId,
            inPlayerId: matchingIn.playerId,
            period: outEvent.period ? parseInt(String(outEvent.period), 10) : null,
            matchSeconds: outEvent.matchSeconds,
          });
        }
      }

      const report = await db.postMatchReport.create({
        data: {
          matchId,
          status: "DRAFT",
          homeGoals: goalsFor,
          awayGoals: goalsAgainst,
          organisationId: session.organisationId,
          playerActuals: {
            create: selections.map((s) => ({
              matchId,
              playerId: s.playerId,
              source: "PLANNED",
              attendanceStatus: "PRESENT",
              organisationId: session.organisationId,
            })),
          },
          goals: {
            create: scorerEvents.map((e) => ({
              playerId: e.playerId!,
              type: "NORMAL",
              organisationId: session.organisationId,
            })),
          },
          assists: {
            create: assistEvents.map((e) => ({
              playerId: e.playerId!,
              type: "NORMAL",
              organisationId: session.organisationId,
            })),
          },
        },
      });

      if (fairPlayEvents.length > 0) {
        await db.fairPlayObservation.createMany({
          data: fairPlayEvents.map((e) => ({
            matchId,
            playerId: e.playerId!,
            category: fairPlayCategoryFromEvent(e.eventType, e.payload as Record<string, unknown> | null) as FairPlayCategory,
            source: "LIVE",
            status: "PROVISIONAL",
            period: e.period ? PERIOD_TO_INT[String(e.period)] ?? null : null,
            matchSeconds: e.matchSeconds,
            liveEventId: e.id,
            organisationId: session.organisationId,
          })),
        });
      }

      if (rotationPairs.length > 0) {
        await db.matchRotation.createMany({
          data: rotationPairs.map((rp) => ({
            matchId,
            outPlayerId: rp.outPlayerId,
            inPlayerId: rp.inPlayerId,
            period: rp.period ?? 0,
            matchSeconds: rp.matchSeconds,
            source: "LIVE",
            organisationId: session.organisationId,
          })),
        });
      }

      reportResult = {
        id: report.id,
        status: report.status,
        matchId: report.matchId,
      };
    }

    revalidatePath(`/matches/${matchId}`);
    revalidatePath(`/matches/${matchId}/live`);
    revalidatePath(`/matches/${matchId}/post-match`);

    return {
      success: true as const,
      data: {
        sessionId,
        matchId,
        reportId: reportResult.id,
        reportStatus: reportResult.status,
      },
    };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Failed to end session and create report.",
    };
  }
}