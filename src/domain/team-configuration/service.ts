import type { TeamConfiguration, TeamRuleConfiguration } from "./types";
import { db } from "@/lib/db";

const KNOWN_RULES: TeamRuleConfiguration[] = [
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
    description: "Player load is tracked across the planning period to balance selections.",
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

export async function getTeamConfiguration(teamId: string): Promise<TeamConfiguration | null> {
  const team = await db.team.findUnique({
    where: { id: teamId },
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
    maxSquadSize: team.maxSquadSize,
    supportPriority: team.supportPriority,
    rules,
  };
}

export async function updateTeamConfiguration(
  teamId: string,
  input: {
    name?: string;
    active?: boolean;
    targetSquadSize?: number;
    maxSquadSize?: number;
    supportPriority?: number;
  },
): Promise<TeamConfiguration> {
  if (input.targetSquadSize !== undefined && input.targetSquadSize <= 0) {
    throw new Error("Target squad size must be greater than 0.");
  }
  if (input.maxSquadSize !== undefined && input.targetSquadSize !== undefined && input.maxSquadSize < input.targetSquadSize) {
    throw new Error("Max squad size must be >= target squad size.");
  }
  if (input.maxSquadSize !== undefined && input.targetSquadSize === undefined) {
    const team = await db.team.findUniqueOrThrow({ where: { id: teamId }, select: { targetSquadSize: true } });
    if (input.maxSquadSize < team.targetSquadSize) {
      throw new Error("Max squad size must be >= target squad size.");
    }
  }

  const data: Record<string, unknown> = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.active === false) data.archivedAt = new Date();
  if (input.active === true) data.archivedAt = null;
  if (input.targetSquadSize !== undefined) data.targetSquadSize = input.targetSquadSize;
  if (input.maxSquadSize !== undefined) data.maxSquadSize = input.maxSquadSize;
  if (input.supportPriority !== undefined) data.supportPriority = input.supportPriority;

  await db.team.update({ where: { id: teamId }, data });

  const result = await getTeamConfiguration(teamId);
  if (!result) throw new Error("Team not found after update.");
  return result;
}