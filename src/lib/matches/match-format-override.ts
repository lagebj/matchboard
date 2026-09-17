import "server-only";

import { db } from "@/lib/db";
import {
  validateMatchFormatDefinition,
  resolveLeagueMatchFormat,
  resolveLeagueMatchFormatSource,
  type MatchFormatDefinition,
} from "@/lib/live-match/match-format";

export type MatchFormatOverrideState = {
  /** The match's own override fields, complete-or-null. */
  matchOverride: MatchFormatDefinition | null;
  /** What the match would inherit (Team/Season walk excluding the match's own override). */
  inheritedFormat: MatchFormatDefinition | null;
  /** The full resolved format including the match override, if any. */
  effectiveFormat: MatchFormatDefinition | null;
  effectiveSource: ReturnType<typeof resolveLeagueMatchFormatSource>;
  /** Live Reporting has started and froze the snapshot — the override is no longer editable. */
  liveReportingStarted: boolean;
  /** The frozen snapshot when live reporting has started (authoritative display value). */
  frozenFormat: MatchFormatDefinition | null;
};

export type UpdateMatchFormatOverrideResult =
  | { success: true; format: MatchFormatDefinition | null }
  | { success: false; error: string };

/**
 * Reads one League match's match-format state for the MatchEditForm surface (ADR-0146 §1,
 * bundle §05.4): the match's own complete-or-null override, what it would inherit from
 * Team/Season, and — once Live Reporting has started — the frozen snapshot that is now
 * authoritative for that match.
 */
export async function getMatchFormatOverrideState(matchId: string, organisationId: string): Promise<MatchFormatOverrideState | null> {
  const match = await db.match.findFirst({
    where: { id: matchId, organisationId },
    select: {
      numberOfPeriodsOverride: true,
      periodDurationMinutesOverride: true,
      breakDurationMinutesOverride: true,
      team: {
        select: {
          numberOfPeriodsOverride: true,
          periodDurationMinutesOverride: true,
          breakDurationMinutesOverride: true,
        },
      },
      matchRound: {
        select: {
          leagueSeason: {
            select: {
              defaultNumberOfPeriods: true,
              defaultPeriodDurationMinutes: true,
              defaultBreakDurationMinutes: true,
            },
          },
        },
      },
    },
  });
  if (!match) return null;

  const liveSession = await db.liveMatchSession.findFirst({
    where: { matchId, status: "ACTIVE" },
    select: {
      formatNumberOfPeriods: true,
      formatPeriodDurationMinutes: true,
      formatBreakDurationMinutes: true,
    },
    orderBy: { startedAt: "desc" },
  });

  const overrideFields = {
    numberOfPeriods: match.numberOfPeriodsOverride,
    periodDurationMinutes: match.periodDurationMinutesOverride,
    breakDurationMinutes: match.breakDurationMinutesOverride,
  };
  const matchOverride =
    overrideFields.numberOfPeriods != null && overrideFields.periodDurationMinutes != null && overrideFields.breakDurationMinutes != null
      ? {
          numberOfPeriods: overrideFields.numberOfPeriods,
          periodDurationMinutes: overrideFields.periodDurationMinutes,
          breakDurationMinutes: overrideFields.breakDurationMinutes,
        }
      : null;

  // The inherited value: the same precedence walk with the match's own override excluded.
  const inheritedParams = {
    season: match.matchRound.leagueSeason,
    team: match.team,
    match: null,
  };

  const fullParams = {
    season: match.matchRound.leagueSeason,
    team: match.team,
    match: {
      numberOfPeriodsOverride: match.numberOfPeriodsOverride,
      periodDurationMinutesOverride: match.periodDurationMinutesOverride,
      breakDurationMinutesOverride: match.breakDurationMinutesOverride,
    },
  };

  const frozenFormat =
    liveSession &&
    liveSession.formatNumberOfPeriods != null &&
    liveSession.formatPeriodDurationMinutes != null &&
    liveSession.formatBreakDurationMinutes != null
      ? {
          numberOfPeriods: liveSession.formatNumberOfPeriods,
          periodDurationMinutes: liveSession.formatPeriodDurationMinutes,
          breakDurationMinutes: liveSession.formatBreakDurationMinutes,
        }
      : null;

  return {
    matchOverride,
    inheritedFormat: resolveLeagueMatchFormat(inheritedParams),
    effectiveFormat: resolveLeagueMatchFormat(fullParams),
    effectiveSource: resolveLeagueMatchFormatSource(fullParams),
    liveReportingStarted: liveSession != null,
    frozenFormat,
  };
}

/**
 * Sets or clears a Match's complete match-format override (ADR-0146 §1, highest precedence
 * over Team/LeagueSeason). Refused once Live Reporting has started for this match — from that
 * moment the frozen snapshot on the session is authoritative and the pre-live override must
 * not present itself as able to change the current live timing model (bundle §05.4).
 * `format: null` clears the override (inherit Season/Team again).
 */
export async function updateMatchFormatOverride(
  matchId: string,
  organisationId: string,
  format: MatchFormatDefinition | null,
): Promise<UpdateMatchFormatOverrideResult> {
  if (format) {
    const errors = validateMatchFormatDefinition(format);
    if (errors.length > 0) {
      return { success: false, error: `Invalid match format: ${errors.join(", ")}` };
    }
  }

  const match = await db.match.findFirst({
    where: { id: matchId, organisationId },
    select: { id: true },
  });
  if (!match) {
    return { success: false, error: "Match not found or access denied." };
  }

  const liveSession = await db.liveMatchSession.findFirst({
    where: { matchId, status: "ACTIVE" },
    select: { id: true },
  });
  if (liveSession) {
    return {
      success: false,
      error: "Live reporting has started for this match — its match format is frozen and can no longer be changed.",
    };
  }

  await db.match.update({
    where: { id: matchId },
    data: {
      numberOfPeriodsOverride: format ? format.numberOfPeriods : null,
      periodDurationMinutesOverride: format ? format.periodDurationMinutes : null,
      breakDurationMinutesOverride: format ? format.breakDurationMinutes : null,
    },
  });

  return { success: true, format };
}