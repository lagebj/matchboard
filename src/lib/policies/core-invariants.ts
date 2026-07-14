import type { SelectionPolicyInput, SelectionPolicyResult } from "./types";

export type CoreInvariantViolation = {
  playerId: string;
  rule: string;
  reason: string;
};

export function checkCoreInvariants(
  input: SelectionPolicyInput,
): CoreInvariantViolation[] {
  const violations: CoreInvariantViolation[] = [];

  for (const player of input.players) {
    if (player.status === "REMOVED") {
      violations.push({
        playerId: player.id,
        rule: "removed_player_cannot_be_selected",
        reason: "Removed players cannot be selected for active planning.",
      });
    }

    if (player.status === "INACTIVE") {
      violations.push({
        playerId: player.id,
        rule: "inactive_player_cannot_be_selected",
        reason: "Inactive players cannot be selected.",
      });
    }

    if (
      !player.availableForContext &&
      player.status !== "REMOVED" &&
      player.status !== "INACTIVE"
    ) {
      const reason = player.unavailableReason
        ? `Unavailable for this context: ${player.unavailableReason}.`
        : "Unavailable for this context.";
      violations.push({
        playerId: player.id,
        rule: "unavailable_player_cannot_be_selected",
        reason,
      });
    }
  }

  for (const squad of input.squads) {
    const seenPlayerIds = new Set<string>();
    for (const playerId of squad.playerIdList) {
      if (seenPlayerIds.has(playerId)) {
        const player = input.players.find((p) => p.id === playerId);
        violations.push({
          playerId,
          rule: "duplicate_player_in_squad",
          reason: `Player${player ? ` ${player.displayName}` : ""} appears twice in the same squad.`,
        });
      }
      seenPlayerIds.add(playerId);
    }
  }

  return violations;
}

export function applyCoreInvariants(
  input: SelectionPolicyInput,
): SelectionPolicyResult {
  const violations = checkCoreInvariants(input);
  const blocked: Record<string, string[]> = {};
  const explanations: SelectionPolicyResult["explanations"] = [];

  for (const v of violations) {
    if (!blocked[v.playerId]) {
      blocked[v.playerId] = [];
    }
    blocked[v.playerId].push(v.rule);
    explanations.push({
      playerId: v.playerId,
      code: v.rule,
      summary: v.reason,
      hardRule: true,
      source: "core",
    });
  }

  const allPlayerIds = input.players.map((p) => p.id);
  const blockedIds = new Set(Object.keys(blocked));
  const allowedPlayerIds = allPlayerIds.filter((id) => !blockedIds.has(id));

  return {
    allowedPlayerIds,
    blocked,
    warnings: [],
    scoreAdjustments: [],
    explanations,
    tags: [],
  };
}
