import type { Player, Team } from "@/generated/prisma/client";
import { formatPlayerName } from "@/lib/player-metrics";

type FairnessPlayer = Pick<
  Player,
  "active" | "canDropCoreMatch" | "firstName" | "id" | "lastName" | "removedAt"
> & {
  coreTeam: Pick<Team, "id" | "name">;
};

export type TeamFairnessGap = {
  currentMatchCount: number;
  gap: number;
  playerId: string;
  playerName: string;
  targetMatchCount: number;
  teamId: string;
  teamName: string;
};

export type TeamFairnessGroup = {
  players: TeamFairnessGap[];
  teamId: string;
  teamName: string;
  targetMatchCount: number;
};

export function getTeamFairnessGroups(
  players: FairnessPlayer[],
  selectedPlayerIdsByMatchId: Map<string, string[]>,
): TeamFairnessGroup[] {
  const savedMatchCountByPlayerId = new Map<string, number>();

  for (const playerIds of selectedPlayerIdsByMatchId.values()) {
    for (const playerId of playerIds) {
      savedMatchCountByPlayerId.set(playerId, (savedMatchCountByPlayerId.get(playerId) ?? 0) + 1);
    }
  }

  const playersByTeamId = new Map<string, FairnessPlayer[]>();

  for (const player of players) {
    if (!player.active || player.removedAt !== null) {
      continue;
    }

    const existingPlayers = playersByTeamId.get(player.coreTeam.id) ?? [];
    existingPlayers.push(player);
    playersByTeamId.set(player.coreTeam.id, existingPlayers);
  }

  return [...playersByTeamId.entries()]
    .map(([teamId, teamPlayers]) => {
      const targetMatchCount = teamPlayers.reduce(
        (highestCount, player) =>
          Math.max(highestCount, savedMatchCountByPlayerId.get(player.id) ?? 0),
        0,
      );

      const teamGapPlayers = teamPlayers
        .filter((player) => !player.canDropCoreMatch)
        .map((player) => {
          const currentMatchCount = savedMatchCountByPlayerId.get(player.id) ?? 0;
          const gap = targetMatchCount - currentMatchCount;

          if (gap <= 0) {
            return null;
          }

          return {
            currentMatchCount,
            gap,
            playerId: player.id,
            playerName: formatPlayerName(player),
            targetMatchCount,
            teamId,
            teamName: player.coreTeam.name,
          } satisfies TeamFairnessGap;
        })
        .filter((gapPlayer): gapPlayer is TeamFairnessGap => gapPlayer !== null)
        .sort((left, right) => {
          if (left.gap !== right.gap) {
            return right.gap - left.gap;
          }

          return left.playerName.localeCompare(right.playerName);
        });

      if (teamGapPlayers.length === 0) {
        return null;
      }

      return {
        players: teamGapPlayers,
        targetMatchCount,
        teamId,
        teamName: teamGapPlayers[0]?.teamName ?? teamPlayers[0]?.coreTeam.name ?? "Unknown",
      } satisfies TeamFairnessGroup;
    })
    .filter((group): group is TeamFairnessGroup => group !== null)
    .sort((left, right) => left.teamName.localeCompare(right.teamName));
}
