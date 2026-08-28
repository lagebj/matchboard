'use server'

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { supersedePendingReviews } from '@/lib/review/review-service';
import { enqueueAndSendNotification } from '@/lib/email/outbox';
import { requirePageActorContext, requireMutationRole } from '@/lib/auth/actor-context';
import { getOrCreateDefaultGroup } from '@/lib/groups/group-domain';
import { type OrgFilterMode } from '@/lib/tenancy/resolve-org-filter';
import type { FormationSlotRoleType, EventPlayerStatus, EventSquadIntent, GameFormat } from '@/generated/prisma/client';
import {
  VALID_EVENT_TYPES,
  VALID_GAME_FORMATS,
  VALID_EVENT_PLAYER_STATUSES,
  VALID_SQUAD_INTENTS,
  VALID_SELECTION_PATTERNS,
  parseEnum,
  parseNumberOfHalves,
  parseNullableNumberOfHalvesOverride,
  parseNullablePositiveMinutesOverride,
  parseNullableNonNegativeMinutesOverride,
} from '@/lib/events/event-validation-constants';
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import type { BroadPosition } from '@/lib/events/event-types';

async function requireEventOrgAccess(eventId: string, orgFilter: OrgFilterMode): Promise<void> {
  if (orgFilter.type === 'org') {
    const event = await db.event.findFirst({
      where: { id: eventId, ...orgFilter.filter },
      select: { id: true },
    });
    if (!event) throw new Error('Event not found or access denied.');
  } else {
    const event = await db.event.findFirst({
      where: { id: eventId },
      select: { id: true },
    });
    if (!event) throw new Error('Event not found.');
  }
}

async function requireEventNotFinalized(eventId: string, orgFilter: OrgFilterMode): Promise<void> {
  const event = await db.event.findFirst({
    where: { id: eventId, ...(orgFilter.type === 'org' ? orgFilter.filter : {}) },
    select: { status: true },
  });
  if (event?.status === 'FINALIZED') {
    throw new Error('Cannot modify a finalized event. Unfinalize the event first.');
  }
}

async function requireSquadOrgAccess(squadId: string, orgFilter: OrgFilterMode): Promise<string> {
  if (orgFilter.type === 'org') {
    const squad = await db.eventSquad.findFirst({
      where: { id: squadId, event: orgFilter.filter },
      select: { eventId: true },
    });
    if (!squad) throw new Error('Squad not found or access denied.');
    return squad.eventId;
  }
  const squad = await db.eventSquad.findFirst({ where: { id: squadId }, select: { eventId: true } });
  if (!squad) throw new Error('Squad not found.');
  return squad.eventId;
}

export async function getEvents() {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);
  return db.event.findMany({
    where: {
      ...ctx.orgFilter.filter,
    },
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
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);
  return db.event.findFirst({
    where: {
      id,
      ...ctx.orgFilter.filter,
    },
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
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);
  requireMutationRole(ctx);

  const name = (formData.get('name') as string)?.trim() || '';
  const eventTypeRaw = formData.get('eventType') as string | null;
  const startsAt = formData.get('startsAt') as string;
  const endsAt = (formData.get('endsAt') as string) || null;
  const gameFormatRaw = formData.get('gameFormat') as string | null;
  const defaultFormationId = (formData.get('defaultFormationId') as string) || null;
  const selectionPatternRaw = formData.get('selectionPattern') as string | null;
  const notes = (formData.get('notes') as string)?.trim() || null;

  if (!name) throw new Error('Event name is required.');
  if (!startsAt) throw new Error('Start date is required.');

  const eventType = parseEnum(eventTypeRaw, VALID_EVENT_TYPES, 'CUP');
  const gameFormat = parseEnum(gameFormatRaw, VALID_GAME_FORMATS, 'SEVEN_A_SIDE');
  const selectionPattern = selectionPatternRaw ? parseEnum(selectionPatternRaw, VALID_SELECTION_PATTERNS, 'ALL_BALANCED') : null;
  const matchDurationMinutes = formData.get('matchDurationMinutes') ? parseInt(formData.get('matchDurationMinutes') as string) : null;
  const validatedMatchDuration = matchDurationMinutes !== null && matchDurationMinutes > 0 ? matchDurationMinutes : null;
  const numberOfHalves = parseNumberOfHalves(formData.get('numberOfHalves') as string | null);
  const breakDurationMinutesRaw = formData.get('breakDurationMinutes') ? parseInt(formData.get('breakDurationMinutes') as string) : null;
  const breakDurationMinutes = breakDurationMinutesRaw !== null && breakDurationMinutesRaw >= 0 ? breakDurationMinutesRaw : null;

  if (defaultFormationId) {
    const formation = await db.formation.findFirst({
      where: { id: defaultFormationId, ...ctx.orgFilter.filter },
      select: { id: true, gameFormat: true },
    });
    if (!formation) {
      throw new Error('Selected formation does not exist.');
    }
    if (formation.gameFormat !== gameFormat) {
      throw new Error('Selected formation does not match the chosen game format.');
    }
  }

  const squadCount = parseInt(formData.get('squadCount') as string) || 2;
  const targetSize = parseInt(formData.get('targetSize') as string) || 7;

  const footballGroupId = await getOrCreateDefaultGroup(ctx.orgFilter.organisationId);
  const organisationId = ctx.orgFilter.organisationId;

  const event = await db.event.create({
    data: {
      name,
      eventType,
      startsAt: new Date(startsAt),
      endsAt: endsAt ? new Date(endsAt) : null,
      gameFormat,
      defaultFormationId: defaultFormationId || undefined,
      selectionPattern,
      matchDurationMinutes: validatedMatchDuration,
      numberOfHalves,
      breakDurationMinutes,
      notes,
      organisationId: ctx.orgFilter.organisationId,
      footballGroupId,
      squads: {
        create: Array.from({ length: squadCount }, (_, i) => ({
          name: i === 0 ? 'Squad 1' : `Squad ${i + 1}`,
          intent: i === 0 && selectionPattern === 'ONE_COMPETITIVE_BALANCED_REMAINDER' ? 'COMPETITIVE' as const : 'BALANCED' as const,
          targetSize,
          generationOrder: i,
          organisationId,
        })),
      },
    },
    include: {
      squads: true,
      players: true,
    },
  });

  revalidatePath('/events');
  redirect(`/events/${event.id}`);
}

export async function updateEventAction(id: string, formData: FormData) {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);
  requireMutationRole(ctx);

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
  const selectionPattern = selectionPatternRaw ? parseEnum(selectionPatternRaw, VALID_SELECTION_PATTERNS, 'ALL_BALANCED') : null;
  const matchDurationMinutes = formData.get('matchDurationMinutes') ? parseInt(formData.get('matchDurationMinutes') as string) : null;
  const validatedMatchDuration = matchDurationMinutes !== null && matchDurationMinutes > 0 ? matchDurationMinutes : null;
  const numberOfHalves = parseNumberOfHalves(formData.get('numberOfHalves') as string | null);
  const breakDurationMinutesRaw = formData.get('breakDurationMinutes') ? parseInt(formData.get('breakDurationMinutes') as string) : null;
  const breakDurationMinutes = breakDurationMinutesRaw !== null && breakDurationMinutesRaw >= 0 ? breakDurationMinutesRaw : null;

  if (defaultFormationId) {
    const formation = await db.formation.findFirst({
      where: {
        id: defaultFormationId,
        ...ctx.orgFilter.filter,
      },
      select: { id: true, gameFormat: true },
    });
    if (!formation) {
      throw new Error('Selected formation does not exist or access denied.');
    }
    if (formation.gameFormat !== gameFormat) {
      throw new Error('Selected formation does not match the chosen game format.');
    }
  }

  const orgWhere = { id, ...ctx.orgFilter.filter };

  const event = await db.event.update({
    where: orgWhere,
    data: {
      name,
      eventType,
      startsAt: new Date(startsAt),
      endsAt: endsAt ? new Date(endsAt) : null,
      gameFormat,
      defaultFormationId: defaultFormationId || null,
      selectionPattern,
      matchDurationMinutes: validatedMatchDuration,
      numberOfHalves,
      breakDurationMinutes,
      notes,
    },
  });

  revalidatePath('/events');
  revalidatePath(`/events/${id}`);
  return event;
}

export async function deleteEventAction(id: string) {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);
  requireMutationRole(ctx);

  const event = await db.event.findFirst({
    where: {
      id,
      ...ctx.orgFilter.filter,
    },
    select: { id: true, footballGroupId: true, status: true },
  });

  if (!event) {
    throw new Error('Event not found or access denied.');
  }

  if (event.status === 'FINALIZED') {
    throw new Error('Cannot delete a finalized event. Unfinalize the event first.');
  }

  await db.event.delete({
    where: { id: event.id },
  });

  revalidatePath('/events');
  revalidatePath(`/o/${ctx.organisationSlug}/events`);
}

export async function updateEventPlayerAvailability(
  eventId: string,
  playerId: string,
  status: EventPlayerStatus,
) {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);
  requireMutationRole(ctx);
  await requireEventOrgAccess(eventId, ctx.orgFilter);

  if (!VALID_EVENT_PLAYER_STATUSES.includes(status)) {
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
      organisationId: ctx.organisationId,
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
  defaultStatus: EventPlayerStatus = 'AVAILABLE',
) {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);
  requireMutationRole(ctx);
  await requireEventOrgAccess(eventId, ctx.orgFilter);

  if (!VALID_EVENT_PLAYER_STATUSES.includes(defaultStatus)) {
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
          organisationId: ctx.organisationId,
        })),
      });
    }
  });

  revalidatePath(`/events/${eventId}`);
}

export async function addPlayersToEventPoolAction(
  eventId: string,
  playerIds: string[],
  defaultStatus: EventPlayerStatus = 'AVAILABLE',
) {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);
  requireMutationRole(ctx);
  await requireEventOrgAccess(eventId, ctx.orgFilter);
  await requireEventNotFinalized(eventId, ctx.orgFilter);

  if (playerIds.length === 0) return;

  if (!VALID_EVENT_PLAYER_STATUSES.includes(defaultStatus)) {
    throw new Error(`Invalid availability status: ${defaultStatus}`);
  }

  const existing = await db.eventPlayerAvailability.findMany({
    where: { eventId, playerId: { in: playerIds } },
    select: { playerId: true, status: true },
  });

  const existingIds = new Set(existing.map((e) => e.playerId));
  const newPlayerIds = playerIds.filter((id) => !existingIds.has(id));

  if (newPlayerIds.length > 0) {
    await db.eventPlayerAvailability.createMany({
      data: newPlayerIds.map((playerId) => ({
        eventId,
        playerId,
        status: defaultStatus,
        organisationId: ctx.organisationId,
      })),
    });
  }

  revalidatePath(`/events/${eventId}`);
  revalidatePath('/events');
}

export async function removePlayerFromEventPoolAction(eventId: string, playerId: string) {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);
  requireMutationRole(ctx);
  await requireEventOrgAccess(eventId, ctx.orgFilter);
  await requireEventNotFinalized(eventId, ctx.orgFilter);

  const squadAssignment = await db.eventSquadPlayer.findFirst({
    where: { playerId, eventSquad: { eventId } },
  });

  if (squadAssignment) {
    await db.eventSquadPlayer.delete({
      where: { id: squadAssignment.id },
    });
  }

  await db.eventPlayerAvailability.deleteMany({
    where: { eventId, playerId },
  });

  revalidatePath(`/events/${eventId}`);
  revalidatePath('/events');
}

export async function removePlayersFromEventPoolAction(eventId: string, playerIds: string[]) {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);
  requireMutationRole(ctx);
  await requireEventOrgAccess(eventId, ctx.orgFilter);
  await requireEventNotFinalized(eventId, ctx.orgFilter);

  if (playerIds.length === 0) return;

  await db.$transaction(async (tx) => {
    await tx.eventSquadPlayer.deleteMany({
      where: {
        playerId: { in: playerIds },
        eventSquad: { eventId },
      },
    });

    await tx.eventPlayerAvailability.deleteMany({
      where: { eventId, playerId: { in: playerIds } },
    });
  });

  revalidatePath(`/events/${eventId}`);
  revalidatePath('/events');
}

export async function assignPlayerToEventSquadAction(
  eventId: string,
  squadId: string,
  playerId: string,
  locked: boolean = false,
) {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);
  requireMutationRole(ctx);
  await requireEventOrgAccess(eventId, ctx.orgFilter);
  await requireEventNotFinalized(eventId, ctx.orgFilter);

  const squad = await db.eventSquad.findFirst({
    where: { id: squadId, eventId },
    select: { id: true },
  });
  if (!squad) {
    throw new Error('Squad does not belong to this event.');
  }

  const existing = await db.eventSquadPlayer.findFirst({
    where: { playerId, eventSquad: { eventId } },
  });

  if (existing) {
    throw new Error('Player is already assigned to a squad in this event.');
  }

  await db.eventSquadPlayer.create({
    data: {
      eventId,
      eventSquadId: squadId,
      playerId,
      source: locked ? 'LOCKED' : 'MANUAL',
      locked,
      selectionReason: locked ? 'Locked by coach' : 'Manually assigned by coach',
      organisationId: ctx.organisationId,
    },
  });

  revalidatePath(`/events/${eventId}`);
}

export async function unassignPlayerFromEventSquadAction(eventSquadPlayerId: string) {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);
  requireMutationRole(ctx);

  const squadPlayer = await db.eventSquadPlayer.findFirst({
    where: { id: eventSquadPlayerId, ...ctx.orgFilter.filter },
    select: { eventSquadId: true, eventId: true },
  });

  if (!squadPlayer) throw new Error('Squad assignment not found or access denied.');

  await requireEventNotFinalized(squadPlayer.eventId, ctx.orgFilter);

  const _eventId = await requireSquadOrgAccess(squadPlayer.eventSquadId, ctx.orgFilter);

  await db.eventSquadPlayer.delete({
    where: { id: eventSquadPlayerId },
  });

  revalidatePath(`/events/${_eventId}`);
}

export async function addEventSquadAction(
  eventId: string,
  name: string,
  intent: EventSquadIntent,
  targetSize: number,
  formationId?: string,
) {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);
  requireMutationRole(ctx);
  await requireEventOrgAccess(eventId, ctx.orgFilter);

  if (!VALID_SQUAD_INTENTS.includes(intent)) {
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
      organisationId: ctx.organisationId,
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
    /** Production consistency pass item #4: null/undefined-string clears the override so the
     * squad inherits the Event default again; a valid GameFormat value sets an explicit override. */
    gameFormatOverride?: string | null;
    /** Per-squad match timing overrides: null/undefined-string clears the override so the squad
     * inherits the Event default; a set value overrides it for this squad only. See
     * getEffectiveEventSquadMatchTiming (event-types.ts). */
    numberOfHalvesOverride?: number | string | null;
    matchDurationMinutesOverride?: number | string | null;
    breakDurationMinutesOverride?: number | string | null;
  },
) {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);
  requireMutationRole(ctx);
  const _eventId = await requireSquadOrgAccess(squadId, ctx.orgFilter);

  const updateData: Parameters<typeof db.eventSquad.update>[0]['data'] = {};

  if (data.name !== undefined) updateData.name = data.name;
  if (data.intent !== undefined) {
    if (!VALID_SQUAD_INTENTS.includes(data.intent)) {
      throw new Error(`Invalid squad intent: ${data.intent}`);
    }
    updateData.intent = data.intent;
  }
  if (data.targetSize !== undefined) updateData.targetSize = data.targetSize;
  if (data.minSize !== undefined) updateData.minSize = data.minSize;
  if (data.maxSize !== undefined) updateData.maxSize = data.maxSize;
  if (data.formationId !== undefined) updateData.formationId = data.formationId || null;
  if (data.gameFormatOverride !== undefined) {
    if (data.gameFormatOverride && !VALID_GAME_FORMATS.includes(data.gameFormatOverride as (typeof VALID_GAME_FORMATS)[number])) {
      throw new Error(`Invalid game format: ${data.gameFormatOverride}`);
    }
    updateData.gameFormatOverride = (data.gameFormatOverride || null) as GameFormat | null;
  }
  if (data.numberOfHalvesOverride !== undefined) {
    updateData.numberOfHalvesOverride = parseNullableNumberOfHalvesOverride(data.numberOfHalvesOverride);
  }
  if (data.matchDurationMinutesOverride !== undefined) {
    updateData.matchDurationMinutesOverride = parseNullablePositiveMinutesOverride(data.matchDurationMinutesOverride, 'match duration override');
  }
  if (data.breakDurationMinutesOverride !== undefined) {
    updateData.breakDurationMinutesOverride = parseNullableNonNegativeMinutesOverride(data.breakDurationMinutesOverride, 'break duration override');
  }

  const squad = await db.eventSquad.update({
    where: { id: squadId },
    data: updateData,
  });

  const eventId = squad.eventId;
  revalidatePath(`/events/${eventId}`);
  return squad;
}

export async function updateEventSquadNameAction(squadId: string, name: string) {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);
  requireMutationRole(ctx);
  const _eventId = await requireSquadOrgAccess(squadId, ctx.orgFilter);

  const trimmed = name.trim();
  if (!trimmed) throw new Error('Squad name cannot be empty.');

  const squad = await db.eventSquad.update({
    where: { id: squadId },
    data: { name: trimmed },
  });

  revalidatePath(`/events/${squad.eventId}`);
  return squad;
}

export async function updateEventMatchDurationAction(eventId: string, matchDurationMinutes: number | null) {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);
  requireMutationRole(ctx);
  await requireEventOrgAccess(eventId, ctx.orgFilter);

  const validated = matchDurationMinutes !== null && matchDurationMinutes > 0 ? matchDurationMinutes : null;

  const event = await db.event.update({
    where: { id: eventId },
    data: { matchDurationMinutes: validated },
  });

  revalidatePath('/events');
  revalidatePath(`/events/${eventId}`);
  return event;
}

export async function updateEventBreakDurationAction(eventId: string, breakDurationMinutes: number | null) {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);
  requireMutationRole(ctx);
  await requireEventOrgAccess(eventId, ctx.orgFilter);

  const validated = breakDurationMinutes !== null && breakDurationMinutes >= 0 ? breakDurationMinutes : null;

  const event = await db.event.update({
    where: { id: eventId },
    data: { breakDurationMinutes: validated },
  });

  revalidatePath('/events');
  revalidatePath(`/events/${eventId}`);
  return event;
}

export async function updateEventNumberOfHalvesAction(eventId: string, numberOfHalves: number) {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);
  requireMutationRole(ctx);
  await requireEventOrgAccess(eventId, ctx.orgFilter);

  const validated = parseNumberOfHalves(numberOfHalves);

  const event = await db.event.update({
    where: { id: eventId },
    data: { numberOfHalves: validated },
  });

  revalidatePath('/events');
  revalidatePath(`/events/${eventId}`);
  return event;
}

export async function removeEventSquadAction(squadId: string) {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);
  requireMutationRole(ctx);
  const _eventId = await requireSquadOrgAccess(squadId, ctx.orgFilter);

  await db.eventSquad.delete({
    where: { id: squadId },
  });

  revalidatePath(`/events/${_eventId}`);
}

export async function movePlayerBetweenSquadsAction(
  playerId: string,
  fromSquadId: string,
  toSquadId: string,
) {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);
  requireMutationRole(ctx);
  const fromEventId = await requireSquadOrgAccess(fromSquadId, ctx.orgFilter);
  const toEventId = await requireSquadOrgAccess(toSquadId, ctx.orgFilter);

  if (fromEventId !== toEventId) {
    throw new Error('Cannot move a player between squads in different events.');
  }

  await requireEventNotFinalized(fromEventId, ctx.orgFilter);

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
        eventId: fromEventId,
        eventSquadId: toSquadId,
        playerId,
        source: 'MANUAL',
        locked: false,
        selectionReason: 'Moved by coach',
        organisationId: ctx.organisationId,
      },
    });
  });

  revalidatePath(`/events/${fromEventId}`);
}

export async function togglePlayerLockAction(
  squadPlayerId: string,
  locked: boolean,
) {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);
  requireMutationRole(ctx);

  const squadPlayer = await db.eventSquadPlayer.findFirst({
    where: { id: squadPlayerId, ...ctx.orgFilter.filter },
    select: { eventSquadId: true, eventId: true },
  });

  if (!squadPlayer) throw new Error('Squad player assignment not found or access denied.');

  await requireEventNotFinalized(squadPlayer.eventId, ctx.orgFilter);

  const _eventId = await requireSquadOrgAccess(squadPlayer.eventSquadId, ctx.orgFilter);

  const updated = await db.eventSquadPlayer.update({
    where: { id: squadPlayerId },
    data: {
      locked,
      source: locked ? 'LOCKED' : 'MANUAL',
      selectionReason: locked ? 'Locked by coach' : 'Unlocked by coach',
    },
  });

  revalidatePath(`/events/${_eventId}`);

  return updated;
}

export async function clearEventSquadsAction(eventId: string) {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);
  requireMutationRole(ctx);
  await requireEventOrgAccess(eventId, ctx.orgFilter);
  await requireEventNotFinalized(eventId, ctx.orgFilter);

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

export async function getLeagueSeasons() {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);
  return db.leagueSeason.findMany({
    where: {
      ...ctx.orgFilter.filter,
    },
    orderBy: { startDate: 'desc' },
  });
}

export async function getFormations() {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);
  return db.formation.findMany({
    where: {
      isArchived: false,
      ...ctx.orgFilter.filter,
    },
    include: { slots: true },
    orderBy: [{ gameFormat: 'asc' }, { name: 'asc' }],
  });
}

export async function getAvailablePlayersForEvent(_leagueSeasonId?: string) {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);

  return db.player.findMany({
    where: {
      active: true,
      removedAt: null,
      ...ctx.orgFilter.filter,
    },
    include: {
      coreTeam: true,
    },
    orderBy: [{ firstName: 'asc' }],
  });
}

export async function generateEventSquadsAction(eventId: string) {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);
  requireMutationRole(ctx);

  await requireEventNotFinalized(eventId, ctx.orgFilter);

  const event = await db.event.findFirst({
    where: {
      id: eventId,
      ...ctx.orgFilter.filter,
    },
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

  if (event.players.length === 0) {
    throw new Error('No players in the event pool. Add players to the pool before generating squads.');
  }

  const availableStatuses = ['AVAILABLE'] as const;
  const includeReserves = false;
  const includeLate = false;

  const eligiblePlayers = event.players.filter((ep) => {
    if (availableStatuses.includes(ep.status as typeof availableStatuses[number])) return true;
    if (includeReserves && ep.status === 'RESERVE') return true;
    if (includeLate && ep.status === 'LATE_ADDITION') return true;
    return false;
  });

  if (eligiblePlayers.length === 0) {
    throw new Error('No available players in the event pool. Mark players as Available before generating squads.');
  }

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

  const selectionPattern = (event.selectionPattern ?? 'ALL_BALANCED') as 'ALL_BALANCED' | 'ONE_COMPETITIVE_BALANCED_REMAINDER' | 'MANUAL_SEED_AUTO_BALANCE' | 'PRESERVE_AND_FILL';

  const lockedAssignments = new Map<string, string>();
  for (const squad of event.squads) {
    for (const sp of squad.players) {
      if (selectionPattern === 'PRESERVE_AND_FILL') {
        lockedAssignments.set(sp.playerId, squad.id);
      } else if (sp.locked) {
        lockedAssignments.set(sp.playerId, squad.id);
      }
    }
  }

  const { generateEventSquads } = await import('@/lib/events/event-squad-generation');
  const { validateEventPool } = await import('@/lib/events/event-validation');
  const { getEffectiveEventTeamGameFormat } = await import('@/lib/events/event-types');
  const typeGameFormat = event.gameFormat as 'THREE_A_SIDE' | 'FIVE_A_SIDE' | 'SEVEN_A_SIDE' | 'NINE_A_SIDE' | 'ELEVEN_A_SIDE';

  // Effective game format per squad (production consistency pass item #4): a squad's own
  // gameFormatOverride if set, otherwise the event default. The normal case is every squad
  // resolving to the same format; mixed-format events are handled by generating each
  // format-group separately below, never by scattering fallback logic through the generator.
  const effectiveFormatBySquadId = new Map(
    event.squads.map((s) => [s.id, getEffectiveEventTeamGameFormat(event, s)]),
  );
  const distinctFormats = [...new Set(effectiveFormatBySquadId.values())];

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

  // Formation lookup table for the generator: every squad's own formation, plus (for any squad
  // relying on the event default) a formation matching that squad's effective format. Previously
  // this only ever contained event.squads[0]'s formation, silently breaking per-squad formation
  // overrides whenever a later squad had a different formationId — fixed here as part of making
  // per-squad effective format actually work end to end.
  const explicitFormationIds = event.squads.map((s) => s.formationId).filter((id): id is string => !!id);
  const fallbackFormationsByFormat = await db.formation.findMany({
    where: {
      isArchived: false,
      gameFormat: { in: distinctFormats },
      ...(event.defaultFormationId ? { id: { not: { in: explicitFormationIds } } } : {}),
      OR: [
        { id: event.defaultFormationId ?? undefined },
        { source: 'SYSTEM' },
      ],
      ...ctx.orgFilter.filterNullable,
    },
    include: { slots: true },
    orderBy: { createdAt: 'asc' },
  });
  const formationById = new Map<string, (typeof event.squads)[number]['formation']>();
  for (const s of event.squads) {
    if (s.formation) formationById.set(s.formation.id, s.formation);
  }
  for (const f of fallbackFormationsByFormat) {
    if (!formationById.has(f.id)) formationById.set(f.id, f);
  }
  const formations = [...formationById.values()].filter((f): f is NonNullable<typeof f> => !!f);

  const validationFormation = event.squads[0]?.formation
    ?? fallbackFormationsByFormat.find((f) => f.gameFormat === typeGameFormat)
    ?? fallbackFormationsByFormat[0];
  const formationSlots: { roleType: string; acceptedPositions: BroadPosition[]; label: string }[] = [];
  if (validationFormation?.slots) {
    for (const slot of validationFormation.slots) {
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

  // Pre-generation policy evaluation: filter blocked players and collect policy warnings
  const policyWarnings: string[] = [];
  let filteredPlayers = playersWithAttrs;

  try {
    const { buildPolicyInput } = await import('@/lib/policies/build-policy-input');
    const { evaluateSelectionPolicy, coachFacingWarningMessage } = await import('@/lib/policies/policy-evaluation');

    const policyInput = buildPolicyInput({
      mode: 'event',
      phase: 'pre_selection',
      decisionType: 'event_squad_generation',
      fairnessScope: 'event',
      players: eligiblePlayers.map((ep) => ({
        id: ep.playerId,
        firstName: ep.player.firstName,
        lastName: ep.player.lastName,
        active: true,
        removedAt: null,
        primaryPosition: ep.player.primaryPosition ?? '',
        secondaryPosition: ep.player.secondaryPosition,
        tertiaryPosition: ep.player.tertiaryPosition,
        goalkeeperAbility: ep.player.goalkeeperAbility ?? 'NO',
        nonRotatable: ep.player.nonRotatable,
        shirtNumber: null,
        coreTeamId: ep.player.coreTeamId,
        availabilities: [{ status: ep.status, matchRoundId: eventId }],
      })),
      teams: event.squads.map((s) => ({
        id: s.id,
        name: s.name,
        targetSquadSize: s.targetSize,
        minSquadSize: s.minSize,
        maxSquadSize: s.maxSize,
      })),
      nowIso: new Date().toISOString(),
      eventId,
    });

    const policyResult = await evaluateSelectionPolicy(policyInput);
    const blockedIds = Object.keys(policyResult.result.blocked);

    if (blockedIds.length > 0) {
      const blockedSet = new Set(blockedIds);
      filteredPlayers = playersWithAttrs.filter((p) => !blockedSet.has(p.playerId));
      for (const [playerId, reasons] of Object.entries(policyResult.result.blocked)) {
        policyWarnings.push(`Policy blocked ${playerId}: ${reasons.join(', ')}`);
      }
    }

    for (const warning of policyResult.result.warnings) {
      policyWarnings.push(coachFacingWarningMessage(warning));
    }
  } catch {
    // Policy evaluation failure must not block event generation.
    // Use all players if policy evaluation fails.
  }

  // Generate per effective-format group (production consistency pass item #4). The normal case
  // — every squad shares one effective format — degenerates to exactly one iteration with the
  // exact same squads/players/format as a single call, so existing single-format Events behave
  // identically to before. A mixed-format Event runs the same generator once per format, in
  // generationOrder, each time drawing only from players not already placed by an earlier
  // group's run — never scattering per-format fallback logic through the generator itself.
  const squadsByFormat = new Map<string, typeof squads>();
  for (const s of squads) {
    const fmt = effectiveFormatBySquadId.get(s.id)!;
    const list = squadsByFormat.get(fmt) ?? [];
    list.push(s);
    squadsByFormat.set(fmt, list);
  }

  type GenerationResult = ReturnType<typeof generateEventSquads>;
  let remainingPlayers = filteredPlayers;
  const combinedAssignments: GenerationResult['assignments'] = [];
  const combinedBalanceSummaries: GenerationResult['balanceSummaries'] = [];
  const combinedValidationNotes: string[] = [];
  const combinedWarnings: string[] = [];

  for (const [format, groupSquads] of squadsByFormat) {
    const groupResult = generateEventSquads({
      eventId: event.id,
      players: remainingPlayers,
      formations,
      defaultFormationId: event.defaultFormationId,
      squads: groupSquads,
      selectionPattern,
      lockedAssignments,
      includeReserves,
      includeLateAdditions: includeLate,
      gameFormat: format as typeof typeGameFormat,
    });
    combinedAssignments.push(...groupResult.assignments);
    combinedBalanceSummaries.push(...groupResult.balanceSummaries);
    combinedValidationNotes.push(...groupResult.validationNotes);
    combinedWarnings.push(...groupResult.warnings);

    const assignedIds = new Set(groupResult.assignments.map((a) => a.playerId));
    remainingPlayers = remainingPlayers.filter((p) => !assignedIds.has(p.playerId));
  }

  const result = {
    assignments: combinedAssignments,
    balanceSummaries: combinedBalanceSummaries,
    validationNotes: combinedValidationNotes,
    warnings: combinedWarnings,
  };

  // Append policy warnings to generation result warnings
  const mergedWarnings = [...result.warnings, ...policyWarnings];

  await db.$transaction(async (tx) => {
    if (selectionPattern === 'PRESERVE_AND_FILL') {
      const existingPlayerIds = new Set(
        event.squads.flatMap((s) => s.players.map((sp) => sp.playerId)),
      );
      const newAssignments = result.assignments.filter(
        (a) => a.source !== 'LOCKED' && !existingPlayerIds.has(a.playerId),
      );
      if (newAssignments.length > 0) {
        await tx.eventSquadPlayer.createMany({
          data: newAssignments.map((assignment) => ({
            eventId,
            eventSquadId: assignment.eventSquadId,
            playerId: assignment.playerId,
            assignedSlotIndex: assignment.assignedSlotIndex,
            assignedSlotLabel: assignment.assignedSlotLabel,
            assignedRoleType: assignment.assignedRoleType as FormationSlotRoleType | null,
            assignedPositionId: assignment.assignedPositionId,
            lineupOrder: assignment.lineupOrder,
            source: assignment.source,
            locked: assignment.locked,
            positionFitTier: assignment.positionFitTier,
            selectionReason: assignment.selectionReason,
            organisationId: ctx.organisationId,
          })),
          skipDuplicates: true,
        });
      }
    } else {
      for (const squad of event.squads) {
        await tx.eventSquadPlayer.deleteMany({
          where: { eventSquadId: squad.id, locked: false },
        });
      }

      const newAssignments = result.assignments.filter((a) => a.source !== 'LOCKED');
      if (newAssignments.length > 0) {
        await tx.eventSquadPlayer.createMany({
          data: newAssignments.map((assignment) => ({
            eventId,
            eventSquadId: assignment.eventSquadId,
            playerId: assignment.playerId,
            assignedSlotIndex: assignment.assignedSlotIndex,
            assignedSlotLabel: assignment.assignedSlotLabel,
            assignedRoleType: assignment.assignedRoleType as FormationSlotRoleType | null,
            assignedPositionId: assignment.assignedPositionId,
            lineupOrder: assignment.lineupOrder,
            source: assignment.source,
            locked: assignment.locked,
            positionFitTier: assignment.positionFitTier,
            selectionReason: assignment.selectionReason,
            organisationId: ctx.organisationId,
          })),
          skipDuplicates: true,
        });
      }
    }
  }, { timeout: 15000 });

  const eventSquadsForReview = await db.eventSquad.findMany({
    where: { eventId },
    select: { id: true },
  });
  for (const squad of eventSquadsForReview) {
    const { superseded } = await supersedePendingReviews("EVENT_SQUAD", squad.id);
    for (const review of superseded) {
      const requester = await db.organisationMembership.findUnique({
        where: { id: review.requestedByMembershipId },
        include: { user: { select: { email: true } } },
      });
      if (requester?.user?.email) {
        const organisation = await db.organisation.findUnique({
          where: { id: ctx.organisationId },
          select: { name: true, slug: true },
        });
        await enqueueAndSendNotification({
          organisationId: ctx.organisationId,
          idempotencyKey: `review-superseded-${review.id}`,
          template: 'REVIEW_SUPERSEDED',
          payload: {
            organisationName: organisation?.name ?? 'Matchboard',
            requesterName: requester.user.email,
            requesterEmail: requester.user.email,
            targetType: review.targetType,
            targetId: review.targetId,
            targetLabel: review.targetId,
            reason: 'Squad regenerated',
            reviewUrl: `/o/${organisation?.slug ?? ctx.organisationSlug}/events/${eventId}`,
            organisationSlug: organisation?.slug ?? ctx.organisationSlug,
          },
          recipientEmail: requester.user.email,
          recipientUserId: requester.userId,
        });
      }
    }
  }

  revalidatePath(`/events/${eventId}`);

  return {
    validation,
    balanceSummaries: result.balanceSummaries,
    validationNotes: result.validationNotes,
    warnings: mergedWarnings,
  };
}