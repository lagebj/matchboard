import type {
  SelectionPolicyInput,
  SelectionPolicyResult,
  PolicyWarning,
  PolicyScoreAdjustment,
  PolicyExplanation,
} from "./types";
import { applyCoreInvariants } from "./core-invariants";

export function evaluateDefaultMatchboardPolicy(
  input: SelectionPolicyInput,
): SelectionPolicyResult {
  const coreResult = applyCoreInvariants(input);
  const blocked = { ...coreResult.blocked };
  const warnings: PolicyWarning[] = [...coreResult.warnings];
  const scoreAdjustments: PolicyScoreAdjustment[] = [
    ...coreResult.scoreAdjustments,
  ];
  const explanations: PolicyExplanation[] = [...coreResult.explanations];
  // allowedSet used for reference; core invariants already computed allowed list

  for (const player of input.players) {
    if (player.availableForContext && player.status === "ACTIVE" && !blocked[player.id]) {
      explanations.push({
        playerId: player.id,
        code: "eligible_active_available",
        summary: "Eligible: active, available, and no conflicts.",
        hardRule: false,
      });
    }
  }

  for (const squad of input.squads) {
    if (squad.primaryGoalkeeperCount === 0) {
      const anyGK = squad.anyGoalkeeperCount > 0;
      const code = anyGK
        ? "no_primary_goalkeeper_tertiary_only"
        : "no_goalkeeper_coverage";
      const severity: PolicyWarning["severity"] = anyGK ? "warning" : "blocking";
      const message = anyGK
        ? "Squad has no primary goalkeeper; only emergency or tertiary coverage."
        : "Squad has no goalkeeper coverage at all.";

      warnings.push({
        code,
        severity,
        message,
        teamId: squad.teamId ?? undefined,
      });
    }

    const team = input.teams.find((t) => t.id === squad.teamId);
    if (team?.minSquadSize && squad.playerIdList.length < team.minSquadSize) {
      warnings.push({
        code: "squad_below_minimum",
        severity: "blocking",
        message: `Squad has ${squad.playerIdList.length} players but minimum is ${team.minSquadSize}.`,
        teamId: squad.teamId ?? undefined,
      });
    }
  }

  for (const player of input.players) {
    if (player.availableForContext && !blocked[player.id]) {
      const recent = player.recentMatchCount ?? 0;
      const period = player.periodMatchCount ?? 0;
      const season = player.seasonMatchCount ?? 0;

      if (recent <= 1) {
        scoreAdjustments.push({
          playerId: player.id,
          delta: 5,
          reason: "Player has had fewer recent match opportunities.",
          code: "low_recent_match_count",
        });
      }

      if (period <= 1) {
        scoreAdjustments.push({
          playerId: player.id,
          delta: 3,
          reason: "Player has had fewer period match opportunities.",
          code: "low_period_match_count",
        });
      }

      if (season <= 2) {
        scoreAdjustments.push({
          playerId: player.id,
          delta: 2,
          reason: "Player has had fewer season match opportunities.",
          code: "low_season_match_count",
        });
      }
    }
  }

  for (const match of input.matches) {
    if (match.isCancelled) {
      warnings.push({
        code: "match_cancelled",
        severity: "info",
        message: "Match is cancelled and excluded from planning.",
        matchId: match.id,
      });
    }
  }

  const allBlockedIds = new Set(Object.keys(blocked));
  const allowedPlayerIds = input.players
    .filter((p) => !allBlockedIds.has(p.id))
    .map((p) => p.id);

  return {
    allowedPlayerIds,
    blocked,
    warnings,
    scoreAdjustments,
    explanations,
    tags: coreResult.tags,
  };
}