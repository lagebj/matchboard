import type { GroupMovementPathInfo } from "@/lib/groups/group-pool-resolver";

export type MovementAuthorizationResult =
  | { authorized: true; path: GroupMovementPathInfo; explanation: string }
  | { authorized: false; explanation: string };

const ROLE_COMPATIBILITY: Record<string, string[]> = {
  SUPPORT: ["SUPPORT", "BACKFILL"],
  DEVELOPMENT: ["DEVELOPMENT", "CONFIDENCE_REBUILD"],
  CONFIDENCE_REBUILD: ["DEVELOPMENT"],
  BACKFILL: ["SUPPORT"],
};

export function isMovementPathAuthorized(
  paths: GroupMovementPathInfo[],
  fromGroupId: string,
  toGroupId: string,
  role: string,
  scope?: string,
): MovementAuthorizationResult {
  const compatibleRoles = ROLE_COMPATIBILITY[role] ?? [role];

  const matchingPath = paths.find(
    (p) =>
      p.fromGroupId === fromGroupId &&
      p.toGroupId === toGroupId &&
      compatibleRoles.includes(p.role) &&
      p.isActive &&
      (scope ? p.scope === scope : true),
  );

  if (matchingPath) {
    return {
      authorized: true,
      path: matchingPath,
      explanation: `Authorized: ${matchingPath.role} path from ${matchingPath.fromGroupName} to ${matchingPath.toGroupName}${scope ? ` (${scope})` : ""}`,
    };
  }

  const anyPathFromGroup = paths.find(
    (p) => p.fromGroupId === fromGroupId && p.toGroupId === toGroupId && p.isActive,
  );

  if (anyPathFromGroup) {
    return {
      authorized: false,
      explanation: `No ${role} path from group to target. A ${anyPathFromGroup.role} path exists but does not authorize ${role} movement.`,
    };
  }

  return {
    authorized: false,
    explanation: `No active movement path from group to target group for role ${role}.`,
  };
}

export function getEligibleTargetGroups(
  paths: GroupMovementPathInfo[],
  sourceGroupId: string,
  role?: string,
): string[] {
  const compatibleRoles = role
    ? (ROLE_COMPATIBILITY[role] ?? [role])
    : undefined;

  return [
    ...new Set(
      paths
        .filter(
          (p) =>
            p.fromGroupId === sourceGroupId &&
            p.isActive &&
            (compatibleRoles ? compatibleRoles.includes(p.role) : true),
        )
        .map((p) => p.toGroupId),
    ),
  ];
}

export function getPlayersEligibleForCrossGroupMovement(
  sourceGroupPlayers: { playerId: string; nonRotatable: boolean; coreTeamId: string | null; footballGroupId: string }[],
  paths: GroupMovementPathInfo[],
  targetGroupId: string,
  role: string,
): { playerId: string; authorized: boolean; explanation: string }[] {
  const compatibleRoles = ROLE_COMPATIBILITY[role] ?? [role];

  const sourceGroupIds = [
    ...new Set(sourceGroupPlayers.map((p) => p.footballGroupId)),
  ];

  const authorizedPaths = paths.filter(
    (p) =>
      p.toGroupId === targetGroupId &&
      sourceGroupIds.includes(p.fromGroupId) &&
      compatibleRoles.includes(p.role) &&
      p.isActive,
  );

  const authorizedSourceGroupIds = new Set(
    authorizedPaths.map((p) => p.fromGroupId),
  );

  return sourceGroupPlayers.map((player) => {
    if (player.nonRotatable) {
      return {
        playerId: player.playerId,
        authorized: false,
        explanation: "Player is marked non-rotatable and cannot be selected for non-core movement.",
      };
    }

    const playerGroupId = player.footballGroupId;

    if (playerGroupId === targetGroupId) {
      return {
        playerId: player.playerId,
        authorized: true,
        explanation: "Player is in the target group (core selection).",
      };
    }

    if (authorizedSourceGroupIds.has(playerGroupId)) {
      const path = authorizedPaths.find((p) => p.fromGroupId === playerGroupId)!;
      return {
        playerId: player.playerId,
        authorized: true,
        explanation: `Authorized via ${path.role} path from ${path.fromGroupName} to ${path.toGroupName}.`,
      };
    }

    return {
      playerId: player.playerId,
      authorized: false,
      explanation: `No active movement path from player's group to target group for role ${role}.`,
    };
  });
}