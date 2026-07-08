import { db } from '@/lib/db';
import { type MatchCategory } from './match-category';

export interface EventMatchWithReport {
  id: string;
  eventSquadId: string;
  category: MatchCategory;
  opponentName: string;
  startsAt: Date;
  location: string | null;
  notes: string | null;
  status: string;
  cancelledAt: Date | null;
  cancelledReason: string | null;
  report: {
    id: string;
    status: string;
    ourScore: number | null;
    opponentScore: number | null;
  } | null;
}

export async function getEventMatchesForSquad(eventSquadId: string): Promise<EventMatchWithReport[]> {
  const matches = await db.eventMatch.findMany({
    where: { eventSquadId },
    orderBy: { startsAt: 'asc' },
    include: {
      postMatchReport: {
        select: {
          id: true,
          status: true,
          ourScore: true,
          opponentScore: true,
        },
      },
    },
  });

  return matches.map((m) => ({
    id: m.id,
    eventSquadId: m.eventSquadId,
    category: m.category as MatchCategory,
    opponentName: m.opponentName,
    startsAt: m.startsAt,
    location: m.location,
    notes: m.notes,
    status: m.status,
    cancelledAt: m.cancelledAt,
    cancelledReason: m.cancelledReason,
    report: m.postMatchReport
      ? {
          id: m.postMatchReport.id,
          status: m.postMatchReport.status,
          ourScore: m.postMatchReport.ourScore,
          opponentScore: m.postMatchReport.opponentScore,
        }
      : null,
  }));
}

export async function getEventMatchesForEvent(eventId: string): Promise<EventMatchWithReport[]> {
  const matches = await db.eventMatch.findMany({
    where: { eventId },
    orderBy: { startsAt: 'asc' },
    include: {
      postMatchReport: {
        select: {
          id: true,
          status: true,
          ourScore: true,
          opponentScore: true,
        },
      },
    },
  });

  return matches.map((m) => ({
    id: m.id,
    eventSquadId: m.eventSquadId,
    category: m.category as MatchCategory,
    opponentName: m.opponentName,
    startsAt: m.startsAt,
    location: m.location,
    notes: m.notes,
    status: m.status,
    cancelledAt: m.cancelledAt,
    cancelledReason: m.cancelledReason,
    report: m.postMatchReport
      ? {
          id: m.postMatchReport.id,
          status: m.postMatchReport.status,
          ourScore: m.postMatchReport.ourScore,
          opponentScore: m.postMatchReport.opponentScore,
        }
      : null,
  }));
}

export { getDefaultEventMatchCategory } from './match-category';