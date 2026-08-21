"use server";

import { revalidatePath } from "next/cache";
import { startLiveSession, endLiveSession, getActiveSession, heartbeatSession } from "@/lib/live-match/live-match-session";
import { recordEvent, getMatchEvents, getRecentEvents } from "@/lib/live-match/live-match-event-store";
import type { LiveMatchEventType, MatchPeriod } from "@/lib/live-match/live-match-types";
import type { LiveEventInput } from "@/lib/live-match/live-match-types";
import { db } from "@/lib/db";
import { requirePageActorContext, requireMutationRole, requireMatchGroupAccess } from "@/lib/auth/actor-context";

export async function startLiveSessionAction(matchId: string) {
  try {
    const ctx = await requirePageActorContext();
    requireMutationRole(ctx);
    await requireMatchGroupAccess(ctx, matchId);
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
    const ctx = await requirePageActorContext();
    requireMutationRole(ctx);
    const session = await endLiveSession(sessionId);
    const matchId = session.matchId;
    await requireMatchGroupAccess(ctx, matchId);
    revalidatePath(`/matches/${matchId}`);
    revalidatePath(`/matches/${matchId}/live`);
    return { success: true as const, data: session };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : "Failed to end live session." };
  }
}

export async function heartbeatAction(sessionId: string) {
  try {
    const ctx = await requirePageActorContext();
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
    const ctx = await requirePageActorContext();
    requireMutationRole(ctx);
    await requireMatchGroupAccess(ctx, input.matchId);
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
    const ctx = await requirePageActorContext();

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

    if (match.organisationId !== ctx.organisationId) {
      return { success: false as const, error: "Match not found or access denied." };
    }

    const squadPlayers = await db.selection.findMany({
      where: {
        matchId,
        match: { organisationId: ctx.organisationId },
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

    // Effective roster = normal squad ∪ match helpers (ADR-0077) — the single point where League
    // helpers join live reporting. Every downstream consumer (rotation, position, goal, assist
    // pickers) reads this one combined `squad` array; no separate helper-only path exists.
    const helperAssignments = await db.matchHelperAssignment.findMany({
      where: { matchId, match: { organisationId: ctx.organisationId } },
      select: {
        playerId: true,
        sourceTeam: { select: { name: true } },
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

    const lineup = await db.matchLineup.findFirst({
      where: {
        matchId,
        teamId: match.teamId,
        status: { in: ["CONFIRMED", "DRAFT"] },
      },
      select: {
        id: true,
        status: true,
        benchPlayerIds: true,
        assignments: {
          select: {
            id: true,
            slotId: true,
            playerId: true,
            locked: true,
            source: true,
          },
        },
        formation: {
          select: {
            id: true,
            name: true,
            slots: {
              select: {
                id: true,
                roleType: true,
                label: true,
                acceptedPositionIds: true,
              },
            },
          },
        },
      },
    });

    const onFieldPlayerIds = new Set<string>();
    const slotLabels = new Map<string, string>();
    if (lineup && lineup.formation) {
      for (const slot of lineup.formation.slots) {
        slotLabels.set(slot.id, slot.label);
        const assignment = lineup.assignments.find((a) => a.slotId === slot.id && a.playerId);
        if (assignment && assignment.playerId) {
          onFieldPlayerIds.add(assignment.playerId);
        }
      }
    }

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
        squad: [
          ...squadPlayers.map((s) => ({
            playerId: s.player.id,
            playerName: [s.player.firstName, s.player.lastName].filter(Boolean).join(" "),
            position: s.player.primaryPosition,
            shirtNumber: s.player.shirtNumber,
            role: s.role,
            availability: s.player.currentAvailability,
            startingOnField: onFieldPlayerIds.has(s.player.id),
            slotLabel: (() => {
              if (!lineup || !lineup.formation) return null;
              const assignment = lineup.assignments.find((a) => a.playerId === s.player.id);
              if (!assignment) return null;
              return slotLabels.get(assignment.slotId) ?? null;
            })(),
            isHelper: false as const,
            helperSourceTeamName: null as string | null,
          })),
          ...helperAssignments.map((h) => ({
            playerId: h.player.id,
            playerName: [h.player.firstName, h.player.lastName].filter(Boolean).join(" "),
            position: h.player.primaryPosition,
            shirtNumber: h.player.shirtNumber,
            role: "HELPER",
            availability: h.player.currentAvailability,
            startingOnField: onFieldPlayerIds.has(h.player.id),
            slotLabel: (() => {
              if (!lineup || !lineup.formation) return null;
              const assignment = lineup.assignments.find((a) => a.playerId === h.player.id);
              if (!assignment) return null;
              return slotLabels.get(assignment.slotId) ?? null;
            })(),
            isHelper: true,
            helperSourceTeamName: h.sourceTeam.name,
          })),
        ],
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