import { SelectionRole, SelectionStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { isFloatingSelectionRole } from "@/lib/match-utils";
import { formatPlayerName } from "@/lib/player-metrics";
import type { SelectionWarning } from "@/lib/selection/types";
import { getFloatingHistory } from "@/lib/selection/get-floating-history";
import { getFinalizedPlayerHistory } from "@/lib/selection/get-finalized-player-history";

type RepairResult = {
  explanation: string;
  repaired: boolean;
  replacementPlayerId?: string;
  replacementPlayerName?: string;
  warnings: SelectionWarning[];
};

type EligibleReplacement = {
  playerId: string;
  playerName: string;
  primaryPosition: string;
  coreTeamId: string;
  recentLoadScore: number;
  totalFloatingMatches: number;
  positionNeedPenalty: number;
  priorityScore: number;
};

function getPrimaryChosenPosition(primaryPosition: string): string {
  return primaryPosition.trim();
}

export async function repairDropout(
  matchId: string,
  droppedPlayerId: string,
): Promise<RepairResult> {
  const match = await db.match.findUnique({
    where: { id: matchId },
    include: {
      team: {
        select: {
          id: true,
          name: true,
          minSupportPlayers: true,
          targetSupportCount: true,
          minAcceptedSquadSize: true,
        },
      },
    },
  });

  if (!match) {
    return {
      explanation: "Match not found.",
      repaired: false,
      warnings: [],
    };
  }

  const droppedSelection = await db.selection.findFirst({
    where: {
      matchId,
      playerId: droppedPlayerId,
      status: SelectionStatus.DRAFT,
    },
    include: {
      player: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          coreTeamId: true,
          primaryPosition: true,
        },
      },
    },
    orderBy: [{ createdAt: "desc" }],
  });

  if (!droppedSelection) {
    return {
      explanation: "The dropped player was not found in the draft selection for this match.",
      repaired: false,
      warnings: [],
    };
  }

  const droppedPlayerName = formatPlayerName(droppedSelection.player);
  const droppedRole = droppedSelection.role;
  const droppedPlayerCoreTeamId = droppedSelection.player.coreTeamId;
  const matchRoundId = match.matchRoundId;

  const allActiveSelections = await db.selection.findMany({
    where: {
      matchId,
      status: SelectionStatus.DRAFT,
    },
    select: {
      playerId: true,
      role: true,
    },
  });

  const activeSelectionPlayerIds = new Set(allActiveSelections.map((s) => s.playerId));

  const sameRoleCount = allActiveSelections.filter(
    (s) => s.role === droppedRole && s.playerId !== droppedPlayerId,
  ).length;

  const playerLocks = await db.playerLock.findMany({
    where: {
      matchRoundId,
      lockType: "LOCKED_OUT",
    },
    select: {
      playerId: true,
    },
  });
  const lockedOutPlayerIds = new Set(playerLocks.map((lock) => lock.playerId));

  const isSupportRole = droppedRole === SelectionRole.SUPPORT;
  const isDevelopmentRole = droppedRole === SelectionRole.DEVELOPMENT;

  const rotationPaths = await db.rotationPath.findMany({
    where: { active: true },
    select: {
      fromTeamId: true,
      toTeamId: true,
      role: true,
    },
  });

  const supportSourceTeamIds = rotationPaths
    .filter((p) => p.toTeamId === match.teamId && p.role === "SUPPORT")
    .map((p) => p.fromTeamId);

  const developmentSourceTeamIds = rotationPaths
    .filter((p) => p.toTeamId === match.teamId && p.role === "DEVELOPMENT")
    .map((p) => p.fromTeamId);

  const isFloatingPath = isFloatingSelectionRole(droppedRole);
  const sourceTeamIds = isSupportRole
    ? supportSourceTeamIds
    : isDevelopmentRole
      ? developmentSourceTeamIds
      : isFloatingPath
        ? [droppedPlayerCoreTeamId]
        : [];

  const replacementCandidates = await db.player.findMany({
    where: {
      active: true,
      removedAt: null,
      currentAvailability: "AVAILABLE",
      id: {
        notIn: [...activeSelectionPlayerIds, droppedPlayerId],
      },
      ...(sourceTeamIds.length > 0
        ? {
            coreTeamId: { in: sourceTeamIds },
          }
        : { coreTeamId: droppedPlayerCoreTeamId }),
    },
    include: {
      coreTeam: {
        select: { id: true, name: true },
      },
    },
  });

  const currentSelectedPositions = allActiveSelections
    .filter((s) => s.playerId !== droppedPlayerId)
    .map(() => "");

  const eligibleReplacements: EligibleReplacement[] = [];

  for (const candidate of replacementCandidates) {
    if (lockedOutPlayerIds.has(candidate.id)) {
      continue;
    }

    if (isFloatingPath) {
      const hasPath = rotationPaths.some(
        (p) =>
          p.fromTeamId === candidate.coreTeamId &&
          p.toTeamId === match.teamId &&
          p.role === droppedRole,
      );
      if (!hasPath) {
        continue;
      }
    } else if (candidate.coreTeamId !== match.teamId) {
      continue;
    }

    const [floatingHistory, finalizedHistory] = await Promise.all([
      getFloatingHistory(candidate.id, match.startsAt),
      getFinalizedPlayerHistory(candidate.id, matchId, match.startsAt),
    ]);

    const recentLoadScore = finalizedHistory.slice(0, 3).length;
    const positionNeedPenalty = currentSelectedPositions.length;
    const priorityScore =
      50 -
      recentLoadScore * 2 -
      floatingHistory.totalFloatingMatches * 3 -
      positionNeedPenalty * 1;

    eligibleReplacements.push({
      coreTeamId: candidate.coreTeamId,
      playerId: candidate.id,
      playerName: formatPlayerName(candidate),
      primaryPosition: candidate.primaryPosition,
      recentLoadScore,
      totalFloatingMatches: floatingHistory.totalFloatingMatches,
      positionNeedPenalty,
      priorityScore,
    });
  }

  eligibleReplacements.sort((left, right) => {
    if (left.priorityScore !== right.priorityScore) {
      return right.priorityScore - left.priorityScore;
    }
    return left.playerName.localeCompare(right.playerName);
  });

  const warnings: SelectionWarning[] = [];

  if (eligibleReplacements.length > 0) {
    const replacement = eligibleReplacements[0]!;

    await db.selection.delete({
      where: { id: droppedSelection.id },
    });

    await db.selection.create({
      data: {
        matchId,
        matchRoundId,
        playerId: replacement.playerId,
        role: droppedRole,
        status: SelectionStatus.DRAFT,
        explanation: {
          summary: `Replaced ${droppedPlayerName} after late dropout. Selected as a ${droppedRole.toLowerCase()} replacement from ${replacement.coreTeamId === match.teamId ? match.team.name : "rotation pool"}.`,
          autoSelected: true,
          manuallyAdded: false,
          manuallyRemoved: false,
          sourceTeamName: replacement.coreTeamId,
          targetTeamName: match.team.name,
          repairReason: `${droppedPlayerName} dropped out. ${replacement.playerName} was chosen as the best available same-role replacement.`,
        },
      },
    });

    const remainingCount = allActiveSelections.length;
    if (remainingCount < match.team.minAcceptedSquadSize) {
      warnings.push({
        code: "repair_below_minimum",
        message: `After replacing ${droppedPlayerName}, the squad has ${remainingCount} players, which is below the minimum accepted squad size of ${match.team.minAcceptedSquadSize}. Manual override or additional selection change may be required.`,
      });
    }

    return {
      explanation: `${droppedPlayerName} dropped out. Replaced with ${replacement.playerName} (${replacement.primaryPosition}) as the best available ${droppedRole.toLowerCase()} replacement from the same source path.`,
      repaired: true,
      replacementPlayerId: replacement.playerId,
      replacementPlayerName: replacement.playerName,
      warnings,
    };
  }

  const remainingAfterDropout = allActiveSelections.length - 1;
  const minimumSquadSize = match.team.minAcceptedSquadSize;

  if (remainingAfterDropout >= minimumSquadSize) {
    await db.selection.delete({
      where: { id: droppedSelection.id },
    });

    warnings.push({
      code: "repair_no_replacement_target_shortfall",
      message: `No eligible replacement found for ${droppedPlayerName} (${droppedRole.toLowerCase()}). Squad reduced to ${remainingAfterDropout} players, which is below the target but still above the minimum of ${minimumSquadSize}.`,
    });

    if (isSupportRole && sameRoleCount < match.team.targetSupportCount) {
      warnings.push({
        code: "support_target_not_reached",
        message: `${match.team.name} target support count of ${match.team.targetSupportCount} is not met after this dropout. Currently ${sameRoleCount} support player(s) from ${match.team.targetSupportCount} target.`,
      });
    }

    return {
      explanation: `No eligible replacement found for ${droppedPlayerName}. The squad was reduced to ${remainingAfterDropout} players, which is still above the minimum accepted size of ${minimumSquadSize}.`,
      repaired: true,
      warnings,
    };
  }

  return {
    explanation: `No eligible replacement found for ${droppedPlayerName}. Removing this player would reduce the squad to ${remainingAfterDropout}, below the minimum accepted squad size of ${minimumSquadSize}. Manual override is required to accept a reduced squad or find an alternative solution.`,
    repaired: false,
    warnings: [
      {
        code: "repair_requires_override",
        message: `Cannot automatically repair: the squad would fall below the minimum accepted size of ${minimumSquadSize}. A coach must manually accept a reduced squad or make an alternative selection change.`,
      },
    ],
  };
}