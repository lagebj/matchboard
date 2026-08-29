import { db } from "@/lib/db";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";

// ADR-0106: GuestPlayer participation in an Event. A GuestPlayer is strictly Group-bound (see
// AGENTS.md "GuestPlayer and the shared match participant model") -- a GuestPlayer may only
// participate in an Event owned by the same Group that owns the GuestPlayer identity. This module
// is the one place that enforces that boundary for Event write paths, mirroring the pattern
// established by src/lib/guest-players/guest-player.ts for Group-level CRUD.

export async function assertGuestPlayerBelongsToEventGroup(
  eventId: string,
  guestPlayerId: string,
  orgFilter: OrgFilterMode,
): Promise<void> {
  const [event, guestPlayer] = await Promise.all([
    db.event.findFirst({
      where: { id: eventId, ...orgFilter.filter },
      select: { footballGroupId: true },
    }),
    db.guestPlayer.findFirst({
      where: { id: guestPlayerId, ...orgFilter.filter },
      select: { footballGroupId: true, active: true },
    }),
  ]);

  if (!event) throw new Error("Event not found or access denied.");
  if (!guestPlayer) throw new Error("Guest player not found or access denied.");
  if (!guestPlayer.active) throw new Error("Guest player is inactive.");
  if (guestPlayer.footballGroupId !== event.footballGroupId) {
    throw new Error("Guest player does not belong to this Event's Group.");
  }
}

export type EventGuestPlayerPoolEntry = {
  guestPlayerId: string;
  name: string;
  sourceLabel: string | null;
  status: string;
  eventSquadPlayerId: string | null;
  assignedSquadId: string | null;
  assignedSquadName: string | null;
};

export async function getEventGuestPlayerPool(
  eventId: string,
  orgFilter: OrgFilterMode,
): Promise<EventGuestPlayerPoolEntry[]> {
  const availabilities = await db.eventPlayerAvailability.findMany({
    where: { eventId, guestPlayerId: { not: null }, ...orgFilter.filter },
    select: {
      guestPlayerId: true,
      status: true,
      guestPlayer: { select: { id: true, name: true, sourceLabel: true } },
    },
  });

  const squadAssignments = await db.eventSquadPlayer.findMany({
    where: { eventId, guestPlayerId: { not: null }, ...orgFilter.filter },
    select: {
      id: true,
      guestPlayerId: true,
      eventSquad: { select: { id: true, name: true } },
    },
  });
  const squadByGuestPlayerId = new Map(
    squadAssignments
      .filter((sa): sa is typeof sa & { guestPlayerId: string } => sa.guestPlayerId !== null)
      .map((sa) => [sa.guestPlayerId, { id: sa.id, eventSquad: sa.eventSquad }]),
  );

  return availabilities
    .filter((a): a is typeof a & { guestPlayerId: string; guestPlayer: NonNullable<typeof a.guestPlayer> } =>
      a.guestPlayerId !== null && a.guestPlayer !== null,
    )
    .map((a) => {
      const assignment = squadByGuestPlayerId.get(a.guestPlayerId);
      const squad = assignment?.eventSquad;
      return {
        guestPlayerId: a.guestPlayerId,
        eventSquadPlayerId: assignment?.id ?? null,
        name: a.guestPlayer.name,
        sourceLabel: a.guestPlayer.sourceLabel,
        status: a.status,
        assignedSquadId: squad?.id ?? null,
        assignedSquadName: squad?.name ?? null,
      };
    });
}

export type AvailableGuestPlayerForEvent = {
  id: string;
  name: string;
  sourceLabel: string | null;
};

export async function getAvailableGuestPlayersForEvent(
  eventId: string,
  orgFilter: OrgFilterMode,
): Promise<AvailableGuestPlayerForEvent[]> {
  const event = await db.event.findFirst({
    where: { id: eventId, ...orgFilter.filter },
    select: { footballGroupId: true },
  });
  if (!event) return [];

  const existingPoolGuestPlayerIds = await db.eventPlayerAvailability.findMany({
    where: { eventId, guestPlayerId: { not: null }, ...orgFilter.filter },
    select: { guestPlayerId: true },
  });
  const excludeIds = new Set(existingPoolGuestPlayerIds.map((e) => e.guestPlayerId));

  const guestPlayers = await db.guestPlayer.findMany({
    where: {
      footballGroupId: event.footballGroupId,
      active: true,
      ...orgFilter.filter,
    },
    select: { id: true, name: true, sourceLabel: true },
    orderBy: { name: "asc" },
  });

  return guestPlayers.filter((g) => !excludeIds.has(g.id));
}
