import type { Player, Team } from "@/generated/prisma/client";

type EligibilityPlayer = Pick<Player, "coreTeamId" | "isFloating"> & {
  allowedFloatTeams: Array<{
    team: Pick<Team, "id" | "name">;
    teamId: string;
  }>;
  coreTeam: Pick<Team, "id" | "name">;
};

export type TargetTeamEligibility =
  | {
      allowed: true;
      explanation: string;
      selectionCategory: "CORE" | "FLOAT";
    }
  | {
      allowed: false;
      explanation: string;
    };

export function getTargetTeamEligibility(
  player: EligibilityPlayer,
  targetTeam: Pick<Team, "id" | "name">,
): TargetTeamEligibility {
  if (player.coreTeamId === targetTeam.id) {
    return {
      allowed: true,
      explanation: `Eligible as a core player for ${targetTeam.name}.`,
      selectionCategory: "CORE",
    };
  }

  if (!player.isFloating) {
    return {
      allowed: false,
      explanation: `Excluded because ${player.coreTeam.name} players only move between teams when marked as floating.`,
    };
  }

  const allowedFloatTeam = player.allowedFloatTeams.find((entry) => entry.teamId === targetTeam.id);

  if (!allowedFloatTeam) {
    return {
      allowed: false,
      explanation: `Excluded because ${player.coreTeam.name} is not marked to float to ${targetTeam.name}.`,
    };
  }

  return {
    allowed: true,
    explanation: `Eligible to float from ${player.coreTeam.name} to ${targetTeam.name}.`,
    selectionCategory: "FLOAT",
  };
}
