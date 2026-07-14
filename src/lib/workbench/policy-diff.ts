import type { SelectionPolicyResult, PolicyWarning, PolicyScoreAdjustment, PolicyExplanation, PolicyMode, PolicyDecisionType, PolicyFairnessScope } from "@/lib/policies/types";
import type { WorkbenchInputSummary } from "./workbench-types";

export type PolicyDiff = {
  blockedAddedByRego: Record<string, string[]>;
  warningsAddedByRego: { code: string; severity: string; message: string; playerId?: string }[];
  scoreAdjustmentsAddedByRego: { playerId: string; delta: number; reason: string; code: string }[];
  explanationsAddedByRego: { playerId: string; code: string; summary: string }[];
  validityChanged: boolean;
  wasValidDefaultOnly: boolean;
  isValidWithRego: boolean;
};

export function diffPolicyResults(
  defaultOnly: SelectionPolicyResult,
  withRego: SelectionPolicyResult,
): PolicyDiff {
  const defaultBlockedIds = new Set(Object.keys(defaultOnly.blocked));

  const blockedAddedByRego: Record<string, string[]> = {};
  for (const [playerId, reasons] of Object.entries(withRego.blocked)) {
    if (!defaultBlockedIds.has(playerId)) {
      blockedAddedByRego[playerId] = reasons;
    } else {
      const defaultReasons = defaultOnly.blocked[playerId] ?? [];
      const newReasons = reasons.filter((r) => !defaultReasons.includes(r));
      if (newReasons.length > 0) {
        blockedAddedByRego[playerId] = newReasons;
      }
    }
  }

  const defaultWarningKeys = new Set(defaultOnly.warnings.map(warningKey));
  const warningsAddedByRego = withRego.warnings
    .filter((w) => !defaultWarningKeys.has(warningKey(w)))
    .map((w) => ({
      code: w.code,
      severity: w.severity,
      message: w.message,
      playerId: w.playerId,
    }));

  const defaultAdjKeys = new Set(
    defaultOnly.scoreAdjustments.map((a) => adjustmentKey(a)),
  );
  const scoreAdjustmentsAddedByRego = withRego.scoreAdjustments
    .filter((a) => !defaultAdjKeys.has(adjustmentKey(a)))
    .map((a) => ({
      playerId: a.playerId,
      delta: a.delta,
      reason: a.reason,
      code: a.code,
    }));

  const defaultExpKeys = new Set(
    defaultOnly.explanations.map((e) => explanationKey(e)),
  );
  const explanationsAddedByRego = withRego.explanations
    .filter((e) => !defaultExpKeys.has(explanationKey(e)))
    .map((e) => ({
      playerId: e.playerId,
      code: e.code,
      summary: e.summary,
    }));

  const wasValidDefaultOnly = defaultOnly.warnings.every(
    (w) => w.severity !== "blocking",
  );
  const isValidWithRego = withRego.warnings.every(
    (w) => w.severity !== "blocking",
  );

  return {
    blockedAddedByRego,
    warningsAddedByRego,
    scoreAdjustmentsAddedByRego,
    explanationsAddedByRego,
    validityChanged: wasValidDefaultOnly !== isValidWithRego,
    wasValidDefaultOnly,
    isValidWithRego,
  };
}

function warningKey(w: PolicyWarning): string {
  return `${w.code}:${w.severity}:${w.playerId ?? ""}:${w.teamId ?? ""}:${w.matchId ?? ""}`;
}

function adjustmentKey(a: PolicyScoreAdjustment): string {
  return `${a.playerId}:${a.code}:${a.delta}`;
}

function explanationKey(e: PolicyExplanation): string {
  return `${e.playerId}:${e.code}`;
}

export function summarizeInput(input: {
  players: { id: string; availableForContext: boolean; status: string }[];
  teams: { id: string }[];
  squads: { id: string; playerIdList: string[] }[];
  matches: { id: string; isCancelled: boolean }[];
  context: { mode: PolicyMode; decisionType: PolicyDecisionType; fairnessScope?: PolicyFairnessScope; generationMode?: string };
}): WorkbenchInputSummary {
  const availableCount = input.players.filter(
    (p) => p.availableForContext && p.status === "ACTIVE",
  ).length;

  return {
    playerCount: input.players.length,
    teamCount: input.teams.length,
    squadCount: input.squads.length,
    matchCount: input.matches.filter((m) => !m.isCancelled).length,
    availablePlayerCount: availableCount,
    blockedPlayerCount: 0,
    contextMode: input.context.mode,
    decisionType: input.context.decisionType,
    fairnessScope: input.context.fairnessScope,
    generationMode: input.context.generationMode,
  };
}