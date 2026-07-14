import type {

  PolicyConditionGroup,
  PolicyRuleCondition,
  PolicyRule,
  PolicyPack,
  PolicyPlayer,
  PolicyTeam,
  PolicySquad,

  SelectionPolicyInput,
  SelectionPolicyResult,

} from "./types";

function getNestedValue(obj: unknown, path: string): unknown {
  if (obj == null || typeof obj !== "object") return undefined;
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function evaluateCondition(
  condition: PolicyRuleCondition,
  context: Record<string, unknown>,
): boolean {
  const value = getNestedValue(context, condition.field);

  switch (condition.op) {
    case "eq":
      return value === condition.value;
    case "neq":
      return value !== condition.value;
    case "lt":
      return typeof value === "number" && typeof condition.value === "number" && value < condition.value;
    case "lte":
      return typeof value === "number" && typeof condition.value === "number" && value <= condition.value;
    case "gt":
      return typeof value === "number" && typeof condition.value === "number" && value > condition.value;
    case "gte":
      return typeof value === "number" && typeof condition.value === "number" && value >= condition.value;
    case "in":
      return Array.isArray(condition.values) && condition.values.includes(value as string | number);
    case "not_in":
      return Array.isArray(condition.values) && !condition.values.includes(value as string | number);
    case "exists":
      return value !== undefined && value !== null;
    case "not_exists":
      return value === undefined || value === null;
    case "contains":
      return typeof value === "string" && typeof condition.value === "string" && value.includes(condition.value);
    default:
      return false;
  }
}

function evaluateConditionGroup(
  group: PolicyConditionGroup,
  context: Record<string, unknown>,
): boolean {
  if (group.all) {
    return group.all.every((cond) => evaluateCondition(cond, context));
  }
  if (group.any) {
    return group.any.some((cond) => evaluateCondition(cond, context));
  }
  return true;
}

function playerRuleContext(
  player: PolicyPlayer,
  input: SelectionPolicyInput,
): Record<string, unknown> {
  return {
    player: {
      id: player.id,
      displayName: player.displayName,
      status: player.status,
      availableForContext: player.availableForContext,
      unavailableReason: player.unavailableReason ?? null,
      primaryPosition: player.primaryPosition ?? null,
      secondaryPosition: player.secondaryPosition ?? null,
      tertiaryPosition: player.tertiaryPosition ?? null,
      shirtNumber: player.shirtNumber ?? null,
      currentTeamIds: player.currentTeamIds,
      recentMatchCount: player.recentMatchCount ?? 0,
      seasonMatchCount: player.seasonMatchCount ?? 0,
      periodMatchCount: player.periodMatchCount ?? 0,
      goalkeeperAbility: player.goalkeeperAbility ?? null,
      nonRotatable: player.nonRotatable ?? false,
    },
    context: input.context,
    constraints: input.constraints,
  };
}

function teamRuleContext(
  team: PolicyTeam,
  input: SelectionPolicyInput,
): Record<string, unknown> {
  return {
    team: {
      id: team.id,
      name: team.name,
      targetSquadSize: team.targetSquadSize ?? null,
      minSquadSize: team.minSquadSize ?? null,
      maxSquadSize: team.maxSquadSize ?? null,
    },
    context: input.context,
    constraints: input.constraints,
  };
}

function squadRuleContext(
  squad: PolicySquad,
  input: SelectionPolicyInput,
): Record<string, unknown> {
  return {
    squad: {
      id: squad.id,
      name: squad.name ?? null,
      teamId: squad.teamId ?? null,
      playerCount: squad.playerIdList.length,
      primaryGoalkeeperCount: squad.primaryGoalkeeperCount,
      anyGoalkeeperCount: squad.anyGoalkeeperCount,
    },
    context: input.context,
    constraints: input.constraints,
  };
}

function evaluateRuleForEntity(
  rule: PolicyRule,
  entityContext: Record<string, unknown>,
): { matches: boolean; effect: PolicyRule["effect"] } {
  const matches = evaluateConditionGroup(rule.when, entityContext);
  return { matches, effect: rule.effect };
}

export type RuleEvaluationResult = {
  denied: Map<string, string[]>;
  warnings: Array<{ playerId?: string; teamId?: string; warning: SelectionPolicyResult["warnings"][0] }>;
  scoreAdjustments: SelectionPolicyResult["scoreAdjustments"];
  tags: SelectionPolicyResult["tags"];
  explanations: SelectionPolicyResult["explanations"];
};

export function evaluatePolicyPack(
  pack: PolicyPack,
  input: SelectionPolicyInput,
): SelectionPolicyResult {
  const blocked: Record<string, string[]> = {};
  const warnings: SelectionPolicyResult["warnings"] = [];
  const scoreAdjustments: SelectionPolicyResult["scoreAdjustments"] = [];
  const explanations: SelectionPolicyResult["explanations"] = [];
  const tags: SelectionPolicyResult["tags"] = [];

  for (const rule of pack.rules) {
    const playerRuleContexts = input.players.map((p) => ({
      player: p,
      ctx: playerRuleContext(p, input),
    }));

    for (const { player, ctx } of playerRuleContexts) {
      const { matches, effect } = evaluateRuleForEntity(rule, ctx);
      if (!matches) continue;

      switch (effect) {
        case "deny":
          if (!blocked[player.id]) blocked[player.id] = [];
          blocked[player.id].push(rule.id);
          explanations.push({
            playerId: player.id,
            code: rule.id,
            summary: rule.reason ?? `Blocked by policy rule ${rule.id}.`,
            hardRule: false,
          });
          break;

        case "warning":
          warnings.push({
            code: rule.warning?.code ?? rule.id,
            severity: rule.warning?.severity ?? "warning",
            message: rule.warning?.message ?? rule.reason ?? `Warning from policy rule ${rule.id}.`,
            playerId: player.id,
          });
          break;

        case "score_adjustment":
          scoreAdjustments.push({
            playerId: player.id,
            delta: rule.scoreAdjustment ?? 0,
            reason: rule.reason ?? `Score adjustment from policy rule ${rule.id}.`,
            code: rule.id,
          });
          break;

        case "tag":
          tags.push({
            playerId: player.id,
            tag: rule.tag ?? rule.id,
            reason: rule.reason ?? `Tagged by policy rule ${rule.id}.`,
          });
          break;
      }
    }

    for (const squad of input.squads) {
      const ctx = squadRuleContext(squad, input);
      const { matches, effect } = evaluateRuleForEntity(rule, ctx);
      if (!matches) continue;

      if (effect === "warning" && rule.warning) {
        warnings.push({
          code: rule.warning.code,
          severity: rule.warning.severity,
          message: rule.warning.message,
          teamId: squad.teamId ?? undefined,
        });
      }
    }

    for (const team of input.teams) {
      const ctx = teamRuleContext(team, input);
      const { matches, effect } = evaluateRuleForEntity(rule, ctx);
      if (!matches) continue;

      if (effect === "warning" && rule.warning) {
        warnings.push({
          code: rule.warning.code,
          severity: rule.warning.severity,
          message: rule.warning.message,
          teamId: team.id,
        });
      }
    }
  }

  const blockedIds = new Set(Object.keys(blocked));
  const allowedPlayerIds = input.players
    .filter((p) => !blockedIds.has(p.id))
    .map((p) => p.id);

  return {
    allowedPlayerIds,
    blocked,
    warnings,
    scoreAdjustments,
    explanations,
    tags,
  };
}

export { evaluateConditionGroup, evaluateCondition, evaluateRuleForEntity };