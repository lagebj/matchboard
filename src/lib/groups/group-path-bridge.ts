import { db } from "@/lib/db";
import type { GroupMovementPathRole, GroupMovementPathScope } from "@/generated/prisma/client";
import type { RotationPathEdge } from "@/lib/selection/rotation-path-policy";
import type { GroupMovementPathInfo } from "@/lib/groups/group-pool-resolver";
import { listGroupMovementPaths } from "@/lib/groups/group-movement-path";

export type GroupMovementPathEdge = {
  id: string;
  fromGroupId: string;
  toGroupId: string;
  fromGroupName: string;
  toGroupName: string;
  role: GroupMovementPathRole;
  scope: GroupMovementPathScope;
  isActive: boolean;
};

const GROUP_ROLE_TO_SELECTION_ROLES: Record<GroupMovementPathRole, string[]> = {
  SUPPORT: ["SUPPORT"],
  DEVELOPMENT: ["DEVELOPMENT"],
  CONFIDENCE_REBUILD: ["CONFIDENCE_REBUILD"],
  BACKFILL: ["BACKFILL"],
};

const SELECTION_ROLE_TO_GROUP_ROLES: Record<string, GroupMovementPathRole[]> = {
  SUPPORT: ["SUPPORT", "BACKFILL"],
  DEVELOPMENT: ["DEVELOPMENT", "CONFIDENCE_REBUILD"],
};

export async function resolveGroupPathsAsRotationEdges(
  organisationId: string,
  scope?: GroupMovementPathScope,
): Promise<RotationPathEdge[]> {
  const groupPathsRaw = await listGroupMovementPaths(organisationId, { activeOnly: true, scope });
  const groupPaths: GroupMovementPathInfo[] = groupPathsRaw.map((p) => ({
    id: p.id,
    fromGroupId: p.fromGroupId,
    toGroupId: p.toGroupId,
    fromGroupName: p.fromGroup.name,
    toGroupName: p.toGroup.name,
    role: p.role,
    scope: p.scope,
    isActive: p.isActive,
  }));

  const teams = await db.team.findMany({
    where: { organisationId },
    select: { id: true, footballGroupId: true },
  });

  const teamsByGroup = new Map<string, string[]>();
  for (const team of teams) {
    const groupTeams = teamsByGroup.get(team.footballGroupId) ?? [];
    groupTeams.push(team.id);
    teamsByGroup.set(team.footballGroupId, groupTeams);
  }

  const edges: RotationPathEdge[] = [];

  for (const path of groupPaths) {
    const sourceTeams = teamsByGroup.get(path.fromGroupId) ?? [];
    const targetTeams = teamsByGroup.get(path.toGroupId) ?? [];

    const compatibleSelectionRoles = GROUP_ROLE_TO_SELECTION_ROLES[path.role] ?? [path.role];

    for (const selectionRole of compatibleSelectionRoles) {
      for (const fromTeamId of sourceTeams) {
        for (const toTeamId of targetTeams) {
          edges.push({
            fromTeamId,
            toTeamId,
            role: selectionRole,
            active: path.isActive,
          });
        }
      }
    }
  }

  return edges;
}

export async function resolveGroupPathsForMatch(
  matchId: string,
  organisationId: string,
): Promise<RotationPathEdge[]> {
  const match = await db.match.findFirst({
    where: { id: matchId, organisationId },
    select: {
      id: true,
      team: { select: { id: true, footballGroupId: true } },
    },
  });

  if (!match) {
    return [];
  }

  return resolveGroupPathsAsRotationEdges(organisationId, "MATCH");
}

export function groupPathsToRotationEdges(
  groupPaths: GroupMovementPathInfo[],
  teamGroupMap: Map<string, string>,
): RotationPathEdge[] {
  const groupIdToTeams = new Map<string, string[]>();
  for (const [teamId, groupId] of teamGroupMap) {
    const teams = groupIdToTeams.get(groupId) ?? [];
    teams.push(teamId);
    groupIdToTeams.set(groupId, teams);
  }

  const edges: RotationPathEdge[] = [];

  for (const path of groupPaths) {
    const sourceTeams = groupIdToTeams.get(path.fromGroupId) ?? [];
    const targetTeams = groupIdToTeams.get(path.toGroupId) ?? [];

    const compatibleSelectionRoles = GROUP_ROLE_TO_SELECTION_ROLES[path.role] ?? [path.role];

    for (const selectionRole of compatibleSelectionRoles) {
      for (const fromTeamId of sourceTeams) {
        for (const toTeamId of targetTeams) {
          edges.push({
            fromTeamId,
            toTeamId,
            role: selectionRole,
            active: path.isActive,
          });
        }
      }
    }
  }

  return edges;
}

export function isGroupMovementPathAuthorized(
  groupPaths: GroupMovementPathInfo[],
  playerTeamGroupId: string,
  targetTeamGroupId: string,
  selectionRole: string,
): boolean {
  const groupRoles = SELECTION_ROLE_TO_GROUP_ROLES[selectionRole];
  if (!groupRoles) return false;

  return groupPaths.some(
    (p) =>
      p.fromGroupId === playerTeamGroupId &&
      p.toGroupId === targetTeamGroupId &&
      groupRoles.includes(p.role) &&
      p.isActive,
  );
}