'use server';

import { db } from '@/lib/db';
import { requireActorContext, requireMutationRole } from '@/lib/auth/actor-context';
import type { OrgFilterMode } from '@/lib/tenancy/resolve-org-filter';
import { revalidatePath } from 'next/cache';
import type { FormationSlotRoleType, GameFormat } from '@/generated/prisma/client';

async function requireMatchOrgAccess(eventMatchId: string, orgFilter: OrgFilterMode): Promise<{ eventId: string }> {
  const match = await db.eventMatch.findFirst({
    where: { id: eventMatchId, event: orgFilter.filter },
    select: { eventId: true },
  });
  if (!match) throw new Error('Event match not found or access denied.');
  return { eventId: match.eventId };
}

async function requireLineupOrgAccess(lineupId: string, orgFilter: OrgFilterMode): Promise<{ eventMatchId: string; eventId: string }> {
  const lineup = await db.eventMatchLineup.findFirst({
    where: { id: lineupId, eventMatch: { event: orgFilter.filter } },
    select: { eventMatchId: true, eventMatch: { select: { eventId: true } } },
  });
  if (!lineup) throw new Error('Lineup not found or access denied.');
  return { eventMatchId: lineup.eventMatchId, eventId: lineup.eventMatch.eventId };
}

export async function getEventMatchLineup(eventMatchId: string) {
  const ctx = await requireActorContext();

  const lineup = await db.eventMatchLineup.findFirst({
    where: { eventMatchId, eventMatch: { ...ctx.orgFilter.filter } },
    include: {
      formation: { include: { slots: { orderBy: { sortOrder: 'asc' } } } },
      assignments: {
        include: { player: { select: { id: true, firstName: true, lastName: true, primaryPosition: true, secondaryPosition: true, tertiaryPosition: true, goalkeeperAbility: true } } },
        orderBy: { slotIndex: 'asc' },
      },
    },
  });

  return lineup;
}

export async function createEventMatchLineup(input: {
  eventMatchId: string;
  formationId?: string;
}) {
  const ctx = await requireActorContext();
  requireMutationRole(ctx);
  const { eventId } = await requireMatchOrgAccess(input.eventMatchId, ctx.orgFilter);

  const existing = await db.eventMatchLineup.findFirst({
    where: { eventMatchId: input.eventMatchId, eventMatch: { ...ctx.orgFilter.filter } },
  });

  if (existing) {
    return existing;
  }

  const formationId = input.formationId ?? null;

  let formationSlots: { id: string; gridX: number; gridY: number; roleType: FormationSlotRoleType; acceptedPositionIds: string[]; sortOrder: number }[] = [];

  if (formationId) {
    const formation = await db.formation.findFirst({
      where: {
        id: formationId,
        ...ctx.orgFilter.filter,
      },
      select: { id: true },
    });
    if (!formation) {
      throw new Error('Formation not found or access denied.');
    }

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
      organisationId: ctx.organisationId,
      assignments: {
        create: formationSlots.map((slot, index) => ({
          slotId: slot.id,
          slotIndex: index,
          slotLabel: slot.roleType,
          roleType: slot.roleType,
          source: 'BASE_SQUAD',
          x: slot.gridX ? slot.gridX / 4 : null,
          y: slot.gridY ? slot.gridY / 5 : null,
          organisationId: ctx.organisationId,
        })),
      },
    },
    include: {
      assignments: true,
    },
  });

  revalidatePath(`/events/${eventId}`);
  return lineup;
}

export async function assignPlayerToLineupSlot(
  lineupId: string,
  assignmentId: string,
  playerId: string,
) {
  const ctx = await requireActorContext();
  requireMutationRole(ctx);
  const { eventId } = await requireLineupOrgAccess(lineupId, ctx.orgFilter);

  const lineup = await db.eventMatchLineup.findFirst({
    where: { id: lineupId, eventMatch: { event: ctx.orgFilter.filter } },
    include: {
      assignments: true,
      eventMatch: {
        select: {
          eventSquadId: true,
        },
      },
    },
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

  const isInSquad = await db.eventSquadPlayer.findFirst({
    where: { eventSquadId: lineup.eventMatch.eventSquadId, playerId },
  });

  const playerInOrg = await db.player.findFirst({
    where: { id: playerId, ...ctx.orgFilter.filter },
    select: { id: true },
  });
  if (!playerInOrg) {
    throw new Error('Player not found or access denied.');
  }

  const source: 'BASE_SQUAD' | 'HELPER' = isInSquad ? 'BASE_SQUAD' : 'HELPER';

  const assignment = await db.eventMatchLineupAssignment.update({
    where: { id: assignmentId },
    data: { playerId, source },
  });

  revalidatePath(`/events/${eventId}`);
  return assignment;
}

export async function removePlayerFromLineupSlot(assignmentId: string) {
  const ctx = await requireActorContext();
  requireMutationRole(ctx);

  const assignment = await db.eventMatchLineupAssignment.findFirst({
    where: { id: assignmentId, lineup: { eventMatch: { event: ctx.orgFilter.filter } } },
    include: { lineup: { include: { eventMatch: { select: { eventId: true } } } } },
  });

  if (!assignment) throw new Error('Assignment not found or access denied');
  if (assignment.lineup.status === 'CONFIRMED') throw new Error('Cannot modify confirmed lineup');
  await requireLineupOrgAccess(assignment.lineupId, ctx.orgFilter);

  const eventId = assignment.lineup.eventMatch.eventId;

  const updated = await db.eventMatchLineupAssignment.update({
    where: { id: assignmentId },
    data: { playerId: null },
  });

  revalidatePath(`/events/${eventId}`);
  return updated;
}

export async function saveEventMatchLineup(lineupId: string) {
  const ctx = await requireActorContext();
  requireMutationRole(ctx);
  const { eventId } = await requireLineupOrgAccess(lineupId, ctx.orgFilter);

  const lineup = await db.eventMatchLineup.findFirst({
    where: { id: lineupId, eventMatch: { event: ctx.orgFilter.filter } },
    include: { assignments: true },
  });

  if (!lineup) throw new Error('Lineup not found');

  const updated = await db.eventMatchLineup.update({
    where: { id: lineupId },
    data: { status: 'DRAFT' },
  });

  revalidatePath(`/events/${eventId}`);
  return updated;
}

export async function clearEventMatchLineup(lineupId: string) {
  const ctx = await requireActorContext();
  requireMutationRole(ctx);
  const { eventId } = await requireLineupOrgAccess(lineupId, ctx.orgFilter);

  const lineup = await db.eventMatchLineup.findFirst({
    where: { id: lineupId, eventMatch: { event: ctx.orgFilter.filter } },
  });

  if (!lineup) throw new Error('Lineup not found');
  if (lineup.status === 'CONFIRMED') throw new Error('Cannot clear confirmed lineup');

  await db.eventMatchLineupAssignment.updateMany({
    where: { lineupId },
    data: { playerId: null },
  });

  revalidatePath(`/events/${eventId}`);
  return { success: true };
}

export async function deleteEventMatchLineup(lineupId: string) {
  const ctx = await requireActorContext();
  requireMutationRole(ctx);
  const { eventId } = await requireLineupOrgAccess(lineupId, ctx.orgFilter);

  const lineup = await db.eventMatchLineup.findFirst({
    where: { id: lineupId, eventMatch: { event: ctx.orgFilter.filter } },
  });

  if (!lineup) throw new Error('Lineup not found');
  if (lineup.status === 'CONFIRMED') throw new Error('Cannot delete confirmed lineup');

  await db.eventMatchLineupAssignment.deleteMany({
    where: { lineupId },
  });

  await db.eventMatchLineup.delete({
    where: { id: lineupId },
  });

  revalidatePath(`/events/${eventId}`);
  return { success: true };
}

export async function changeEventMatchLineupFormation(lineupId: string, formationId: string | null) {
  const ctx = await requireActorContext();
  requireMutationRole(ctx);
  const { eventId } = await requireLineupOrgAccess(lineupId, ctx.orgFilter);

  const lineup = await db.eventMatchLineup.findFirst({
    where: { id: lineupId, eventMatch: { event: ctx.orgFilter.filter } },
  });

  if (!lineup) throw new Error('Lineup not found');
  if (lineup.status === 'CONFIRMED') throw new Error('Cannot modify confirmed lineup');

  let formationSlots: { id: string; gridX: number; gridY: number; roleType: FormationSlotRoleType; acceptedPositionIds: string[]; sortOrder: number }[] = [];

  if (formationId) {
    const formation = await db.formation.findFirst({
      where: {
        id: formationId,
        ...ctx.orgFilter.filter,
      },
      select: { id: true },
    });
    if (!formation) {
      throw new Error('Formation not found or access denied.');
    }

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
      organisationId: ctx.organisationId,
    })),
  });

  const updated = await db.eventMatchLineup.update({
    where: { id: lineupId },
    data: { formationId },
  });

  revalidatePath(`/events/${eventId}`);
  return updated;
}

export async function autoFillEventMatchLineup(lineupId: string) {
  const ctx = await requireActorContext();
  requireMutationRole(ctx);
  const { eventId } = await requireLineupOrgAccess(lineupId, ctx.orgFilter);

  const lineup = await db.eventMatchLineup.findFirst({
    where: { id: lineupId, eventMatch: { event: ctx.orgFilter.filter } },
    include: {
      assignments: { orderBy: { slotIndex: 'asc' } },
    },
  });

  if (!lineup) throw new Error('Lineup not found');
  if (lineup.status === 'CONFIRMED') throw new Error('Cannot modify confirmed lineup');

  const eventMatch = await db.eventMatch.findFirst({
    where: { id: lineup.eventMatchId, event: ctx.orgFilter.filter },
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
    const isInSquad = squadPlayers.some((p) => p.id === update.playerId);
    await db.eventMatchLineupAssignment.update({
      where: { id: update.assignmentId },
      data: { playerId: update.playerId, source: isInSquad ? 'BASE_SQUAD' : 'HELPER' },
    });
  }

  revalidatePath(`/events/${eventId}`);
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
  const ctx = await requireActorContext();

  return db.formation.findMany({
    where: {
      gameFormat: gameFormat as GameFormat,
      isArchived: false,
      ...ctx.orgFilter.filter,
    },
    include: { slots: { orderBy: { sortOrder: 'asc' } } },
    orderBy: { name: 'asc' },
  });
}