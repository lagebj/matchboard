export type {
  TeamCompositionContext,
  SystemTeamScenario,
  StructuralRole,
  PositionFitTier,
  RoleSuitabilityProfile,
  RoleStrengthProfile,
  CompositionPlayer,
  CompositionTargetTeam,
  StructuralSlotRequirement,
  TeamStructuralRequirements,
  LockedCompositionAssignment,
  TeamCompositionProblem,
  ResolvedTeamScenario,
  BalancedStrengthProfile,
  OneStrongStrengthProfile,
  TieredStrengthProfile,
  PreserveAndRepairProfile,
  PreserveAndFillProfile,
  StructuralRuleConfiguration,
  ScenarioObjectiveConfiguration,
  AssignmentSource,
  ProposalSeverity,
  ProposedTeamAssignment,
  ProposedTeamMetrics,
  ProposalMetrics,
  ProposalValidation,
  ProposalIssue,
  ProposalExplanation,
  TeamCompositionProposal,
  BroadPosition,
} from "./team-composition-types";

export {
  STRUCTURAL_ROLES,
  FIT_TIER_PRIORITY,
  FIT_TIER_LABELS,
  BROAD_POSITIONS,
  BROAD_POSITION_TO_STRUCTURAL_ROLE,
} from "./team-composition-types";

export {
  mapPositionCodeToBroad,
  getPositionFit,
  getRoleFit,
  computeRoleStrength,
  computePositionScarcity,
  getCandidatesForSlot,
  isGoalkeeperCapable,
  getGkCoverageTier,
  sortByRoleRelevantStrength,
  sortByOverallStrength,
  type PositionScarcity,
} from "./position-suitability";

export {
  getDefaultTargetSize,
  getFallbackStructure,
  getStructureForTeam,
  getDefaultSlotRequirements,
  countRoleRequirements,
  getTotalSlotCount,
  type GameFormat,
  type FormationStructure,
  GAME_FORMAT_PLAYER_COUNT,
} from "./structural-requirements";

export {
  SYSTEM_SCENARIOS,
  SCENARIO_VERSION,
  getSystemScenario,
  getAllSystemScenarios,
  isScenarioPolicyGated,
} from "./scenario-catalogue";

export {
  validateProposal,
  computeTeamMetrics,
  computeProposalMetrics,
  generateExplanations,
  computeInputFingerprint,
} from "./proposal-validation";

export {
  composeTeams,
} from "./deterministic-team-composer";