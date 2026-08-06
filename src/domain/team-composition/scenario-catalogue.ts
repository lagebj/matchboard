// ─────────────────────────────────────────────────────────────────
// Scenario catalogue: four system scenarios for team composition.
//
// System scenarios are versioned, immutable definitions that control
// how the composition engine distributes players across teams.
// Future layers (organisation, group) may modify resolved scenario
// parameters, but system scenarios are not editable at runtime.
// ─────────────────────────────────────────────────────────────────

import type {
  SystemTeamScenario,
  ResolvedTeamScenario,
  StructuralRuleConfiguration,
  ScenarioObjectiveConfiguration,
} from "./team-composition-types";

export const SCENARIO_VERSION = 1;

const DEFAULT_STRUCTURAL_RULES: StructuralRuleConfiguration = {
  rolePriority: ["GOALKEEPER", "DEFENCE", "MIDFIELD", "ATTACK", "FLEXIBLE"],
  requireGoalkeeper: true,
  maxTertiaryPositionPercentage: 40,
  maxNoFitPercentage: 0,
  warnOnSinglePlayerRoleDependency: true,
};

const DEFAULT_OBJECTIVES: ScenarioObjectiveConfiguration = {
  maxOverallSpread: null,
  maxDefensiveSpread: null,
  maxMidfieldSpread: null,
  maxAttackingSpread: null,
  maxSizeSpread: 2,
  strongTeamTargetGap: null,
  minimumMovesForRepair: 1,
  continuityWeight: 0.5,
};

export const SYSTEM_SCENARIOS: Record<SystemTeamScenario, ResolvedTeamScenario> = {
  PRESERVE_AND_REPAIR: {
    code: "PRESERVE_AND_REPAIR",
    version: SCENARIO_VERSION,
    displayName: "Preserve teams and repair balance",
    description: "Keep current team assignments and only move players to fix structural issues like missing goalkeeper coverage, broken formations, or invalid squad sizes. Minimise the number of moved players.",
    strengthProfile: { type: "PRESERVE_AND_REPAIR" },
    structuralRules: {
      ...DEFAULT_STRUCTURAL_RULES,
      requireGoalkeeper: true,
    },
    objectives: {
      ...DEFAULT_OBJECTIVES,
      continuityWeight: 0.8,
      minimumMovesForRepair: 1,
      maxSizeSpread: 2,
    },
  },
  BALANCED: {
    code: "BALANCED",
    version: SCENARIO_VERSION,
    displayName: "Balanced teams",
    description: "Create teams that are balanced both overall and by structural unit (defence, midfield, attack). Distribute strong players within each role across teams rather than grouping them together.",
    strengthProfile: { type: "BALANCED" },
    structuralRules: {
      ...DEFAULT_STRUCTURAL_RULES,
      requireGoalkeeper: true,
    },
    objectives: {
      ...DEFAULT_OBJECTIVES,
      maxOverallSpread: 1.0,
      maxDefensiveSpread: 1.5,
      maxMidfieldSpread: 1.5,
      maxAttackingSpread: 1.5,
      maxSizeSpread: 2,
      continuityWeight: 0.3,
    },
  },
  ONE_STRONG_REST_BALANCED: {
    code: "ONE_STRONG_REST_BALANCED",
    version: SCENARIO_VERSION,
    displayName: "One stronger team, remaining teams balanced",
    description: "Create one intentionally stronger team that is strong across a viable football structure (not just overall rating). The remaining teams stay balanced against each other and structurally viable.",
    strengthProfile: { type: "ONE_STRONG_REST_BALANCED", strongTeamRank: 1 },
    structuralRules: {
      ...DEFAULT_STRUCTURAL_RULES,
      requireGoalkeeper: true,
    },
    objectives: {
      ...DEFAULT_OBJECTIVES,
      maxOverallSpread: null,
      maxDefensiveSpread: null,
      maxMidfieldSpread: null,
      maxAttackingSpread: null,
      maxSizeSpread: 2,
      strongTeamTargetGap: 1.15,
      continuityWeight: 0.2,
    },
  },
  TIERED_DESCENDING: {
    code: "TIERED_DESCENDING",
    version: SCENARIO_VERSION,
    displayName: "Tiered competitive teams",
    description: "Create teams in descending competitive strength. Team 1 is strongest across all structural units, Team 2 next, and so on. Every team remains structurally viable. This scenario is policy-gated.",
    strengthProfile: { type: "TIERED_DESCENDING" },
    structuralRules: {
      ...DEFAULT_STRUCTURAL_RULES,
      requireGoalkeeper: true,
      warnOnSinglePlayerRoleDependency: true,
    },
    objectives: {
      ...DEFAULT_OBJECTIVES,
      maxOverallSpread: null,
      maxDefensiveSpread: null,
      maxMidfieldSpread: null,
      maxAttackingSpread: null,
      maxSizeSpread: 2,
      continuityWeight: 0.1,
    },
  },
};

export function getSystemScenario(code: SystemTeamScenario): ResolvedTeamScenario {
  return SYSTEM_SCENARIOS[code];
}

export function getAllSystemScenarios(): ResolvedTeamScenario[] {
  return Object.values(SYSTEM_SCENARIOS);
}

export function isScenarioPolicyGated(code: SystemTeamScenario): boolean {
  return code === "TIERED_DESCENDING";
}