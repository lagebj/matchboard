'use server'

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { requirePageActorContext, requireMutationRole } from '@/lib/auth/actor-context';
import type { OrgFilterMode } from '@/lib/tenancy/resolve-org-filter';
import { logMutationEvent } from '@/lib/security/audit-log';
import { isPlayerAvailableForSupport } from '@/lib/events/event-match-time';
import { checkSupportConflicts, getSupportCandidatesForEventMatch, resolveMatchWindow } from '@/lib/events/event-match-support';
import type { EventMatchWindow } from '@/lib/events/event-match-time';
import { getEffectiveEventSquadMatchTiming } from '@/lib/events/event-types';
import type { EventSquadMatchTiming } from '@/lib/events/event-types';
import { EventMatchSupportRole } from '@/generated/prisma/client';
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";

const EVENT_SQUAD_TIMING_OVERRIDE_SELECT = {
  numberOfHalvesOverride: true,
  matchDurationMinutesOverride: true,
  breakDurationMinutesOverride: true,
} as const;

/** Builds the per-squad effective match timing map required by getEventMatchWindow-based
 * overlap detection -- see getEffectiveEventSquadMatchTiming (event-types.ts) for why a single
 * event-wide duration/halves value is not sufficient once squads can have different effective
 * game formats (and therefore different halves/duration/break). */
function buildTimingBySquadId(
  event: { numberOfHalves: number; matchDurationMinutes: number | null; breakDurationMinutes: number | null },
  squads: { id: string; numberOfHalvesOverride: number | null; matchDurationMinutesOverride: number | null; breakDurationMinutesOverride: number | null }[],
): Map<string, EventSquadMatchTiming> {
  return new Map(squads.map((s) => [s.id, getEffectiveEventSquadMatchTiming(event, s)]));
}

async function requireEventOrgAccess(eventId: string, orgFilter: OrgFilterMode): Promise<void> {
  if (orgFilter.type !== 'org') return;
  const event = await db.event.findFirst({
    where: { id: eventId, ...orgFilter.filter },
    select: { id: true },
  });
  if (!event) throw new Error('Event not found or access denied.');
}

async function requireEventNotFinalized(eventId: string, orgFilter: OrgFilterMode): Promise<void> {
  const event = await db.event.findFirst({
    where: { id: eventId, ...(orgFilter.type === 'org' ? orgFilter.filter : {}) },
    select: { status: true },
  });
  if (event?.status === 'FINALIZED') {
    throw new Error('Cannot modify support assignments of a finalized event. Unfinalize the event first.');
  }
}

const VALID_PLANNED_ROLES = Object.values(EventMatchSupportRole);

function isValidPlannedRole(role: string | null | undefined): role is EventMatchSupportRole | null {
  if (role === null || role === undefined) return true;
  return (VALID_PLANNED_ROLES as readonly string[]).includes(role);
}

export async function addEventMatchSupportAssignmentAction(input: {
  eventMatchId: string;
  playerId: string;
  plannedRole?: EventMatchSupportRole;
  note?: string;
}) {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);
  requireMutationRole(ctx);

  const { eventMatchId, playerId, plannedRole, note } = input;

  if (!eventMatchId || !playerId) {
    throw new Error('Event match ID and player ID are required.');
  }

  if (!isValidPlannedRole(plannedRole ?? null)) {
    throw new Error(`Invalid planned role. Must be one of: ${VALID_PLANNED_ROLES.join(', ')}`);
  }

  const eventMatch = await db.eventMatch.findFirst({
    where: { id: eventMatchId, event: ctx.orgFilter.filter },
    include: { event: true },
  });
  if (!eventMatch) throw new Error('Event match not found or access denied.');

  await requireEventOrgAccess(eventMatch.eventId, ctx.orgFilter);
  await requireEventNotFinalized(eventMatch.eventId, ctx.orgFilter);

  if (eventMatch.status === 'CANCELLED') {
    throw new Error('Cannot add support to a cancelled match.');
  }

  const event = eventMatch.event;

  const eventSquads = await db.eventSquad.findMany({
    where: { eventId: event.id },
    select: {
      id: true,
      name: true,
      players: { select: { playerId: true } },
      ...EVENT_SQUAD_TIMING_OVERRIDE_SELECT,
    },
  });
  const timingBySquadId = buildTimingBySquadId(event, eventSquads);

  const allEventMatches = await db.eventMatch.findMany({
    where: { eventId: event.id },
    select: { id: true, eventSquadId: true, startsAt: true, status: true },
  });

  const targetWindow = resolveMatchWindow(eventMatch, timingBySquadId);
  if (!targetWindow) {
    throw new Error('Event match duration not set. Set match duration before planning support.');
  }
  const allWindows: EventMatchWindow[] = allEventMatches
    .map((m) => resolveMatchWindow(m, timingBySquadId))
    .filter((w): w is EventMatchWindow => w !== null);

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

  const existing = await db.eventMatchSupportAssignment.findFirst({
    where: { eventMatchId, playerId, eventMatch: ctx.orgFilter.filter },
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
      organisationId: ctx.organisationId,
    },
  });

  logMutationEvent("manual_override", ctx.email || "unknown", "event_match_support", assignment.id, "success");

  revalidatePath(`/events/${event.id}`);
  return assignment;
}

export async function removeEventMatchSupportAssignmentAction(assignmentId: string) {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);
  requireMutationRole(ctx);

  const assignment = await db.eventMatchSupportAssignment.findFirst({
    where: { id: assignmentId, eventMatch: ctx.orgFilter.filter },
    include: { eventMatch: { select: { id: true, eventId: true } } },
  });
  if (!assignment) throw new Error('Support assignment not found or access denied.');

  await requireEventOrgAccess(assignment.eventMatch.eventId, ctx.orgFilter);
  await requireEventNotFinalized(assignment.eventMatch.eventId, ctx.orgFilter);

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
  plannedRole?: EventMatchSupportRole;
  note?: string;
}) {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);
  requireMutationRole(ctx);

  const { assignmentId, plannedRole, note } = input;

  if (!isValidPlannedRole(plannedRole ?? null)) {
    throw new Error(`Invalid planned role. Must be one of: ${VALID_PLANNED_ROLES.join(', ')}`);
  }

  const assignment = await db.eventMatchSupportAssignment.findFirst({
    where: { id: assignmentId, eventMatch: ctx.orgFilter.filter },
    include: { eventMatch: { select: { eventId: true } } },
  });
  if (!assignment) throw new Error('Support assignment not found or access denied.');

  await requireEventOrgAccess(assignment.eventMatch.eventId, ctx.orgFilter);
  await requireEventNotFinalized(assignment.eventMatch.eventId, ctx.orgFilter);

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
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);

  const event = await db.event.findFirst({
    where: { id: eventId, ...ctx.orgFilter.filter },
    select: { matchDurationMinutes: true, numberOfHalves: true, breakDurationMinutes: true },
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
    select: { id: true, name: true, players: { select: { playerId: true } }, ...EVENT_SQUAD_TIMING_OVERRIDE_SELECT },
  });
  const timingBySquadId = buildTimingBySquadId(event, eventSquads);

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
    timingBySquadId,
    eventSquads,
    playerEventAvailability: playerAvailability,
    playerNames,
    squadNames,
  });

  return conflicted;
}

export async function getSupportCandidatesForMatchAction(eventMatchId: string) {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);

  const eventMatch = await db.eventMatch.findFirst({
    where: { id: eventMatchId, event: ctx.orgFilter.filter },
    include: { event: true },
  });
  if (!eventMatch) throw new Error('Event match not found or access denied.');

  await requireEventOrgAccess(eventMatch.eventId, ctx.orgFilter);

  const event = eventMatch.event;

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
      ...EVENT_SQUAD_TIMING_OVERRIDE_SELECT,
    },
  });
  const timingBySquadId = buildTimingBySquadId(event, eventSquads);

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

  const targetMatch = {
    id: eventMatch.id,
    eventSquadId: eventMatch.eventSquadId,
    startsAt: eventMatch.startsAt,
    status: eventMatch.status,
  };

  return getSupportCandidatesForEventMatch({
    targetMatch,
    timingBySquadId,
    allEventMatches,
    eventSquads,
    playerProfiles,
    existingSupportAssignments,
    playerEventAvailability,
  });
}