"use server";

import { revalidatePath } from "next/cache";
import { startEventLiveSession, endEventLiveSession, getEventActiveSession, heartbeatEventSession } from "@/lib/live-match/event-live-match-session";
import { recordEventEvent, getEventMatchEvents, getRecentEventEvents } from "@/lib/live-match/event-live-match-event-store";
import type { LiveMatchEventType, MatchPeriod } from "@/lib/live-match/live-match-types";
import type { EventLiveEventInput } from "@/lib/live-match/event-live-match-event-store";
import { db } from "@/lib/db";
import { requirePageActorContext, requireMutationRole } from "@/lib/auth/actor-context";

async function requireEventMatchOrgAccess(eventMatchId: string): Promise<{ eventId: string }> {
  const ctx = await requirePageActorContext();
  const match = await db.eventMatch.findFirst({
    where: { id: eventMatchId, event: ctx.orgFilter.filter },
    select: { eventId: true },
  });
  if (!match) throw new Error("Event match not found or access denied.");
  return { eventId: match.eventId };
}

export async function startEventLiveSessionAction(eventMatchId: string) {
  try {
    const { eventId } = await requireEventMatchOrgAccess(eventMatchId);
    const session = await startEventLiveSession(eventMatchId);
    revalidatePath(`/events/${eventId}`);
    revalidatePath(`/events/${eventId}/matches/${eventMatchId}/live`);
    return { success: true as const, data: session };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : "Failed to start live session." };
  }
}

export async function getEventActiveSessionAction(eventMatchId: string) {
  try {
    await requireEventMatchOrgAccess(eventMatchId);
    const session = await getEventActiveSession(eventMatchId);
    return { success: true as const, data: session };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : "Failed to get active session." };
  }
}

export async function endEventLiveSessionAction(sessionId: string) {
  try {
    const ctx = await requirePageActorContext();
    requireMutationRole(ctx);
    const session = await db.eventLiveMatchSession.findFirst({
      where: { id: sessionId, eventMatch: { event: ctx.orgFilter.filter } },
      select: { eventMatchId: true },
    });
    if (!session) throw new Error("Live session not found or access denied.");
    const ended = await endEventLiveSession(sessionId);
    const { eventId } = await requireEventMatchOrgAccess(ended.eventMatchId);
    revalidatePath(`/events/${eventId}`);
    revalidatePath(`/events/${eventId}/matches/${ended.eventMatchId}/live`);
    return { success: true as const, data: ended };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : "Failed to end live session." };
  }
}

export async function heartbeatEventAction(sessionId: string) {
  try {
    const ctx = await requirePageActorContext();
    requireMutationRole(ctx);
    const session = await db.eventLiveMatchSession.findFirst({
      where: { id: sessionId, eventMatch: { event: ctx.orgFilter.filter } },
      select: { id: true },
    });
    if (!session) throw new Error("Live session not found or access denied.");
    await heartbeatEventSession(sessionId);
    return { success: true as const };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : "Heartbeat failed." };
  }
}

export async function recordEventLiveEventAction(input: {
  eventMatchId: string;
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
    await requireEventMatchOrgAccess(input.eventMatchId);
    const typedInput: EventLiveEventInput = {
      eventMatchId: input.eventMatchId,
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

    const result = await recordEventEvent(typedInput);
    revalidatePath(`/events/${(await requireEventMatchOrgAccess(input.eventMatchId)).eventId}/matches/${input.eventMatchId}/live`);
    return { success: true as const, data: result };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : "Failed to record event." };
  }
}

export async function getEventMatchEventsAction(eventMatchId: string) {
  try {
    await requireEventMatchOrgAccess(eventMatchId);
    const events = await getEventMatchEvents(eventMatchId);
    return { success: true as const, data: events };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : "Failed to get events." };
  }
}

export async function getRecentEventEventsAction(eventMatchId: string, limit?: number) {
  try {
    await requireEventMatchOrgAccess(eventMatchId);
    const events = await getRecentEventEvents(eventMatchId, limit);
    return { success: true as const, data: events };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : "Failed to get recent events." };
  }
}

export async function getEventLiveMatchPreMatchPackageAction(eventMatchId: string) {
  try {
    const { eventId } = await requireEventMatchOrgAccess(eventMatchId);

    const match = await db.eventMatch.findUnique({
      where: { id: eventMatchId },
      select: {
        id: true,
        opponentName: true,
        category: true,
        startsAt: true,
        status: true,
        eventSquadId: true,
        event: {
          select: {
            id: true,
            name: true,
            gameFormat: true,
            matchDurationMinutes: true,
            organisationId: true,
          },
        },
        eventSquad: {
          select: {
            id: true,
            name: true,
            players: {
              select: {
                playerId: true,
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
                assignedRoleType: true,
                source: true,
              },
            },
          },
        },
      },
    });

    if (!match) {
      return { success: false as const, error: "Event match not found." };
    }

    const lineup = await db.eventMatchLineup.findUnique({
      where: { eventMatchId },
      select: {
        id: true,
        status: true,
        assignments: {
          select: {
            id: true,
            playerId: true,
            slotId: true,
            slotLabel: true,
            roleType: true,
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

    const activeSession = await getEventActiveSession(eventMatchId);

    return {
      success: true as const,
      data: {
        match: {
          id: match.id,
          opponentName: match.opponentName,
          category: match.category,
          startsAt: match.startsAt.toISOString(),
          status: match.status,
          squadName: match.eventSquad?.name ?? "",
          eventName: match.event.name,
          gameFormat: match.event.gameFormat,
          matchDurationMinutes: match.event.matchDurationMinutes,
        },
        squad: match.eventSquad
          ? match.eventSquad.players.map((sp) => ({
              playerId: sp.player.id,
              playerName: [sp.player.firstName, sp.player.lastName].filter(Boolean).join(" "),
              position: sp.player.primaryPosition,
              shirtNumber: sp.player.shirtNumber,
              role: sp.assignedRoleType ?? sp.source,
              availability: sp.player.currentAvailability,
              startingOnField: onFieldPlayerIds.has(sp.player.id),
              slotLabel: (() => {
                if (!lineup || !lineup.formation) return null;
                const assignment = lineup.assignments.find((a) => a.playerId === sp.player.id);
                if (!assignment) return null;
                return assignment.slotLabel ?? (assignment.slotId ? slotLabels.get(assignment.slotId) : null) ?? null;
              })(),
            }))
          : [],
        activeSession: activeSession
          ? {
              id: activeSession.id,
              coachId: activeSession.coachId,
              startedAt: activeSession.startedAt.toISOString(),
            }
          : null,
        eventId,
      },
    };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : "Failed to load event match data." };
  }
}