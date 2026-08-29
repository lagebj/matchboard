import { db } from "@/lib/db";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";
import type { EventPlayerStatus } from "@/generated/prisma/client";
import { assertExactlyOneParticipant } from "@/lib/participants/participant-ref";

// ADR-0106 (Event Match availability, spec §16-18): a participant (Player or GuestPlayer) can
// attend an Event but be unavailable for specific Matches within it. Storage is sparse: an
// EventMatchAvailability row's mere existence means "unavailable for this specific match" -- there
// is no per-match AVAILABLE override against an Event-level UNAVAILABLE (or WITHDRAWN, which
// carries the same "out of the whole Event" semantics -- both are treated as a hard event-level
// exclusion that no per-match exception can undo).
//
// This module is purely additive in this PR: no existing planning/selection/live-reporting code
// path reads getEffectiveEventMatchAvailability() yet (that wiring is PR 5b, a separate,
// deliberately follow-up change) -- nothing here can regress current behaviour by construction.

export type ParticipantIdentity = {
  playerId: string | null;
  guestPlayerId: string | null;
};

export type EffectiveEventMatchAvailability = {
  /** The participant's Event-level attendance status (EventPlayerAvailability.status). */
  eventLevelStatus: EventPlayerStatus;
  /** Whether a per-match unavailability exception exists for this participant and match. */
  hasMatchException: boolean;
  /**
   * Whether the participant is available to plan for this specific match, given both their
   * Event-level status and any per-match exception. False when the Event-level status is
   * UNAVAILABLE or WITHDRAWN (a hard exclusion no per-match exception can override), or when a
   * per-match exception exists. Does not otherwise re-implement Event-level pool-inclusion rules
   * (RESERVE/LATE_ADDITION/UNKNOWN handling) -- those remain event-validation.ts's concern.
   */
  isAvailableForMatch: boolean;
};

const HARD_EVENT_LEVEL_EXCLUSIONS: EventPlayerStatus[] = ["UNAVAILABLE", "WITHDRAWN"];

function orgWhere(orgFilter: OrgFilterMode): { organisationId: string } {
  return orgFilter.filter;
}

async function getEventLevelStatus(
  eventId: string,
  participant: ParticipantIdentity,
  orgFilter: OrgFilterMode,
): Promise<EventPlayerStatus> {
  assertExactlyOneParticipant(participant.playerId, participant.guestPlayerId);

  const availability = await db.eventPlayerAvailability.findFirst({
    where: {
      eventId,
      ...(participant.playerId ? { playerId: participant.playerId } : { guestPlayerId: participant.guestPlayerId }),
      ...orgWhere(orgFilter),
    },
    select: { status: true },
  });

  return availability?.status ?? "UNKNOWN";
}

export async function getEffectiveEventMatchAvailability(
  eventMatchId: string,
  participant: ParticipantIdentity,
  orgFilter: OrgFilterMode,
): Promise<EffectiveEventMatchAvailability> {
  assertExactlyOneParticipant(participant.playerId, participant.guestPlayerId);

  const match = await db.eventMatch.findFirst({
    where: { id: eventMatchId, event: orgFilter.filter },
    select: { eventId: true },
  });
  if (!match) {
    throw new Error("Event match not found or access denied.");
  }

  const [eventLevelStatus, exception] = await Promise.all([
    getEventLevelStatus(match.eventId, participant, orgFilter),
    db.eventMatchAvailability.findFirst({
      where: {
        eventMatchId,
        ...(participant.playerId ? { playerId: participant.playerId } : { guestPlayerId: participant.guestPlayerId }),
        ...orgWhere(orgFilter),
      },
      select: { id: true },
    }),
  ]);

  const hasMatchException = exception !== null;
  const isAvailableForMatch = !HARD_EVENT_LEVEL_EXCLUSIONS.includes(eventLevelStatus) && !hasMatchException;

  return { eventLevelStatus, hasMatchException, isAvailableForMatch };
}

export async function setEventMatchUnavailable(
  eventMatchId: string,
  participant: ParticipantIdentity,
  orgFilter: OrgFilterMode,
  note?: string | null,
): Promise<{ success: true } | { success: false; error: string }> {
  assertExactlyOneParticipant(participant.playerId, participant.guestPlayerId);

  const match = await db.eventMatch.findFirst({
    where: { id: eventMatchId, event: orgFilter.filter },
    select: { id: true },
  });
  if (!match) return { success: false, error: "Event match not found or access denied." };

  try {
    if (participant.playerId) {
      await db.eventMatchAvailability.upsert({
        where: { eventMatchId_playerId: { eventMatchId, playerId: participant.playerId } },
        create: {
          eventMatchId,
          playerId: participant.playerId,
          note: note?.trim() || null,
          organisationId: orgFilter.filter.organisationId,
        },
        update: { note: note?.trim() || null },
      });
    } else {
      await db.eventMatchAvailability.upsert({
        where: { eventMatchId_guestPlayerId: { eventMatchId, guestPlayerId: participant.guestPlayerId! } },
        create: {
          eventMatchId,
          guestPlayerId: participant.guestPlayerId!,
          note: note?.trim() || null,
          organisationId: orgFilter.filter.organisationId,
        },
        update: { note: note?.trim() || null },
      });
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Failed to set match unavailability." };
  }
}

export async function removeEventMatchAvailabilityException(
  eventMatchId: string,
  participant: ParticipantIdentity,
  orgFilter: OrgFilterMode,
): Promise<{ success: true } | { success: false; error: string }> {
  assertExactlyOneParticipant(participant.playerId, participant.guestPlayerId);

  await db.eventMatchAvailability.deleteMany({
    where: {
      eventMatchId,
      ...(participant.playerId ? { playerId: participant.playerId } : { guestPlayerId: participant.guestPlayerId }),
      ...orgWhere(orgFilter),
    },
  });

  return { success: true };
}

export type EventMatchAvailabilityMatrixEntry = {
  participantId: string;
  playerId: string | null;
  guestPlayerId: string | null;
  displayName: string;
  eventLevelStatus: EventPlayerStatus;
  matchExceptions: Record<string, { note: string | null }>;
};

/**
 * Full per-Event availability matrix: every participant's Event-level status plus which specific
 * matches they have an unavailability exception for. Intended for the matrix/chips UX (spec
 * §19) -- one query per Event, not one per participant per match.
 */
export async function getEventMatchAvailabilityMatrix(
  eventId: string,
  orgFilter: OrgFilterMode,
): Promise<EventMatchAvailabilityMatrixEntry[]> {
  const availabilities = await db.eventPlayerAvailability.findMany({
    where: { eventId, ...orgWhere(orgFilter) },
    select: {
      playerId: true,
      guestPlayerId: true,
      status: true,
      player: { select: { firstName: true, lastName: true } },
      guestPlayer: { select: { name: true, sourceLabel: true } },
    },
  });

  const exceptions = await db.eventMatchAvailability.findMany({
    where: { eventMatch: { eventId }, ...orgWhere(orgFilter) },
    select: { eventMatchId: true, playerId: true, guestPlayerId: true, note: true },
  });

  const entries: EventMatchAvailabilityMatrixEntry[] = [];

  for (const a of availabilities) {
    let participantId: string;
    let displayName: string;

    if (a.playerId !== null && a.player !== null) {
      participantId = a.playerId;
      displayName = a.player.lastName ? `${a.player.firstName} ${a.player.lastName}` : a.player.firstName;
    } else if (a.guestPlayerId !== null && a.guestPlayer !== null) {
      participantId = a.guestPlayerId;
      displayName = a.guestPlayer.name;
    } else {
      continue;
    }

    const matchExceptions: Record<string, { note: string | null }> = {};
    for (const ex of exceptions) {
      const isMatch = a.playerId ? ex.playerId === a.playerId : ex.guestPlayerId === a.guestPlayerId;
      if (isMatch) {
        matchExceptions[ex.eventMatchId] = { note: ex.note };
      }
    }

    entries.push({
      participantId,
      playerId: a.playerId,
      guestPlayerId: a.guestPlayerId,
      displayName,
      eventLevelStatus: a.status,
      matchExceptions,
    });
  }

  return entries;
}
