// ─────────────────────────────────────────────────────────────────
// Shared team-composition domain contract (v1)
//
// This module defines the stable, versioned contract for the
// team-composition engine. It is used by both event-squad generation
// and league-team auto-selection.
//
// Domain types must NOT depend on Prisma, Next.js, server actions,
// React, or application-specific persistence models.
// ─────────────────────────────────────────────────────────────────

// ── Context and scenario ──────────────────────────────────────

export type TeamCompositionContext = "EVENT_SQUADS" | "LEAGUE_TEAMS";

export type SystemTeamScenario =
  | "PRESERVE_AND_REPAIR"
  | "BALANCED"
  | "ONE_STRONG_REST_BALANCED"
  | "TIERED_DESCENDING";

// ── Position and structural roles ───────────────────────────────

export type StructuralRole =
  | "GOALKEEPER"
  | "DEFENCE"
  | "MIDFIELD"
  | "ATTACK"
  | "FLEXIBLE";

export const STRUCTURAL_ROLES: readonly StructuralRole[] = [
  "GOALKEEPER",
  "DEFENCE",
  "MIDFIELD",
  "ATTACK",
  "FLEXIBLE",
] as const;

export type PositionFitTier = "PRIMARY" | "SECONDARY" | "TERTIARY" | "NO_FIT";

export const FIT_TIER_PRIORITY: Record<PositionFitTier, number> = {
  PRIMARY: 4,
  SECONDARY: 3,
  TERTIARY: 2,
  NO_FIT: 1,
};

export const FIT_TIER_LABELS: Record<PositionFitTier, string> = {
  PRIMARY: "Primary",
  SECONDARY: "Secondary",
  TERTIARY: "Tertiary",
  NO_FIT: "No fit",
};

export type BroadPosition = "goalkeeper" | "defender" | "midfielder" | "forward" | "flexible";

export const BROAD_POSITIONS: readonly BroadPosition[] = [
  "goalkeeper",
  "defender",
  "midfielder",
  "forward",
  "flexible",
];

export const STRUCTURAL_ROLE_TO_BROAD_POSITION: Record<StructuralRole, BroadPosition> = {
  GOALKEEPER: "goalkeeper",
  DEFENCE: "defender",
  MIDFIELD: "midfielder",
  ATTACK: "forward",
  FLEXIBLE: "flexible",
};

export const BROAD_POSITION_TO_STRUCTURAL_ROLE: Record<BroadPosition, StructuralRole> = {
  goalkeeper: "GOALKEEPER",
  defender: "DEFENCE",
  midfielder: "MIDFIELD",
  forward: "ATTACK",
  flexible: "FLEXIBLE",
};

// ── Position suitability ────────────────────────────────────────

export interface RoleSuitabilityProfile {
  /** Fit tier for each structural role */
  goalkeeper: PositionFitTier;
  defence: PositionFitTier;
  midfield: PositionFitTier;
  attack: PositionFitTier;
  flexible: PositionFitTier;
}

// ── Players ─────────────────────────────────────────────────────

export interface CompositionPlayer {
  id: string;
  displayName: string;
  shirtNumber?: number;
  overallStrength: number;
  /** Null means not rated — treat as uncertainty, not zero */
  overallStrengthRated: boolean;
  currentTeamId?: string;
  available: boolean;
  active: boolean;
  goalkeeperAbility: "YES" | "EMERGENCY" | "NO";
  roleSuitability: RoleSuitabilityProfile;
  /** Primary broad position for sorting and fallback */
  primaryBroadPosition: BroadPosition;
  /** Composite strength per structural role (null = not computable) */
  roleStrength: RoleStrengthProfile;
}

export interface RoleStrengthProfile {
  goalkeeper: number | null;
  defence: number | null;
  midfield: number | null;
  attack: number | null;
  flexible: number | null;
}

// ── Target teams ────────────────────────────────────────────────

export interface CompositionTargetTeam {
  id: string;
  name: string;
  targetSize: number;
  minimumSize: number;
  maximumSize: number;
  formationId?: string;
  /** For tiered scenarios: 1 = strongest, higher = weaker */
  rank?: number;
}

// ── Formation / structure ──────────────────────────────────────

export interface StructuralSlotRequirement {
  role: StructuralRole;
  /** How many players needed for this role */
  count: number;
  /** Which broad positions are accepted */
  acceptedPositions: BroadPosition[];
  label: string;
}

export interface TeamStructuralRequirements {
  /** Ordered slot requirements (GK first, then defence, midfield, attack, flexible) */
  slots: StructuralSlotRequirement[];
  /** Whether goalkeeper coverage is mandatory */
  requireGoalkeeper: boolean;
  /** Source of these requirements */
  source: "FORMATION" | "FALLBACK" | "MANUAL";
  formationId?: string;
  formationName?: string;
}

// ── Locked assignments ──────────────────────────────────────────

export interface LockedCompositionAssignment {
  playerId: string;
  teamId: string;
  /** Why this assignment is locked (e.g. "Coach locked", "Existing assignment") */
  reason: string;
}

// ── Input ────────────────────────────────────────────────────────

export interface ResolvedTeamScenario {
  code: SystemTeamScenario;
  version: number;
  displayName: string;
  description: string;
  strengthProfile:
    | BalancedStrengthProfile
    | OneStrongStrengthProfile
    | TieredStrengthProfile
    | PreserveAndRepairProfile;
  structuralRules: StructuralRuleConfiguration;
  objectives: ScenarioObjectiveConfiguration;
}

export interface BalancedStrengthProfile {
  type: "BALANCED";
}

export interface OneStrongStrengthProfile {
  type: "ONE_STRONG_REST_BALANCED";
  /** Which team receives the strength advantage (by rank or id) */
  strongTeamRank: number;
}

export interface TieredStrengthProfile {
  type: "TIERED_DESCENDING";
}

export interface PreserveAndRepairProfile {
  type: "PRESERVE_AND_REPAIR";
}

export interface StructuralRuleConfiguration {
  /** Roles that must be filled before flexible assignment */
  rolePriority: StructuralRole[];
  /** Whether goalkeeper coverage is strictly required */
  requireGoalkeeper: boolean;
  /** Maximum percentage of tertiary-position assignments before flagging */
  maxTertiaryPositionPercentage: number;
  /** Maximum percentage of no-fit assignments before blocking */
  maxNoFitPercentage: number;
  /** Whether a single-player role dependency should generate a warning */
  warnOnSinglePlayerRoleDependency: boolean;
}

export interface ScenarioObjectiveConfiguration {
  /** Maximum spread of average overall strength between teams (null = no limit) */
  maxOverallSpread: number | null;
  /** Maximum spread of average defensive strength between teams */
  maxDefensiveSpread: number | null;
  /** Maximum spread of average midfield strength between teams */
  maxMidfieldSpread: number | null;
  /** Maximum spread of average attacking strength between teams */
  maxAttackingSpread: number | null;
  /** Maximum spread of squad sizes between teams */
  maxSizeSpread: number | null;
  /** For ONE_STRONG: target strength gap as a ratio (strong team avg / weak team avg) */
  strongTeamTargetGap: number | null;
  /** Minimum number of moves for PRESERVE_AND_REPAIR before considering a change */
  minimumMovesForRepair: number;
  /** Whether to prioritise continuity (keeping players on current teams) */
  continuityWeight: number;
}

// ── Problem definition ──────────────────────────────────────────

export interface TeamCompositionProblem {
  contractVersion: 1;
  context: TeamCompositionContext;
  scenario: ResolvedTeamScenario;
  players: CompositionPlayer[];
  targetTeams: CompositionTargetTeam[];
  lockedAssignments: LockedCompositionAssignment[];
  structure: TeamStructuralRequirements;
  /** Seed for deterministic reproducibility */
  deterministicSeed: string;
}

// ── Proposal output ──────────────────────────────────────────────

export type AssignmentSource = "LOCKED" | "PRESERVED" | "STRUCTURAL_ROLE" | "BALANCE_FILL" | "SCENARIO_DISTRIBUTION" | "MANUAL";

export type ProposalSeverity = "BLOCKED" | "DECISION_REQUIRED" | "PLANNING_NOTE";

export interface ProposedTeamAssignment {
  playerId: string;
  teamId: string;
  assignedRole: StructuralRole;
  assignedBroadPosition: BroadPosition;
  positionFit: PositionFitTier;
  source: AssignmentSource;
  selectionReason: string;
  overallStrength: number;
  isGoalkeeper: boolean;
}

export interface ProposedTeamMetrics {
  teamId: string;
  teamName: string;
  squadSize: number;
  averageOverall: number | null;
  goalkeeperCoverage: "full" | "emergency" | "none";
  goalkeeperQuality: number | null;
  defensiveStrength: number | null;
  midfieldStrength: number | null;
  attackingStrength: number | null;
  primaryPositionCount: number;
  secondaryPositionCount: number;
  tertiaryPositionCount: number;
  noFitCount: number;
  flexiblePlayerCount: number;
  playersMovedFromCurrentTeam: number;
  formationViability: "viable" | "degraded" | "broken";
  structuralWarnings: string[];
}

export interface ProposalMetrics {
  overallSpread: number | null;
  defensiveSpread: number | null;
  midfieldSpread: number | null;
  attackingSpread: number | null;
  sizeSpread: number;
  totalPlayersMoved: number;
  averageTeamSize: number;
}

export interface ProposalValidation {
  valid: boolean;
  blockingIssues: ProposalIssue[];
  warnings: ProposalIssue[];
  notes: ProposalIssue[];
}

export interface ProposalIssue {
  severity: ProposalSeverity;
  code: string;
  message: string;
  affectedPlayerIds?: string[];
  affectedTeamIds?: string[];
}

export interface ProposalExplanation {
  playerId: string;
  teamId: string;
  code: string;
  message: string;
  severity: ProposalSeverity;
}

export interface TeamCompositionProposal {
  assignments: ProposedTeamAssignment[];
  teamMetrics: ProposedTeamMetrics[];
  proposalMetrics: ProposalMetrics;
  validation: ProposalValidation;
  explanations: ProposalExplanation[];
  scenarioCode: SystemTeamScenario;
  scenarioVersion: number;
  deterministicSeed: string;
  /** Fingerprint of inputs for stale-proposal detection */
  inputFingerprint: string;
}