import "server-only";

import { db } from "@/lib/db";
import {
  resolveLeagueMatchFormat,
  resolveLeagueMatchFormatSource,
  eventSquadMatchTimingToFormat,
  type MatchFormatDefinition,
  type MatchFormatSnapshotSource,
} from "./match-format";
import { getEffectiveEventSquadMatchTiming } from "@/lib/events/event-types";

export interface MatchFormatSnapshotFields {
  formatNumberOfPeriods: number | null;
  formatPeriodDurationMinutes: number | null;
  formatBreakDurationMinutes: number | null;
  formatSource: MatchFormatSnapshotSource | null;
  formatSnapshotAt: Date | null;
}

const UNCONFIGURED_SNAPSHOT: MatchFormatSnapshotFields = {
  formatNumberOfPeriods: null,
  formatPeriodDurationMinutes: null,
  formatBreakDurationMinutes: null,
  formatSource: null,
  formatSnapshotAt: null,
};

/**
 * Builds the snapshot fields to persist onto LiveMatchSession/EventLiveMatchSession at the
 * moment Live Reporting starts (ADR-0146 §1, "Freeze point"). `null` (unconfigured) is a valid,
 * permanent result — never guessed.
 */
function buildFormatSnapshotFields(
  format: MatchFormatDefinition | null,
  source: MatchFormatSnapshotSource | null,
): MatchFormatSnapshotFields {
  if (!format) return UNCONFIGURED_SNAPSHOT;
  return {
    formatNumberOfPeriods: format.numberOfPeriods,
    formatPeriodDurationMinutes: format.periodDurationMinutes,
    formatBreakDurationMinutes: format.breakDurationMinutes,
    formatSource: source,
    formatSnapshotAt: new Date(),
  };
}

/**
 * Resolves the effective match format for a League match at the moment Live Reporting starts
 * (Match override > Team override > LeagueSeason default > unconfigured) and returns the fields
 * to persist onto the new LiveMatchSession row. Callers must only call this once, when actually
 * creating the session — re-resolving on every idempotent "already ACTIVE" call would silently
 * let a later Season/Team change reinterpret an already-live match (the freeze invariant this
 * exists to protect).
 */
export async function resolveLeagueMatchFormatSnapshot(matchId: string): Promise<MatchFormatSnapshotFields> {
  const match = await db.match.findUnique({
    where: { id: matchId },
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

  if (!match) return UNCONFIGURED_SNAPSHOT;

  const params = {
    season: match.matchRound.leagueSeason,
    team: match.team,
    match,
  };
  const format = resolveLeagueMatchFormat(params);
  const source = resolveLeagueMatchFormatSource(params);
  return buildFormatSnapshotFields(format, source);
}

/**
 * Resolves the effective match format for an Event match at the moment Live Reporting starts,
 * adapting Event's existing `getEffectiveEventSquadMatchTiming()` resolution into the shared
 * snapshot shape. Event's own override fields/resolvers are unchanged.
 */
export async function resolveEventMatchFormatSnapshot(eventMatchId: string): Promise<MatchFormatSnapshotFields> {
  const eventMatch = await db.eventMatch.findUnique({
    where: { id: eventMatchId },
    select: {
      eventSquad: {
        select: {
          numberOfHalvesOverride: true,
          matchDurationMinutesOverride: true,
          breakDurationMinutesOverride: true,
          event: {
            select: {
              numberOfHalves: true,
              matchDurationMinutes: true,
              breakDurationMinutes: true,
            },
          },
        },
      },
    },
  });

  if (!eventMatch) return UNCONFIGURED_SNAPSHOT;

  const timing = getEffectiveEventSquadMatchTiming(eventMatch.eventSquad.event, eventMatch.eventSquad);
  const format = eventSquadMatchTimingToFormat(timing);
  return buildFormatSnapshotFields(format, format ? "EVENT" : null);
}
