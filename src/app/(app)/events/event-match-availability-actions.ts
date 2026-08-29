'use server'

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { requirePageActorContext, requireMutationRole } from '@/lib/auth/actor-context';
import { setTenantOrganisationId } from '@/lib/tenancy/tenant-async-storage';
import type { OrgFilterMode } from '@/lib/tenancy/resolve-org-filter';
import {
  getEffectiveEventMatchAvailability,
  setEventMatchUnavailable,
  removeEventMatchAvailabilityException,
  getEventMatchAvailabilityMatrix,
  type ParticipantIdentity,
} from '@/lib/events/event-match-availability';

// ADR-0106 (Event Match availability, PR 5a): server actions for the sparse per-match
// unavailability exception. Purely additive -- nothing in this file is consumed by any existing
// planning/selection/live-reporting code path yet (enforcement is PR 5b).

async function requireEventMatchOrgAccess(eventMatchId: string, orgFilter: OrgFilterMode): Promise<string> {
  const match = await db.eventMatch.findFirst({
    where: { id: eventMatchId, event: orgFilter.filter },
    select: { eventId: true },
  });
  if (!match) throw new Error('Event match not found or access denied.');
  return match.eventId;
}

export async function setEventMatchUnavailableAction(
  eventMatchId: string,
  participant: ParticipantIdentity,
  note?: string,
) {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);
  requireMutationRole(ctx);
  const eventId = await requireEventMatchOrgAccess(eventMatchId, ctx.orgFilter);

  const result = await setEventMatchUnavailable(eventMatchId, participant, ctx.orgFilter, note);
  if (result.success) {
    revalidatePath(`/events/${eventId}`);
  }
  return result;
}

export async function removeEventMatchAvailabilityExceptionAction(
  eventMatchId: string,
  participant: ParticipantIdentity,
) {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);
  requireMutationRole(ctx);
  const eventId = await requireEventMatchOrgAccess(eventMatchId, ctx.orgFilter);

  const result = await removeEventMatchAvailabilityException(eventMatchId, participant, ctx.orgFilter);
  if (result.success) {
    revalidatePath(`/events/${eventId}`);
  }
  return result;
}

export async function getEffectiveEventMatchAvailabilityAction(
  eventMatchId: string,
  participant: ParticipantIdentity,
) {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);

  return getEffectiveEventMatchAvailability(eventMatchId, participant, ctx.orgFilter);
}

export async function getEventMatchAvailabilityMatrixAction(eventId: string) {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);

  const event = await db.event.findFirst({ where: { id: eventId, ...ctx.orgFilter.filter }, select: { id: true } });
  if (!event) throw new Error('Event not found or access denied.');

  return getEventMatchAvailabilityMatrix(eventId, ctx.orgFilter);
}

export async function getEventMatchAvailabilityBoardAction(eventId: string) {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);

  const event = await db.event.findFirst({ where: { id: eventId, ...ctx.orgFilter.filter }, select: { id: true } });
  if (!event) throw new Error('Event not found or access denied.');

  const [matches, matrix] = await Promise.all([
    db.eventMatch.findMany({
      where: { eventId, ...ctx.orgFilter.filter },
      select: { id: true, opponentName: true, startsAt: true, status: true },
      orderBy: { startsAt: 'asc' },
    }),
    getEventMatchAvailabilityMatrix(eventId, ctx.orgFilter),
  ]);

  return {
    matches: matches.map((m) => ({ ...m, startsAt: m.startsAt.toISOString() })),
    matrix,
  };
}
