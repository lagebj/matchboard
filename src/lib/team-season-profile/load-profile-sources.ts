import "server-only";
import { db } from "@/lib/db";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";
import { getGoalAttributionEventsForRef } from "@/lib/evidence/combination-goal-attribution";
import { getMatchPhaseWindows } from "@/lib/evidence/match-state-timeline";
import { getLeaguePeriodConfig } from "@/lib/live-match/period-config";
import { getSeasonCombinationEvidenceWithOpponents } from "@/lib/evidence/combination-aggregation";
import type { CombinationEvidenceRow } from "@/lib/evidence/combination-topology";
import { getQualitativeEvidenceForMatches } from "@/lib/evidence/qualitative-evidence-service";
import type { TeamThemeObservation } from "@/lib/team-season-profile/qualitative-patterns";
import type { MatchRhythmSample } from "@/lib/team-season-profile/pattern-catalogue";
import type { PlayerMatchExposure, PlayerMatchInterval } from "@/lib/team-season-profile/player-contributions";
import type { JsonValue } from "@/lib/ai/fingerprints";

/**
 * Bounded source loader for one Team Season Profile build (ADR-0156 §8 /
 * `05_DATA_MODEL_AND_REFRESH.md` §8: "prefer a bounded, explicit source loader ... rather than
 * having UI components individually query evidence"). The only module in this feature that
 * issues Prisma queries directly; every family builder downstream is pure.
 *
 * V1 is League Team + League Season scoped only (locked decision #4): eligible matches are
 * `Match` rows for this exact `teamId` within this exact `leagueSeasonId`'s rounds. Event
 * matches are never included -- there is no Event-squad-to-League-Team inference here.
 */

export type EligibleMatch = { id: string; startsAt: Date };

export type ProfileSources = {
  organisationId: string;
  teamId: string;
  leagueSeasonId: string;
  seasonStart: Date;
  seasonEnd: Date;
  eligibleMatches: EligibleMatch[];
  recentMatchIds: Set<string>;
  rhythmSamples: MatchRhythmSample[];
  combinationEvidenceRows: CombinationEvidenceRow[];
  opponentByMatch: Map<string, string>;
  themeObservations: TeamThemeObservation[];
  playerExposures: PlayerMatchExposure[];
  realPlayerIds: Set<string>;
  qualitativeObservationCount: number;
  combinationEvidenceCount: number;
  totalResolvedMinutes: number;
  fingerprintInput: JsonValue;
};

/** Trajectory's "latest 4 completed matches" recent window (`04_CONFIDENCE_TRAJECTORY_AND_LANGUAGE.md`
 * §2) -- never crosses the season boundary because it is drawn only from `eligibleMatches`,
 * which are already season-scoped. */
const RECENT_WINDOW_MATCHES = 4;

export async function loadTeamSeasonProfileSources(params: {
  organisationId: string;
  teamId: string;
  leagueSeasonId: string;
  orgFilter: OrgFilterMode;
}): Promise<ProfileSources | null> {
  const { organisationId, teamId, leagueSeasonId, orgFilter } = params;
  if (orgFilter.type !== "org") return null;

  const [team, season] = await Promise.all([
    db.team.findFirst({ where: { id: teamId, ...orgFilter.filter }, select: { id: true } }),
    db.leagueSeason.findFirst({ where: { id: leagueSeasonId, ...orgFilter.filter }, select: { id: true, startDate: true, endDate: true } }),
  ]);
  if (!team || !season) return null;

  const matches = await db.match.findMany({
    where: { teamId, matchRound: { leagueSeasonId }, status: "SCHEDULED", ...orgFilter.filter },
    select: { id: true, startsAt: true, matchType: true },
    orderBy: { startsAt: "asc" },
  });
  if (matches.length === 0) {
    return emptySources({ organisationId, teamId, leagueSeasonId, season });
  }

  const reports = await db.postMatchReport.findMany({
    where: { matchId: { in: matches.map((m) => m.id) }, status: { in: ["REPORTED", "LOCKED"] } },
    select: { matchId: true, status: true, updatedAt: true, homeGoals: true, awayGoals: true },
  });
  const reportByMatch = new Map(reports.map((r) => [r.matchId, r]));
  const eligible = matches.filter((m) => reportByMatch.has(m.id));
  if (eligible.length === 0) {
    return emptySources({ organisationId, teamId, leagueSeasonId, season });
  }

  const eligibleMatches: EligibleMatch[] = eligible.map((m) => ({ id: m.id, startsAt: m.startsAt }));
  const eligibleMatchIds = new Set(eligibleMatches.map((m) => m.id));
  const recentMatchIds = new Set(eligible.slice(-RECENT_WINDOW_MATCHES).map((m) => m.id));

  const rhythmSamples: MatchRhythmSample[] = [];
  for (const match of eligible) {
    const goalEvents = await getGoalAttributionEventsForRef({ kind: "LEAGUE_MATCH", matchId: match.id, leagueSeasonId });
    const periodConfig = getLeaguePeriodConfig(match.matchType);
    const totalExposureMinutes = periodConfig.filter((p) => p.type === "playing").reduce((sum, p) => sum + (p.durationMs ?? 0) / 60000, 0);
    rhythmSamples.push({ matchId: match.id, startsAt: match.startsAt, goalEvents, phaseWindows: getMatchPhaseWindows(periodConfig), totalExposureMinutes });
  }

  const { evidence: allCombinationEvidence, opponentByMatch } = await getSeasonCombinationEvidenceWithOpponents(leagueSeasonId);
  const combinationEvidenceRows = allCombinationEvidence.filter((r) => r.matchId != null && eligibleMatchIds.has(r.matchId));

  // `getQualitativeEvidenceForMatches` (not the date-windowed `getQualitativeEvidenceForTeamWindow`)
  // -- it takes the exact eligible-match set this loader already decided is in scope, rather
  // than an observation-creation-date window that could drift from the match's own date (e.g. a
  // debrief filed after the season's `endDate` for a match that occurred within it).
  const rawObservations = await getQualitativeEvidenceForMatches([...eligibleMatchIds], organisationId);
  const themeObservations: TeamThemeObservation[] = rawObservations
    .filter((o) => o.scope === "TEAM" && o.matchId != null)
    .map((o) => ({ id: o.id, matchId: o.matchId as string, phase: o.phase, polarity: o.polarity, createdAt: o.createdAt }));

  const intervals = await db.actualPositionInterval.findMany({
    where: { organisationId, matchId: { in: [...eligibleMatchIds] }, playerId: { not: null } },
    select: { matchId: true, playerId: true, position: true, startedAtMs: true, endedAtMs: true, updatedAt: true },
  });

  const exposureKey = (matchId: string, playerId: string) => `${matchId}:${playerId}`;
  const exposureByKey = new Map<string, { matchId: string; startsAt: Date; playerId: string; minutesPlayed: number; intervals: PlayerMatchInterval[] }>();
  const realPlayerIds = new Set<string>();
  let latestIntervalUpdate = 0;

  for (const row of intervals) {
    const playerId = row.playerId as string;
    realPlayerIds.add(playerId);
    latestIntervalUpdate = Math.max(latestIntervalUpdate, row.updatedAt.getTime());

    const key = exposureKey(row.matchId as string, playerId);
    const startsAt = eligibleMatches.find((m) => m.id === row.matchId)?.startsAt ?? new Date(0);
    const existing = exposureByKey.get(key) ?? { matchId: row.matchId as string, startsAt, playerId, minutesPlayed: 0, intervals: [] };
    existing.intervals.push({ position: row.position, startedAtMs: row.startedAtMs, endedAtMs: row.endedAtMs });
    if (row.position !== "BENCH") {
      existing.minutesPlayed += ((row.endedAtMs ?? row.startedAtMs) - row.startedAtMs) / 60000;
    }
    exposureByKey.set(key, existing);
  }

  const playerExposures: PlayerMatchExposure[] = [...exposureByKey.values()].map((e) => ({ ...e, minutesPlayed: Math.round(e.minutesPlayed * 10) / 10 }));
  const totalResolvedMinutes = Math.round(playerExposures.reduce((sum, e) => sum + e.minutesPlayed, 0) * 10) / 10;

  const fingerprintInput: JsonValue = {
    leagueSeasonId,
    seasonStart: season.startDate.toISOString(),
    seasonEnd: season.endDate.toISOString(),
    matches: eligible
      .map((m) => {
        const report = reportByMatch.get(m.id)!;
        return {
          matchId: m.id,
          reportStatus: report.status,
          reportUpdatedAt: report.updatedAt.toISOString(),
          homeGoals: report.homeGoals,
          awayGoals: report.awayGoals,
        };
      })
      .sort((a, b) => a.matchId.localeCompare(b.matchId)),
    combinationEvidenceCount: combinationEvidenceRows.length,
    combinationEvidenceLatest: combinationEvidenceRows.reduce((max, r) => Math.max(max, r.createdAt.getTime()), 0),
    qualitativeObservationCount: themeObservations.length,
    qualitativeObservationLatest: themeObservations.reduce((max, o) => Math.max(max, o.createdAt.getTime()), 0),
    actualPositionIntervalLatest: latestIntervalUpdate,
  };

  return {
    organisationId,
    teamId,
    leagueSeasonId,
    seasonStart: season.startDate,
    seasonEnd: season.endDate,
    eligibleMatches,
    recentMatchIds,
    rhythmSamples,
    combinationEvidenceRows,
    opponentByMatch,
    themeObservations,
    playerExposures,
    realPlayerIds,
    qualitativeObservationCount: themeObservations.length,
    combinationEvidenceCount: combinationEvidenceRows.length,
    totalResolvedMinutes,
    fingerprintInput,
  };
}

function emptySources(params: { organisationId: string; teamId: string; leagueSeasonId: string; season: { startDate: Date; endDate: Date } }): ProfileSources {
  return {
    organisationId: params.organisationId,
    teamId: params.teamId,
    leagueSeasonId: params.leagueSeasonId,
    seasonStart: params.season.startDate,
    seasonEnd: params.season.endDate,
    eligibleMatches: [],
    recentMatchIds: new Set(),
    rhythmSamples: [],
    combinationEvidenceRows: [],
    opponentByMatch: new Map(),
    themeObservations: [],
    playerExposures: [],
    realPlayerIds: new Set(),
    qualitativeObservationCount: 0,
    combinationEvidenceCount: 0,
    totalResolvedMinutes: 0,
    fingerprintInput: {
      leagueSeasonId: params.leagueSeasonId,
      seasonStart: params.season.startDate.toISOString(),
      seasonEnd: params.season.endDate.toISOString(),
      matches: [],
      combinationEvidenceCount: 0,
      combinationEvidenceLatest: 0,
      qualitativeObservationCount: 0,
      qualitativeObservationLatest: 0,
      actualPositionIntervalLatest: 0,
    },
  };
}
