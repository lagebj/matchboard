import { db } from "@/lib/db";
import { Prisma, type GameFormat, type MatchFit } from "@/generated/prisma/client";
import {
  calculateEncounterEstimate,
  computeFieldedRating,
  shouldAutoExcludeEncounter,
  FORMULA_VERSION,
} from "./sporting-level-calculation";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";
import { getPlayerOverallRating } from "@/lib/ratings/player-rating";
import { RATING_ATTRIBUTE_KEYS } from "@/lib/player-development/constants";
import { OPPONENT_ENGINE_VERSION, classifyDataQuality, computeWholeMatchEstimate } from "@/lib/evidence/opponent-engine";
import { recordOpponentAssessmentChange } from "@/lib/evidence/opponent-assessment-change";
import { getEffectiveEventTeamGameFormat } from "@/lib/events/event-types";
import type { FootballMatchRef } from "@/lib/evidence/football-match-ref";

export type FieldedPlayer = {
  playerId: string;
  rating: number | null;
  minutes?: number | null;
};

export type RecordOpponentSportingEvidenceResult = {
  recorded: boolean;
  evidenceId?: string;
  reason?: string;
};

/**
 * Persistence-agnostic encounter facts the opponent-evidence algorithm needs.
 * `matchFit` is null for sources with no sporting-fit signal (Event matches today —
 * `EventMatch` has no `matchFit` field, see ADR-0104's Consequences).
 */
type MatchEncounterContext = {
  organisationId: string;
  opponentTeamId: string | null;
  matchFit: MatchFit | null;
  gameFormat: GameFormat | null;
  occurredAt: Date;
  goalsFor: number;
  goalsAgainst: number;
  reportStatus: string;
  presentActuals: Array<{ playerId: string; actualPositions: unknown }>;
};

async function getLeagueEncounterContext(
  matchId: string,
  orgFilter: OrgFilterMode,
): Promise<MatchEncounterContext | { reason: string }> {
  const match = await db.match.findFirst({
    where: { id: matchId, ...orgFilter.filter },
    select: {
      opponentTeamId: true,
      matchFit: true,
      gameFormat: true,
      startsAt: true,
      organisationId: true,
      homeAway: true,
    },
  });

  if (!match) return { reason: "Match not found" };
  if (!match.opponentTeamId) return { reason: "No opponent team linked to match" };

  const report = await db.postMatchReport.findFirst({
    where: { matchId, ...orgFilter.filterNullable },
    select: {
      status: true,
      homeGoals: true,
      awayGoals: true,
      playerActuals: {
        select: { playerId: true, attendanceStatus: true, actualPositions: true },
      },
    },
  });

  if (!report) return { reason: "No post-match report" };
  if (report.status !== "LOCKED" && report.status !== "REPORTED") return { reason: "Report not completed" };

  const homeGoals = report.homeGoals ?? 0;
  const awayGoals = report.awayGoals ?? 0;

  // homeGoals/awayGoals are venue-relative (home team's score, away team's score).
  // goalsFor/goalsAgainst are from our team's perspective.
  const isHome = match.homeAway === "HOME";
  const goalsFor = isHome ? homeGoals : awayGoals;
  const goalsAgainst = isHome ? awayGoals : homeGoals;

  // ADR-0106: PostMatchPlayerActual.playerId is now nullable (a GuestPlayer appearance uses
  // guestPlayerId instead). Whether GuestPlayer presence should count toward opponent/team-level
  // sporting evidence is a deliberate product decision for later, guest-aware evidence work, not
  // something to fold in silently here -- excluded for now, preserving current behaviour.
  const presentActuals = report.playerActuals
    .filter((a) => a.attendanceStatus === "PRESENT" && a.playerId !== null)
    .map((a) => ({ playerId: a.playerId as string, actualPositions: a.actualPositions }));

  return {
    organisationId: match.organisationId,
    opponentTeamId: match.opponentTeamId,
    matchFit: match.matchFit,
    gameFormat: match.gameFormat,
    occurredAt: match.startsAt,
    goalsFor,
    goalsAgainst,
    reportStatus: report.status,
    presentActuals,
  };
}

async function getEventEncounterContext(
  eventMatchId: string,
  orgFilter: OrgFilterMode,
): Promise<MatchEncounterContext | { reason: string }> {
  const eventMatch = await db.eventMatch.findFirst({
    where: { id: eventMatchId, ...orgFilter.filter },
    select: {
      opponentTeamId: true,
      startsAt: true,
      organisationId: true,
      event: { select: { gameFormat: true } },
      eventSquad: { select: { gameFormatOverride: true } },
    },
  });

  if (!eventMatch) return { reason: "Event match not found" };
  if (!eventMatch.opponentTeamId) return { reason: "No opponent team linked to match" };

  const report = await db.eventPostMatchReport.findFirst({
    where: { eventMatchId, ...orgFilter.filterNullable },
    select: {
      status: true,
      ourScore: true,
      opponentScore: true,
      playerReports: {
        select: { playerId: true, attendanceStatus: true },
      },
    },
  });

  if (!report) return { reason: "No post-match report" };
  if (report.status !== "LOCKED" && report.status !== "REPORTED") return { reason: "Report not completed" };

  // ADR-0106: EventPostMatchPlayer.playerId is now nullable (a GuestPlayer appearance uses
  // guestPlayerId instead) -- same exclusion rationale as the League branch above.
  const presentActuals = report.playerReports
    .filter((a) => a.attendanceStatus === "PRESENT" && a.playerId !== null)
    .map((a) => ({ playerId: a.playerId as string, actualPositions: null as unknown }));

  const gameFormat = getEffectiveEventTeamGameFormat(eventMatch.event, eventMatch.eventSquad) as GameFormat;

  return {
    organisationId: eventMatch.organisationId,
    opponentTeamId: eventMatch.opponentTeamId,
    // EventMatch has no matchFit field — no auto-exclusion signal available for Event
    // matches yet (ADR-0104). Never guess/duplicate the League MatchFit enum here.
    matchFit: null,
    gameFormat,
    occurredAt: eventMatch.startsAt,
    goalsFor: report.ourScore ?? 0,
    goalsAgainst: report.opponentScore ?? 0,
    reportStatus: report.status,
    presentActuals,
  };
}

export async function recordOpponentSportingEvidenceForRef(
  ref: FootballMatchRef,
  orgFilter: OrgFilterMode,
): Promise<RecordOpponentSportingEvidenceResult> {
  const context =
    ref.kind === "LEAGUE_MATCH"
      ? await getLeagueEncounterContext(ref.matchId, orgFilter)
      : await getEventEncounterContext(ref.eventMatchId, orgFilter);

  if ("reason" in context) {
    return { recorded: false, reason: context.reason };
  }

  if (!context.opponentTeamId) {
    return { recorded: false, reason: "No opponent team linked to match" };
  }

  if (context.presentActuals.length === 0) {
    return { recorded: false, reason: "No present participants" };
  }

  const playerIds = context.presentActuals.map((a) => a.playerId);

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

  const fieldedPlayers: FieldedPlayer[] = context.presentActuals.map((actual) => {
    const player = playerMap.get(actual.playerId);
    const rating = player ? getPlayerOverallRating(player).value : null;
    return { playerId: actual.playerId, rating };
  });

  const { rating: fieldedRating, method, participantCount, ratedParticipantCount } = computeFieldedRating(fieldedPlayers);

  const uniqueWhere = ref.kind === "LEAGUE_MATCH" ? { matchId: ref.matchId } : { eventMatchId: ref.eventMatchId };

  if (fieldedRating === null) {
    const existing = await db.opponentSportingEvidence.findFirst({
      where: { ...uniqueWhere, ...orgFilter.filter },
    });
    if (existing) {
      await db.opponentSportingEvidence.delete({ where: { id: existing.id } });
    }
    return { recorded: false, reason: "No valid fielded rating could be derived" };
  }

  const estimate = calculateEncounterEstimate(fieldedRating, context.goalsFor, context.goalsAgainst);
  const autoExclude = context.matchFit !== null && shouldAutoExcludeEncounter(context.matchFit);

  const dataQuality = classifyDataQuality({
    hasExactTimeline: false,
    hasReliableMinutes: method === "MINUTE_WEIGHTED",
    hasReliablePositions: false,
    participantCount,
    ratedParticipantCount,
  });

  const wholeMatchResult = computeWholeMatchEstimate(
    fieldedRating,
    context.goalsFor,
    context.goalsAgainst,
    participantCount,
    ratedParticipantCount,
    context.matchFit ?? "UNKNOWN",
    dataQuality,
    null,
  );

  const fieldedRatingDetails = {
    players: context.presentActuals.map((a) => {
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

  const organisationId = orgFilter.type === "org" ? orgFilter.organisationId : context.organisationId;

  const sharedFields = {
    opponentTeamId: context.opponentTeamId,
    occurredAt: context.occurredAt,
    gameFormat: context.gameFormat,
    goalsFor: context.goalsFor,
    goalsAgainst: context.goalsAgainst,
    fieldedRatingSnapshot: new Prisma.Decimal(fieldedRating.toFixed(2)),
    participantCount,
    ratedParticipantCount,
    weightingMethod: method === "MINUTE_WEIGHTED" ? ("MINUTE_WEIGHTED" as const) : ("PARTICIPANT_AVERAGE" as const),
    estimate: new Prisma.Decimal(estimate.toFixed(2)),
    formulaVersion: FORMULA_VERSION,
    engineVersion: OPPONENT_ENGINE_VERSION,
    dataQuality,
    lineupStateCount: 0,
    dominantLineupStrength: new Prisma.Decimal(fieldedRating.toFixed(2)),
    contextSignals: wholeMatchResult.contextSignals as Prisma.InputJsonValue,
    excludedAt: autoExclude ? new Date() : null,
    exclusionReason: autoExclude ? `Auto-excluded: match fit ${context.matchFit}` : null,
    fieldedRatingDetails: fieldedRatingDetails as Prisma.InputJsonValue,
    organisationId,
  };

  const evidence = await db.opponentSportingEvidence.upsert({
    where: uniqueWhere,
    update: sharedFields,
    create: {
      ...(ref.kind === "LEAGUE_MATCH" ? { matchId: ref.matchId } : { eventMatchId: ref.eventMatchId }),
      ...sharedFields,
    },
  });

  if (!autoExclude) {
    try {
      const previousEstimate = await db.opponentSportingEvidence.findFirst({
        where: {
          opponentTeamId: context.opponentTeamId,
          ...orgFilter.filter,
          excludedAt: null,
          id: { not: evidence.id },
        },
        orderBy: { occurredAt: "desc" },
        select: { estimate: true },
      });

      await recordOpponentAssessmentChange({
        opponentTeamId: context.opponentTeamId,
        beforeLevel: previousEstimate ? Number(previousEstimate.estimate) : null,
        afterLevel: Number(estimate.toFixed(2)),
        source: "AUTOMATIC",
        reason: `Match evidence recorded (${dataQuality} data)`,
        evidenceMatchId: ref.kind === "LEAGUE_MATCH" ? ref.matchId : ref.eventMatchId,
        confidence: wholeMatchResult.confidence,
        dataQuality,
      });
    } catch {
      // Assessment change recording is non-blocking — evidence is already persisted
    }
  }

  return { recorded: true, evidenceId: evidence.id };
}

/**
 * League-only convenience wrapper, kept for existing call sites (e.g. the historical
 * "Populate opponent levels" replay tool). New code should call
 * `recordOpponentSportingEvidenceForRef` directly with a `FootballMatchRef`.
 */
export async function recordOpponentSportingEvidence(
  matchId: string,
  orgFilter: OrgFilterMode,
): Promise<RecordOpponentSportingEvidenceResult> {
  return recordOpponentSportingEvidenceForRef({ kind: "LEAGUE_MATCH", matchId, leagueSeasonId: null }, orgFilter);
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
