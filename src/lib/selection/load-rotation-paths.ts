import { db } from "@/lib/db";
import { SelectionRole } from "@/generated/prisma/client";
import { listGroupMovementPaths } from "@/lib/groups/group-movement-path";

export type RotationPathWithTeamName = {
  fromTeamId: string;
  fromTeam: { name: string };
  toTeamId: string;
  toTeam: { name: string };
  role: string;
  cooldownRounds: number | null;
};

export type RotationPathRow = {
  fromTeamId: string;
  toTeamId: string;
  role: string;
};

export type RotationPathEdgeWithActive = {
  fromTeamId: string;
  toTeamId: string;
  role: string;
  active: boolean;
};

export async function loadRotationPathsWithGroupPaths(
  organisationId: string,
  options?: { scope?: "MATCH" },
): Promise<RotationPathWithTeamName[]> {
  const [rotationPaths, groupPathsRaw, teamsForGroups] = await Promise.all([
    db.rotationPath.findMany({
      where: { active: true },
      select: {
        cooldownRounds: true,
        fromTeamId: true,
        fromTeam: { select: { name: true } },
        toTeamId: true,
        toTeam: { select: { name: true } },
        role: true,
      },
    }),
    listGroupMovementPaths(organisationId, { activeOnly: true, scope: options?.scope }),
    db.team.findMany({
      where: { organisationId },
      select: { id: true, footballGroupId: true, name: true },
    }),
  ]);

  const groupTeamsMap = new Map<string, { id: string; name: string }[]>();
  for (const team of teamsForGroups) {
    const groupTeams = groupTeamsMap.get(team.footballGroupId) ?? [];
    groupTeams.push({ id: team.id, name: team.name });
    groupTeamsMap.set(team.footballGroupId, groupTeams);
  }

  const groupPathEdges: RotationPathWithTeamName[] = [];

  for (const gp of groupPathsRaw) {
    const sourceTeams = groupTeamsMap.get(gp.fromGroupId) ?? [];
    const targetTeams = groupTeamsMap.get(gp.toGroupId) ?? [];

    for (const fromTeam of sourceTeams) {
      for (const toTeam of targetTeams) {
        groupPathEdges.push({
          fromTeamId: fromTeam.id,
          fromTeam: { name: fromTeam.name },
          toTeamId: toTeam.id,
          toTeam: { name: toTeam.name },
          role: gp.role,
          cooldownRounds: null,
        });
      }
    }
  }

  return [...rotationPaths, ...groupPathEdges];
}

export async function loadRotationPathRowsWithGroupPaths(
  organisationId: string,
  roleFilter?: SelectionRole[],
  options?: { scope?: "MATCH" },
): Promise<RotationPathRow[]> {
  const [rotationPaths, groupPathsRaw, teamsForGroups] = await Promise.all([
    db.rotationPath.findMany({
      where: {
        active: true,
        ...(roleFilter ? { role: { in: roleFilter } } : {}),
      },
      select: { fromTeamId: true, toTeamId: true, role: true },
    }),
    listGroupMovementPaths(organisationId, { activeOnly: true, scope: options?.scope }),
    db.team.findMany({
      where: { organisationId },
      select: { id: true, footballGroupId: true },
    }),
  ]);

  const groupTeamsMap = new Map<string, string[]>();
  for (const team of teamsForGroups) {
    const groupTeams = groupTeamsMap.get(team.footballGroupId) ?? [];
    groupTeams.push(team.id);
    groupTeamsMap.set(team.footballGroupId, groupTeams);
  }

  const groupPathRows: RotationPathRow[] = [];

  for (const gp of groupPathsRaw) {
    if (roleFilter && !roleFilter.includes(gp.role as SelectionRole)) continue;

    const sourceTeams = groupTeamsMap.get(gp.fromGroupId) ?? [];
    const targetTeams = groupTeamsMap.get(gp.toGroupId) ?? [];

    for (const fromTeamId of sourceTeams) {
      for (const toTeamId of targetTeams) {
        groupPathRows.push({
          fromTeamId,
          toTeamId,
          role: gp.role,
        });
      }
    }
  }

  return [...rotationPaths, ...groupPathRows];
}

export async function loadRotationPathEdgesWithGroupPaths(
  organisationId: string,
  options?: { scope?: "MATCH" },
): Promise<RotationPathEdgeWithActive[]> {
  const [rotationPaths, groupPathsRaw, teamsForGroups] = await Promise.all([
    db.rotationPath.findMany({
      where: { active: true },
      select: { fromTeamId: true, toTeamId: true, role: true, active: true },
    }),
    listGroupMovementPaths(organisationId, { activeOnly: true, scope: options?.scope }),
    db.team.findMany({
      where: { organisationId },
      select: { id: true, footballGroupId: true },
    }),
  ]);

  const groupTeamsMap = new Map<string, string[]>();
  for (const team of teamsForGroups) {
    const groupTeams = groupTeamsMap.get(team.footballGroupId) ?? [];
    groupTeams.push(team.id);
    groupTeamsMap.set(team.footballGroupId, groupTeams);
  }

  const edges: RotationPathEdgeWithActive[] = [...rotationPaths];

  for (const gp of groupPathsRaw) {
    const sourceTeams = groupTeamsMap.get(gp.fromGroupId) ?? [];
    const targetTeams = groupTeamsMap.get(gp.toGroupId) ?? [];

    for (const fromTeamId of sourceTeams) {
      for (const toTeamId of targetTeams) {
        edges.push({
          fromTeamId,
          toTeamId,
          role: gp.role,
          active: true,
        });
      }
    }
  }

  return edges;
}