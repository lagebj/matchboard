import type { Player, Team } from "@/generated/prisma/client";
import { formatPlayerName } from "@/lib/player-metrics";
import { getTargetTeamEligibility } from "@/lib/selection/get-target-team-eligibility";

type CoveragePlayer = Pick<
  Player,
  | "active"
  | "canDropCoreMatch"
  | "coreTeamId"
  | "currentAvailability"
  | "firstName"
  | "id"
  | "isFloating"
  | "lastName"
  | "removedAt"
> & {
  allowedFloatTeams: Array<{
    team: Pick<Team, "id" | "name">;
    teamId: string;
  }>;
  coreTeam: Pick<Team, "id" | "name">;
};

type CoverageMatch = {
  id: string;
  opponent: string;
  targetTeam: Pick<Team, "id" | "name">;
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

  return players
    .filter((player) => player.active && player.removedAt === null && player.currentAvailability === "AVAILABLE")
    .map((player) => {
      const eligibleMatchLabels = weekMatches
        .filter((match) => getTargetTeamEligibility(player, match.targetTeam).allowed)
        .map((match) => `${match.targetTeam.name} vs ${match.opponent}`);

      if (eligibleMatchLabels.length === 0 || selectedPlayerIds.has(player.id)) {
        return null;
      }

      return {
        eligibleMatchLabels,
        playerId: player.id,
        playerName: formatPlayerName(player),
        reason: player.canDropCoreMatch
          ? "Not currently included in any week selection. Core-match drop is allowed, so this stays informational unless you want to use the player elsewhere this week."
          : "Not currently included in any week selection and should be reviewed before the week is considered complete.",
        severity: player.canDropCoreMatch ? "info" : "warning",
        teamName: player.coreTeam.name,
      } satisfies WeeklyCoverageRow;
    })
    .filter((row): row is WeeklyCoverageRow => row !== null)
    .sort((left, right) => {
      if (left.severity !== right.severity) {
        return left.severity === "warning" ? -1 : 1;
      }

      if (left.teamName !== right.teamName) {
        return left.teamName.localeCompare(right.teamName);
      }

      return left.playerName.localeCompare(right.playerName);
    });
}
