import "server-only";

import { db } from "@/lib/db";
import type { MatchType } from "@/generated/prisma/client";
import {
  getLeagueMatchPeriodConfig,
  getEventPeriodConfig,
  buildPeriodConfigFromFormat,
  type PeriodConfig,
} from "./period-config";

export function snapshotToFormat(session: {
  formatNumberOfPeriods: number | null;
  formatPeriodDurationMinutes: number | null;
  formatBreakDurationMinutes: number | null;
} | null) {
  if (
    !session ||
    session.formatNumberOfPeriods == null ||
    session.formatPeriodDurationMinutes == null ||
    session.formatBreakDurationMinutes == null
  ) {
    return null;
  }
  return {
    numberOfPeriods: session.formatNumberOfPeriods,
    periodDurationMinutes: session.formatPeriodDurationMinutes,
    breakDurationMinutes: session.formatBreakDurationMinutes,
  };
}

/**
 * The `PeriodConfig[]` that actually drives a League match's live clock (ADR-0146). If Live
 * Reporting has started and froze a format snapshot, that snapshot is authoritative regardless of
 * any later Season/Team/Match configuration change. If no session/snapshot exists yet (not
 * started, or a legacy/unconfigured match), falls back to `getLeaguePeriodConfig(matchType)` --
 * byte-identical to pre-ADR-0146 behavior.
 */
export async function resolveLeagueMatchPeriodConfig(matchId: string, matchType: MatchType): Promise<PeriodConfig[]> {
  const session = await db.liveMatchSession.findUnique({
    where: { matchId },
    select: { formatNumberOfPeriods: true, formatPeriodDurationMinutes: true, formatBreakDurationMinutes: true },
  });

  return getLeagueMatchPeriodConfig(matchType, snapshotToFormat(session));
}

/**
 * Event equivalent of `resolveLeagueMatchPeriodConfig`. `fallback*` are the pre-live effective
 * values (`getEffectiveEventSquadMatchTiming`) already used before this session ever starts.
 */
export async function resolveEventMatchPeriodConfig(params: {
  eventMatchId: string;
  fallbackMatchDurationMinutes: number | null;
  fallbackNumberOfHalves: number;
  fallbackBreakDurationMinutes: number | null;
}): Promise<PeriodConfig[]> {
  const session = await db.eventLiveMatchSession.findUnique({
    where: { eventMatchId: params.eventMatchId },
    select: { formatNumberOfPeriods: true, formatPeriodDurationMinutes: true, formatBreakDurationMinutes: true },
  });

  const format = snapshotToFormat(session);
  if (format) return buildPeriodConfigFromFormat(format);

  return getEventPeriodConfig(params.fallbackMatchDurationMinutes, params.fallbackNumberOfHalves, params.fallbackBreakDurationMinutes);
}
