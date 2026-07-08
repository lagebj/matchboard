'use server'

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { requireCoachAccess } from '@/lib/auth';
import { getEventMatchWindow, isPlayerAvailableForSupport } from '@/lib/events/event-match-time';
import type { EventMatchWindow } from '@/lib/events/event-match-time';

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
  await requireCoachAccess();

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
    throw new Error(`Player is not eligible: ${eligibility.reason}`);
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

  revalidatePath(`/events/${event.id}`);
  return assignment;
}

export async function removeEventMatchSupportAssignmentAction(assignmentId: string) {
  await requireCoachAccess();

  const assignment = await db.eventMatchSupportAssignment.findUnique({
    where: { id: assignmentId },
    include: { eventMatch: { select: { eventId: true } } },
  });
  if (!assignment) throw new Error('Support assignment not found.');

  await db.eventMatchSupportAssignment.delete({ where: { id: assignmentId } });

  revalidatePath(`/events/${assignment.eventMatch.eventId}`);
}

export async function updateEventMatchSupportAssignmentAction(input: {
  assignmentId: string;
  plannedRole?: string;
  note?: string;
}) {
  await requireCoachAccess();

  const { assignmentId, plannedRole, note } = input;

  if (!isValidPlannedRole(plannedRole ?? null)) {
    throw new Error(`Invalid planned role. Must be one of: ${VALID_PLANNED_ROLES.join(', ')}`);
  }

  const assignment = await db.eventMatchSupportAssignment.findUnique({
    where: { id: assignmentId },
    include: { eventMatch: { select: { eventId: true } } },
  });
  if (!assignment) throw new Error('Support assignment not found.');

  const updated = await db.eventMatchSupportAssignment.update({
    where: { id: assignmentId },
    data: {
      plannedRole: plannedRole ?? null,
      note: note ?? null,
    },
  });

  revalidatePath(`/events/${assignment.eventMatch.eventId}`);
  return updated;
}

export async function getEventMatchSupportAssignmentsAction(eventId: string) {
  await requireCoachAccess();

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

  return assignments;
}