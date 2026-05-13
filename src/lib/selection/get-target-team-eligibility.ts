import type { Player, Team } from "@/generated/prisma/client";

type EligibilityPlayer = Pick<Player, "coreTeamId" | "nonRotatable"> & {
  coreTeam: Pick<Team, "id" | "name"> | null;
};

type PathDestination = {
  toTeamId: string;
  role: string;
};

import type { SelectionCategory } from "@/lib/selection/types";

export type TargetTeamEligibility =
  | {
      allowed: true;
      explanation: string;
      selectionCategory: SelectionCategory;
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
      explanation: `Excluded because ${player.coreTeam?.name ?? "Unassigned"} players can only move between teams when not marked as non-rotatable.`,
    };
  }

  if (!pathDestinations || pathDestinations.length === 0) {
    return {
      allowed: false,
      explanation: `Excluded because no rotation path allows ${player.coreTeam?.name ?? "Unassigned"} players to move to ${targetTeam.name}.`,
    };
  }

  const matchingPath = pathDestinations.find(
    (path) => path.toTeamId === targetTeam.id,
  );

  if (!matchingPath) {
    return {
      allowed: false,
      explanation: `Excluded because no rotation path allows movement from ${player.coreTeam?.name ?? "Unassigned"} to ${targetTeam.name}.`,
    };
  }

  const pathRole = matchingPath.role;

  // Generation only produces SUPPORT and DEVELOPMENT.
  // BACKFILL and CONFIDENCE_REBUILD are legacy roles retained for
  // backward compatibility of historical data and manual override.
  // When a BACKFILL path is found, the player is routed as SUPPORT
  // for squad repair purposes. CONFIDENCE_REBUILD paths route as
  // DEVELOPMENT.
  const generationCategory: "SUPPORT" | "DEVELOPMENT" =
    pathRole === "DEVELOPMENT" || pathRole === "CONFIDENCE_REBUILD"
      ? "DEVELOPMENT"
      : "SUPPORT";

  return {
    allowed: true,
    explanation: `Eligible to move from ${player.coreTeam?.name ?? "Unassigned"} to ${targetTeam.name} via ${generationCategory.toLowerCase()} path.`,
    selectionCategory: generationCategory,
  };
}