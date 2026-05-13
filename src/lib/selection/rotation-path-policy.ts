import type { AutomaticSelectionCategory } from "@/lib/selection/types";

export type RotationPathEdge = {
  fromTeamId: string;
  toTeamId: string;
  role: string;
  active: boolean;
};

export type PathPolicyResult =
  | { valid: true; path: RotationPathEdge; explanation: string }
  | { valid: false; explanation: string };

function pathRoleMatchesCategory(pathRole: string, category: AutomaticSelectionCategory): boolean {
  const normalizedPathRole = pathRole.toUpperCase();
  const normalizedCategory = category.toUpperCase();

  // Exact match always works
  if (normalizedPathRole === normalizedCategory) return true;

  // BACKFILL rotation paths authorize SUPPORT movement
  if (normalizedCategory === "SUPPORT" && normalizedPathRole === "BACKFILL") return true;

  // CONFIDENCE_REBUILD rotation paths authorize DEVELOPMENT movement
  if (normalizedCategory === "DEVELOPMENT" && normalizedPathRole === "CONFIDENCE_REBUILD") return true;

  return false;
}

export function getValidPathForRole(
  paths: RotationPathEdge[],
  fromTeamId: string,
  toTeamId: string,
  role: AutomaticSelectionCategory,
): RotationPathEdge | null {
  return (
    paths.find(
      (p) =>
        p.fromTeamId === fromTeamId &&
        p.toTeamId === toTeamId &&
        p.active &&
        pathRoleMatchesCategory(p.role, role),
    ) ?? null
  );
}

export function canMoveForRole(
  playerCoreTeamId: string,
  targetTeamId: string,
  role: AutomaticSelectionCategory,
  playerNonRotatable: boolean,
  paths: RotationPathEdge[],
): PathPolicyResult {
  if (playerNonRotatable) {
    return {
      valid: false,
      explanation: `Player is marked non-rotatable and cannot be automatically selected for any non-core role.`,
    };
  }

  if (playerCoreTeamId === targetTeamId) {
    return {
      valid: false,
      explanation: `Player is a core member of the target team; no rotation path needed.`,
    };
  }

  const path = getValidPathForRole(paths, playerCoreTeamId, targetTeamId, role);

  if (!path) {
    return {
      valid: false,
      explanation: `No active ${role} rotation path from player's core team to the target team. A path with a different role does not authorize ${role} movement.`,
    };
  }

  return {
    valid: true,
    path,
    explanation: `Active ${role} rotation path exists from core team to target team.`,
  };
}

export function assertValidMovementPath(
  playerCoreTeamId: string,
  playerCoreTeamName: string,
  targetTeamId: string,
  targetTeamName: string,
  role: AutomaticSelectionCategory,
  playerNonRotatable: boolean,
  paths: RotationPathEdge[],
): PathPolicyResult {
  const result = canMoveForRole(playerCoreTeamId, targetTeamId, role, playerNonRotatable, paths);

  if (!result.valid) {
    return result;
  }

  return {
    valid: true,
    path: result.path,
    explanation: `${playerCoreTeamName} player may move to ${targetTeamName} as ${role} via active ${role} path.`,
  };
}

export function explainInvalidMovementPath(
  playerCoreTeamName: string,
  targetTeamName: string,
  requestedRole: string,
  existingPaths: RotationPathEdge[],
  fromTeamId: string,
  toTeamId: string,
): string {
  const sameDirectionPaths = existingPaths.filter(
    (p) => p.fromTeamId === fromTeamId && p.toTeamId === toTeamId,
  );

  if (sameDirectionPaths.length > 0) {
    const pathRoles = sameDirectionPaths.map((p) => p.role).join(", ");
    return `A path exists from ${playerCoreTeamName} to ${targetTeamName} for role(s): ${pathRoles} — but not for ${requestedRole}. Each path authorizes exactly one role.`;
  }

  return `No rotation path from ${playerCoreTeamName} to ${targetTeamName} exists. Movement is not authorized without a configured path.`;
}

export function filterPathsForRole(
  paths: RotationPathEdge[],
  role: AutomaticSelectionCategory,
): RotationPathEdge[] {
  return paths.filter((p) => p.active && pathRoleMatchesCategory(p.role, role));
}

export function getSourceTeamIdsForRole(
  paths: RotationPathEdge[],
  targetTeamId: string,
  role: AutomaticSelectionCategory,
): string[] {
  return filterPathsForRole(paths, role)
    .filter((p) => p.toTeamId === targetTeamId)
    .map((p) => p.fromTeamId);
}