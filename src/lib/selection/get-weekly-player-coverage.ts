import type { Player, Team } from "@/generated/prisma/client";
import { formatPlayerName } from "@/lib/player-metrics";
import { getTargetTeamEligibility } from "@/lib/selection/get-target-team-eligibility";

type CoveragePlayer = Pick<
  Player,
  | "active"
  | "coreTeamId"
  | "currentAvailability"
  | "firstName"
  | "id"
  | "lastName"
  | "nonRotatable"
  | "removedAt"
> & {
  coreTeam: Pick<Team, "id" | "name">;
};

type CoverageMatch = {
  id: string;
  opponent: string;
  team: Pick<Team, "id" | "name">;
};

export type WeeklyCoverageRow = {
  eligibleMatchLabels: string[];
  playerId: string;
  playerName: string;
  reason: string;
  severity: "info" | "warning";
  teamName: string;
};

export function getWeeklyPlayerCoverage(
  players: CoveragePlayer[],
  weekMatches: CoverageMatch[],
  selectedPlayerIdsByMatchId: Map<string, string[]>,
): WeeklyCoverageRow[] {
  const selectedPlayerIds = new Set(
    weekMatches.flatMap((match) => selectedPlayerIdsByMatchId.get(match.id) ?? []),
  );

  const rows: WeeklyCoverageRow[] = [];

  for (const player of players) {
    if (!player.active || player.removedAt !== null || player.currentAvailability !== "AVAILABLE") {
      continue;
    }

    const eligibleMatchLabels = weekMatches
      .filter((match) => getTargetTeamEligibility(player, match.team).allowed)
      .map((match) => `${match.team.name} vs ${match.opponent}`);

    if (eligibleMatchLabels.length === 0 || selectedPlayerIds.has(player.id)) {
      continue;
    }

    rows.push({
      eligibleMatchLabels,
      playerId: player.id,
      playerName: formatPlayerName(player),
      reason: "Not currently included in any week selection and should be reviewed before the week is considered complete.",
      severity: "warning",
      teamName: player.coreTeam.name,
    });
  }

  return rows.sort((left, right) => {
    if (left.severity !== right.severity) {
      return left.severity === "warning" ? -1 : 1;
    }

    if (left.teamName !== right.teamName) {
      return left.teamName.localeCompare(right.teamName);
    }

    return left.playerName.localeCompare(right.playerName);
  });
}
