"use server";

import { revalidatePath } from "next/cache";
import { startLiveSession, endLiveSession, getActiveSession, heartbeatSession } from "@/lib/live-match/live-match-session";
import { recordEvent, getMatchEvents, getRecentEvents } from "@/lib/live-match/live-match-event-store";
import type { LiveMatchEventType, MatchPeriod } from "@/lib/live-match/live-match-types";
import type { LiveEventInput } from "@/lib/live-match/live-match-types";
import { db } from "@/lib/db";
import { requireActorContext, requireMutationRole, requireMatchTeamAccess } from "@/lib/auth/actor-context";

export async function startLiveSessionAction(matchId: string) {
  try {
    const ctx = await requireActorContext();
    requireMutationRole(ctx);
    await requireMatchTeamAccess(ctx, matchId);
    const session = await startLiveSession(matchId);
    revalidatePath(`/matches/${matchId}`);
    revalidatePath(`/matches/${matchId}/live`);
    return { success: true as const, data: session };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : "Failed to start live session." };
  }
}

export async function getActiveSessionAction(matchId: string) {
  try {
    const session = await getActiveSession(matchId);
    return { success: true as const, data: session };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : "Failed to get active session." };
  }
}

export async function endLiveSessionAction(sessionId: string) {
  try {
    const ctx = await requireActorContext();
    requireMutationRole(ctx);
    const session = await endLiveSession(sessionId);
    const matchId = session.matchId;
    await requireMatchTeamAccess(ctx, matchId);
    revalidatePath(`/matches/${matchId}`);
    revalidatePath(`/matches/${matchId}/live`);
    return { success: true as const, data: session };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : "Failed to end live session." };
  }
}

export async function heartbeatAction(sessionId: string) {
  try {
    const ctx = await requireActorContext();
    requireMutationRole(ctx);
    await heartbeatSession(sessionId);
    return { success: true as const };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : "Heartbeat failed." };
  }
}

export async function recordLiveEventAction(input: {
  matchId: string;
  sessionId: string;
  eventType: string;
  period?: string;
  matchSeconds?: number;
  playerId?: string;
  secondaryPlayerId?: string;
  payload?: Record<string, unknown>;
  clientEventId: string;
  correctionType?: string;
  correctsEventId?: string;
}) {
  try {
    const ctx = await requireActorContext();
    requireMutationRole(ctx);
    await requireMatchTeamAccess(ctx, input.matchId);
    const typedInput: LiveEventInput = {
      matchId: input.matchId,
      sessionId: input.sessionId,
      eventType: input.eventType as LiveMatchEventType,
      period: input.period as MatchPeriod | undefined,
      matchSeconds: input.matchSeconds,
      playerId: input.playerId,
      secondaryPlayerId: input.secondaryPlayerId,
      payload: input.payload,
      clientEventId: input.clientEventId,
      correctionType: input.correctionType as "CORRECTION" | "REVERSAL" | undefined,
      correctsEventId: input.correctsEventId,
    };

    const result = await recordEvent(typedInput);
    revalidatePath(`/matches/${input.matchId}/live`);
    return { success: true as const, data: result };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : "Failed to record event." };
  }
}

export async function getMatchEventsAction(matchId: string) {
  try {
    const events = await getMatchEvents(matchId);
    return { success: true as const, data: events };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : "Failed to get events." };
  }
}

export async function getRecentEventsAction(matchId: string, limit?: number) {
  try {
    const events = await getRecentEvents(matchId, limit);
    return { success: true as const, data: events };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : "Failed to get recent events." };
  }
}

export async function getLiveMatchPreMatchPackageAction(matchId: string) {
  try {
    const ctx = await requireActorContext();
    const orgWhere = ctx.orgFilter.type === "org" ? ctx.orgFilter.filter : {};

    const match = await db.match.findUnique({
      where: { id: matchId },
      select: {
        id: true,
        opponent: true,
        homeAway: true,
        gameFormat: true,
        startsAt: true,
        status: true,
        teamId: true,
        organisationId: true,
        matchRoundId: true,
        team: { select: { id: true, name: true } },
        matchRound: {
          select: { id: true, name: true },
        },
      },
    });

    if (!match) {
      return { success: false as const, error: "Match not found." };
    }

    if (ctx.orgFilter.type === "org" && match.organisationId !== ctx.orgFilter.organisationId) {
      return { success: false as const, error: "Match not found or access denied." };
    }

    const squadPlayers = await db.selection.findMany({
      where: {
        matchId,
        ...(ctx.orgFilter.type === "org"
          ? { match: { organisationId: ctx.orgFilter.organisationId } }
          : {}),
      },
      select: {
        id: true,
        playerId: true,
        role: true,
        player: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            primaryPosition: true,
            shirtNumber: true,
            currentAvailability: true,
          },
        },
      },
    });

    const activeSession = await getActiveSession(matchId);

    return {
      success: true as const,
      data: {
        match: {
          id: match.id,
          opponent: match.opponent,
          homeAway: match.homeAway,
          gameFormat: match.gameFormat,
          startsAt: match.startsAt.toISOString(),
          status: match.status,
          teamName: match.team.name,
          teamId: match.teamId,
          roundName: match.matchRound?.name ?? null,
        },
        squad: squadPlayers.map((s) => ({
          playerId: s.player.id,
          playerName: [s.player.firstName, s.player.lastName].filter(Boolean).join(" "),
          position: s.player.primaryPosition,
          shirtNumber: s.player.shirtNumber,
          role: s.role,
          availability: s.player.currentAvailability,
        })),
        activeSession: activeSession
          ? {
              id: activeSession.id,
              coachId: activeSession.coachId,
              startedAt: activeSession.startedAt.toISOString(),
            }
          : null,
      },
    };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : "Failed to load pre-match package." };
  }
}