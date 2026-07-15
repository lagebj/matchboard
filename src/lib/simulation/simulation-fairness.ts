import type {
  SimulationFairnessSignal,
  SimulationFairnessSummary,
  PlayerSimulationParticipation,
} from "./simulation-types";

export function computeSimulationFairness(
  participation: PlayerSimulationParticipation[],
  totalRounds: number,
): SimulationFairnessSummary {
  const flags: SimulationFairnessSignal[] = [];

  let playersWithZeroOpportunity = 0;
  let playersWithLowParticipation = 0;
  let playersWithHighLoad = 0;
  let playersWithEligibleNotSelected = 0;

  const totalPlayers = participation.length;

  if (totalPlayers === 0 || totalRounds === 0) {
    return {
      totalPlayers: 0,
      playersWithZeroOpportunity: 0,
      playersWithLowParticipation: 0,
      playersWithHighLoad: 0,
      playersWithEligibleNotSelected: 0,
      flags: [],
    };
  }

  const avgPlannedRounds =
    participation.reduce((sum, p) => sum + p.plannedRounds, 0) / totalPlayers;

  const avgSupportAssignments =
    participation.reduce((sum, p) => sum + p.supportAssignments, 0) / totalPlayers;

  for (const player of participation) {
    if (player.plannedRounds === 0 && player.unavailableRounds < totalRounds) {
      playersWithZeroOpportunity++;
      flags.push({
        playerId: player.playerId,
        flag: "zero_planned_opportunity",
        label: "No planned match opportunity",
        roundsAffected: totalRounds,
        detail: `${player.playerName} has no planned match opportunity in the simulated horizon across ${totalRounds} rounds.`,
      });
    }

    if (avgPlannedRounds > 0 && player.plannedRounds > 0) {
      const participationRatio = player.plannedRounds / avgPlannedRounds;
      if (participationRatio < 0.5) {
        playersWithLowParticipation++;
        flags.push({
          playerId: player.playerId,
          flag: "low_period_participation",
          label: "Low period participation",
          roundsAffected: totalRounds - player.plannedRounds,
          detail: `${player.playerName} has ${player.plannedRounds} planned rounds vs ${avgPlannedRounds.toFixed(1)} average (${(participationRatio * 100).toFixed(0)}%).`,
        });
      }
    }

    if (
      player.supportAssignments > 0 &&
      avgSupportAssignments > 0 &&
      player.supportAssignments > avgSupportAssignments * 1.5
    ) {
      playersWithHighLoad++;
      flags.push({
        playerId: player.playerId,
        flag: "high_recent_load",
        label: "High recent load",
        roundsAffected: player.supportAssignments,
        detail: `${player.playerName} has ${player.supportAssignments} support assignments across the horizon (average: ${avgSupportAssignments.toFixed(1)}).`,
      });
    }

    if (
      player.unavailableRounds === 0 &&
      player.plannedRounds === 0 &&
      player.notSelectedRounds > 0
    ) {
      playersWithEligibleNotSelected++;
      flags.push({
        playerId: player.playerId,
        flag: "eligible_not_selected",
        label: "Eligible but not selected",
        roundsAffected: player.notSelectedRounds,
        detail: `${player.playerName} is available and eligible but not selected in ${player.notSelectedRounds} round(s).`,
      });
    }

    if (
      player.supportAssignments >= 2 &&
      player.coreAssignments === 0
    ) {
      flags.push({
        playerId: player.playerId,
        flag: "consecutive_support_burden",
        label: "Consecutive support burden",
        roundsAffected: player.supportAssignments,
        detail: `${player.playerName} has ${player.supportAssignments} support assignments with zero core assignments.`,
      });
    }
  }

  return {
    totalPlayers,
    playersWithZeroOpportunity,
    playersWithLowParticipation,
    playersWithHighLoad,
    playersWithEligibleNotSelected,
    flags,
  };
}

export function detectGkCoverageGaps(
  participation: PlayerSimulationParticipation[],
  goalkeepersPerRound: Record<string, number>,
  minGkPerRound: number = 1,
): SimulationFairnessSignal[] {
  const flags: SimulationFairnessSignal[] = [];

  for (const [roundId, gkCount] of Object.entries(goalkeepersPerRound)) {
    if (gkCount < minGkPerRound) {
      flags.push({
        playerId: "",
        flag: "gk_coverage_gap",
        label: "GK coverage gap",
        roundsAffected: 1,
        detail: `Round ${roundId} has ${gkCount} goalkeeper(s); minimum is ${minGkPerRound}.`,
      });
    }
  }

  return flags;
}