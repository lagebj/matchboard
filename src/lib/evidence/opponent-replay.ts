import { db } from "@/lib/db";
import { classifyDataQuality, computeWholeMatchEstimate, type HistoricalDryRunResult } from "./opponent-engine";
import { getPlayerOverallRating } from "@/lib/ratings/player-rating";
import { recordOpponentSportingEvidenceForRef } from "@/lib/opponents/sporting-level-recording";
import { footballMatchRefSourceId, type FootballMatchRef } from "@/lib/evidence/football-match-ref";
import { getEffectiveEventTeamGameFormat } from "@/lib/events/event-types";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";
import { startsAtRangeFilter } from "@/lib/evidence/date-range-filter";

/**
 * Historical match eligible for the "Populate opponent levels" transient catch-up tool
 * (ARR-0031). Covers both League and Event history through one shared shape -- `ref`
 * identifies the source, everything downstream (dry-run estimate preview, apply via
 * `recordOpponentSportingEvidenceForRef`) is source-agnostic (ADR-0104).
 */
type MatchForReplay = {
  ref: FootballMatchRef;
  opponentTeamId: string;
  occurredAt: Date;
  gameFormat: string | null;
  goalsFor: number;
  goalsAgainst: number;
  matchFit: string | null;
  reportStatus: string;
};

type PlayerRatingSnapshot = {
  playerId: string;
  overallRating: number | null;
  primaryPosition: string | null;
  secondaryPosition: string | null;
  tertiaryPosition: string | null;
};

export async function dryRunOpponentEvidence(
  organisationId: string,
  options?: { gameFormat?: string; from?: Date; to?: Date },
): Promise<HistoricalDryRunResult> {
  const matches = await getEligibleMatches(organisationId, options);

  let matchesInspected = 0;
  let matchesEligible = 0;
  let matchesInspectedLeague = 0;
  let matchesInspectedEvent = 0;
  let matchesEligibleLeague = 0;
  let matchesEligibleEvent = 0;
  const exclusions: Array<{ matchId: string; reason: string }> = [];
  let evidenceCreated = 0;
  let evidenceSkipped = 0;
  const opponentsAffected = new Set<string>();
  const playerMutations = 0;
  const playerPositionMutations = 0;
  const historicalFactChanges = 0;
  const details: HistoricalDryRunResult["details"] = [];

  const occurredAtFilter = startsAtRangeFilter(options);
  const existingEvidence = await db.opponentSportingEvidence.findMany({
    where: {
      organisationId,
      ...(occurredAtFilter ? { occurredAt: occurredAtFilter } : {}),
    },
    select: {
      matchId: true,
      eventMatchId: true,
      estimate: true,
      opponentTeamId: true,
    },
  });

  const existingBySourceId = new Map(
    existingEvidence.map((e) => [e.matchId ?? e.eventMatchId!, e]),
  );

  const playerBaselines = await getPlayerBaselines(organisationId);

  for (const match of matches) {
    matchesInspected++;
    if (match.ref.kind === "LEAGUE_MATCH") matchesInspectedLeague++;
    else matchesInspectedEvent++;

    const sourceId = footballMatchRefSourceId(match.ref);

    if (!match.opponentTeamId) {
      exclusions.push({ matchId: sourceId, reason: "No opponent team linked" });
      continue;
    }

    if (match.reportStatus !== "LOCKED" && match.reportStatus !== "REPORTED") {
      exclusions.push({ matchId: sourceId, reason: `Report status ${match.reportStatus} not completed` });
      continue;
    }

    const matchFit = match.matchFit;
    if (matchFit === "CHAOTIC" || matchFit === "SUPPORT_OVERPOWERED" || matchFit === "SUPPORT_TOO_LOW") {
      exclusions.push({
        matchId: sourceId,
        reason: `Match fit ${matchFit} auto-excluded`,
      });
      continue;
    }

    matchesEligible++;
    if (match.ref.kind === "LEAGUE_MATCH") matchesEligibleLeague++;
    else matchesEligibleEvent++;
    opponentsAffected.add(match.opponentTeamId);

    const existing = existingBySourceId.get(sourceId);
    const previousEstimate = existing ? Number(existing.estimate) : null;

    try {
      const playerRatings = await getPlayerRatingsForMatch(match.ref, organisationId, playerBaselines);

      const dataQuality = classifyDataQuality({
        hasExactTimeline: false,
        hasReliableMinutes: false,
        hasReliablePositions: false,
        participantCount: playerRatings.length,
        ratedParticipantCount: playerRatings.filter((p) => p.overallRating !== null).length,
      });

      const avgRating = playerRatings.length > 0
        ? playerRatings.reduce((sum, p) => sum + (p.overallRating ?? 5.0), 0) / playerRatings.length
        : null;

      const result = computeWholeMatchEstimate(
        avgRating,
        match.goalsFor,
        match.goalsAgainst,
        playerRatings.length,
        playerRatings.filter((p) => p.overallRating !== null).length,
        matchFit,
        dataQuality,
        null,
      );

      evidenceCreated++;

      details.push({
        matchId: sourceId,
        opponentTeamId: match.opponentTeamId,
        previousEstimate,
        proposedEstimate: result.estimate,
        dataQuality: result.dataQuality,
        confidence: result.confidence,
        difference: previousEstimate !== null
          ? Math.round((result.estimate - previousEstimate) * 100) / 100
          : result.estimate,
      });
    } catch {
      exclusions.push({ matchId: sourceId, reason: "Processing error" });
      evidenceSkipped++;
    }
  }

  return {
    matchesInspected,
    matchesEligible,
    exclusions,
    evidenceCreated,
    evidenceSkipped,
    opponentsAffected: opponentsAffected.size,
    playerMutations,
    playerPositionMutations,
    historicalFactChanges,
    details,
    bySource: {
      league: { inspected: matchesInspectedLeague, eligible: matchesEligibleLeague },
      event: { inspected: matchesInspectedEvent, eligible: matchesEligibleEvent },
    },
  };
}

async function getEligibleMatches(
  organisationId: string,
  options?: { gameFormat?: string; from?: Date; to?: Date },
): Promise<MatchForReplay[]> {
  const leagueMatches = await getEligibleLeagueMatches(organisationId, options);
  const eventMatches = await getEligibleEventMatches(organisationId, options);
  return [...leagueMatches, ...eventMatches].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
}

async function getEligibleLeagueMatches(
  organisationId: string,
  options?: { gameFormat?: string; from?: Date; to?: Date },
): Promise<MatchForReplay[]> {
  const startsAtFilter = startsAtRangeFilter(options);
  const matches = await db.match.findMany({
    where: {
      organisationId,
      opponentTeamId: { not: null },
      ...(startsAtFilter ? { startsAt: startsAtFilter } : {}),
    },
    select: {
      id: true,
      matchRoundId: true,
      opponentTeamId: true,
      startsAt: true,
      gameFormat: true,
      matchFit: true,
      homeAway: true,
    },
    orderBy: { startsAt: "asc" },
  });

  const matchIds = matches.map((m) => m.id);

  const reports = await db.postMatchReport.findMany({
    where: {
      matchId: { in: matchIds },
      status: { in: ["REPORTED", "LOCKED"] },
    },
    select: {
      matchId: true,
      status: true,
      homeGoals: true,
      awayGoals: true,
    },
  });

  const reportByMatchId = new Map(reports.map((r) => [r.matchId, r]));

  return matches
    .map((m): MatchForReplay => {
      const report = reportByMatchId.get(m.id);
      const homeGoals = report?.homeGoals ?? 0;
      const awayGoals = report?.awayGoals ?? 0;
      const isHome = m.homeAway === "HOME";
      const goalsFor = isHome ? homeGoals : awayGoals;
      const goalsAgainst = isHome ? awayGoals : homeGoals;

      return {
        ref: { kind: "LEAGUE_MATCH", matchId: m.id, leagueSeasonId: null },
        opponentTeamId: m.opponentTeamId!,
        occurredAt: m.startsAt,
        gameFormat: m.gameFormat,
        goalsFor,
        goalsAgainst,
        matchFit: m.matchFit,
        reportStatus: report?.status ?? "UNKNOWN",
      };
    })
    .filter((m) => m.reportStatus === "REPORTED" || m.reportStatus === "LOCKED");
}

async function getEligibleEventMatches(
  organisationId: string,
  options?: { gameFormat?: string; from?: Date; to?: Date },
): Promise<MatchForReplay[]> {
  const startsAtFilter = startsAtRangeFilter(options);
  const eventMatches = await db.eventMatch.findMany({
    where: {
      organisationId,
      opponentTeamId: { not: null },
      ...(startsAtFilter ? { startsAt: startsAtFilter } : {}),
    },
    select: {
      id: true,
      eventId: true,
      opponentTeamId: true,
      startsAt: true,
      event: { select: { gameFormat: true } },
      eventSquad: { select: { gameFormatOverride: true } },
    },
    orderBy: { startsAt: "asc" },
  });

  const eventMatchIds = eventMatches.map((m) => m.id);

  const reports = await db.eventPostMatchReport.findMany({
    where: {
      eventMatchId: { in: eventMatchIds },
      status: { in: ["REPORTED", "LOCKED"] },
    },
    select: {
      eventMatchId: true,
      status: true,
      ourScore: true,
      opponentScore: true,
    },
  });

  const reportByEventMatchId = new Map(reports.map((r) => [r.eventMatchId, r]));

  return eventMatches
    .map((m): MatchForReplay => {
      const report = reportByEventMatchId.get(m.id);

      return {
        // evidenceLeagueSeasonId is not needed for opponent evidence (only combination
        // evidence uses it); leaving it null here is correct, not a shortcut.
        ref: { kind: "EVENT_MATCH", eventMatchId: m.id, eventId: m.eventId, evidenceLeagueSeasonId: null },
        opponentTeamId: m.opponentTeamId!,
        occurredAt: m.startsAt,
        gameFormat: getEffectiveEventTeamGameFormat(m.event, m.eventSquad),
        goalsFor: report?.ourScore ?? 0,
        goalsAgainst: report?.opponentScore ?? 0,
        // EventMatch has no matchFit field -- no auto-exclusion signal for Event history
        // either (ADR-0104), consistent with the automatic recording path.
        matchFit: null,
        reportStatus: report?.status ?? "UNKNOWN",
      };
    })
    .filter((m) => m.reportStatus === "REPORTED" || m.reportStatus === "LOCKED");
}

async function getPlayerBaselines(
  organisationId: string,
): Promise<Map<string, number | null>> {
  const players = await db.player.findMany({
    where: {
      organisationId,
      active: true,
      removedAt: null,
    },
    select: {
      id: true,
      ballControl: true,
      passing: true,
      firstTouch: true,
      oneVOneAttacking: true,
      positioning: true,
      oneVOneDefending: true,
      decisionMaking: true,
      effort: true,
      teamplay: true,
      concentration: true,
      speed: true,
      strength: true,
    },
  });

  const baselines = new Map<string, number | null>();
  for (const player of players) {
    baselines.set(player.id, getPlayerOverallRating(player).value);
  }
  return baselines;
}

async function getPlayerRatingsForMatch(
  ref: FootballMatchRef,
  organisationId: string,
  baselines: Map<string, number | null>,
): Promise<PlayerRatingSnapshot[]> {
  if (ref.kind === "LEAGUE_MATCH") {
    const actuals = await db.postMatchPlayerActual.findMany({
      where: { matchId: ref.matchId, attendanceStatus: "PRESENT" },
      select: {
        playerId: true,
        player: { select: { id: true, primaryPosition: true, secondaryPosition: true, tertiaryPosition: true } },
      },
    });

    // ADR-0106: PostMatchPlayerActual.playerId/player are now nullable (a GuestPlayer appearance
    // uses guestPlayerId instead). A GuestPlayer has no ratings/positions to snapshot here by
    // design (ADR-0106 §4) -- excluded, not just a PR1 placeholder.
    return actuals
      .filter((a): a is typeof a & { playerId: string; player: NonNullable<typeof a.player> } => a.playerId !== null && a.player !== null)
      .map((a) => ({
      playerId: a.playerId,
      overallRating: baselines.get(a.playerId) ?? null,
      primaryPosition: a.player.primaryPosition,
      secondaryPosition: a.player.secondaryPosition,
      tertiaryPosition: a.player.tertiaryPosition,
    }));
  }

  const report = await db.eventPostMatchReport.findFirst({
    where: { eventMatchId: ref.eventMatchId },
    select: {
      playerReports: {
        where: { attendanceStatus: "PRESENT" },
        select: {
          playerId: true,
          player: { select: { id: true, primaryPosition: true, secondaryPosition: true, tertiaryPosition: true } },
        },
      },
    },
  });

  if (!report) return [];

  // ADR-0106: EventPostMatchPlayer.playerId/player are now nullable (a GuestPlayer appearance
  // uses guestPlayerId instead) -- same exclusion rationale as the League branch above.
  return report.playerReports
    .filter((a): a is typeof a & { playerId: string; player: NonNullable<typeof a.player> } => a.playerId !== null && a.player !== null)
    .map((a) => ({
    playerId: a.playerId,
    overallRating: baselines.get(a.playerId) ?? null,
    primaryPosition: a.player.primaryPosition,
    secondaryPosition: a.player.secondaryPosition,
    tertiaryPosition: a.player.tertiaryPosition,
  }));
}

export type ApplyResult = {
  totalMatches: number;
  processed: number;
  skipped: number;
  recorded: number;
  failed: number;
  details: Array<{ matchId: string; opponentTeamId: string | null; status: string }>;
  bySource: {
    league: { total: number; recorded: number; skipped: number; failed: number };
    event: { total: number; recorded: number; skipped: number; failed: number };
  };
};

/**
 * Applies the same generalized `recordOpponentSportingEvidenceForRef()` League's
 * `completeReport()` and Event's `completeEventReport()` call automatically (ADR-0104) --
 * not a second historical-only opponent-rating algorithm (ARR-0031).
 */
export async function applyOpponentEvidenceHistory(
  organisationId: string,
  options?: { gameFormat?: string; from?: Date; to?: Date },
): Promise<ApplyResult> {
  const matches = await getEligibleMatches(organisationId, options);
  const orgFilter: OrgFilterMode = { type: "org", organisationId, filter: { organisationId }, filterNullable: { organisationId } };

  const occurredAtFilter = startsAtRangeFilter(options);
  const existingEvidence = await db.opponentSportingEvidence.findMany({
    where: {
      organisationId,
      ...(occurredAtFilter ? { occurredAt: occurredAtFilter } : {}),
    },
    select: { matchId: true, eventMatchId: true },
  });
  const alreadyRecorded = new Set(existingEvidence.map((e) => e.matchId ?? e.eventMatchId!));

  let processed = 0;
  let skipped = 0;
  let recorded = 0;
  let failed = 0;
  const details: ApplyResult["details"] = [];
  const bySource: ApplyResult["bySource"] = {
    league: { total: 0, recorded: 0, skipped: 0, failed: 0 },
    event: { total: 0, recorded: 0, skipped: 0, failed: 0 },
  };

  for (const match of matches) {
    const sourceId = footballMatchRefSourceId(match.ref);
    const bucket = match.ref.kind === "LEAGUE_MATCH" ? bySource.league : bySource.event;
    bucket.total++;

    if (alreadyRecorded.has(sourceId)) {
      skipped++;
      bucket.skipped++;
      details.push({ matchId: sourceId, opponentTeamId: match.opponentTeamId, status: "already_recorded" });
      continue;
    }

    processed++;

    try {
      const result = await recordOpponentSportingEvidenceForRef(match.ref, orgFilter);

      if (result.recorded) {
        recorded++;
        bucket.recorded++;
        details.push({ matchId: sourceId, opponentTeamId: match.opponentTeamId, status: "recorded" });
      } else {
        skipped++;
        bucket.skipped++;
        details.push({ matchId: sourceId, opponentTeamId: match.opponentTeamId, status: result.reason ?? "skipped" });
      }
    } catch (error) {
      failed++;
      bucket.failed++;
      details.push({ matchId: sourceId, opponentTeamId: match.opponentTeamId, status: `error: ${error instanceof Error ? error.message : "unknown"}` });
    }
  }

  return {
    totalMatches: matches.length,
    processed,
    skipped,
    recorded,
    failed,
    details,
    bySource,
  };
}
