import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import {
  calculateEncounterEstimate,
  computeFieldedRating,
  shouldAutoExcludeEncounter,
  FORMULA_VERSION,
} from "./sporting-level-calculation";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";
import { getPlayerOverallRating } from "@/lib/ratings/player-rating";
import { RATING_ATTRIBUTE_KEYS } from "@/lib/player-development/constants";

export type FieldedPlayer = {
  playerId: string;
  rating: number | null;
  minutes?: number | null;
};

export async function recordOpponentSportingEvidence(
  matchId: string,
  orgFilter: OrgFilterMode,
): Promise<{ recorded: boolean; evidenceId?: string; reason?: string }> {
  const match = await db.match.findFirst({
    where: { id: matchId, ...orgFilter.filter },
    select: {
      id: true,
      opponentTeamId: true,
      matchFit: true,
      gameFormat: true,
      startsAt: true,
      organisationId: true,
      homeAway: true,
    },
  });

  if (!match) {
    return { recorded: false, reason: "Match not found" };
  }

  if (!match.opponentTeamId) {
    return { recorded: false, reason: "No opponent team linked to match" };
  }

  const report = await db.postMatchReport.findFirst({
    where: { matchId, ...orgFilter.filterNullable },
    select: {
      id: true,
      status: true,
      homeGoals: true,
      awayGoals: true,
      playerActuals: {
        select: {
          playerId: true,
          attendanceStatus: true,
          actualPositions: true,
        },
      },
    },
  });

  if (!report) {
    return { recorded: false, reason: "No post-match report" };
  }

  if (report.status !== "LOCKED" && report.status !== "REPORTED") {
    return { recorded: false, reason: "Report not completed" };
  }

  const homeGoals = report.homeGoals ?? 0;
  const awayGoals = report.awayGoals ?? 0;

  // homeGoals/awayGoals are venue-relative (home team's score, away team's score).
  // goalsFor/goalsAgainst in sporting evidence are from our team's perspective.
  // When we're the away team, our goals = awayGoals, opponent's = homeGoals.
  const isHome = match.homeAway === "HOME";
  const goalsFor = isHome ? homeGoals : awayGoals;
  const goalsAgainst = isHome ? awayGoals : homeGoals;

  const presentActuals = report.playerActuals.filter(
    (a: { playerId: string; attendanceStatus: string; actualPositions: unknown }) =>
      a.attendanceStatus === "PRESENT",
  );

  if (presentActuals.length === 0) {
    return { recorded: false, reason: "No present participants" };
  }

  const playerIds = presentActuals.map((a: { playerId: string }) => a.playerId);

  const players = await db.player.findMany({
    where: {
      id: { in: playerIds },
      ...(orgFilter.type === "org" ? orgFilter.filter : {}),
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

  const playerMap = new Map(players.map((p) => [p.id, p]));

  const fieldedPlayers: FieldedPlayer[] = presentActuals.map((actual: { playerId: string; attendanceStatus: string; actualPositions: unknown }) => {
    const player = playerMap.get(actual.playerId);
    const rating = player ? getPlayerOverallRating(player).value : null;
    return { playerId: actual.playerId, rating };
  });

  const { rating: fieldedRating, method, participantCount, ratedParticipantCount } = computeFieldedRating(fieldedPlayers);

  if (fieldedRating === null) {
    const existing = await db.opponentSportingEvidence.findFirst({
      where: { matchId, ...orgFilter.filter },
    });
    if (existing) {
      await db.opponentSportingEvidence.delete({ where: { id: existing.id } });
    }
    return { recorded: false, reason: "No valid fielded rating could be derived" };
  }

  const estimate = calculateEncounterEstimate(fieldedRating, homeGoals, awayGoals);

  const autoExclude = shouldAutoExcludeEncounter(match.matchFit);

  const fieldedRatingDetails = {
    players: presentActuals.map((a: { playerId: string; attendanceStatus: string; actualPositions: unknown }) => {
      const p = playerMap.get(a.playerId);
      const attrs: Record<string, number | null> = {};
      if (p) {
        for (const key of RATING_ATTRIBUTE_KEYS) {
          attrs[key] = p[key as keyof typeof p] as number | null;
        }
      }
      return {
        playerId: a.playerId,
        rating: fieldedPlayers.find((f) => f.playerId === a.playerId)?.rating ?? null,
        actualPositions: a.actualPositions,
      };
    }),
    method,
    participantCount,
    ratedParticipantCount,
  };

  const organisationId = orgFilter.type === "org" ? orgFilter.organisationId : match.organisationId;

  const _gameFormat = match.gameFormat as string | null;

  const evidence = await db.opponentSportingEvidence.upsert({
    where: { matchId },
    update: {
      opponentTeamId: match.opponentTeamId,
      occurredAt: match.startsAt,
      gameFormat: match.gameFormat,
      goalsFor,
      goalsAgainst,
      fieldedRatingSnapshot: new Prisma.Decimal(fieldedRating.toFixed(2)),
      participantCount,
      ratedParticipantCount,
      weightingMethod: method === "MINUTE_WEIGHTED" ? "MINUTE_WEIGHTED" : "PARTICIPANT_AVERAGE",
      estimate: new Prisma.Decimal(estimate.toFixed(2)),
      formulaVersion: FORMULA_VERSION,
      excludedAt: autoExclude ? new Date() : null,
      exclusionReason: autoExclude ? `Auto-excluded: match fit ${match.matchFit}` : null,
      fieldedRatingDetails: fieldedRatingDetails as Prisma.InputJsonValue,
      organisationId,
    },
    create: {
      matchId,
      opponentTeamId: match.opponentTeamId,
      occurredAt: match.startsAt,
      gameFormat: match.gameFormat,
      goalsFor,
      goalsAgainst,
      fieldedRatingSnapshot: new Prisma.Decimal(fieldedRating.toFixed(2)),
      participantCount,
      ratedParticipantCount,
      weightingMethod: method === "MINUTE_WEIGHTED" ? "MINUTE_WEIGHTED" : "PARTICIPANT_AVERAGE",
      estimate: new Prisma.Decimal(estimate.toFixed(2)),
      formulaVersion: FORMULA_VERSION,
      excludedAt: autoExclude ? new Date() : null,
      exclusionReason: autoExclude ? `Auto-excluded: match fit ${match.matchFit}` : null,
      fieldedRatingDetails: fieldedRatingDetails as Prisma.InputJsonValue,
      organisationId,
    },
  });

  return { recorded: true, evidenceId: evidence.id };
}

export async function excludeOpponentSportingEvidence(
  evidenceId: string,
  reason: string,
  orgFilter: OrgFilterMode,
): Promise<{ success: boolean; error?: string }> {
  if (orgFilter.type !== "org") {
    return { success: false, error: "Organisation access required" };
  }

  const evidence = await db.opponentSportingEvidence.findFirst({
    where: { id: evidenceId, ...orgFilter.filter },
  });

  if (!evidence) {
    return { success: false, error: "Evidence not found or access denied" };
  }

  if (evidence.excludedAt) {
    return { success: false, error: "Evidence already excluded" };
  }

  await db.opponentSportingEvidence.update({
    where: { id: evidenceId },
    data: {
      excludedAt: new Date(),
      exclusionReason: reason,
    },
  });

  return { success: true };
}

export async function includeOpponentSportingEvidence(
  evidenceId: string,
  orgFilter: OrgFilterMode,
): Promise<{ success: boolean; error?: string }> {
  if (orgFilter.type !== "org") {
    return { success: false, error: "Organisation access required" };
  }

  const evidence = await db.opponentSportingEvidence.findFirst({
    where: { id: evidenceId, ...orgFilter.filter },
  });

  if (!evidence) {
    return { success: false, error: "Evidence not found or access denied" };
  }

  if (!evidence.excludedAt) {
    return { success: false, error: "Evidence is not excluded" };
  }

  await db.opponentSportingEvidence.update({
    where: { id: evidenceId },
    data: {
      excludedAt: null,
      exclusionReason: null,
    },
  });

  return { success: true };
}

export async function getOpponentSportingEvidence(
  opponentTeamId: string,
  orgFilter: OrgFilterMode,
): Promise<Prisma.OpponentSportingEvidenceGetPayload<Record<string, never>>[]> {
  if (orgFilter.type !== "org") return [];

  return db.opponentSportingEvidence.findMany({
    where: {
      opponentTeamId,
      ...orgFilter.filter,
    },
    orderBy: { occurredAt: "desc" },
  });
}