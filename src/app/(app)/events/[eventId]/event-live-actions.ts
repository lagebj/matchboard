"use server";

import { revalidatePath } from "next/cache";
import { startEventLiveSession, endEventLiveSession, getEventActiveSession, heartbeatEventSession } from "@/lib/live-match/event-live-match-session";
import { recordEventEvent, getEventMatchEvents, getRecentEventEvents } from "@/lib/live-match/event-live-match-event-store";
import type { LiveMatchEventType, MatchPeriod } from "@/lib/live-match/live-match-types";
import type { EventLiveEventInput } from "@/lib/live-match/event-live-match-event-store";
import { db } from "@/lib/db";
import { requirePageActorContext, requireMutationRole } from "@/lib/auth/actor-context";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";
import { getUnavailableParticipantIdsForMatch } from "@/lib/events/event-match-availability";

// Takes an already-resolved `orgFilter` (established once, at the top of each exported action
// below via requirePageActorContext()/setTenantOrganisationId()) rather than resolving its own
// actor context — matching the convention every other events action file uses (see
// event-match-actions.ts's requireMatchOrgAccess, event-match-availability-actions.ts's
// requireEventMatchOrgAccess). The previous version of this helper called requirePageActorContext()
// and setTenantOrganisationId() internally: that mutation only ever scoped this helper's OWN
// query, never the caller's subsequent ones (AsyncLocalStorage's enterWith() cannot make a
// mutation made after an internal await visible to whoever awaits the function it happened in —
// see ARR-0029 "Bug 3" and src/lib/db.ts's own comment on getExplicitOrgId()). That silently left
// every later query in a caller like getEventLiveMatchPreMatchPackageAction unscoped, which
// src/lib/db.ts's fail-closed tenantRLS extension (ADR-0087) correctly refused to run.
async function requireEventMatchOrgAccess(eventMatchId: string, orgFilter: OrgFilterMode): Promise<{ eventId: string }> {
  const match = await db.eventMatch.findFirst({
    where: { id: eventMatchId, organisationId: orgFilter.organisationId },
    select: { eventId: true },
  });
  if (!match) throw new Error("Event match not found or access denied.");
  return { eventId: match.eventId };
}

export async function startEventLiveSessionAction(eventMatchId: string) {
  try {
    const ctx = await requirePageActorContext();
    setTenantOrganisationId(ctx.organisationId);
    requireMutationRole(ctx);
    const { eventId } = await requireEventMatchOrgAccess(eventMatchId, ctx.orgFilter);
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
    const ctx = await requirePageActorContext();
    setTenantOrganisationId(ctx.organisationId);
    await requireEventMatchOrgAccess(eventMatchId, ctx.orgFilter);
    const session = await getEventActiveSession(eventMatchId);
    return { success: true as const, data: session };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : "Failed to get active session." };
  }
}

export async function endEventLiveSessionAction(sessionId: string) {
  try {
    const ctx = await requirePageActorContext();
    setTenantOrganisationId(ctx.organisationId);
    requireMutationRole(ctx);
    const session = await db.eventLiveMatchSession.findFirst({
      where: { id: sessionId, organisationId: ctx.orgFilter.organisationId },
      select: { eventMatchId: true },
    });
    if (!session) throw new Error("Live session not found or access denied.");
    const ended = await endEventLiveSession(sessionId);
    const { eventId } = await requireEventMatchOrgAccess(ended.eventMatchId, ctx.orgFilter);
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
    setTenantOrganisationId(ctx.organisationId);
    requireMutationRole(ctx);
    const session = await db.eventLiveMatchSession.findFirst({
      where: { id: sessionId, organisationId: ctx.orgFilter.organisationId },
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
    setTenantOrganisationId(ctx.organisationId);
    requireMutationRole(ctx);
    const { eventId } = await requireEventMatchOrgAccess(input.eventMatchId, ctx.orgFilter);
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
    revalidatePath(`/events/${eventId}/matches/${input.eventMatchId}/live`);
    return { success: true as const, data: result };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : "Failed to record event." };
  }
}

export async function getEventMatchEventsAction(eventMatchId: string) {
  try {
    const ctx = await requirePageActorContext();
    setTenantOrganisationId(ctx.organisationId);
    await requireEventMatchOrgAccess(eventMatchId, ctx.orgFilter);
    const events = await getEventMatchEvents(eventMatchId);
    return { success: true as const, data: events };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : "Failed to get events." };
  }
}

export async function getRecentEventEventsAction(eventMatchId: string, limit?: number) {
  try {
    const ctx = await requirePageActorContext();
    setTenantOrganisationId(ctx.organisationId);
    await requireEventMatchOrgAccess(eventMatchId, ctx.orgFilter);
    const events = await getRecentEventEvents(eventMatchId, limit);
    return { success: true as const, data: events };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : "Failed to get recent events." };
  }
}

export async function getEventLiveMatchPreMatchPackageAction(eventMatchId: string) {
  try {
    const ctx = await requirePageActorContext();
    setTenantOrganisationId(ctx.organisationId);
    const orgFilter = ctx.orgFilter;
    const { eventId } = await requireEventMatchOrgAccess(eventMatchId, orgFilter);

    // Explicit organisationId filter on every query below (not just relying on the
    // setTenantOrganisationId() call above) — the same defense-in-depth convention every other
    // events action file uses, and the only way to be certain these RLS-scoped queries stay
    // correctly scoped regardless of how many awaits separate them from the call above.
    const match = await db.eventMatch.findFirst({
      where: { id: eventMatchId, organisationId: orgFilter.organisationId },
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
            gameFormatOverride: true,
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

    const lineup = await db.eventMatchLineup.findFirst({
      where: { eventMatchId, organisationId: orgFilter.organisationId },
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

    // ADR-0106 PR 5b: exclude participants marked unavailable for this specific match from the
    // live-reporting roster (scorer/assist/rotation/position pickers).
    const unavailableParticipantIds = await getUnavailableParticipantIdsForMatch(eventMatchId, orgFilter);

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
          // Effective game format (production consistency pass item #4): the squad's own
          // override if set, else the Event default — never the Event default alone.
          gameFormat: match.eventSquad?.gameFormatOverride ?? match.event.gameFormat,
          matchDurationMinutes: match.event.matchDurationMinutes,
        },
        // ADR-0106: EventSquadPlayer.playerId/player are now nullable (a GuestPlayer assignment
        // uses guestPlayerId instead). GuestPlayer-aware live reporting is a later, separate
        // change; filtered to Player-backed rows as a no-op today (no write path produces a
        // guest row yet).
        squad: match.eventSquad
          ? match.eventSquad.players
              .filter(
                (sp): sp is typeof sp & { player: NonNullable<typeof sp.player> } =>
                  sp.player !== null && !unavailableParticipantIds.has(sp.player.id),
              )
              .map((sp) => ({
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