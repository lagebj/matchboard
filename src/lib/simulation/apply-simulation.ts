import "server-only";

import { db } from "@/lib/db";
import { generateMatchRound } from "@/lib/selection/generate-round";
import { createGeneratedDraftRound } from "@/lib/selection/save-generated-draft";
import { buildPersistableWarnings, persistRoundWarnings } from "@/lib/selection/persist-warnings";
import { persistRoundExplanations } from "@/lib/selection/persist-explanations";
import { enrichSelectionsWithIntent } from "@/lib/selection/explanation-enrichment";
import { computeSimulationFairness, detectGkCoverageGaps } from "./simulation-fairness";
import { resolveLeagueSeasonId } from "./simulation-service";

export type ApplySimulationResult = {
  leagueSeasonId: string;
  results: ApplyRoundResult[];
  failedRoundIds: string[];
  skippedRoundIds: string[];
  totalRounds: number;
  appliedCount: number;
  failedCount: number;
  skippedCount: number;
};

export type ApplyRoundResult = {
  matchRoundId: string;
  matchRoundName: string;
  matchCount: number;
  warningCount: number;
  success: boolean;
  error?: string;
};

export type SimulationInputHash = {
  leagueSeasonId: string;
  roundIds: string[];
  playerCount: number;
  matchCount: number;
  availabilityCount: number;
  rotationPathCount: number;
  computedAt: string;
};

export async function computeSimulationInputHash(
  leagueSeasonId: string,
  roundIds?: string[],
): Promise<SimulationInputHash> {
  const resolvedId = await resolveLeagueSeasonId({
    scope: "league_round",
    leagueSeasonId,
    roundIds,
    includeLeague: true,
    includeEvents: false,
    includeCommittedPlans: false,
    includeDraftPlans: true,
    policyMode: "default_only",
  });

  const rounds = await db.matchRound.findMany({
    where: {
      leagueSeasonId: resolvedId,
      status: { not: "FINALIZED" },
      ...(roundIds?.length ? { id: { in: roundIds } } : {}),
    },
    select: { id: true },
  });

  const [playerCount, matchCount, availabilityCount, rotationPathCount] = await Promise.all([
    db.player.count({ where: { active: true, removedAt: null } }),
    db.match.count({
      where: {
        matchRound: { leagueSeasonId: resolvedId },
        status: { not: "CANCELLED" },
      },
    }),
    db.availability.count({
      where: { matchRound: { leagueSeasonId: resolvedId } },
    }),
    db.rotationPath.count({
      where: { active: true },
    }),
  ]);

  return {
    leagueSeasonId: resolvedId,
    roundIds: rounds.map((r) => r.id),
    playerCount,
    matchCount,
    availabilityCount,
    rotationPathCount,
    computedAt: new Date().toISOString(),
  };
}

export function isInputStale(
  current: SimulationInputHash,
  previous: SimulationInputHash,
): boolean {
  if (current.leagueSeasonId !== previous.leagueSeasonId) return true;
  if (current.roundIds.length !== previous.roundIds.length) return true;
  if (current.playerCount !== previous.playerCount) return true;
  if (current.matchCount !== previous.matchCount) return true;
  if (current.availabilityCount !== previous.availabilityCount) return true;
  if (current.rotationPathCount !== previous.rotationPathCount) return true;
  const sortedCurrent = [...current.roundIds].sort();
  const sortedPrevious = [...previous.roundIds].sort();
  if (sortedCurrent.join(",") !== sortedPrevious.join(",")) return true;
  return false;
}

export async function applySimulationAsDrafts(
  leagueSeasonId: string,
  roundIds?: string[],
): Promise<ApplySimulationResult> {
  const leagueSeason = await db.leagueSeason.findUnique({
    where: { id: leagueSeasonId },
    include: {
      matchRounds: {
        include: {
          matches: {
            include: {
              team: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  });

  if (!leagueSeason) {
    throw new Error("League season not found.");
  }

  const sortedRounds = [...leagueSeason.matchRounds].sort((a, b) => {
    const aEarliest = a.matches.length > 0 ? Math.min(...a.matches.map((m) => new Date(m.startsAt).getTime())) : 0;
    const bEarliest = b.matches.length > 0 ? Math.min(...b.matches.map((m) => new Date(m.startsAt).getTime())) : 0;
    return aEarliest - bEarliest;
  }).filter((r) => {
    if (r.status === "FINALIZED") return false;
    if (roundIds?.length && !roundIds.includes(r.id)) return false;
    return true;
  });

  const results: ApplyRoundResult[] = [];
  const failedRoundIds: string[] = [];
  const skippedRoundIds: string[] = [];

  for (const matchRound of leagueSeason.matchRounds) {
    if (matchRound.status === "FINALIZED") {
      if (!roundIds?.length || roundIds.includes(matchRound.id)) {
        skippedRoundIds.push(matchRound.id);
      }
      continue;
    }

    if (roundIds?.length && !roundIds.includes(matchRound.id)) {
      continue;
    }

    try {
      const generatedRound = await generateMatchRound(matchRound.id);
      await createGeneratedDraftRound(generatedRound);

      const matchIdByTeamName = new Map<string, string>();
      const teamIdByTeamName = new Map<string, string>();
      for (const match of matchRound.matches) {
        matchIdByTeamName.set(match.team.name, match.id);
        teamIdByTeamName.set(match.team.name, match.team.id);
      }

      const warnings = buildPersistableWarnings(generatedRound, matchIdByTeamName, teamIdByTeamName);
      await persistRoundWarnings(warnings);
      await persistRoundExplanations(generatedRound);
      await enrichSelectionsWithIntent(generatedRound.matchResults.map((m) => m.matchId));

      results.push({
        matchRoundId: matchRound.id,
        matchRoundName: matchRound.name,
        matchCount: generatedRound.matchResults.length,
        warningCount: warnings.length,
        success: true,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      failedRoundIds.push(matchRound.id);
      results.push({
        matchRoundId: matchRound.id,
        matchRoundName: matchRound.name,
        matchCount: 0,
        warningCount: 0,
        success: false,
        error: errorMessage,
      });
    }
  }

  return {
    leagueSeasonId,
    results,
    failedRoundIds,
    skippedRoundIds,
    totalRounds: leagueSeason.matchRounds.filter((r) =>
      !roundIds?.length || roundIds.includes(r.id),
    ).length,
    appliedCount: results.filter((r) => r.success).length,
    failedCount: failedRoundIds.length,
    skippedCount: skippedRoundIds.length,
  };
}