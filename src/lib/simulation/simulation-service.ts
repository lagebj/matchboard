import "server-only";

import { db } from "@/lib/db";
import type { LeagueSeasonPart } from "@/lib/seasons/league-season";
import { generateMatchRound } from "@/lib/selection/generate-round";
import type { GeneratedRound, GeneratedSelection } from "@/lib/selection/types";
import {
  computeSimulationFairness,
  detectGkCoverageGaps,
} from "./simulation-fairness";
import type {
  SeasonSimulationRequest,
  SeasonSimulationResult,
  LeagueSimulationResult,
  SimulationFairnessSummary,
  SimulationFairnessSignal,
  SimulationConflict,
  SimulationWarning,
  SimulationPolicySummary,
  SimulatedRoundResult,
  SimulatedMatchResult,
  SimulatedPlayerRound,
  PlayerSimulationParticipation,
  RoundCoverageSummary,
} from "./simulation-types";
import { getPolicyVersion } from "@/lib/policies/policy-version";
import { isRegoEnabled } from "@/lib/policies/rego-policy-adapter";
import type { SelectionRole } from "@/generated/prisma/client";

export async function runSeasonSimulation(
  request: SeasonSimulationRequest,
): Promise<SeasonSimulationResult> {
  let league: LeagueSimulationResult | undefined;
  const conflicts: SimulationConflict[] = [];
  const warnings: SimulationWarning[] = [];

  if (request.includeLeague) {
    const leagueResult = await simulateLeague(request);
    league = leagueResult;
    conflicts.push(...leagueResult.conflicts);
  }

  const emptyFairness: SimulationFairnessSummary = {
    totalPlayers: 0,
    playersWithZeroOpportunity: 0,
    playersWithLowParticipation: 0,
    playersWithHighLoad: 0,
    playersWithEligibleNotSelected: 0,
    flags: [] as SimulationFairnessSignal[],
  };

  const policySummary: SimulationPolicySummary = {
    policyVersion: getPolicyVersion(),
    regoEnabled: request.policyMode === "default_plus_rego" && isRegoEnabled(),
    regoAvailable: isRegoEnabled(),
    decisionTypes: request.includeLeague
      ? ["league_match_selection", "league_round_fairness"]
      : [],
    defaultOnlyResultCount: league?.rounds.length ?? 0,
  };

  return {
    request,
    league,
    fairness: league
      ? computeSimulationFairness(league.playerParticipation, league.rounds.length)
      : emptyFairness,
    conflicts,
    warnings,
    policy: policySummary,
    validToCommit: false,
    dryRunNotice: true,
  };
}

async function simulateLeague(
  request: SeasonSimulationRequest,
): Promise<LeagueSimulationResult> {
  const leagueSeasonId = await resolveLeagueSeasonId(request);

  const leagueSeason = await db.leagueSeason.findUnique({
    where: { id: leagueSeasonId },
    include: { season: true },
  });
  if (!leagueSeason) {
    throw new Error(`League season not found: ${leagueSeasonId}`);
  }

  const rounds = await db.matchRound.findMany({
    where: {
      leagueSeasonId,
      ...(request.roundIds?.length ? { id: { in: request.roundIds } } : {}),
    },
    orderBy: { createdAt: "asc" },
  });

  const roundResults: SimulatedRoundResult[] = [];
  const goalkeepersPerRound: Record<string, number> = {};
  const allConflicts: SimulationConflict[] = [];

  const playerParticipationMap = new Map<
    string,
    {
      plannedRounds: number;
      coreAssignments: number;
      supportAssignments: number;
      developmentAssignments: number;
      squadRepairAssignments: number;
      notSelectedRounds: number;
      unavailableRounds: number;
    }
  >();

  for (const round of rounds) {
    if (round.status === "FINALIZED" && !request.includeCommittedPlans) {
      continue;
    }

    let generatedRound: GeneratedRound | null = null;
    let generationError: string | null = null;

    if (round.status !== "FINALIZED") {
      try {
        generatedRound = await generateMatchRound(round.id);
      } catch (err) {
        generationError = err instanceof Error ? err.message : "Unknown generation error";
      }
    }

    if (generatedRound) {
      const simulatedRound = transformGeneratedRound(generatedRound);
      roundResults.push(simulatedRound);

      for (const match of generatedRound.matchResults) {
        for (const player of match.selectedPlayers) {
          let stats = playerParticipationMap.get(player.playerId);
          if (!stats) {
            stats = {
              plannedRounds: 0,
              coreAssignments: 0,
              supportAssignments: 0,
              developmentAssignments: 0,
              squadRepairAssignments: 0,
              notSelectedRounds: 0,
              unavailableRounds: 0,
            };
            playerParticipationMap.set(player.playerId, stats);
          }
          stats.plannedRounds++;
          const cat = player.selectionCategory;
          if (cat === "CORE") stats.coreAssignments++;
          else if (cat === "SUPPORT") stats.supportAssignments++;
          else if (cat === "DEVELOPMENT") stats.developmentAssignments++;
          else if (cat === "BACKFILL" || cat === "CONFIDENCE_REBUILD") stats.squadRepairAssignments++;
        }

        const gkInMatch = match.selectedPlayers.filter(
          (p) => p.selectionCategory === "CORE" && p.playerPosition?.toLowerCase().includes("gk"),
        ).length;
        goalkeepersPerRound[round.id] = (goalkeepersPerRound[round.id] ?? 0) + gkInMatch;
      }
    } else {
      roundResults.push({
        roundId: round.id,
        roundName: round.name,
        matches: [],
        planIntegritySignals: [],
        warnings: generationError
          ? [{ code: "generation_failed", message: generationError, severity: "blocked" as const }]
          : [],
        valid: false,
      });
    }
  }

  const allPlayers = await db.player.findMany({
    where: { active: true, removedAt: null },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      coreTeamId: true,
    },
  });

  for (const player of allPlayers) {
    if (!playerParticipationMap.has(player.id)) {
      playerParticipationMap.set(player.id, {
        plannedRounds: 0,
        coreAssignments: 0,
        supportAssignments: 0,
        developmentAssignments: 0,
        squadRepairAssignments: 0,
        notSelectedRounds: 0,
        unavailableRounds: 0,
      });
    }
  }

  const participation: PlayerSimulationParticipation[] = allPlayers.map((player) => {
    const stats = playerParticipationMap.get(player.id) ?? {
      plannedRounds: 0,
      coreAssignments: 0,
      supportAssignments: 0,
      developmentAssignments: 0,
      squadRepairAssignments: 0,
      notSelectedRounds: 0,
      unavailableRounds: 0,
    };
    return {
      playerId: player.id,
      playerName: player.firstName + (player.lastName ? ` ${player.lastName}` : ""),
      coreTeamId: player.coreTeamId ?? "",
      ...stats,
      roundsWithOpportunity: stats.plannedRounds,
    };
  });

  const fairnessSummary = computeSimulationFairness(
    participation,
    rounds.length,
  );

  const gkFlags = detectGkCoverageGaps(participation, goalkeepersPerRound);
  fairnessSummary.flags.push(...gkFlags);

  const roundCoverage: RoundCoverageSummary[] = rounds.map((round) => {
    const simulatedRound = roundResults.find((r) => r.roundId === round.id);
    const totalSelected = simulatedRound?.matches.reduce(
      (sum, m) => sum + m.selectionCount,
      0,
    ) ?? 0;

    return {
      roundId: round.id,
      roundName: round.name,
      totalPlayers: allPlayers.length,
      selectedPlayers: totalSelected,
      blockedPlayers: 0,
      notSelectedPlayers: allPlayers.length - totalSelected,
      gkCoverageStatus:
        (goalkeepersPerRound[round.id] ?? 0) >= 1 ? "adequate" : "gap",
    };
  });

  return {
    rounds: roundResults,
    playerParticipation: participation,
    fairnessSignals: fairnessSummary.flags,
    conflicts: allConflicts,
    roundCoverage,
  };
}

function transformGeneratedRound(generated: GeneratedRound): SimulatedRoundResult {
  return {
    roundId: generated.matchRoundId,
    roundName: `Round ${generated.matchRoundId}`,
    matches: generated.matchResults.map(transformMatchResult),
    planIntegritySignals: [],
    warnings: generated.roundWarnings.map((w) => ({
      code: w.code,
      severity: w.severity === "HARD_BLOCK"
        ? "blocked" as const
        : w.severity === "REQUIRES_OVERRIDE"
          ? "decision_required" as const
          : "planning_note" as const,
      message: w.message,
      playerId: w.playerId,
      teamId: w.teamId,
      matchId: w.matchId,
    })),
    valid: true,
  };
}

function transformMatchResult(match: GeneratedSelection): SimulatedMatchResult {
  const selections: SimulatedPlayerRound[] = match.selectedPlayers.map((p) => ({
    playerId: p.playerId,
    roundId: match.matchRoundId,
    matchId: match.matchId,
    teamId: match.teamId,
    role: (p.selectionCategory === "BACKFILL" || p.selectionCategory === "CONFIDENCE_REBUILD"
      ? "SUPPORT"
      : p.selectionCategory) as SelectionRole,
    isSimulation: true,
  }));

  const primaryGk = match.selectedPlayers.filter(
    (p) => p.playerPosition?.toLowerCase().includes("gk"),
  ).length;

  return {
    matchId: match.matchId,
    teamId: match.teamId,
    teamName: match.teamName,
    opponentName: match.opponent,
    selections,
    blockedPlayers: {},
    gkCoverage: {
      primary: primaryGk,
      secondary: 0,
      any: primaryGk,
    },
    selectionCount: match.selectedPlayers.length,
  };
}

async function resolveLeagueSeasonId(
  request: SeasonSimulationRequest,
): Promise<string> {
  if (request.roundIds && request.roundIds.length > 0) {
    const round = await db.matchRound.findFirst({
      where: { id: request.roundIds[0] },
      select: { leagueSeasonId: true },
    });
    if (!round) {
      throw new Error(`Round not found: ${request.roundIds[0]}`);
    }
    return round.leagueSeasonId;
  }

  const where: Record<string, unknown> = {};
  if (request.seasonYear) {
    where.season = { year: request.seasonYear };
  }
  if (request.period && request.period !== "full_year") {
    where.part = request.period.toUpperCase() as LeagueSeasonPart;
  }

  const leagueSeason = await db.leagueSeason.findFirst({
    where,
    orderBy: { createdAt: "desc" },
  });

  if (!leagueSeason) {
    throw new Error(
      `No league season found for year=${request.seasonYear}, period=${request.period}`,
    );
  }

  return leagueSeason.id;
}