import { db } from '@/lib/db';
import { type MatchCategory } from './match-category';
import { resolveLiveReportingPrimaryAction, type LiveReportingPrimaryAction } from '@/lib/live-match/live-reporting-primary-action';
import { snapshotToFormat } from '@/lib/live-match/match-format';
import { buildPeriodConfigFromFormat, getEventPeriodConfig } from '@/lib/live-match/period-config';
import type { MatchPeriod } from '@/generated/prisma/client';

export interface EventMatchWithReport {
  id: string;
  eventSquadId: string;
  category: MatchCategory;
  opponentName: string;
  opponentTeamId: string | null;
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
  /** ADR-0152 §2 / issue #686: the same canonical resolver League Live Reporting/Today/Match
   * Details already consume — Event's own match list must not independently infer "is this
   * live" from a bare boolean. `null` when no active session exists. */
  isLive: boolean;
  livePrimaryAction: LiveReportingPrimaryAction | null;
}

type LiveSessionSnapshot = {
  status: string;
  clockPeriod: MatchPeriod;
  clockRunning: boolean;
  formatNumberOfPeriods: number | null;
  formatPeriodDurationMinutes: number | null;
  formatBreakDurationMinutes: number | null;
} | null;

const LIVE_SESSION_SELECT = {
  select: {
    status: true,
    clockPeriod: true,
    clockRunning: true,
    formatNumberOfPeriods: true,
    formatPeriodDurationMinutes: true,
    formatBreakDurationMinutes: true,
  },
} as const;

/**
 * No `matchType`-driven fallback exists for Event (unlike League's `getLeagueMatchPeriodConfig`)
 * -- a live session's own frozen format snapshot is expected to be populated by the time it's
 * ACTIVE (ADR-0146), so a missing snapshot here is a genuine edge case, not the normal path.
 * Falls back to a generic 2-half config with unknown (never a faked zero) duration, matching
 * `getEventPeriodConfig`'s own "unknown duration" discipline.
 */
function deriveEventLiveState(liveSession: LiveSessionSnapshot): { isLive: boolean; livePrimaryAction: LiveReportingPrimaryAction | null } {
  const isLive = liveSession?.status === 'ACTIVE';
  if (!isLive || !liveSession) return { isLive: false, livePrimaryAction: null };

  const format = snapshotToFormat(liveSession);
  const periodConfig = format ? buildPeriodConfigFromFormat(format) : getEventPeriodConfig(null, 2, null);

  const livePrimaryAction = resolveLiveReportingPrimaryAction({
    sessionStatus: 'ACTIVE',
    clock: { period: liveSession.clockPeriod, running: liveSession.clockRunning },
    periodConfig,
  });

  return { isLive: true, livePrimaryAction };
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
      liveSession: LIVE_SESSION_SELECT,
    },
  });

  return matches.map((m) => ({
    id: m.id,
    eventSquadId: m.eventSquadId,
    category: m.category as MatchCategory,
    opponentName: m.opponentName,
    opponentTeamId: m.opponentTeamId,
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
    ...deriveEventLiveState(m.liveSession),
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
      liveSession: LIVE_SESSION_SELECT,
    },
  });

  return matches.map((m) => ({
    id: m.id,
    eventSquadId: m.eventSquadId,
    category: m.category as MatchCategory,
    opponentName: m.opponentName,
    opponentTeamId: m.opponentTeamId,
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
    ...deriveEventLiveState(m.liveSession),
  }));
}

export { getDefaultEventMatchCategory } from './match-category';
