'use server'

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { requireActorContext } from '@/lib/auth/actor-context';
import type { OrgFilterMode } from '@/lib/tenancy/resolve-org-filter';
import { logMutationEvent } from '@/lib/security/audit-log';
import { getEventMatchWindow, isPlayerAvailableForSupport } from '@/lib/events/event-match-time';
import { checkSupportConflicts, getSupportCandidatesForEventMatch } from '@/lib/events/event-match-support';
import type { EventMatchWindow } from '@/lib/events/event-match-time';

async function requireEventOrgAccess(eventId: string, orgFilter: OrgFilterMode): Promise<void> {
  if (orgFilter.type !== 'org') return;
  const event = await db.event.findFirst({
    where: { id: eventId, ...orgFilter.filter },
    select: { id: true },
  });
  if (!event) throw new Error('Event not found or access denied.');
}

const VALID_PLANNED_ROLES = [
  'GK cover',
  'Defender cover',
  'Midfield cover',
  'Forward cover',
  'General cover',
] as const;

type PlannedRole = (typeof VALID_PLANNED_ROLES)[number];

function isValidPlannedRole(role: string | null | undefined): role is PlannedRole | null {
  if (role === null || role === undefined) return true;
  return (VALID_PLANNED_ROLES as readonly string[]).includes(role);
}

export async function addEventMatchSupportAssignmentAction(input: {
  eventMatchId: string;
  playerId: string;
  plannedRole?: string;
  note?: string;
}) {
  const ctx = await requireActorContext();

  const { eventMatchId, playerId, plannedRole, note } = input;

  if (!eventMatchId || !playerId) {
    throw new Error('Event match ID and player ID are required.');
  }

  if (!isValidPlannedRole(plannedRole ?? null)) {
    throw new Error(`Invalid planned role. Must be one of: ${VALID_PLANNED_ROLES.join(', ')}`);
  }

  const eventMatch = await db.eventMatch.findUnique({
    where: { id: eventMatchId },
    include: { event: true },
  });
  if (!eventMatch) throw new Error('Event match not found.');

  await requireEventOrgAccess(eventMatch.eventId, ctx.orgFilter);

  if (eventMatch.status === 'CANCELLED') {
    throw new Error('Cannot add support to a cancelled match.');
  }

  const event = eventMatch.event;
  const matchDurationMinutes = event.matchDurationMinutes;
  if (!matchDurationMinutes || matchDurationMinutes <= 0) {
    throw new Error('Event match duration not set. Set match duration before planning support.');
  }

  const allEventMatches = await db.eventMatch.findMany({
    where: { eventId: event.id },
    select: { id: true, eventSquadId: true, startsAt: true, status: true },
  });

  const targetWindow = getEventMatchWindow(eventMatch, matchDurationMinutes);
  const allWindows: EventMatchWindow[] = allEventMatches.map((m) =>
    getEventMatchWindow(m, matchDurationMinutes),
  );

  const eventSquads = await db.eventSquad.findMany({
    where: { eventId: event.id },
    select: {
      id: true,
      name: true,
      players: { select: { playerId: true } },
    },
  });

  const playerSquad = await db.eventSquadPlayer.findFirst({
    where: { playerId, eventSquad: { eventId: event.id } },
    select: { eventSquadId: true },
  });
  if (!playerSquad) {
    throw new Error('Player is not assigned to any event squad in this event.');
  }

  const existingAssignments = await db.eventMatchSupportAssignment.findMany({
    where: { eventMatch: { event: { id: event.id } } },
    select: { eventMatchId: true, playerId: true, targetEventSquadId: true },
  });

  const playerAvailability = await db.eventPlayerAvailability.findMany({
    where: { eventId: event.id },
    select: { playerId: true, status: true },
  });

  const eligibility = isPlayerAvailableForSupport({
    playerId,
    sourceEventSquadId: playerSquad.eventSquadId,
    targetEventSquadId: eventMatch.eventSquadId,
    targetMatch: targetWindow,
    allEventMatches: allWindows,
    eventSquads: eventSquads.map((s) => ({ id: s.id, players: s.players })),
    existingSupportAssignments: existingAssignments,
    playerEventAvailability: playerAvailability,
  });

  if (!eligibility.available) {
    const reasonMap: Record<string, string> = {
      'Already in target squad': 'Cannot add helper: player is already in the target squad.',
      'Own squad has overlapping match': 'Cannot add helper: player\'s own squad has an overlapping match.',
      'Already helping another overlapping match': 'Cannot add helper: player is already helping another overlapping match.',
      'Player unavailable for event': 'Cannot add helper: player is unavailable for this event.',
      'Player withdrawn for event': 'Cannot add helper: player has withdrawn from this event.',
      'Target match is cancelled': 'Cannot add helper: target match is cancelled.',
      'Event match duration not set': 'Cannot add helper: event match duration is not set.',
      'Player not in event pool': 'Cannot add helper: player is not in the event pool.',
      'Player removed from source squad': 'Cannot add helper: player has been removed from their source squad.',
    };
    const message = reasonMap[eligibility.reason ?? ''] ?? `Cannot add helper: ${eligibility.reason}`;
    throw new Error(message);
  }

  const existing = await db.eventMatchSupportAssignment.findUnique({
    where: { eventMatchId_playerId: { eventMatchId, playerId } },
  });
  if (existing) {
    throw new Error('Player is already assigned as support for this match.');
  }

  const assignment = await db.eventMatchSupportAssignment.create({
    data: {
      eventMatchId,
      playerId,
      sourceEventSquadId: playerSquad.eventSquadId,
      targetEventSquadId: eventMatch.eventSquadId,
      plannedRole: plannedRole ?? null,
      note: note ?? null,
    },
  });

  logMutationEvent("manual_override", ctx.email || "unknown", "event_match_support", assignment.id, "success");

  revalidatePath(`/events/${event.id}`);
  return assignment;
}

export async function removeEventMatchSupportAssignmentAction(assignmentId: string) {
  const ctx = await requireActorContext();

  const assignment = await db.eventMatchSupportAssignment.findUnique({
    where: { id: assignmentId },
    include: { eventMatch: { select: { id: true, eventId: true } } },
  });
  if (!assignment) throw new Error('Support assignment not found.');

  await requireEventOrgAccess(assignment.eventMatch.eventId, ctx.orgFilter);

  await db.$transaction(async (tx) => {
    await tx.eventMatchSupportAssignment.delete({ where: { id: assignmentId } });

    await tx.eventMatchLineupAssignment.updateMany({
      where: {
        playerId: assignment.playerId,
        source: 'HELPER',
        lineup: { eventMatchId: assignment.eventMatchId },
      },
      data: { playerId: null, source: 'BASE_SQUAD' },
    });
  });

  logMutationEvent("manual_override", ctx.email || "unknown", "event_match_support", assignmentId, "success");

  revalidatePath(`/events/${assignment.eventMatch.eventId}`);
}

export async function updateEventMatchSupportAssignmentAction(input: {
  assignmentId: string;
  plannedRole?: string;
  note?: string;
}) {
  const ctx = await requireActorContext();

  const { assignmentId, plannedRole, note } = input;

  if (!isValidPlannedRole(plannedRole ?? null)) {
    throw new Error(`Invalid planned role. Must be one of: ${VALID_PLANNED_ROLES.join(', ')}`);
  }

  const assignment = await db.eventMatchSupportAssignment.findUnique({
    where: { id: assignmentId },
    include: { eventMatch: { select: { eventId: true } } },
  });
  if (!assignment) throw new Error('Support assignment not found.');

  await requireEventOrgAccess(assignment.eventMatch.eventId, ctx.orgFilter);

  const updated = await db.eventMatchSupportAssignment.update({
    where: { id: assignmentId },
    data: {
      plannedRole: plannedRole ?? null,
      note: note ?? null,
    },
  });

  logMutationEvent("manual_override", ctx.email || "unknown", "event_match_support", assignmentId, "success");

  revalidatePath(`/events/${assignment.eventMatch.eventId}`);
  return updated;
}

export async function getEventMatchSupportAssignmentsAction(eventId: string) {
  const ctx = await requireActorContext();

  const event = await db.event.findFirst({
    where: { id: eventId, ...(ctx.orgFilter.type === 'org' ? ctx.orgFilter.filter : {}) },
    select: { matchDurationMinutes: true },
  });
  if (!event) throw new Error('Event not found.');

  const assignments = await db.eventMatchSupportAssignment.findMany({
    where: { eventMatch: { eventId } },
    include: {
      player: {
        select: { id: true, firstName: true, lastName: true, primaryPosition: true, secondaryPosition: true, tertiaryPosition: true, goalkeeperAbility: true },
      },
      sourceEventSquad: { select: { id: true, name: true } },
      targetEventSquad: { select: { id: true, name: true } },
      eventMatch: { select: { id: true, eventSquadId: true, startsAt: true, status: true, opponentName: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  if (assignments.length === 0) return [];

  const allEventMatches = await db.eventMatch.findMany({
    where: { eventId },
    select: { id: true, eventSquadId: true, startsAt: true, status: true },
  });

  const eventSquads = await db.eventSquad.findMany({
    where: { eventId },
    select: { id: true, name: true, players: { select: { playerId: true } } },
  });

  const playerAvailability = await db.eventPlayerAvailability.findMany({
    where: { eventId },
    select: { playerId: true, status: true },
  });

  const playerNames = new Map<string, { firstName: string; lastName: string | null }>();
  const squadNames = new Map<string, string>();
  for (const a of assignments) {
    playerNames.set(a.playerId, { firstName: a.player.firstName, lastName: a.player.lastName });
  }
  for (const s of eventSquads) {
    squadNames.set(s.id, s.name);
  }

  const matchDurationMinutes = event.matchDurationMinutes ?? 0;

  const conflicted = checkSupportConflicts({
    assignments: assignments.map((a) => ({
      id: a.id,
      eventMatchId: a.eventMatchId,
      playerId: a.playerId,
      sourceEventSquadId: a.sourceEventSquadId,
      targetEventSquadId: a.targetEventSquadId,
      plannedRole: a.plannedRole,
      note: a.note,
    })),
    allEventMatches,
    matchDurationMinutes,
    eventSquads,
    playerEventAvailability: playerAvailability,
    playerNames,
    squadNames,
  });

  return conflicted;
}

export async function getSupportCandidatesForMatchAction(eventMatchId: string) {
  const ctx = await requireActorContext();

  const eventMatch = await db.eventMatch.findUnique({
    where: { id: eventMatchId },
    include: { event: true },
  });
  if (!eventMatch) throw new Error('Event match not found.');

  await requireEventOrgAccess(eventMatch.eventId, ctx.orgFilter);

  const event = eventMatch.event;
  const matchDurationMinutes = event.matchDurationMinutes;

  const allEventMatches = await db.eventMatch.findMany({
    where: { eventId: event.id },
    select: { id: true, eventSquadId: true, startsAt: true, status: true },
  });

  const eventSquads = await db.eventSquad.findMany({
    where: { eventId: event.id },
    select: {
      id: true,
      name: true,
      players: { select: { playerId: true } },
    },
  });

  const playerIds = eventSquads.flatMap((s) => s.players.map((p) => p.playerId));
  const uniquePlayerIds = [...new Set(playerIds)];

  const playerProfiles = await db.player.findMany({
    where: { id: { in: uniquePlayerIds } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      primaryPosition: true,
      secondaryPosition: true,
      tertiaryPosition: true,
      goalkeeperAbility: true,
      coreTeamId: true,
      ballControl: true,
      passing: true,
      firstTouch: true,
      oneVOneAttacking: true,
      positioning: true,
      oneVOneDefending: true,
      decisionMaking: true,
      effort: true,
      teamplay: true,
      concentration: true,
      speed: true,
      strength: true,
      nonRotatable: true,
      preferredFoot: true,
      bestSide: true,
    },
  });

  const existingSupportAssignments = await db.eventMatchSupportAssignment.findMany({
    where: { eventMatch: { event: { id: event.id } } },
    select: { eventMatchId: true, playerId: true, targetEventSquadId: true },
  });

  const playerEventAvailability = await db.eventPlayerAvailability.findMany({
    where: { eventId: event.id },
    select: { playerId: true, status: true },
  });

  if (!matchDurationMinutes || matchDurationMinutes <= 0) {
    return playerProfiles.map((p) => ({
      playerId: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      sourceEventSquadId: '',
      sourceEventSquadName: '',
      primaryPosition: p.primaryPosition,
      secondaryPosition: p.secondaryPosition,
      tertiaryPosition: p.tertiaryPosition,
      goalkeeperAbility: p.goalkeeperAbility,
      overallLevel: null,
      isGK: p.goalkeeperAbility === 'YES' || p.goalkeeperAbility === 'EMERGENCY',
      available: false,
      unavailableReason: 'Event match duration not set',
    }));
  }

  const targetMatch = {
    id: eventMatch.id,
    eventSquadId: eventMatch.eventSquadId,
    startsAt: eventMatch.startsAt,
    status: eventMatch.status,
  };

  return getSupportCandidatesForEventMatch({
    targetMatch,
    matchDurationMinutes,
    allEventMatches,
    eventSquads,
    playerProfiles,
    existingSupportAssignments,
    playerEventAvailability,
  });
}