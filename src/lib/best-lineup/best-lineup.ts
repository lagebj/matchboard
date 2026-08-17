import { db } from '@/lib/db';
import { getPlayerOverallRating } from '@/lib/ratings/player-rating';
import { getPlayerSlotCompatibility, type PlayerPositionInfo } from '@/lib/formations/lineup-compatibility';
import { createFormationSnapshot } from '@/lib/formations/snapshot';
import type { FormationSlotData, FormationSlotRoleType } from '@/lib/formations/types';
import type { OrgFilterMode } from '@/lib/tenancy/resolve-org-filter';
import { Prisma, type GameFormat } from '@/generated/prisma/client';

export type BestLineupSlot = {
  slotId: string;
  gridX: number;
  gridY: number;
  label: string;
  shortLabel: string;
  roleType: string;
  acceptedPositionIds: string[];
  sortOrder: number;
  playerId: string | null;
  playerFirstName: string | null;
  playerLastName: string | null;
  locked: boolean;
};

export type BestLineupData = {
  lineupId: string | null;
  teamId: string;
  teamName: string;
  formationId: string | null;
  formationName: string | null;
  formationGameFormat: string | null;
  slots: BestLineupSlot[];
  benchPlayerIds: string[];
};

type FormationSlotRow = {
  id: string;
  gridX: number;
  gridY: number;
  label: string;
  shortLabel: string;
  roleType: string;
  acceptedPositionIds: unknown;
  sortOrder: number;
};

type PlayerRow = {
  id: string;
  firstName: string;
  lastName: string | null;
  primaryPosition: string;
  secondaryPosition: string | null;
  tertiaryPosition: string | null;
  goalkeeperAbility: string;
  ballControl: number | null;
  passing: number | null;
  firstTouch: number | null;
  oneVOneAttacking: number | null;
  positioning: number | null;
  oneVOneDefending: number | null;
  decisionMaking: number | null;
  effort: number | null;
  teamplay: number | null;
  concentration: number | null;
  speed: number | null;
  strength: number | null;
  shirtNumber: number | null;
  coreTeamId: string | null;
};

function slotAcceptedPositionIds(slot: FormationSlotRow): string[] {
  return Array.isArray(slot.acceptedPositionIds) ? slot.acceptedPositionIds as string[] : [];
}

function toPlayerPositionInfo(p: PlayerRow): PlayerPositionInfo {
  return {
    playerId: p.id,
    primaryPosition: p.primaryPosition,
    secondaryPositions: [p.secondaryPosition, p.tertiaryPosition].filter((s): s is string => s !== null),
  };
}

function toSlotData(slot: FormationSlotRow) {
  return {
    id: slot.id,
    gridX: slot.gridX,
    gridY: slot.gridY,
    label: slot.label,
    shortLabel: slot.shortLabel,
    roleType: slot.roleType as FormationSlotRoleType,
    acceptedPositionIds: slotAcceptedPositionIds(slot),
    sortOrder: slot.sortOrder,
  };
}

export async function getBestLineup(teamId: string, orgFilter: OrgFilterMode): Promise<BestLineupData | null> {
  const team = await db.team.findFirst({
    where: { id: teamId, ...orgFilter.filter },
    select: { id: true, name: true },
  });
  if (!team) return null;

  const lineup = await db.teamBestLineup.findFirst({
    where: { teamId, team: orgFilter.filter },
    include: {
      formation: { include: { slots: { orderBy: { sortOrder: 'asc' } } } },
      assignments: { include: { player: { select: { id: true, firstName: true, lastName: true } } } },
    },
  });

  if (!lineup) {
    return {
      lineupId: null,
      teamId: team.id,
      teamName: team.name,
      formationId: null,
      formationName: null,
      formationGameFormat: null,
      slots: [],
      benchPlayerIds: [],
    };
  }

  const formationName = lineup.formation?.name ?? null;
  const formationGameFormat = lineup.formation?.gameFormat as string | null;
  const formationSlots = lineup.formation?.slots ?? [];

  const assignmentMap = new Map(lineup.assignments.map((a) => [a.slotId, a]));

  const slots: BestLineupSlot[] = formationSlots.map((slot) => {
    const assignment = assignmentMap.get(slot.id);
    return {
      slotId: slot.id,
      gridX: slot.gridX,
      gridY: slot.gridY,
      label: slot.label,
      shortLabel: slot.shortLabel,
      roleType: slot.roleType,
      acceptedPositionIds: slotAcceptedPositionIds(slot),
      sortOrder: slot.sortOrder,
      playerId: assignment?.playerId ?? null,
      playerFirstName: assignment?.player?.firstName ?? null,
      playerLastName: assignment?.player?.lastName ?? null,
      locked: assignment?.locked ?? false,
    };
  });

  return {
    lineupId: lineup.id,
    teamId: team.id,
    teamName: team.name,
    formationId: lineup.formationId,
    formationName,
    formationGameFormat,
    slots,
    benchPlayerIds: [],
  };
}

export async function autoSelectBestLineup(teamId: string, orgFilter: OrgFilterMode, formationId?: string): Promise<BestLineupData> {
  const team = await db.team.findFirst({
    where: { id: teamId, ...orgFilter.filter },
    select: { id: true, name: true, footballGroupId: true, organisationId: true },
  });
  if (!team) throw new Error('Team not found');

  const players = await db.player.findMany({
    where: {
      coreTeamId: teamId,
      active: true,
      removedAt: null,
    },
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
      speed: true,
      strength: true,
      shirtNumber: true,
      coreTeamId: true,
    },
  });

  const targetFormationId = formationId ?? await getDefaultFormationId(teamId, team.footballGroupId);
  if (!targetFormationId) {
    throw new Error('No formation available. Configure a formation for this team first.');
  }

  const formation = await db.formation.findFirst({
    where: { id: targetFormationId },
    include: { slots: { orderBy: { sortOrder: 'asc' } } },
  });
  if (!formation) throw new Error('Formation not found');

  const formationSlots = formation.slots as FormationSlotRow[];

  const existingLineup = await db.teamBestLineup.findFirst({
    where: { teamId, team: orgFilter.filter },
    include: { assignments: true },
  });

  const lockedAssignments = new Map<string, string>();
  if (existingLineup) {
    for (const a of existingLineup.assignments) {
      if (a.locked && a.playerId) {
        lockedAssignments.set(a.slotId, a.playerId);
      }
    }
  }

  const assignedPlayerIds = new Set<string>();
  const slotAssignments = new Map<string, string>();

  for (const [slotId, playerId] of lockedAssignments) {
    if (players.some((p) => p.id === playerId)) {
      slotAssignments.set(slotId, playerId);
      assignedPlayerIds.add(playerId);
    }
  }

  const gkSlots = formationSlots.filter((s) => s.roleType === 'GOALKEEPER');
  const otherSlots = formationSlots.filter((s) => s.roleType !== 'GOALKEEPER');

  const sortedOtherSlots = [...otherSlots].sort((a, b) => {
    const aCompat = countCompatiblePlayers(players, a, assignedPlayerIds);
    const bCompat = countCompatiblePlayers(players, b, assignedPlayerIds);
    return aCompat - bCompat;
  });

  const orderedSlots = [...gkSlots, ...sortedOtherSlots];

  for (const slot of orderedSlots) {
    if (slotAssignments.has(slot.id)) continue;

    const available = players.filter((p) => !assignedPlayerIds.has(p.id));
    if (available.length === 0) continue;

    const slotData: FormationSlotData = {
      id: slot.id,
      gridX: slot.gridX,
      gridY: slot.gridY,
      label: slot.label,
      shortLabel: slot.shortLabel,
      roleType: slot.roleType as FormationSlotRoleType,
      acceptedPositionIds: slotAcceptedPositionIds(slot),
      sortOrder: slot.sortOrder,
    };
    const compatPlayers = available
      .map((p) => {
        const posInfo = toPlayerPositionInfo(p);
        const compat = getPlayerSlotCompatibility(posInfo, slotData);
        const rating = getPlayerOverallRating(p);
        return { player: p, isCompatible: compat.isCompatible, reason: compat.compatibilityReason, rating: rating.value ?? 0 };
      })
      .filter((item) => item.isCompatible)
      .sort((a, b) => {
        const aIsPrimary = a.reason?.includes('Registered as') ? 0 : 1;
        const bIsPrimary = b.reason?.includes('Registered as') ? 0 : 1;
        if (aIsPrimary !== bIsPrimary) return aIsPrimary - bIsPrimary;
        return b.rating - a.rating;
      });

    if (compatPlayers.length > 0) {
      slotAssignments.set(slot.id, compatPlayers[0].player.id);
      assignedPlayerIds.add(compatPlayers[0].player.id);
    }
  }

  const snapshot = createFormationSnapshot(
    formation.id,
    formation.name,
    formation.gameFormat as GameFormat,
    formationSlots.map((s) => toSlotData(s)),
  );

  const lineup = await db.teamBestLineup.upsert({
    where: { teamId },
    update: {
      formationId: formation.id,
      formationSnapshot: snapshot as Prisma.InputJsonValue,
    },
    create: {
      teamId,
      organisationId: team.organisationId,
      formationId: formation.id,
      formationSnapshot: snapshot as Prisma.InputJsonValue,
    },
    include: { assignments: true },
  });

  await syncAssignments(lineup.id, formationSlots, slotAssignments, lockedAssignments, team.organisationId);

  return getBestLineup(teamId, orgFilter) as Promise<BestLineupData>;
}

function countCompatiblePlayers(
  players: PlayerRow[],
  slot: FormationSlotRow,
  exclude: Set<string>,
): number {
  const slotData: FormationSlotData = {
    id: slot.id,
    gridX: slot.gridX,
    gridY: slot.gridY,
    label: slot.label,
    shortLabel: slot.shortLabel,
    roleType: slot.roleType as FormationSlotRoleType,
    acceptedPositionIds: slotAcceptedPositionIds(slot),
    sortOrder: slot.sortOrder,
  };
  return players.filter((p) => {
    if (exclude.has(p.id)) return false;
    return getPlayerSlotCompatibility(toPlayerPositionInfo(p), slotData).isCompatible;
  }).length;
}

async function syncAssignments(
  lineupId: string,
  slots: FormationSlotRow[],
  assignments: Map<string, string>,
  lockedAssignments: Map<string, string>,
  organisationId: string,
): Promise<void> {
  const existing = await db.teamBestLineupAssignment.findMany({
    where: { bestLineupId: lineupId },
  });
  const existingMap = new Map(existing.map((a) => [a.slotId, a]));

  const currentSlotIds = new Set(slots.map((s) => s.id));

  for (const existingAssignment of existing) {
    if (!currentSlotIds.has(existingAssignment.slotId)) {
      await db.teamBestLineupAssignment.delete({
        where: { id: existingAssignment.id },
      });
    }
  }

  for (const slot of slots) {
    const playerId = assignments.get(slot.id) ?? null;
    const isLocked = lockedAssignments.has(slot.id);
    const existingAssignment = existingMap.get(slot.id);

    if (existingAssignment) {
      if (existingAssignment.playerId !== playerId || existingAssignment.locked !== isLocked) {
        await db.teamBestLineupAssignment.update({
          where: { id: existingAssignment.id },
          data: { playerId, locked: isLocked },
        });
      }
    } else if (playerId) {
      await db.teamBestLineupAssignment.create({
        data: {
          bestLineupId: lineupId,
          organisationId,
          slotId: slot.id,
          playerId,
          locked: isLocked,
        },
      });
    }
  }
}

async function getDefaultFormationId(teamId: string, groupId: string): Promise<string | null> {
  const teamFormation = await db.formation.findFirst({
    where: { teamId, isArchived: false, source: 'CUSTOM' },
    orderBy: { createdAt: 'desc' },
  });
  if (teamFormation) return teamFormation.id;

  const groupTeams = await db.team.findMany({
    where: { footballGroupId: groupId },
    select: { id: true },
  });
  const teamIds = groupTeams.map((t) => t.id);

  const siblingFormation = await db.formation.findFirst({
    where: { teamId: { in: teamIds }, isArchived: false, source: 'CUSTOM' },
    orderBy: { createdAt: 'desc' },
  });
  if (siblingFormation) return siblingFormation.id;

  const systemFormation = await db.formation.findFirst({
    where: { source: 'SYSTEM', isArchived: false },
    orderBy: { name: 'asc' },
  });
  return systemFormation?.id ?? null;
}

export async function setBestLineupFormation(teamId: string, formationId: string, orgFilter: OrgFilterMode): Promise<BestLineupData> {
  const team = await db.team.findFirst({
    where: { id: teamId, ...orgFilter.filter },
    select: { id: true, organisationId: true },
  });
  if (!team) throw new Error('Team not found');

  const formation = await db.formation.findFirst({
    where: { id: formationId },
    include: { slots: { orderBy: { sortOrder: 'asc' } } },
  });
  if (!formation) throw new Error('Formation not found');

  const snapshot = createFormationSnapshot(
    formation.id,
    formation.name,
    formation.gameFormat as GameFormat,
    formation.slots.map((s) => toSlotData(s as FormationSlotRow)),
  );

  const lineup = await db.teamBestLineup.upsert({
    where: { teamId },
    update: {
      formationId: formation.id,
      formationSnapshot: snapshot as Prisma.InputJsonValue,
    },
    create: {
      teamId,
      organisationId: team.organisationId,
      formationId: formation.id,
      formationSnapshot: snapshot as Prisma.InputJsonValue,
    },
    include: { assignments: true },
  });

  const formationSlots = formation.slots as FormationSlotRow[];
  const newSlotIds = new Set(formationSlots.map((s) => s.id));

  const preservedAssignments = new Map<string, { playerId: string | null; locked: boolean }>();
  for (const assignment of lineup.assignments) {
    if (newSlotIds.has(assignment.slotId)) {
      let playerId = assignment.playerId;
      let locked = assignment.locked;
      if (playerId) {
        const playerStillValid = await db.player.findFirst({
          where: { id: playerId, ...orgFilter.filter },
          select: { id: true, active: true, removedAt: true },
        });
        if (!playerStillValid || !playerStillValid.active || playerStillValid.removedAt) {
          playerId = null;
          locked = false;
        }
      }
      preservedAssignments.set(assignment.slotId, { playerId, locked });
    }
  }

  await db.teamBestLineupAssignment.deleteMany({
    where: { bestLineupId: lineup.id },
  });

  for (const [slotId, data] of preservedAssignments) {
    if (data.playerId) {
      await db.teamBestLineupAssignment.create({
        data: {
          bestLineupId: lineup.id,
          organisationId: team.organisationId,
          slotId,
          playerId: data.playerId,
          locked: data.locked,
        },
      });
    }
  }

  return getBestLineup(teamId, orgFilter) as Promise<BestLineupData>;
}

export async function assignPlayerToBestLineupSlot(
  lineupId: string,
  slotId: string,
  playerId: string | null,
  orgFilter: OrgFilterMode,
  locked?: boolean,
): Promise<void> {
  const lineup = await db.teamBestLineup.findFirst({
    where: { id: lineupId, team: orgFilter.filter },
    include: { assignments: true },
  });
  if (!lineup) throw new Error('Best lineup not found');

  if (playerId) {
    const player = await db.player.findFirst({
      where: { id: playerId, ...orgFilter.filter },
      select: { id: true, active: true, removedAt: true },
    });
    if (!player || !player.active || player.removedAt) {
      throw new Error('Player is not active or has been removed.');
    }

    const duplicateAssignment = lineup.assignments.find(
      (a) => a.playerId === playerId && a.slotId !== slotId,
    );
    if (duplicateAssignment) {
      await db.teamBestLineupAssignment.update({
        where: { id: duplicateAssignment.id },
        data: { playerId: null },
      });
    }
  }

  const existing = lineup.assignments.find((a) => a.slotId === slotId);
  if (existing) {
    await db.teamBestLineupAssignment.update({
      where: { id: existing.id },
      data: {
        ...(playerId !== undefined && { playerId }),
        ...(locked !== undefined && { locked }),
      },
    });
  } else if (playerId) {
    await db.teamBestLineupAssignment.create({
      data: {
        bestLineupId: lineupId,
        organisationId: lineup.organisationId,
        slotId,
        playerId,
        locked: locked ?? false,
      },
    });
  }
}

export async function clearBestLineupSlot(lineupId: string, slotId: string): Promise<void> {
  await db.teamBestLineupAssignment.deleteMany({
    where: { bestLineupId: lineupId, slotId },
  });
}

export async function clearBestLineup(teamId: string, orgFilter: OrgFilterMode): Promise<void> {
  const lineup = await db.teamBestLineup.findFirst({
    where: { teamId, team: orgFilter.filter },
  });
  if (!lineup) return;

  await db.teamBestLineupAssignment.deleteMany({
    where: { bestLineupId: lineup.id },
  });

  await db.teamBestLineup.update({
    where: { id: lineup.id },
    data: { formationId: null, formationSnapshot: Prisma.JsonNull },
  });
}

export async function deleteBestLineup(teamId: string, orgFilter: OrgFilterMode): Promise<void> {
  await db.teamBestLineup.deleteMany({
    where: { teamId, team: orgFilter.filter },
  });
}

export async function copyBestLineupToMatch(
  teamId: string,
  matchId: string,
  orgFilter: OrgFilterMode,
): Promise<{ applied: number; skipped: number; skippedReasons: Array<{ slotId: string; playerId: string; reason: string }> }> {
  const bestLineup = await db.teamBestLineup.findFirst({
    where: { teamId, team: orgFilter.filter },
    include: {
      formation: { include: { slots: { orderBy: { sortOrder: 'asc' } } } },
      assignments: { include: { player: { select: { id: true, active: true, removedAt: true, coreTeamId: true } } } },
    },
  });

  if (!bestLineup || !bestLineup.formationId) {
    throw new Error('No best lineup configured for this team.');
  }

  const match = await db.match.findFirst({
    where: { id: matchId, ...orgFilter.filter },
    select: { id: true, teamId: true, organisationId: true },
  });
  if (!match) throw new Error('Match not found');

  const formation = await db.formation.findFirst({
    where: { id: bestLineup.formationId },
    include: { slots: { orderBy: { sortOrder: 'asc' } } },
  });
  if (!formation) throw new Error('Formation not found');

  let matchLineupId: string;
  const existingLineup = await db.matchLineup.findFirst({
    where: { matchId, teamId },
  });

  if (existingLineup) {
    matchLineupId = existingLineup.id;
    await db.matchLineup.update({
      where: { id: matchLineupId },
      data: {
        formationId: bestLineup.formationId,
        formationSnapshot: bestLineup.formationSnapshot as Prisma.InputJsonValue,
      },
    });
    await db.matchLineupAssignment.deleteMany({
      where: { matchLineupId },
    });
    for (const slot of formation.slots) {
      await db.matchLineupAssignment.create({
        data: {
          matchLineupId,
          organisationId: match.organisationId,
          slotId: slot.id,
          playerId: null,
          source: 'MANUAL',
        },
      });
    }
  } else {
    const snapshot = bestLineup.formationSnapshot ?? createFormationSnapshot(
      formation.id,
      formation.name,
      formation.gameFormat as GameFormat,
      formation.slots.map((s) => toSlotData(s as FormationSlotRow)),
    );

    const newLineup = await db.matchLineup.create({
      data: {
        matchId,
        teamId,
        organisationId: match.organisationId,
        formationId: bestLineup.formationId,
        formationSnapshot: snapshot as Prisma.InputJsonValue,
        status: 'DRAFT',
      },
    });
    matchLineupId = newLineup.id;

    for (const slot of formation.slots) {
      await db.matchLineupAssignment.create({
        data: {
          matchLineupId,
          organisationId: match.organisationId,
          slotId: slot.id,
          playerId: null,
          source: 'MANUAL',
        },
      });
    }
  }

  const matchAvailabilities = await db.availability.findMany({
    where: { matchId, status: 'UNAVAILABLE' },
    select: { playerId: true },
  });
  const unavailablePlayerIds = new Set(matchAvailabilities.map((a) => a.playerId));

  let applied = 0;
  let skipped = 0;
  const skippedReasons: Array<{ slotId: string; playerId: string; reason: string }> = [];

  for (const assignment of bestLineup.assignments) {
    if (!assignment.playerId) continue;

    const player = assignment.player;
    if (!player || !player.active || player.removedAt) {
      skipped++;
      skippedReasons.push({
        slotId: assignment.slotId,
        playerId: assignment.playerId,
        reason: 'Player is no longer active',
      });
      continue;
    }

    if (unavailablePlayerIds.has(assignment.playerId)) {
      skipped++;
      skippedReasons.push({
        slotId: assignment.slotId,
        playerId: assignment.playerId,
        reason: 'Player is unavailable for this match',
      });
      continue;
    }

    const slotExists = formation.slots.some((s) => s.id === assignment.slotId);
    if (!slotExists) {
      skipped++;
      skippedReasons.push({
        slotId: assignment.slotId,
        playerId: assignment.playerId,
        reason: 'Slot no longer exists in formation',
      });
      continue;
    }

    const existingSlotAssignment = await db.matchLineupAssignment.findFirst({
      where: { matchLineupId, slotId: assignment.slotId },
    });

    const duplicateAssignment = await db.matchLineupAssignment.findFirst({
      where: { matchLineupId, playerId: assignment.playerId },
    });
    if (duplicateAssignment && duplicateAssignment.slotId !== assignment.slotId) {
      await db.matchLineupAssignment.update({
        where: { id: duplicateAssignment.id },
        data: { playerId: null },
      });
    }

    if (existingSlotAssignment) {
      await db.matchLineupAssignment.update({
        where: { id: existingSlotAssignment.id },
        data: { playerId: assignment.playerId, source: 'MANUAL' },
      });
    } else {
      await db.matchLineupAssignment.create({
        data: {
          matchLineupId,
          organisationId: match.organisationId,
          slotId: assignment.slotId,
          playerId: assignment.playerId,
          source: 'MANUAL',
        },
      });
    }
    applied++;
  }

  return { applied, skipped, skippedReasons };
}

export async function getFormationsForTeam(teamId: string, orgFilter: OrgFilterMode): Promise<Array<{ id: string; name: string; gameFormat: string; source: string; isArchived: boolean }>> {
  const team = await db.team.findFirst({
    where: { id: teamId, ...orgFilter.filter },
    select: { footballGroupId: true },
  });
  if (!team) return [];

  const groupTeams = await db.team.findMany({
    where: { footballGroupId: team.footballGroupId },
    select: { id: true },
  });
  const teamIds = groupTeams.map((t) => t.id);

  const formations = await db.formation.findMany({
    where: {
      isArchived: false,
      OR: [
        { teamId: { in: [...teamIds] } },
        { source: 'SYSTEM' },
      ],
    },
    orderBy: [{ source: 'desc' }, { name: 'asc' }],
    select: { id: true, name: true, gameFormat: true, source: true, isArchived: true },
  });

  return formations.map((f) => ({
    id: f.id,
    name: f.name,
    gameFormat: f.gameFormat as string,
    source: f.source as string,
    isArchived: f.isArchived,
  }));
}