import { db } from "@/lib/db";
import type { CoreMatchDropCandidate, GeneratedSelection } from "@/lib/selection/types";
import { getNeededPositions } from "@/lib/selection/rotation-candidate-ranking";

type RotationPathRow = {
  id: string;
  fromTeamId: string;
  toTeamId: string;
  role: string;
};

type DownstreamSlot = {
  matchId: string;
  matchResult: GeneratedSelection;
  teamId: string;
  teamName: string;
  currentCount: number;
  targetSquadSize: number;
  maxSquadSize: number;
  currentDevCount: number;
  targetDevSlots: number;
  role: "DEVELOPMENT" | "SUPPORT";
};

export type RoutedDrop = {
  playerId: string;
  playerName: string;
  playerPosition: string;
  primaryPosition: string;
  targetMatchId: string;
  targetTeamId: string;
  targetTeamName: string;
  fromMatchId: string;
  fromTeamId: string;
  fromTeamName: string;
  role: "SUPPORT" | "DEVELOPMENT";
  positionFit: "primary" | "secondary" | "tertiary" | "none";
  priorityBonus: number;
  nonRotatable: boolean;
};

function getPositionFitLevel(
  candidate: CoreMatchDropCandidate,
  neededPositions: string[],
): "primary" | "secondary" | "tertiary" | "none" {
  if (neededPositions.length === 0) {
    return "none";
  }

  for (const pos of neededPositions) {
    if (candidate.primaryPosition === pos) return "primary";
  }
  for (const pos of neededPositions) {
    if (candidate.secondaryPosition && candidate.secondaryPosition === pos) return "secondary";
  }
  for (const pos of neededPositions) {
    if (candidate.tertiaryPosition && candidate.tertiaryPosition === pos) return "tertiary";
  }

  return "none";
}

function getPositionPriorityScore(level: "primary" | "secondary" | "tertiary" | "none"): number {
  if (level === "primary") return 20;
  if (level === "secondary") return 10;
  if (level === "tertiary") return 5;
  return 0;
}

export async function routeCoreMatchDrops(
  candidates: CoreMatchDropCandidate[],
  matchResults: GeneratedSelection[],
): Promise<RoutedDrop[]> {
  if (candidates.length === 0) {
    return [];
  }

  const rotationPaths = await db.rotationPath.findMany({
    where: { active: true },
    select: {
      id: true,
      fromTeamId: true,
      toTeamId: true,
      role: true,
    },
  });

  const matches = await db.match.findMany({
    where: {
      id: { in: matchResults.map((r) => r.matchId) },
    },
    include: {
      team: {
        select: {
          id: true,
          name: true,
          targetSquadSize: true,
          maxSquadSize: true,
          developmentSlots: true,
        },
      },
    },
  });

  const matchById = new Map(matches.map((m) => [m.id, m]));

  const downstreamPaths: RotationPathRow[] = rotationPaths.filter(
    (path) => path.role === "DEVELOPMENT" || path.role === "SUPPORT" || path.role === "BACKFILL",
  );

  const routedDrops: RoutedDrop[] = [];
  const assignedPlayerIds = new Set<string>();
  for (const matchResult of matchResults) {
    for (const player of matchResult.selectedPlayers) {
      assignedPlayerIds.add(player.playerId);
    }
  }
  const runningSlotCounts = new Map<string, number>();
  for (const matchResult of matchResults) {
    const matchData = matchById.get(matchResult.matchId);
    if (matchData) {
      runningSlotCounts.set(matchData.id, matchResult.selectedPlayers.length);
    }
  }

  const sortedCandidates = [...candidates].sort((left, right) => {
    return left.playerName.localeCompare(right.playerName);
  });

  for (const candidate of sortedCandidates) {
    if (assignedPlayerIds.has(candidate.playerId)) continue;

    const candidateDownstreamPaths = downstreamPaths.filter(
      (path) => path.fromTeamId === candidate.coreTeamId,
    );

    if (candidateDownstreamPaths.length === 0) continue;

    const candidateDownstreamTeamIds = new Set(candidateDownstreamPaths.map((p) => p.toTeamId));

    const availableSlots: DownstreamSlot[] = [];

    for (const matchResult of matchResults) {
      const matchData = matchById.get(matchResult.matchId);
      if (!matchData) continue;

      if (!candidateDownstreamTeamIds.has(matchData.teamId)) continue;

      const targetSquadSize = matchData.team.targetSquadSize;
      const maxSquadSize = matchData.team.maxSquadSize;
      const currentCount = runningSlotCounts.get(matchResult.matchId) ?? matchResult.selectedPlayers.length;

      if (currentCount >= maxSquadSize) continue;

      const path = candidateDownstreamPaths.find((p) => p.toTeamId === matchData.teamId);
      // BACKFILL rotation paths route as SUPPORT for squad repair.
      // CONFIDENCE_REBUILD rotation paths route as DEVELOPMENT.
      const role: "SUPPORT" | "DEVELOPMENT" = path?.role === "DEVELOPMENT" || path?.role === "CONFIDENCE_REBUILD" ? "DEVELOPMENT" : "SUPPORT";
      const currentDevCount = matchResult.selectedPlayers.filter((p) => p.selectionCategory === "DEVELOPMENT").length;
      const targetDevSlots = matchData.team.developmentSlots ?? 0;

      availableSlots.push({
        matchId: matchResult.matchId,
        matchResult,
        teamId: matchData.teamId,
        teamName: matchData.team.name,
        currentCount,
        targetSquadSize,
        maxSquadSize,
        currentDevCount,
        targetDevSlots,
        role,
      });
    }

    if (availableSlots.length === 0) continue;

    const bestSlot = availableSlots.sort((left, right) => {
      const leftNeeded = getNeededPositions(left.matchResult.selectedPlayers, left.targetSquadSize);
      const rightNeeded = getNeededPositions(right.matchResult.selectedPlayers, right.targetSquadSize);

      const leftFit = getPositionFitLevel(candidate, leftNeeded);
      const rightFit = getPositionFitLevel(candidate, rightNeeded);

      const leftDevBonus = (left.role === "DEVELOPMENT" && left.currentDevCount < left.targetDevSlots) ? 50 : 0;
      const rightDevBonus = (right.role === "DEVELOPMENT" && right.currentDevCount < right.targetDevSlots) ? 50 : 0;

      const leftScore = getPositionPriorityScore(leftFit) + leftDevBonus + (left.maxSquadSize - left.currentCount);
      const rightScore = getPositionPriorityScore(rightFit) + rightDevBonus + (right.maxSquadSize - right.currentCount);

      return rightScore - leftScore;
    })[0];

    if (!bestSlot) continue;

    const role: "SUPPORT" | "DEVELOPMENT" = bestSlot.role;

    const bestNeededPositions = getNeededPositions(
      bestSlot.matchResult.selectedPlayers,
      bestSlot.targetSquadSize,
    );
    const positionFit = getPositionFitLevel(candidate, bestNeededPositions);
    const priorityBonus = getPositionPriorityScore(positionFit);

    routedDrops.push({
      playerId: candidate.playerId,
      playerName: candidate.playerName,
      playerPosition: candidate.playerPosition,
      primaryPosition: candidate.primaryPosition,
      targetMatchId: bestSlot.matchId,
      targetTeamId: bestSlot.teamId,
      targetTeamName: bestSlot.teamName,
      fromMatchId: candidate.fromMatchId,
      fromTeamId: candidate.coreTeamId,
      fromTeamName: candidate.coreTeamName,
      role,
      positionFit,
      priorityBonus,
      nonRotatable: candidate.nonRotatable,
    });

    assignedPlayerIds.add(candidate.playerId);
    runningSlotCounts.set(bestSlot.matchId, (runningSlotCounts.get(bestSlot.matchId) ?? bestSlot.currentCount) + 1);
  }

  return routedDrops;
}