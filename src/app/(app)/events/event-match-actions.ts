'use server'

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { requireActorContext, requireMutationRole } from '@/lib/auth/actor-context';
import type { OrgFilterMode } from '@/lib/tenancy/resolve-org-filter';
import { MatchCategory } from '@/generated/prisma/client';
import { getDefaultEventMatchCategory } from '@/lib/stats/event-match-stats';
import { cleanOpponentDisplayName } from '@/lib/opponents/opponent-team';

const VALID_CATEGORIES: MatchCategory[] = ['CUP', 'OTHER'];

async function requireEventOrgAccess(eventId: string, orgFilter: OrgFilterMode): Promise<void> {
  if (orgFilter.type !== 'org') return;
  const event = await db.event.findFirst({
    where: { id: eventId, ...orgFilter.filter },
    select: { id: true },
  });
  if (!event) throw new Error('Event not found or access denied.');
}

async function requireMatchOrgAccess(eventMatchId: string, orgFilter: OrgFilterMode): Promise<{ eventId: string }> {
  if (orgFilter.type !== 'org') {
    const match = await db.eventMatch.findUnique({ where: { id: eventMatchId }, select: { eventId: true } });
    if (!match) throw new Error('Event match not found.');
    return { eventId: match.eventId };
  }
  const match = await db.eventMatch.findFirst({
    where: { id: eventMatchId, event: orgFilter.filter },
    select: { eventId: true },
  });
  if (!match) throw new Error('Event match not found or access denied.');
  return { eventId: match.eventId };
}

async function resolveOpponent(opponentName: string, opponentTeamIdInput?: string | null): Promise<{ opponentTeamId: string | null; opponentName: string }> {
  if (opponentTeamIdInput) {
    const existing = await db.opponentTeam.findUnique({
      where: { id: opponentTeamIdInput },
      select: { id: true, displayName: true },
    });
    if (!existing) throw new Error('Opponent team not found.');
    return { opponentTeamId: existing.id, opponentName: existing.displayName };
  }
  const displayName = cleanOpponentDisplayName(opponentName);
  return { opponentTeamId: null, opponentName: displayName };
}

export async function createEventMatchAction(formData: FormData) {
  const ctx = await requireActorContext();
  requireMutationRole(ctx);

  const eventId = formData.get('eventId') as string;
  const eventSquadId = formData.get('eventSquadId') as string;
  const opponentNameInput = (formData.get('opponentName') as string)?.trim();
  const opponentTeamIdInput = (formData.get('opponentTeamId') as string)?.trim() || null;
  const startsAt = formData.get('startsAt') as string;
  const location = (formData.get('location') as string)?.trim() || null;
  const notes = (formData.get('notes') as string)?.trim() || null;
  const categoryRaw = formData.get('category') as string;

  if (!eventId || !eventSquadId || !opponentNameInput || !startsAt) {
    throw new Error('Event, squad, opponent name, and date/time are required.');
  }

  await requireEventOrgAccess(eventId, ctx.orgFilter);

  const { opponentTeamId, opponentName } = await resolveOpponent(opponentNameInput, opponentTeamIdInput);

  const event = await db.event.findFirst({
    where: { id: eventId, ...(ctx.orgFilter.type === 'org' ? ctx.orgFilter.filter : {}) },
  });
  if (!event) throw new Error('Event not found.');

  const squad = await db.eventSquad.findUnique({ where: { id: eventSquadId } });
  if (!squad || squad.eventId !== eventId) {
    throw new Error('Event squad not found or does not belong to this event.');
  }

  if (categoryRaw === 'LEAGUE') {
    throw new Error('Event matches cannot use LEAGUE category.');
  }

  const category: MatchCategory = VALID_CATEGORIES.includes(categoryRaw as MatchCategory)
    ? (categoryRaw as MatchCategory)
    : getDefaultEventMatchCategory(event.eventType);

  const eventMatch = await db.eventMatch.create({
    data: {
      eventId,
      eventSquadId,
      category,
      opponentName,
      opponentTeamId,
      startsAt: new Date(startsAt),
      location,
      notes,
      status: 'SCHEDULED',
      organisationId: ctx.organisationId,
    },
  });

  revalidatePath(`/events/${eventId}`);
  return eventMatch;
}

export async function updateEventMatchAction(eventMatchId: string, data: {
  opponentName?: string;
  opponentTeamId?: string | null;
  startsAt?: string;
  location?: string | null;
  notes?: string | null;
  category?: string;
  eventSquadId?: string;
}) {
  const ctx = await requireActorContext();
  requireMutationRole(ctx);

  const { eventId } = await requireMatchOrgAccess(eventMatchId, ctx.orgFilter);

  const existing = await db.eventMatch.findUnique({ where: { id: eventMatchId } });
  if (!existing) throw new Error('Event match not found.');

  const report = await db.eventPostMatchReport.findUnique({
    where: { eventMatchId },
  });

  if (data.eventSquadId !== undefined && data.eventSquadId !== existing.eventSquadId) {
    if (report && report.status !== 'DRAFT') {
      throw new Error('Cannot change squad for a match with a completed report.');
    }
    const squad = await db.eventSquad.findFirst({
      where: {
        id: data.eventSquadId,
        eventId: existing.eventId,
        ...(ctx.orgFilter.type === 'org' ? { event: ctx.orgFilter.filter } : {}),
      },
    });
    if (!squad) {
      throw new Error('Event squad must belong to the same event.');
    }
  }

  if (data.category !== undefined) {
    if (!VALID_CATEGORIES.includes(data.category as MatchCategory)) {
      throw new Error('Event match category must be CUP or OTHER.');
    }
    if (report && report.status !== 'DRAFT' && data.category !== existing.category) {
      throw new Error('Cannot change category for a match with a completed report.');
    }
  }

  if (data.startsAt !== undefined && report && report.status !== 'DRAFT') {
    throw new Error('Cannot change match time for a match with a completed report.');
  }

  const updateData: Record<string, unknown> = {};

  if (data.opponentName !== undefined) {
    if (data.opponentTeamId === null) {
      updateData.opponentName = data.opponentName.trim();
      updateData.opponentTeamId = null;
    } else {
      const { opponentTeamId, opponentName } = await resolveOpponent(data.opponentName, data.opponentTeamId);
      updateData.opponentName = opponentName;
      updateData.opponentTeamId = opponentTeamId;
    }
  }
  if (data.startsAt !== undefined) updateData.startsAt = new Date(data.startsAt);
  if (data.location !== undefined) updateData.location = data.location?.trim() || null;
  if (data.notes !== undefined) updateData.notes = data.notes?.trim() || null;
  if (data.category !== undefined) updateData.category = data.category as MatchCategory;
  if (data.eventSquadId !== undefined) updateData.eventSquadId = data.eventSquadId;

  const updated = await db.eventMatch.update({
    where: { id: eventMatchId },
    data: updateData,
  });

  revalidatePath(`/events/${existing.eventId}`);
  return updated;
}

export async function deleteEventMatchAction(eventMatchId: string) {
  const ctx = await requireActorContext();
  requireMutationRole(ctx);

  const { eventId } = await requireMatchOrgAccess(eventMatchId, ctx.orgFilter);

  const existing = await db.eventMatch.findUnique({ where: { id: eventMatchId } });
  if (!existing) throw new Error('Event match not found.');

  const report = await db.eventPostMatchReport.findUnique({
    where: { eventMatchId },
  });

  if (report && ['REPORTED', 'LOCKED'].includes(report.status)) {
    throw new Error('Cannot delete match with a completed report.');
  }

  await db.eventMatch.delete({ where: { id: eventMatchId } });

  revalidatePath(`/events/${existing.eventId}`);
  return { success: true };
}

export async function cancelEventMatchAction(eventMatchId: string, reason?: string) {
  const ctx = await requireActorContext();
  requireMutationRole(ctx);

  const { eventId } = await requireMatchOrgAccess(eventMatchId, ctx.orgFilter);

  const existing = await db.eventMatch.findUnique({ where: { id: eventMatchId } });
  if (!existing) throw new Error('Event match not found.');

  if (existing.status === 'CANCELLED') {
    throw new Error('Match is already cancelled.');
  }

  const report = await db.eventPostMatchReport.findUnique({
    where: { eventMatchId },
  });

  if (report && ['REPORTED', 'LOCKED'].includes(report.status)) {
    throw new Error('Cannot cancel match with a completed report.');
  }

  const updated = await db.eventMatch.update({
    where: { id: eventMatchId },
    data: {
      status: 'CANCELLED',
      cancelledAt: new Date(),
      cancelledReason: reason?.trim() || null,
    },
  });

  revalidatePath(`/events/${existing.eventId}`);
  return updated;
}

export async function listEventMatchesAction(eventId: string) {
  const ctx = await requireActorContext();
  await requireEventOrgAccess(eventId, ctx.orgFilter);
  const { getEventMatchesForEvent } = await import('@/lib/stats/event-match-stats');
  return getEventMatchesForEvent(eventId);
}

export async function reopenEventMatchAction(eventMatchId: string) {
  const ctx = await requireActorContext();
  requireMutationRole(ctx);

  const { eventId } = await requireMatchOrgAccess(eventMatchId, ctx.orgFilter);

  const existing = await db.eventMatch.findUnique({ where: { id: eventMatchId } });
  if (!existing) throw new Error('Event match not found.');

  if (existing.status !== 'CANCELLED') {
    throw new Error('Match is not cancelled.');
  }

  const updated = await db.eventMatch.update({
    where: { id: eventMatchId },
    data: {
      status: 'SCHEDULED',
      cancelledAt: null,
      cancelledReason: null,
    },
  });

  revalidatePath(`/events/${existing.eventId}`);
  return updated;
}