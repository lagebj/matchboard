import "server-only";

import { db } from "@/lib/db";
import type { LeagueSeasonPart } from "@/lib/seasons/league-season";
import {
  buildLeagueSimulationContext,
} from "./simulation-context-builder";
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
  const context = await buildLeagueSimulationContext(leagueSeasonId, {
    roundIds: request.roundIds,
    includeFinalizedHistory: request.includeCommittedPlans,
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

  for (const player of context.players) {
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

  const selectedPlayersPerRound = new Map<string, Set<string>>();

  for (const round of context.rounds) {
    if (round.status === "FINALIZED" && !request.includeCommittedPlans) {
      continue;
    }

    const roundMatches = context.matches.filter(
      (m) => m.matchRoundId === round.id,
    );

    const roundSelections: SimulatedPlayerRound[] = [];
    const roundBlockedPlayers: Record<string, string[]> = {};
    const roundValid = true;

    selectedPlayersPerRound.set(round.id, new Set());

    for (const match of roundMatches) {
      const team = context.teams.find((t) => t.id === match.teamId);
      if (!team) continue;

      const availabilitiesForRound = context.availabilities.filter(
        (a) => a.matchRoundId === round.id,
      );

      const availablePlayerIds = new Set(
        availabilitiesForRound
          .filter((a) => a.status === "AVAILABLE")
          .map((a) => a.playerId),
      );

      const corePlayers = context.players.filter(
        (p) =>
          p.coreTeamId === match.teamId &&
          p.active &&
          availablePlayerIds.has(p.id),
      );

      const matchSelections: SimulatedPlayerRound[] = corePlayers.map((p) => ({
        playerId: p.id,
        roundId: round.id,
        matchId: match.id,
        teamId: match.teamId,
        role: "CORE" as SelectionRole,
        isSimulation: true,
      }));

      roundSelections.push(...matchSelections);
      const roundSelectedSet = selectedPlayersPerRound.get(round.id)!;
      for (const p of corePlayers) {
        roundSelectedSet.add(p.id);
      }

      const _matchResult: SimulatedMatchResult = {
        matchId: match.id,
        teamId: match.teamId,
        teamName: team.name,
        opponentName: match.opponentName,
        selections: matchSelections,
        blockedPlayers: {},
        gkCoverage: {
          primary: corePlayers.filter(
            (p) => p.goalkeeperAbility === "YES",
          ).length,
          secondary: corePlayers.filter(
            (p) => p.goalkeeperAbility === "EMERGENCY",
          ).length,
          any: corePlayers.filter(
            (p) => p.goalkeeperAbility === "YES" || p.goalkeeperAbility === "EMERGENCY",
          ).length,
        },
        selectionCount: matchSelections.length,
      };

      roundBlockedPlayers[match.id] = [];
    }

    const gkCount = roundSelections.filter(
      (s) => {
        const player = context.players.find((p) => p.id === s.playerId);
        return player?.goalkeeperAbility === "YES";
      },
    ).length;
    goalkeepersPerRound[round.id] = gkCount;

    roundResults.push({
      roundId: round.id,
      roundName: round.name,
      matches: roundMatches.map((m) => {
        const team = context.teams.find((t) => t.id === m.teamId);
        return {
          matchId: m.id,
          teamId: m.teamId,
          teamName: team?.name ?? "Unknown",
          opponentName: m.opponentName,
          selections: roundSelections.filter((s) => s.matchId === m.id),
          blockedPlayers: roundBlockedPlayers,
          gkCoverage: {
            primary: roundSelections.filter(
              (s) =>
                s.matchId === m.id &&
                context.players.find((p) => p.id === s.playerId)?.goalkeeperAbility === "YES",
            ).length,
            secondary: 0,
            any: roundSelections.filter(
              (s) =>
                s.matchId === m.id &&
                context.players.find((p) => p.id === s.playerId)?.goalkeeperAbility !== "NO",
            ).length,
          },
          selectionCount: roundSelections.filter((s) => s.matchId === m.id).length,
        };
      }),
      planIntegritySignals: [],
      warnings: [],
      valid: roundValid,
    });

    const selectedInRound = selectedPlayersPerRound.get(round.id) ?? new Set();

    for (const player of context.players) {
      const stats = playerParticipationMap.get(player.id);
      if (!stats) continue;

      const isAvailable = context.availabilities.some(
        (a) =>
          a.playerId === player.id &&
          a.matchRoundId === round.id &&
          a.status === "AVAILABLE",
      );

      if (!isAvailable) {
        stats.unavailableRounds++;
      } else if (selectedInRound.has(player.id)) {
        stats.plannedRounds++;
        const selection = roundSelections.find((s) => s.playerId === player.id);
        if (selection) {
          switch (selection.role) {
            case "CORE":
              stats.coreAssignments++;
              break;
            case "SUPPORT":
              stats.supportAssignments++;
              break;
            case "DEVELOPMENT":
              stats.developmentAssignments++;
              break;
            case "BACKFILL":
              stats.squadRepairAssignments++;
              break;
          }
        }
      } else if (isAvailable) {
        stats.notSelectedRounds++;
      }
    }
  }

  const participation: PlayerSimulationParticipation[] = context.players.map(
    (player) => {
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
    },
  );

  const fairnessSummary = computeSimulationFairness(
    participation,
    context.rounds.length,
  );

  const gkFlags = detectGkCoverageGaps(participation, goalkeepersPerRound);
  fairnessSummary.flags.push(...gkFlags);

  const roundCoverage: RoundCoverageSummary[] = context.rounds.map((round) => {
    const selectedInRound = selectedPlayersPerRound.get(round.id) ?? new Set();
    return {
      roundId: round.id,
      roundName: round.name,
      totalPlayers: context.players.length,
      selectedPlayers: selectedInRound.size,
      blockedPlayers: 0,
      notSelectedPlayers:
        context.players.length -
        selectedInRound.size -
        context.players.filter((p) =>
          context.availabilities.some(
            (a) =>
              a.playerId === p.id &&
              a.matchRoundId === round.id &&
              a.status !== "AVAILABLE",
          ),
        ).length,
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