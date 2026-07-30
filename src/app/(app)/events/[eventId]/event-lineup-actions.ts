'use server';

import { db } from '@/lib/db';
import { requireCoachAccess } from '@/lib/auth';
import { resolveOrgFilterForUser, type OrgFilterMode } from '@/lib/tenancy/resolve-org-filter';
import { revalidatePath } from 'next/cache';
import type { FormationSlotRoleType, GameFormat } from '@/generated/prisma/client';

async function requireEventOrgAccess(eventId: string, orgFilter: OrgFilterMode): Promise<void> {
  if (orgFilter.type !== 'org') return;
  const event = await db.event.findFirst({
    where: { id: eventId, ...orgFilter.filter },
    select: { id: true },
  });
  if (!event) throw new Error('Event not found or access denied.');
}

async function requireLineupOrgAccess(lineupId: string, orgFilter: OrgFilterMode): Promise<string> {
  if (orgFilter.type !== 'org') {
    const lineup = await db.eventMatchLineup.findUnique({ where: { id: lineupId }, select: { eventMatchId: true } });
    if (!lineup) throw new Error('Lineup not found.');
    return lineup.eventMatchId;
  }
  const lineup = await db.eventMatchLineup.findFirst({
    where: { id: lineupId, eventMatch: { event: orgFilter.filter } },
    select: { eventMatchId: true },
  });
  if (!lineup) throw new Error('Lineup not found or access denied.');
  return lineup.eventMatchId;
}

export async function getEventMatchLineup(eventMatchId: string) {
  const coach = await requireCoachAccess();
  const orgFilter = await resolveOrgFilterForUser(coach.id ?? '');

  const lineup = await db.eventMatchLineup.findUnique({
    where: { eventMatchId },
    include: {
      formation: { include: { slots: { orderBy: { sortOrder: 'asc' } } } },
      assignments: {
        include: { player: { select: { id: true, firstName: true, lastName: true, primaryPosition: true, secondaryPosition: true, tertiaryPosition: true, goalkeeperAbility: true } } },
        orderBy: { slotIndex: 'asc' },
      },
    },
  });

  if (lineup && orgFilter.type === 'org') {
    const match = await db.eventMatch.findFirst({
      where: { id: lineup.eventMatchId, ...orgFilter.filter },
      select: { id: true },
    });
    if (!match) return null;
  }

  return lineup;
}

export async function createEventMatchLineup(input: {
  eventMatchId: string;
  formationId?: string;
}) {
  const coach = await requireCoachAccess();
  const orgFilter = await resolveOrgFilterForUser(coach.id ?? '');

  if (orgFilter.type === 'org') {
    const match = await db.eventMatch.findFirst({
      where: { id: input.eventMatchId, ...orgFilter.filter },
      select: { id: true },
    });
    if (!match) throw new Error('Event match not found or access denied.');
  }

  const existing = await db.eventMatchLineup.findUnique({
    where: { eventMatchId: input.eventMatchId },
  });

  if (existing) {
    return existing;
  }

  const formationId = input.formationId ?? null;

  let formationSlots: { id: string; gridX: number; gridY: number; roleType: FormationSlotRoleType; acceptedPositionIds: string[]; sortOrder: number }[] = [];

  if (formationId) {
    const raw = await db.formationSlot.findMany({
      where: { formationId },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, gridX: true, gridY: true, roleType: true, acceptedPositionIds: true, sortOrder: true },
    });
    formationSlots = raw.map((s) => ({
      ...s,
      acceptedPositionIds: Array.isArray(s.acceptedPositionIds) ? s.acceptedPositionIds as string[] : [],
    }));
  }

  const lineup = await db.eventMatchLineup.create({
    data: {
      eventMatchId: input.eventMatchId,
      formationId,
      status: 'DRAFT',
      assignments: {
        create: formationSlots.map((slot, index) => ({
          slotId: slot.id,
          slotIndex: index,
          slotLabel: slot.roleType,
          roleType: slot.roleType,
          source: 'BASE_SQUAD',
          x: slot.gridX ? slot.gridX / 4 : null,
          y: slot.gridY ? slot.gridY / 5 : null,
        })),
      },
    },
    include: {
      assignments: true,
    },
  });

  revalidatePath(`/events/${input.eventMatchId}`);
  return lineup;
}

export async function assignPlayerToLineupSlot(
  lineupId: string,
  assignmentId: string,
  playerId: string,
) {
  const coach = await requireCoachAccess();
  const orgFilter = await resolveOrgFilterForUser(coach.id ?? '');
  await requireLineupOrgAccess(lineupId, orgFilter);

  const lineup = await db.eventMatchLineup.findUnique({
    where: { id: lineupId },
    include: { assignments: true },
  });

  if (!lineup) throw new Error('Lineup not found');
  if (lineup.status === 'CONFIRMED') throw new Error('Cannot modify confirmed lineup');

  const existingAssignment = lineup.assignments.find((a) => a.playerId === playerId);
  if (existingAssignment && existingAssignment.id !== assignmentId) {
    await db.eventMatchLineupAssignment.update({
      where: { id: existingAssignment.id },
      data: { playerId: null },
    });
  }

  const assignment = await db.eventMatchLineupAssignment.update({
    where: { id: assignmentId },
    data: { playerId },
  });

  revalidatePath(`/events/${lineup.eventMatchId}`);
  return assignment;
}

export async function removePlayerFromLineupSlot(assignmentId: string) {
  const coach = await requireCoachAccess();
  const orgFilter = await resolveOrgFilterForUser(coach.id ?? '');

  const assignment = await db.eventMatchLineupAssignment.findUnique({
    where: { id: assignmentId },
    include: { lineup: true },
  });

  if (!assignment) throw new Error('Assignment not found');
  if (assignment.lineup.status === 'CONFIRMED') throw new Error('Cannot modify confirmed lineup');
  await requireLineupOrgAccess(assignment.lineupId, orgFilter);

  const updated = await db.eventMatchLineupAssignment.update({
    where: { id: assignmentId },
    data: { playerId: null },
  });

  revalidatePath(`/events/${assignment.lineup.eventMatchId}`);
  return updated;
}

export async function saveEventMatchLineup(lineupId: string) {
  const coach = await requireCoachAccess();
  const orgFilter = await resolveOrgFilterForUser(coach.id ?? '');
  await requireLineupOrgAccess(lineupId, orgFilter);

  const lineup = await db.eventMatchLineup.findUnique({
    where: { id: lineupId },
    include: { assignments: true },
  });

  if (!lineup) throw new Error('Lineup not found');

  const updated = await db.eventMatchLineup.update({
    where: { id: lineupId },
    data: { status: 'DRAFT' },
  });

  revalidatePath(`/events/${updated.eventMatchId}`);
  return updated;
}

export async function clearEventMatchLineup(lineupId: string) {
  const coach = await requireCoachAccess();
  const orgFilter = await resolveOrgFilterForUser(coach.id ?? '');
  await requireLineupOrgAccess(lineupId, orgFilter);

  const lineup = await db.eventMatchLineup.findUnique({
    where: { id: lineupId },
  });

  if (!lineup) throw new Error('Lineup not found');
  if (lineup.status === 'CONFIRMED') throw new Error('Cannot clear confirmed lineup');

  await db.eventMatchLineupAssignment.updateMany({
    where: { lineupId },
    data: { playerId: null },
  });

  revalidatePath(`/events/${lineup.eventMatchId}`);
  return { success: true };
}

export async function deleteEventMatchLineup(lineupId: string) {
  const coach = await requireCoachAccess();
  const orgFilter = await resolveOrgFilterForUser(coach.id ?? '');
  await requireLineupOrgAccess(lineupId, orgFilter);

  const lineup = await db.eventMatchLineup.findUnique({
    where: { id: lineupId },
  });

  if (!lineup) throw new Error('Lineup not found');
  if (lineup.status === 'CONFIRMED') throw new Error('Cannot delete confirmed lineup');

  await db.eventMatchLineupAssignment.deleteMany({
    where: { lineupId },
  });

  await db.eventMatchLineup.delete({
    where: { id: lineupId },
  });

  revalidatePath(`/events/${lineup.eventMatchId}`);
  return { success: true };
}

export async function changeEventMatchLineupFormation(lineupId: string, formationId: string | null) {
  const coach = await requireCoachAccess();
  const orgFilter = await resolveOrgFilterForUser(coach.id ?? '');
  await requireLineupOrgAccess(lineupId, orgFilter);

  const lineup = await db.eventMatchLineup.findUnique({
    where: { id: lineupId },
  });

  if (!lineup) throw new Error('Lineup not found');
  if (lineup.status === 'CONFIRMED') throw new Error('Cannot modify confirmed lineup');

  let formationSlots: { id: string; gridX: number; gridY: number; roleType: FormationSlotRoleType; acceptedPositionIds: string[]; sortOrder: number }[] = [];

  if (formationId) {
    const raw = await db.formationSlot.findMany({
      where: { formationId },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, gridX: true, gridY: true, roleType: true, acceptedPositionIds: true, sortOrder: true },
    });
    formationSlots = raw.map((s) => ({
      ...s,
      acceptedPositionIds: Array.isArray(s.acceptedPositionIds) ? s.acceptedPositionIds as string[] : [],
    }));
  }

  await db.eventMatchLineupAssignment.deleteMany({
    where: { lineupId },
  });

  await db.eventMatchLineupAssignment.createMany({
    data: formationSlots.map((slot, index) => ({
      lineupId,
      slotId: slot.id,
      slotIndex: index,
      slotLabel: slot.roleType,
      roleType: slot.roleType,
      source: 'BASE_SQUAD' as const,
      x: slot.gridX ? slot.gridX / 4 : null,
      y: slot.gridY ? slot.gridY / 5 : null,
    })),
  });

  const updated = await db.eventMatchLineup.update({
    where: { id: lineupId },
    data: { formationId },
  });

  revalidatePath(`/events/${updated.eventMatchId}`);
  return updated;
}

export async function autoFillEventMatchLineup(lineupId: string) {
  const coach = await requireCoachAccess();
  const orgFilter = await resolveOrgFilterForUser(coach.id ?? '');
  await requireLineupOrgAccess(lineupId, orgFilter);

  const lineup = await db.eventMatchLineup.findUnique({
    where: { id: lineupId },
    include: {
      assignments: { orderBy: { slotIndex: 'asc' } },
    },
  });

  if (!lineup) throw new Error('Lineup not found');
  if (lineup.status === 'CONFIRMED') throw new Error('Cannot modify confirmed lineup');

  const eventMatch = await db.eventMatch.findUnique({
    where: { id: lineup.eventMatchId },
    include: {
      eventSquad: {
        include: {
          players: {
            include: {
              player: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  primaryPosition: true,
                  secondaryPosition: true,
                  tertiaryPosition: true,
                  goalkeeperAbility: true,
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
                },
              },
            },
          },
        },
      },
    },
  });

  if (!eventMatch) throw new Error('Event match not found');

  const squadPlayers = eventMatch.eventSquad.players
    .filter((sp) => !sp.locked || sp.source === 'LOCKED' || sp.source === 'MANUAL' || sp.source === 'AUTO')
    .map((sp) => ({
      id: sp.player.id,
      firstName: sp.player.firstName,
      lastName: sp.player.lastName,
      primaryPosition: sp.player.primaryPosition,
      secondaryPosition: sp.player.secondaryPosition,
      tertiaryPosition: sp.player.tertiaryPosition,
      goalkeeperAbility: sp.player.goalkeeperAbility,
    }));

  const lockedPlayerIds = new Set(
    lineup.assignments
      .filter((a) => a.playerId)
      .map((a) => a.playerId!),
  );

  const assignedPlayerIds = new Set(lockedPlayerIds);
  const updates: { assignmentId: string; playerId: string }[] = [];

  for (const assignment of lineup.assignments) {
    if (assignment.playerId && lockedPlayerIds.has(assignment.playerId)) continue;

    const slotPositions = assignment.roleType
      ? roleTypeToPositions(assignment.roleType)
      : [];

    const candidates = squadPlayers
      .filter((p) => !assignedPlayerIds.has(p.id))
      .map((p) => ({
        player: p,
        score: scorePlayerForSlot(p, slotPositions),
      }))
      .sort((a, b) => b.score - a.score);

    if (candidates.length > 0) {
      const best = candidates[0];
      updates.push({ assignmentId: assignment.id, playerId: best.player.id });
      assignedPlayerIds.add(best.player.id);
    }
  }

  for (const update of updates) {
    await db.eventMatchLineupAssignment.update({
      where: { id: update.assignmentId },
      data: { playerId: update.playerId },
    });
  }

  revalidatePath(`/events/${lineup.eventMatchId}`);
  return { assigned: updates.length };
}

type PlayerForScoring = {
  id: string;
  firstName: string;
  lastName: string | null;
  primaryPosition: string;
  secondaryPosition: string | null;
  tertiaryPosition: string | null;
  goalkeeperAbility: string;
};

function roleTypeToPositions(roleType: string): string[] {
  switch (roleType) {
    case 'GOALKEEPER': return ['GK'];
    case 'DEFENDER': return ['CB', 'LB', 'RB', 'SW'];
    case 'DEFENSIVE_MIDFIELDER': return ['CDM', 'CM'];
    case 'MIDFIELDER': return ['CM', 'CDM', 'CAM', 'W', 'LW', 'RW'];
    case 'ATTACKING_MIDFIELDER': return ['CAM', 'SS', 'W', 'LW', 'RW'];
    case 'FORWARD': return ['ST', 'CF', 'LW', 'RW'];
    case 'FREE': return ['GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'W', 'LW', 'RW', 'ST', 'CF'];
    default: return [];
  }
}

function scorePlayerForSlot(player: PlayerForScoring, slotPositions: string[]): number {
  let score = 0;
  const isGK = player.goalkeeperAbility === 'YES';

  if (slotPositions.includes(player.primaryPosition)) score += 100;
  if (player.secondaryPosition && slotPositions.includes(player.secondaryPosition)) score += 60;
  if (player.tertiaryPosition && slotPositions.includes(player.tertiaryPosition)) score += 30;

  if (slotPositions.includes('GK') && isGK) score += 200;
  if (!slotPositions.includes('GK') && isGK) score -= 50;

  if (slotPositions.length === 0) score += 10;

  return score;
}

export async function getAvailableFormations(gameFormat: string) {
  const coach = await requireCoachAccess();
  const orgFilter = await resolveOrgFilterForUser(coach.id ?? '');

  return db.formation.findMany({
    where: {
      gameFormat: gameFormat as GameFormat,
      isArchived: false,
      ...(orgFilter.type === 'org' ? orgFilter.filterNullable : {}),
    },
    include: { slots: { orderBy: { sortOrder: 'asc' } } },
    orderBy: { name: 'asc' },
  });
}