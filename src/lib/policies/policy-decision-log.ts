import { getActivePackId, loadPackMetadata } from "./policy-pack";
import { getPolicyRuntimeDiagnostics } from "./policy-runtime";
import { getPolicyArtifactHash, getPolicyVersion } from "./policy-version";
import type { SelectionPolicyResult } from "./types";

export type PolicyDecisionSummary = {
  decisionType: string;
  policyRuntime: "default+rego";
  policyRuntimeStatus: "HEALTHY" | "DEGRADED";
  policyVersion: string;
  policyArtifactHash: string | null;
  packFailureMode: string | null;
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
  const metadata = loadPackMetadata(getActivePackId());

  return {
    decisionType,
    policyRuntime: "default+rego",
    policyRuntimeStatus: getPolicyRuntimeDiagnostics().status,
    policyVersion: getPolicyVersion(),
    policyArtifactHash: getPolicyArtifactHash(),
    packFailureMode: metadata?.failureMode ?? null,
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
