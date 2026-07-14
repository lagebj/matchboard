import type { SelectionPolicyInput, SelectionPolicyResult, PolicyWarning, PolicyExplanation } from "./types";
import { createPolicyPipeline } from "./selection-policy-adapter";
import { isRegoEnabled, getRegoFailureMode } from "./rego-policy-adapter";

export type PolicyEvaluationResult = {
  result: SelectionPolicyResult;
  input: SelectionPolicyInput;
  regoEnabled: boolean;
  regoFailureMode: string;
  evaluationDurationMs: number;
};

export type PolicyWarningSummary = {
  blockedPlayerIds: string[];
  blockedReasons: Record<string, string[]>;
  warningCodes: string[];
  scoreAdjustmentCount: number;
  explanationCount: number;
};

export function mapPolicyWarningToCategory(warning: PolicyWarning): "BLOCKED" | "DECISION_REQUIRED" | "PLANNING_NOTE" {
  switch (warning.severity) {
    case "blocking":
      return "BLOCKED";
    case "warning":
      return "DECISION_REQUIRED";
    case "info":
      return "PLANNING_NOTE";
  }
}

export function coachFacingBlockedReason(rule: string): string {
  const reasons: Record<string, string> = {
    removed_player_cannot_be_selected: "Player is no longer in the active registry.",
    inactive_player_cannot_be_selected: "Player is currently inactive.",
    unavailable_player_cannot_be_selected: "Player is unavailable for this match.",
    duplicate_player_in_squad: "Player is already selected for this squad.",
    blocked_by_custom_policy_tag: "Blocked by custom policy.",
  };
  return reasons[rule] ?? rule.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

export function coachFacingWarningMessage(warning: PolicyWarning): string {
  return warning.message;
}

export function summarizePolicyResult(result: SelectionPolicyResult): PolicyWarningSummary {
  return {
    blockedPlayerIds: Object.keys(result.blocked),
    blockedReasons: result.blocked,
    warningCodes: result.warnings.map((w) => w.code),
    scoreAdjustmentCount: result.scoreAdjustments.length,
    explanationCount: result.explanations.length,
  };
}

export async function evaluateSelectionPolicy(
  input: SelectionPolicyInput,
): Promise<PolicyEvaluationResult> {
  const start = Date.now();
  const regoEnabled = isRegoEnabled();
  const regoFailureMode = getRegoFailureMode();

  const pipeline = createPolicyPipeline();
  const result = await pipeline.evaluate(input);
  const evaluationDurationMs = Date.now() - start;

  return {
    result,
    input,
    regoEnabled,
    regoFailureMode,
    evaluationDurationMs,
  };
}

export function filterBlockedPlayerIds(
  playerIds: string[],
  policyResult: SelectionPolicyResult,
): string[] {
  const blockedSet = new Set(Object.keys(policyResult.blocked));
  return playerIds.filter((id) => !blockedSet.has(id));
}

export function applyScoreAdjustments(
  scores: Record<string, number>,
  adjustments: SelectionPolicyResult["scoreAdjustments"],
  minDelta: number = -20,
  maxDelta: number = 20,
): Record<string, number> {
  const result = { ...scores };
  for (const adj of adjustments) {
    const clampedDelta = Math.max(minDelta, Math.min(maxDelta, adj.delta));
    result[adj.playerId] = (result[adj.playerId] ?? 0) + clampedDelta;
  }
  return result;
}

export function policyExplanationToCoachFacing(
  explanation: PolicyExplanation,
): string {
  return explanation.summary;
}

export function policyBlockedReasonsForPlayer(
  playerId: string,
  policyResult: SelectionPolicyResult,
): string[] {
  return policyResult.blocked[playerId] ?? [];
}

export function policyWarningsForPlayer(
  playerId: string,
  policyResult: SelectionPolicyResult,
): PolicyWarning[] {
  return policyResult.warnings.filter((w) => w.playerId === playerId);
}

export function policyWarningsForTeam(
  teamId: string,
  policyResult: SelectionPolicyResult,
): PolicyWarning[] {
  return policyResult.warnings.filter((w) => w.teamId === teamId);
}

export function policyWarningsForMatch(
  matchId: string,
  policyResult: SelectionPolicyResult,
): PolicyWarning[] {
  return policyResult.warnings.filter((w) => w.matchId === matchId);
}