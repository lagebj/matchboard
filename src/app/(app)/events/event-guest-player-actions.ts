'use server'

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { requirePageActorContext, requireMutationRole } from '@/lib/auth/actor-context';
import { setTenantOrganisationId } from '@/lib/tenancy/tenant-async-storage';
import type { OrgFilterMode } from '@/lib/tenancy/resolve-org-filter';
import type { EventPlayerStatus } from '@/generated/prisma/client';
import { VALID_EVENT_PLAYER_STATUSES } from '@/lib/events/event-validation-constants';
import {
  assertGuestPlayerBelongsToEventGroup,
  getEventGuestPlayerPool,
  getAvailableGuestPlayersForEvent,
} from '@/lib/events/event-guest-player-participation';

// ADR-0106: GuestPlayer Event participation write paths. Kept as a separate, parallel action
// file rather than retrofitting every existing Player-keyed Event action -- mirrors the schema
// layer's dual-FK-but-separate-write-path convention (see ADR-0077's precedent, cited in
// ADR-0106, for keeping guest-specific write paths distinct from their Player-only counterparts).

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
    throw new Error('Cannot modify a finalized event. Unfinalize the event first.');
  }
}

export async function setEventGuestPlayerAvailabilityAction(
  eventId: string,
  guestPlayerId: string,
  status: EventPlayerStatus,
) {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);
  requireMutationRole(ctx);
  await requireEventOrgAccess(eventId, ctx.orgFilter);
  await assertGuestPlayerBelongsToEventGroup(eventId, guestPlayerId, ctx.orgFilter);

  if (!VALID_EVENT_PLAYER_STATUSES.includes(status)) {
    throw new Error(`Invalid availability status: ${status}`);
  }

  await db.eventPlayerAvailability.upsert({
    where: {
      eventId_guestPlayerId: { eventId, guestPlayerId },
    },
    create: {
      eventId,
      guestPlayerId,
      status,
      organisationId: ctx.organisationId,
    },
    update: {
      status,
    },
  });

  revalidatePath(`/events/${eventId}`);
}

export async function addGuestPlayersToEventPoolAction(
  eventId: string,
  guestPlayerIds: string[],
  defaultStatus: EventPlayerStatus = 'AVAILABLE',
) {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);
  requireMutationRole(ctx);
  await requireEventOrgAccess(eventId, ctx.orgFilter);
  await requireEventNotFinalized(eventId, ctx.orgFilter);

  if (guestPlayerIds.length === 0) return;

  if (!VALID_EVENT_PLAYER_STATUSES.includes(defaultStatus)) {
    throw new Error(`Invalid availability status: ${defaultStatus}`);
  }

  for (const guestPlayerId of guestPlayerIds) {
    await assertGuestPlayerBelongsToEventGroup(eventId, guestPlayerId, ctx.orgFilter);
  }

  const existing = await db.eventPlayerAvailability.findMany({
    where: { eventId, guestPlayerId: { in: guestPlayerIds } },
    select: { guestPlayerId: true },
  });
  const existingIds = new Set(existing.map((e) => e.guestPlayerId));
  const newGuestPlayerIds = guestPlayerIds.filter((id) => !existingIds.has(id));

  if (newGuestPlayerIds.length > 0) {
    await db.eventPlayerAvailability.createMany({
      data: newGuestPlayerIds.map((guestPlayerId) => ({
        eventId,
        guestPlayerId,
        status: defaultStatus,
        organisationId: ctx.organisationId,
      })),
    });
  }

  revalidatePath(`/events/${eventId}`);
  revalidatePath('/events');
}

export async function removeGuestPlayerFromEventPoolAction(eventId: string, guestPlayerId: string) {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);
  requireMutationRole(ctx);
  await requireEventOrgAccess(eventId, ctx.orgFilter);
  await requireEventNotFinalized(eventId, ctx.orgFilter);

  const squadAssignment = await db.eventSquadPlayer.findFirst({
    where: { guestPlayerId, eventSquad: { eventId } },
  });

  if (squadAssignment) {
    await db.eventSquadPlayer.delete({
      where: { id: squadAssignment.id },
    });
  }

  await db.eventPlayerAvailability.deleteMany({
    where: { eventId, guestPlayerId },
  });

  revalidatePath(`/events/${eventId}`);
  revalidatePath('/events');
}

export async function assignGuestPlayerToEventSquadAction(
  eventId: string,
  squadId: string,
  guestPlayerId: string,
  locked: boolean = false,
) {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);
  requireMutationRole(ctx);
  await requireEventOrgAccess(eventId, ctx.orgFilter);
  await requireEventNotFinalized(eventId, ctx.orgFilter);
  await assertGuestPlayerBelongsToEventGroup(eventId, guestPlayerId, ctx.orgFilter);

  const squad = await db.eventSquad.findFirst({
    where: { id: squadId, eventId },
    select: { id: true },
  });
  if (!squad) {
    throw new Error('Squad does not belong to this event.');
  }

  const existing = await db.eventSquadPlayer.findFirst({
    where: { guestPlayerId, eventSquad: { eventId } },
  });

  if (existing) {
    throw new Error('Guest player is already assigned to a squad in this event.');
  }

  await db.eventSquadPlayer.create({
    data: {
      eventId,
      eventSquadId: squadId,
      guestPlayerId,
      source: locked ? 'LOCKED' : 'MANUAL',
      locked,
      selectionReason: locked ? 'Locked by coach' : 'Manually assigned by coach',
      organisationId: ctx.organisationId,
    },
  });

  revalidatePath(`/events/${eventId}`);
}

export async function getEventGuestPlayerPoolAction(eventId: string) {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);
  await requireEventOrgAccess(eventId, ctx.orgFilter);

  return getEventGuestPlayerPool(eventId, ctx.orgFilter);
}

export async function getAvailableGuestPlayersForEventAction(eventId: string) {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);
  await requireEventOrgAccess(eventId, ctx.orgFilter);

  return getAvailableGuestPlayersForEvent(eventId, ctx.orgFilter);
}
