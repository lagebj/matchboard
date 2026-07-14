export type {
  PolicyMode,
  PolicyDecisionType,
  PolicyFairnessScope,
  PolicyPeriod,
  PolicyDecisionPhase,
  PolicyPlayerStatus,
  PolicyPlayer,
  PolicyTeam,
  PolicySquad,
  PolicyMatch,
  PolicyHistory,
  PolicyConstraints,
  PolicyCandidateSelection,
  SelectionPolicyInput,
  PolicyWarningSeverity,
  PolicyWarning,
  PolicyScoreAdjustment,
  PolicyExplanation,
  PolicyTag,
  SelectionPolicyResult,
} from "./types";

export {
  checkCoreInvariants,
  applyCoreInvariants,
  type CoreInvariantViolation,
} from "./core-invariants";

export {
  evaluateDefaultMatchboardPolicy,
} from "./default-matchboard-policy";

export {
  DefaultMatchboardPolicyAdapter,
  CompositePolicyAdapter,
  createPolicyPipeline,
} from "./selection-policy-adapter";

export type { SelectionPolicyAdapter } from "./selection-policy-adapter";

export {
  RegoPolicyAdapter,
  RegoPolicyError,
  isRegoEnabled,
  getRegoFailureMode,
  clearRegoPolicyCache,
} from "./rego-policy-adapter";

export { buildPolicyInput, mapPlayerStatus } from "./build-policy-input";

export {
  evaluateSelectionPolicy,
  filterBlockedPlayerIds,
  applyScoreAdjustments,
  policyExplanationToCoachFacing,
  policyBlockedReasonsForPlayer,
  policyWarningsForPlayer,
  policyWarningsForTeam,
  policyWarningsForMatch,
  mapPolicyWarningToCategory,
  coachFacingBlockedReason,
  coachFacingWarningMessage,
  summarizePolicyResult,
  type PolicyEvaluationResult,
  type PolicyWarningSummary,
} from "./policy-evaluation";

export {
  policyWarningToSignal,
  policyExplanationToSignal,
  policyBlockedToSignals,
  policyWarningsToSignals,
  mergePolicySignals,
  type PolicyDerivedSignal,
} from "./policy-signal-mapper";

export {
  getPolicyArtifactHash,
  getPolicyVersion,
  clearPolicyHashCache,
} from "./policy-version";

export {
  buildDecisionSummary,
  type PolicyDecisionSummary,
} from "./policy-decision-log";