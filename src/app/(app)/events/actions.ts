'use server'

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { requireCoachAccess } from '@/lib/auth';
import {
  type EventType,
  type GameFormat,
  type EventPlayerStatus,
  type EventSquadIntent,
  type EventSelectionPattern,
} from '@/generated/prisma/client';
import type { BroadPosition } from '@/lib/events/event-types';

const VALID_EVENT_TYPES: EventType[] = ['CUP', 'TOURNAMENT', 'FRIENDLY_DAY', 'OTHER'];
const VALID_GAME_FORMATS: GameFormat[] = ['THREE_A_SIDE', 'FIVE_A_SIDE', 'SEVEN_A_SIDE', 'NINE_A_SIDE', 'ELEVEN_A_SIDE'];
const VALID_STATUSES: EventPlayerStatus[] = ['AVAILABLE', 'UNAVAILABLE', 'UNKNOWN', 'RESERVE', 'LATE_ADDITION', 'WITHDRAWN'];
const VALID_INTENTS: EventSquadIntent[] = ['COMPETITIVE', 'BALANCED', 'MANUAL'];
const VALID_PATTERNS: EventSelectionPattern[] = ['ALL_BALANCED', 'ONE_COMPETITIVE_BALANCED_REMAINDER', 'MANUAL_SEED_AUTO_BALANCE'];

function parseEnum<T extends string>(value: string | null | undefined, validValues: readonly T[], defaultValue: T): T {
  if (!value) return defaultValue;
  if (validValues.includes(value as T)) return value as T;
  return defaultValue;
}

export async function getEvents() {
  await requireCoachAccess();
  return db.event.findMany({
    orderBy: { startsAt: 'desc' },
    include: {
      squads: {
        include: {
          players: {
            include: { player: true },
          },
        },
      },
      players: {
        include: { player: true },
      },
    },
  });
}

export async function getEventById(id: string) {
  await requireCoachAccess();
  return db.event.findUnique({
    where: { id },
    include: {
      squads: {
        include: {
          players: {
            include: { player: true },
          },
          formation: {
            include: { slots: true },
          },
        },
        orderBy: { generationOrder: 'asc' },
      },
      players: {
        include: { player: { include: { coreTeam: true } } },
      },
    },
  });
}

export async function createEventAction(formData: FormData) {
  await requireCoachAccess();

  const name = (formData.get('name') as string)?.trim() || '';
  const eventTypeRaw = formData.get('eventType') as string | null;
  const startsAt = formData.get('startsAt') as string;
  const endsAt = (formData.get('endsAt') as string) || null;
  const gameFormatRaw = formData.get('gameFormat') as string | null;
  const sourcePlanningPeriodId = (formData.get('sourcePlanningPeriodId') as string) || null;
  const defaultFormationId = (formData.get('defaultFormationId') as string) || null;
  const selectionPatternRaw = formData.get('selectionPattern') as string | null;
  const notes = (formData.get('notes') as string)?.trim() || null;

  if (!name) throw new Error('Event name is required.');
  if (!startsAt) throw new Error('Start date is required.');

  const eventType = parseEnum(eventTypeRaw, VALID_EVENT_TYPES, 'CUP');
  const gameFormat = parseEnum(gameFormatRaw, VALID_GAME_FORMATS, 'SEVEN_A_SIDE');
  const selectionPattern = selectionPatternRaw ? parseEnum(selectionPatternRaw, VALID_PATTERNS, 'ALL_BALANCED') : null;

  const squadCount = parseInt(formData.get('squadCount') as string) || 2;
  const targetSize = parseInt(formData.get('targetSize') as string) || 7;

  const event = await db.event.create({
    data: {
      name,
      eventType,
      startsAt: new Date(startsAt),
      endsAt: endsAt ? new Date(endsAt) : null,
      gameFormat,
      sourcePlanningPeriodId,
      defaultFormationId: defaultFormationId || undefined,
      selectionPattern,
      notes,
      squads: {
        create: Array.from({ length: squadCount }, (_, i) => ({
          name: i === 0 ? 'Squad 1' : `Squad ${i + 1}`,
          intent: i === 0 && selectionPattern === 'ONE_COMPETITIVE_BALANCED_REMAINDER' ? 'COMPETITIVE' as const : 'BALANCED' as const,
          targetSize,
          generationOrder: i,
        })),
      },
    },
    include: {
      squads: true,
      players: true,
    },
  });

  revalidatePath('/events');
  return event;
}

export async function updateEventAction(id: string, formData: FormData) {
  await requireCoachAccess();

  const name = (formData.get('name') as string)?.trim() || '';
  const eventTypeRaw = formData.get('eventType') as string | null;
  const startsAt = formData.get('startsAt') as string;
  const endsAt = (formData.get('endsAt') as string) || null;
  const gameFormatRaw = formData.get('gameFormat') as string | null;
  const defaultFormationId = (formData.get('defaultFormationId') as string) || null;
  const selectionPatternRaw = formData.get('selectionPattern') as string | null;
  const notes = (formData.get('notes') as string)?.trim() || null;

  if (!name) throw new Error('Event name is required.');

  const eventType = parseEnum(eventTypeRaw, VALID_EVENT_TYPES, 'CUP');
  const gameFormat = parseEnum(gameFormatRaw, VALID_GAME_FORMATS, 'SEVEN_A_SIDE');
  const selectionPattern = selectionPatternRaw ? parseEnum(selectionPatternRaw, VALID_PATTERNS, 'ALL_BALANCED') : null;

  const event = await db.event.update({
    where: { id },
    data: {
      name,
      eventType,
      startsAt: new Date(startsAt),
      endsAt: endsAt ? new Date(endsAt) : null,
      gameFormat,
      defaultFormationId: defaultFormationId || null,
      selectionPattern,
      notes,
    },
  });

  revalidatePath('/events');
  revalidatePath(`/events/${id}`);
  return event;
}

export async function deleteEventAction(id: string) {
  await requireCoachAccess();

  await db.event.delete({
    where: { id },
  });

  revalidatePath('/events');
}

export async function updateEventPlayerAvailability(
  eventId: string,
  playerId: string,
  status: EventPlayerStatus,
) {
  await requireCoachAccess();

  if (!VALID_STATUSES.includes(status)) {
    throw new Error(`Invalid availability status: ${status}`);
  }

  await db.eventPlayerAvailability.upsert({
    where: {
      eventId_playerId: { eventId, playerId },
    },
    create: {
      eventId,
      playerId,
      status,
    },
    update: {
      status,
    },
  });

  revalidatePath(`/events/${eventId}`);
}

export async function setEventPlayerPool(
  eventId: string,
  playerIds: string[],
  defaultStatus: EventPlayerStatus = 'UNKNOWN',
) {
  await requireCoachAccess();

  if (!VALID_STATUSES.includes(defaultStatus)) {
    throw new Error(`Invalid availability status: ${defaultStatus}`);
  }

  await db.$transaction(async (tx) => {
    await tx.eventPlayerAvailability.deleteMany({
      where: { eventId },
    });

    if (playerIds.length > 0) {
      await tx.eventPlayerAvailability.createMany({
        data: playerIds.map((playerId) => ({
          eventId,
          playerId,
          status: defaultStatus,
        })),
      });
    }
  });

  revalidatePath(`/events/${eventId}`);
}

export async function addEventSquadAction(
  eventId: string,
  name: string,
  intent: EventSquadIntent,
  targetSize: number,
  formationId?: string,
) {
  await requireCoachAccess();

  if (!VALID_INTENTS.includes(intent)) {
    throw new Error(`Invalid squad intent: ${intent}`);
  }

  const maxOrder = await db.eventSquad.findFirst({
    where: { eventId },
    orderBy: { generationOrder: 'desc' },
    select: { generationOrder: true },
  });

  const squad = await db.eventSquad.create({
    data: {
      eventId,
      name,
      intent,
      targetSize,
      formationId: formationId || undefined,
      generationOrder: (maxOrder?.generationOrder ?? -1) + 1,
    },
  });

  revalidatePath(`/events/${eventId}`);
  return squad;
}

export async function updateEventSquadAction(
  squadId: string,
  data: {
    name?: string;
    intent?: EventSquadIntent;
    targetSize?: number;
    minSize?: number;
    maxSize?: number;
    formationId?: string;
  },
) {
  await requireCoachAccess();

  const updateData: Parameters<typeof db.eventSquad.update>[0]['data'] = {};

  if (data.name !== undefined) updateData.name = data.name;
  if (data.intent !== undefined) {
    if (!VALID_INTENTS.includes(data.intent)) {
      throw new Error(`Invalid squad intent: ${data.intent}`);
    }
    updateData.intent = data.intent;
  }
  if (data.targetSize !== undefined) updateData.targetSize = data.targetSize;
  if (data.minSize !== undefined) updateData.minSize = data.minSize;
  if (data.maxSize !== undefined) updateData.maxSize = data.maxSize;
  if (data.formationId !== undefined) updateData.formationId = data.formationId || null;

  const squad = await db.eventSquad.update({
    where: { id: squadId },
    data: updateData,
  });

  const eventId = squad.eventId;
  revalidatePath(`/events/${eventId}`);
  return squad;
}

export async function removeEventSquadAction(squadId: string) {
  await requireCoachAccess();

  const squad = await db.eventSquad.findUnique({
    where: { id: squadId },
    select: { eventId: true },
  });

  if (!squad) throw new Error('Squad not found.');

  await db.eventSquad.delete({
    where: { id: squadId },
  });

  revalidatePath(`/events/${squad.eventId}`);
}

export async function movePlayerBetweenSquadsAction(
  playerId: string,
  fromSquadId: string,
  toSquadId: string,
) {
  await requireCoachAccess();

  const existing = await db.eventSquadPlayer.findFirst({
    where: { playerId, eventSquadId: fromSquadId },
  });

  if (!existing) throw new Error('Player not found in source squad.');

  await db.$transaction(async (tx) => {
    await tx.eventSquadPlayer.delete({
      where: { id: existing.id },
    });

    await tx.eventSquadPlayer.create({
      data: {
        eventSquadId: toSquadId,
        playerId,
        source: 'MANUAL',
        locked: false,
        selectionReason: 'Moved by coach',
      },
    });
  });

  const toSquad = await db.eventSquad.findUnique({
    where: { id: toSquadId },
    select: { eventId: true },
  });

  if (toSquad) {
    revalidatePath(`/events/${toSquad.eventId}`);
  }
}

export async function togglePlayerLockAction(
  squadPlayerId: string,
  locked: boolean,
) {
  await requireCoachAccess();

  const squadPlayer = await db.eventSquadPlayer.update({
    where: { id: squadPlayerId },
    data: {
      locked,
      source: locked ? 'LOCKED' : 'MANUAL',
      selectionReason: locked ? 'Locked by coach' : 'Unlocked by coach',
    },
  });

  const squad = await db.eventSquad.findUnique({
    where: { id: squadPlayer.eventSquadId },
    select: { eventId: true },
  });

  if (squad) {
    revalidatePath(`/events/${squad.eventId}`);
  }

  return squadPlayer;
}

export async function clearEventSquadsAction(eventId: string) {
  await requireCoachAccess();

  const squads = await db.eventSquad.findMany({
    where: { eventId },
    select: { id: true },
  });

  await db.$transaction(async (tx) => {
    for (const squad of squads) {
      await tx.eventSquadPlayer.deleteMany({
        where: { eventSquadId: squad.id },
      });
    }
  });

  revalidatePath(`/events/${eventId}`);
}

export async function getPlanningPeriods() {
  await requireCoachAccess();
  return db.planningPeriod.findMany({
    orderBy: { startDate: 'desc' },
  });
}

export async function getFormations() {
  await requireCoachAccess();
  return db.formation.findMany({
    where: { isArchived: false },
    include: { slots: true },
    orderBy: [{ gameFormat: 'asc' }, { name: 'asc' }],
  });
}

export async function getAvailablePlayersForEvent(_planningPeriodId?: string) {
  await requireCoachAccess();

  return db.player.findMany({
    where: {
      active: true,
      removedAt: null,
    },
    include: {
      coreTeam: true,
      positions: true,
    },
    orderBy: [{ firstName: 'asc' }],
  });
}

export async function generateEventSquadsAction(eventId: string) {
  await requireCoachAccess();

  const event = await db.event.findUnique({
    where: { id: eventId },
    include: {
      squads: {
        include: {
          players: true,
          formation: { include: { slots: true } },
        },
        orderBy: { generationOrder: 'asc' },
      },
      players: {
        include: { player: true },
      },
    },
  });

  if (!event) throw new Error('Event not found.');

  const availableStatuses = ['AVAILABLE'] as const;
  const includeReserves = false;
  const includeLate = false;

  const eligiblePlayers = event.players.filter((ep) => {
    if (availableStatuses.includes(ep.status as typeof availableStatuses[number])) return true;
    if (includeReserves && ep.status === 'RESERVE') return true;
    if (includeLate && ep.status === 'LATE_ADDITION') return true;
    return false;
  });

  const playersWithAttrs = eligiblePlayers.map((ep) => {
    const p = ep.player;
    return {
      playerId: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      coreTeamId: p.coreTeamId,
      primaryPosition: p.primaryPosition ?? 'flexible',
      secondaryPosition: p.secondaryPosition,
      tertiaryPosition: p.tertiaryPosition,
      goalkeeperAbility: (p.goalkeeperAbility ?? 'NO') as 'NO' | 'EMERGENCY' | 'YES',
      ballControl: p.ballControl,
      passing: p.passing,
      firstTouch: p.firstTouch,
      oneVOneAttacking: p.oneVOneAttacking,
      positioning: p.positioning,
      oneVOneDefending: p.oneVOneDefending,
      decisionMaking: p.decisionMaking,
      effort: p.effort,
      teamplay: p.teamplay,
      concentration: p.concentration,
      speed: p.speed,
      strength: p.strength,
      nonRotatable: p.nonRotatable,
      preferredFoot: p.preferredFoot ?? 'RIGHT',
      bestSide: p.bestSide ?? 'RIGHT',
    };
  });

  const lockedAssignments = new Map<string, string>();
  for (const squad of event.squads) {
    for (const sp of squad.players) {
      if (sp.locked) {
        lockedAssignments.set(sp.playerId, squad.id);
      }
    }
  }

  const { generateEventSquads } = await import('@/lib/events/event-squad-generation');
  const { validateEventPool } = await import('@/lib/events/event-validation');
  const typeGameFormat = event.gameFormat as 'THREE_A_SIDE' | 'FIVE_A_SIDE' | 'SEVEN_A_SIDE' | 'NINE_A_SIDE' | 'ELEVEN_A_SIDE';

  const squads = event.squads.map((s) => ({
    id: s.id,
    name: s.name,
    intent: s.intent as 'COMPETITIVE' | 'BALANCED' | 'MANUAL',
    targetSize: s.targetSize,
    minSize: s.minSize,
    maxSize: s.maxSize,
    formationId: s.formationId,
    generationOrder: s.generationOrder,
  }));

  const formationSlots: { roleType: string; acceptedPositions: BroadPosition[]; label: string }[] = [];
  const defaultFormation = event.squads[0]?.formation;
  if (defaultFormation?.slots) {
    for (const slot of defaultFormation.slots) {
      const posIds = typeof slot.acceptedPositionIds === 'string'
        ? slot.acceptedPositionIds.split(',').map((s: string) => s.trim() as BroadPosition)
        : Array.isArray(slot.acceptedPositionIds)
          ? (slot.acceptedPositionIds as string[]).map((s) => s.trim() as BroadPosition)
          : [];
      formationSlots.push({
        roleType: slot.roleType,
        acceptedPositions: posIds,
        label: slot.label ?? slot.roleType,
      });
    }
  }

  const validation = validateEventPool(
    playersWithAttrs,
    event.squads.length,
    event.squads[0]?.targetSize ?? 7,
    typeGameFormat,
    formationSlots,
  );

  const result = generateEventSquads({
    eventId: event.id,
    players: playersWithAttrs,
    formations: defaultFormation ? [defaultFormation] : [],
    defaultFormationId: event.defaultFormationId,
    squads,
    selectionPattern: (event.selectionPattern ?? 'ALL_BALANCED') as 'ALL_BALANCED' | 'ONE_COMPETITIVE_BALANCED_REMAINDER' | 'MANUAL_SEED_AUTO_BALANCE',
    lockedAssignments,
    includeReserves,
    includeLateAdditions: includeLate,
    gameFormat: typeGameFormat,
  });

  await db.$transaction(async (tx) => {
    for (const squad of event.squads) {
      await tx.eventSquadPlayer.deleteMany({
        where: { eventSquadId: squad.id, locked: false },
      });
    }

    for (const assignment of result.assignments) {
      if (assignment.source === 'LOCKED') continue;

      const existing = await tx.eventSquadPlayer.findFirst({
        where: {
          playerId: assignment.playerId,
          eventSquadId: assignment.eventSquadId,
        },
      });

      if (!existing) {
        await tx.eventSquadPlayer.create({
          data: {
            eventSquadId: assignment.eventSquadId,
            playerId: assignment.playerId,
            source: assignment.source,
            locked: assignment.locked,
            selectionReason: assignment.selectionReason,
          },
        });
      }
    }
  });

  revalidatePath(`/events/${eventId}`);

  return {
    validation,
    balanceSummaries: result.balanceSummaries,
    validationNotes: result.validationNotes,
    warnings: result.warnings,
  };
}