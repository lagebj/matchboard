import { db } from "@/lib/db";
import { classifyDataQuality, computeWholeMatchEstimate, type HistoricalDryRunResult } from "./opponent-engine";
import { getPlayerOverallRating } from "@/lib/ratings/player-rating";
import { recordOpponentSportingEvidence } from "@/lib/opponents/sporting-level-recording";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";

type MatchForReplay = {
  matchId: string;
  opponentTeamId: string;
  occurredAt: Date;
  gameFormat: string | null;
  homeGoals: number;
  awayGoals: number;
  isHome: boolean;
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
  const exclusions: Array<{ matchId: string; reason: string }> = [];
  let evidenceCreated = 0;
  let evidenceSkipped = 0;
  const opponentsAffected = new Set<string>();
  const playerMutations = 0;
  const playerPositionMutations = 0;
  const historicalFactChanges = 0;
  const details: HistoricalDryRunResult["details"] = [];

  const existingEvidence = await db.opponentSportingEvidence.findMany({
    where: {
      organisationId,
      ...(options?.from ? { occurredAt: { gte: options.from } } : {}),
      ...(options?.to ? { occurredAt: { lte: options.to } } : {}),
    },
    select: {
      matchId: true,
      estimate: true,
      opponentTeamId: true,
    },
  });

  const existingByMatchId = new Map(existingEvidence.map((e) => [e.matchId, e]));

  const playerBaselines = await getPlayerBaselines(organisationId);

  for (const match of matches) {
    matchesInspected++;

    if (!match.opponentTeamId) {
      exclusions.push({ matchId: match.matchId, reason: "No opponent team linked" });
      continue;
    }

    if (match.reportStatus !== "LOCKED" && match.reportStatus !== "REPORTED") {
      exclusions.push({ matchId: match.matchId, reason: `Report status ${match.reportStatus} not completed` });
      continue;
    }

    const matchFit = match.matchFit;
    if (matchFit === "CHAOTIC" || matchFit === "SUPPORT_OVERPOWERED" || matchFit === "SUPPORT_TOO_LOW") {
      exclusions.push({
        matchId: match.matchId,
        reason: `Match fit ${matchFit} auto-excluded`,
      });
      continue;
    }

    matchesEligible++;
    opponentsAffected.add(match.opponentTeamId);

    const goalsFor = match.isHome ? match.homeGoals : match.awayGoals;
    const goalsAgainst = match.isHome ? match.awayGoals : match.homeGoals;

    const existing = existingByMatchId.get(match.matchId);
    const previousEstimate = existing ? Number(existing.estimate) : null;

    try {
      const playerRatings = await getPlayerRatingsForMatch(match.matchId, organisationId, playerBaselines);

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
        goalsFor,
        goalsAgainst,
        playerRatings.length,
        playerRatings.filter((p) => p.overallRating !== null).length,
        matchFit,
        dataQuality,
        null,
      );

      evidenceCreated++;

      details.push({
        matchId: match.matchId,
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
      exclusions.push({ matchId: match.matchId, reason: "Processing error" });
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
  };
}

async function getEligibleMatches(
  organisationId: string,
  options?: { gameFormat?: string; from?: Date; to?: Date },
): Promise<MatchForReplay[]> {
  const matches = await db.match.findMany({
    where: {
      organisationId,
      opponentTeamId: { not: null },
      ...(options?.from ? { startsAt: { gte: options.from } } : {}),
      ...(options?.to ? { startsAt: { lte: options.to } } : {}),
    },
    select: {
      id: true,
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
    .map((m) => {
      const report = reportByMatchId.get(m.id);
      const homeGoals = report?.homeGoals ?? 0;
      const awayGoals = report?.awayGoals ?? 0;
      const isHome = m.homeAway === "HOME";

      return {
        matchId: m.id,
        opponentTeamId: m.opponentTeamId!,
        occurredAt: m.startsAt,
        gameFormat: m.gameFormat,
        homeGoals,
        awayGoals,
        isHome,
        matchFit: m.matchFit,
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
  matchId: string,
  organisationId: string,
  baselines: Map<string, number | null>,
): Promise<PlayerRatingSnapshot[]> {
  const actuals = await db.postMatchPlayerActual.findMany({
    where: {
      matchId,
      attendanceStatus: "PRESENT",
    },
    select: {
      playerId: true,
      player: {
        select: {
          id: true,
          primaryPosition: true,
          secondaryPosition: true,
          tertiaryPosition: true,
        },
      },
    },
  });

  return actuals.map((a) => ({
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
};

export async function applyOpponentEvidenceHistory(
  organisationId: string,
  options?: { gameFormat?: string; from?: Date; to?: Date },
): Promise<ApplyResult> {
  const matches = await getEligibleMatches(organisationId, options);
  const orgFilter: OrgFilterMode = { type: "org", organisationId, filter: { organisationId }, filterNullable: { organisationId } };

  const existingEvidence = await db.opponentSportingEvidence.findMany({
    where: {
      organisationId,
      ...(options?.from ? { occurredAt: { gte: options.from } } : {}),
      ...(options?.to ? { occurredAt: { lte: options.to } } : {}),
    },
    select: { matchId: true },
  });
  const alreadyRecorded = new Set(existingEvidence.map((e) => e.matchId));

  let processed = 0;
  let skipped = 0;
  let recorded = 0;
  let failed = 0;
  const details: ApplyResult["details"] = [];

  for (const match of matches) {
    if (alreadyRecorded.has(match.matchId)) {
      skipped++;
      details.push({ matchId: match.matchId, opponentTeamId: match.opponentTeamId, status: "already_recorded" });
      continue;
    }

    processed++;

    try {
      const result = await recordOpponentSportingEvidence(match.matchId, orgFilter);

      if (result.recorded) {
        recorded++;
        details.push({ matchId: match.matchId, opponentTeamId: match.opponentTeamId, status: "recorded" });
      } else {
        skipped++;
        details.push({ matchId: match.matchId, opponentTeamId: match.opponentTeamId, status: result.reason ?? "skipped" });
      }
    } catch (error) {
      failed++;
      details.push({ matchId: match.matchId, opponentTeamId: match.opponentTeamId, status: `error: ${error instanceof Error ? error.message : "unknown"}` });
    }
  }

  return {
    totalMatches: matches.length,
    processed,
    skipped,
    recorded,
    failed,
    details,
  };
}