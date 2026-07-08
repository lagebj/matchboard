'use server'

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { requireCoachAccess } from '@/lib/auth';
import { MatchCategory } from '@/generated/prisma/client';
import type { EventMatchUpdateInput } from '@/generated/prisma/models/EventMatch';
import { getDefaultEventMatchCategory } from '@/lib/stats/event-match-stats';

const VALID_CATEGORIES: MatchCategory[] = ['CUP', 'OTHER'];

export async function createEventMatchAction(formData: FormData) {
  await requireCoachAccess();

  const eventId = formData.get('eventId') as string;
  const eventSquadId = formData.get('eventSquadId') as string;
  const opponentName = (formData.get('opponentName') as string)?.trim();
  const startsAt = formData.get('startsAt') as string;
  const location = (formData.get('location') as string)?.trim() || null;
  const notes = (formData.get('notes') as string)?.trim() || null;
  const categoryRaw = formData.get('category') as string;

  if (!eventId || !eventSquadId || !opponentName || !startsAt) {
    throw new Error('Event, squad, opponent name, and date/time are required.');
  }

  const event = await db.event.findUnique({ where: { id: eventId } });
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
      startsAt: new Date(startsAt),
      location,
      notes,
      status: 'SCHEDULED',
    },
  });

  revalidatePath(`/events/${eventId}`);
  return eventMatch;
}

export async function updateEventMatchAction(eventMatchId: string, data: {
  opponentName?: string;
  startsAt?: string;
  location?: string | null;
  notes?: string | null;
  category?: string;
}) {
  await requireCoachAccess();

  const existing = await db.eventMatch.findUnique({ where: { id: eventMatchId } });
  if (!existing) throw new Error('Event match not found.');

  const report = await db.eventPostMatchReport.findUnique({
    where: { eventMatchId },
  });

  if (report && report.status !== 'DRAFT') {
    throw new Error('Cannot edit match with a completed report.');
  }

  const updateData: Partial<EventMatchUpdateInput> = {};

  if (data.opponentName !== undefined) updateData.opponentName = data.opponentName.trim();
  if (data.startsAt !== undefined) updateData.startsAt = new Date(data.startsAt);
  if (data.location !== undefined) updateData.location = data.location?.trim() || null;
  if (data.notes !== undefined) updateData.notes = data.notes?.trim() || null;
  if (data.category !== undefined) {
    if (!VALID_CATEGORIES.includes(data.category as MatchCategory)) {
      throw new Error('Event match category must be CUP or OTHER.');
    }
    updateData.category = data.category as MatchCategory;
  }

  const updated = await db.eventMatch.update({
    where: { id: eventMatchId },
    data: updateData,
  });

  revalidatePath(`/events/${existing.eventId}`);
  return updated;
}

export async function deleteEventMatchAction(eventMatchId: string) {
  await requireCoachAccess();

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
  await requireCoachAccess();

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
  await requireCoachAccess();
  const { getEventMatchesForEvent } = await import('@/lib/stats/event-match-stats');
  return getEventMatchesForEvent(eventId);
}

export async function reopenEventMatchAction(eventMatchId: string) {
  await requireCoachAccess();

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