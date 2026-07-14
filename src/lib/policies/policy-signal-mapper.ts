import type { PolicyWarning, SelectionPolicyResult, PolicyExplanation } from "./types";
import type { SignalCategory } from "../selection/signal-category";

export type PolicyDerivedSignal = {
  idempotencyKey: string;
  kind: SignalCategory;
  ruleCode: string;
  playerId?: string;
  teamId?: string;
  matchId?: string;
  title: string;
  detail: string;
  source: "policy";
};

export function policyWarningToSignal(
  warning: PolicyWarning,
  matchRoundId: string,
): PolicyDerivedSignal {
  const kind = mapPolicySeverityToCategory(warning.severity);
  const idempotencyKey = buildIdempotencyKey(warning, matchRoundId);

  return {
    idempotencyKey,
    kind,
    ruleCode: warning.code,
    playerId: warning.playerId,
    teamId: warning.teamId,
    matchId: warning.matchId,
    title: warning.message,
    detail: warning.message,
    source: "policy",
  };
}

export function policyExplanationToSignal(
  explanation: PolicyExplanation,
  matchRoundId: string,
): PolicyDerivedSignal {
  const idempotencyKey = `policy-explanation-${matchRoundId}-${explanation.playerId}-${explanation.code}`;

  return {
    idempotencyKey,
    kind: "PLANNING_NOTE",
    ruleCode: explanation.code,
    playerId: explanation.playerId,
    title: explanation.summary,
    detail: explanation.summary,
    source: "policy",
  };
}

export function policyBlockedToSignals(
  policyResult: SelectionPolicyResult,
  matchRoundId: string,
): PolicyDerivedSignal[] {
  const signals: PolicyDerivedSignal[] = [];

  for (const [playerId, reasons] of Object.entries(policyResult.blocked)) {
    for (const reason of reasons) {
      signals.push({
        idempotencyKey: `policy-blocked-${matchRoundId}-${playerId}-${reason}`,
        kind: "BLOCKED",
        ruleCode: reason,
        playerId,
        title: formatBlockedTitle(reason),
        detail: formatBlockedDetail(reason),
        source: "policy",
      });
    }
  }

  return signals;
}

export function policyWarningsToSignals(
  policyResult: SelectionPolicyResult,
  matchRoundId: string,
): PolicyDerivedSignal[] {
  const signals: PolicyDerivedSignal[] = [];

  for (const warning of policyResult.warnings) {
    signals.push(policyWarningToSignal(warning, matchRoundId));
  }

  return signals;
}

export function mergePolicySignals(
  existingSignals: PolicyDerivedSignal[],
  policySignals: PolicyDerivedSignal[],
): PolicyDerivedSignal[] {
  const existingKeys = new Set(existingSignals.map((s) => s.idempotencyKey));
  const newSignals = policySignals.filter((s) => !existingKeys.has(s.idempotencyKey));
  return [...existingSignals, ...newSignals];
}

function mapPolicySeverityToCategory(severity: PolicyWarning["severity"]): SignalCategory {
  switch (severity) {
    case "blocking":
      return "BLOCKED";
    case "warning":
      return "DECISION_REQUIRED";
    case "info":
      return "PLANNING_NOTE";
  }
}

function buildIdempotencyKey(warning: PolicyWarning, matchRoundId: string): string {
  const parts = [
    "policy",
    matchRoundId,
    warning.code,
    warning.playerId ?? "no-player",
    warning.teamId ?? "no-team",
    warning.matchId ?? "no-match",
  ];
  return parts.join("-");
}

function formatBlockedTitle(reason: string): string {
  const titles: Record<string, string> = {
    removed_player_cannot_be_selected: "Player removed from registry",
    inactive_player_cannot_be_selected: "Player inactive",
    unavailable_player_cannot_be_selected: "Player unavailable",
    duplicate_player_in_squad: "Player selected twice",
    blocked_by_custom_policy_tag: "Blocked by custom policy",
  };
  return titles[reason] ?? reason.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

function formatBlockedDetail(reason: string): string {
  const details: Record<string, string> = {
    removed_player_cannot_be_selected: "This player has been removed from the active registry and cannot be selected for planning.",
    inactive_player_cannot_be_selected: "This player is currently inactive and cannot be selected.",
    unavailable_player_cannot_be_selected: "This player is unavailable for this context and cannot be selected.",
    duplicate_player_in_squad: "This player appears twice in the same squad, which is not allowed.",
    blocked_by_custom_policy_tag: "This player is blocked by a custom policy rule.",
  };
  return details[reason] ?? reason.replace(/_/g, " ");
}