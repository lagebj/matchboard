import { isRegoEnabled, getRegoFailureMode } from "./rego-policy-adapter";
import { getPolicyArtifactHash, getPolicyVersion } from "./policy-version";
import type { SelectionPolicyResult } from "./types";

export type PolicyDecisionSummary = {
  decisionType: string;
  policyRuntime: string;
  policyVersion: string;
  policyArtifactHash: string | null;
  regoEnabled: boolean;
  regoFailureMode: string;
  blockedCount: number;
  warningCodes: string[];
  scoreAdjustmentCount: number;
  explanationCount: number;
  relatedEventId?: string;
  relatedEventMatchId?: string;
  relatedLeagueMatchId?: string;
  relatedTeamId?: string;
  evaluationDurationMs?: number;
};

export function buildDecisionSummary(
  decisionType: string,
  result: SelectionPolicyResult,
  options?: {
    relatedEventId?: string;
    relatedEventMatchId?: string;
    relatedLeagueMatchId?: string;
    relatedTeamId?: string;
    evaluationDurationMs?: number;
  },
): PolicyDecisionSummary {
  return {
    decisionType,
    policyRuntime: isRegoEnabled() ? "default+rego" : "default",
    policyVersion: getPolicyVersion(),
    policyArtifactHash: getPolicyArtifactHash(),
    regoEnabled: isRegoEnabled(),
    regoFailureMode: getRegoFailureMode(),
    blockedCount: Object.keys(result.blocked).length,
    warningCodes: result.warnings.map((w) => w.code),
    scoreAdjustmentCount: result.scoreAdjustments.length,
    explanationCount: result.explanations.length,
    relatedEventId: options?.relatedEventId,
    relatedEventMatchId: options?.relatedEventMatchId,
    relatedLeagueMatchId: options?.relatedLeagueMatchId,
    relatedTeamId: options?.relatedTeamId,
    evaluationDurationMs: options?.evaluationDurationMs,
  };
}