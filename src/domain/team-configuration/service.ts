import type { TeamConfiguration, TeamRuleConfiguration } from "./types";
import { db } from "@/lib/db";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";

export const KNOWN_RULES: TeamRuleConfiguration[] = [
  {
    ruleId: "own-core-preference",
    name: "Own core first",
    description: "Players are assigned to their own core team before any cross-team movement.",
    scope: "GLOBAL",
    enabled: true,
    editable: false,
  },
  {
    ruleId: "support-priority",
    name: "Support priority",
    description: "Teams with lower support priority rank receive support first. Priority 1 is highest.",
    scope: "TEAM",
    enabled: true,
    editable: true,
    value: "Configured per team via supportPriority field",
  },
  {
    ruleId: "floating-gap",
    name: "Floating gap",
    description: "Players cannot float to a team without an active rotation path.",
    scope: "GLOBAL",
    enabled: true,
    editable: false,
  },
  {
    ruleId: "squad-size-cap",
    name: "Squad size cap",
    description: "Teams cannot exceed maximum squad size without override.",
    scope: "TEAM",
    enabled: true,
    editable: true,
    value: "Configured per team via maxSquadSize field",
  },
  {
    ruleId: "match-load-fairness",
    name: "Match load fairness",
    description: "Player load is tracked across the league season to balance selections.",
    scope: "GLOBAL",
    enabled: true,
    editable: false,
  },
  {
    ruleId: "core-match-drop",
    name: "Core match drop allowance",
    description: "Core players may be dropped from a match based on attendance and effort patterns.",
    scope: "GLOBAL",
    enabled: true,
    editable: false,
  },
  {
    ruleId: "consecutive-support-rotation",
    name: "Consecutive support rotation",
    description: "Players sent as support for consecutive rounds receive a scoring penalty.",
    scope: "GLOBAL",
    enabled: true,
    editable: false,
  },
];

export async function getTeamConfiguration(teamId: string, orgFilter?: OrgFilterMode): Promise<TeamConfiguration | null> {
  const orgWhere = orgFilter?.type === "org" ? orgFilter.filter : {};
  const team = await db.team.findFirst({
    where: { id: teamId, ...orgWhere },
    include: {
      corePlayers: {
        where: { active: true },
        select: { id: true, firstName: true, lastName: true, primaryPosition: true },
        orderBy: { firstName: "asc" },
      },
      fromRotationPaths: {
        where: { active: true },
        include: { toTeam: { select: { id: true, name: true } } },
      },
      toRotationPaths: {
        where: { active: true },
        include: { fromTeam: { select: { id: true, name: true } } },
      },
      group: {
        select: { id: true, name: true, slug: true, type: true },
      },
    },
  });

  if (!team) return null;

  const rules: TeamRuleConfiguration[] = KNOWN_RULES.map((rule) => {
    if (rule.ruleId === "support-priority") {
      return { ...rule, value: `Priority ${team.supportPriority}` };
    }
    if (rule.ruleId === "squad-size-cap") {
      return { ...rule, value: `Max ${team.maxSquadSize} players` };
    }
    return rule;
  });

  return {
    teamId: team.id,
    name: team.name,
    coreGroup: `${team.corePlayers.length} active players`,
    active: !team.archivedAt,
    targetSquadSize: team.targetSquadSize,
    minAcceptedSquadSize: team.minAcceptedSquadSize,
    maxSquadSize: team.maxSquadSize,
    minCorePlayers: team.minCorePlayers,
    supportPriority: team.supportPriority,
    minSupportPlayers: team.minSupportPlayers,
    developmentSlots: team.developmentSlots,
    footballGroupId: team.footballGroupId,
    footballGroup: { id: team.group.id, name: team.group.name, slug: team.group.slug, type: team.group.type },
    rules,
  };
}

export async function updateTeamConfiguration(
  teamId: string,
  input: {
    name?: string;
    active?: boolean;
    targetSquadSize?: number;
    minAcceptedSquadSize?: number;
    maxSquadSize?: number;
    minCorePlayers?: number;
    supportPriority?: number;
    minSupportPlayers?: number;
    developmentSlots?: number;
    footballGroupId?: string;
  },
  orgFilter?: OrgFilterMode,
): Promise<TeamConfiguration> {
  const orgWhere = orgFilter?.type === "org" ? orgFilter.filter : {};

  if (input.targetSquadSize !== undefined && input.targetSquadSize <= 0) {
    throw new Error("Target squad size must be greater than 0.");
  }

  const existing = await db.team.findUniqueOrThrow({ where: { id: teamId, ...orgWhere }, select: { targetSquadSize: true, minAcceptedSquadSize: true, maxSquadSize: true } });
  const effectiveTarget = input.targetSquadSize ?? existing.targetSquadSize;
  const effectiveMin = input.minAcceptedSquadSize ?? existing.minAcceptedSquadSize;
  const effectiveMax = input.maxSquadSize ?? existing.maxSquadSize;

  if (effectiveMin > effectiveTarget) {
    throw new Error("Min accepted squad size must be <= target squad size.");
  }
  if (effectiveMax < effectiveTarget) {
    throw new Error("Max squad size must be >= target squad size.");
  }

  const data: Record<string, unknown> = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.active === false) data.archivedAt = new Date();
  if (input.active === true) data.archivedAt = null;
  if (input.targetSquadSize !== undefined) data.targetSquadSize = input.targetSquadSize;
  if (input.minAcceptedSquadSize !== undefined) data.minAcceptedSquadSize = input.minAcceptedSquadSize;
  if (input.maxSquadSize !== undefined) data.maxSquadSize = input.maxSquadSize;
  if (input.minCorePlayers !== undefined) data.minCorePlayers = input.minCorePlayers;
  if (input.supportPriority !== undefined) data.supportPriority = input.supportPriority;
  if (input.minSupportPlayers !== undefined) data.minSupportPlayers = input.minSupportPlayers;
  if (input.developmentSlots !== undefined) data.developmentSlots = input.developmentSlots;
  if (input.footballGroupId !== undefined) data.footballGroupId = input.footballGroupId;

  await db.team.update({ where: { id: teamId, ...orgWhere }, data });

  const result = await getTeamConfiguration(teamId, orgFilter);
  if (!result) throw new Error("Team not found after update.");
  return result;
}