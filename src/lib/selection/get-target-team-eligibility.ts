import type { Player, Team } from "@/generated/prisma/client";

type EligibilityPlayer = Pick<Player, "coreTeamId" | "nonRotatable"> & {
  coreTeam: Pick<Team, "id" | "name">;
};

type PathDestination = {
  toTeamId: string;
  role: string;
};

export type TargetTeamEligibility =
  | {
      allowed: true;
      explanation: string;
      selectionCategory: "CORE" | "SUPPORT" | "DEVELOPMENT" | "BACKFILL" | "CONFIDENCE_REBUILD";
    }
  | {
      allowed: false;
      explanation: string;
    };

export function getTargetTeamEligibility(
  player: EligibilityPlayer,
  targetTeam: Pick<Team, "id" | "name">,
  pathDestinations?: PathDestination[],
): TargetTeamEligibility {
  if (player.coreTeamId === targetTeam.id) {
    return {
      allowed: true,
      explanation: `Eligible as a core player for ${targetTeam.name}.`,
      selectionCategory: "CORE",
    };
  }

  if (player.nonRotatable) {
    return {
      allowed: false,
      explanation: `Excluded because ${player.coreTeam.name} players can only move between teams when not marked as non-rotatable.`,
    };
  }

  if (!pathDestinations || pathDestinations.length === 0) {
    return {
      allowed: false,
      explanation: `Excluded because no rotation path allows ${player.coreTeam.name} players to move to ${targetTeam.name}.`,
    };
  }

  const matchingPath = pathDestinations.find(
    (path) => path.toTeamId === targetTeam.id,
  );

  if (!matchingPath) {
    return {
      allowed: false,
      explanation: `Excluded because no rotation path allows movement from ${player.coreTeam.name} to ${targetTeam.name}.`,
    };
  }

  const pathRole = matchingPath.role as "SUPPORT" | "DEVELOPMENT" | "BACKFILL" | "CONFIDENCE_REBUILD";

  return {
    allowed: true,
    explanation: `Eligible to move from ${player.coreTeam.name} to ${targetTeam.name} via ${pathRole.toLowerCase()} path.`,
    selectionCategory: pathRole === "SUPPORT" ? "SUPPORT"
      : pathRole === "DEVELOPMENT" ? "DEVELOPMENT"
      : pathRole === "CONFIDENCE_REBUILD" ? "CONFIDENCE_REBUILD"
      : "BACKFILL",
  };
}