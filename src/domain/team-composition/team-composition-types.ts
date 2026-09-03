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
  | "PRESERVE_AND_FILL"
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
  /** Falls back to NEUTRAL_UNRATED_RATING (not 0) when unrated — check overallStrengthRated first. */
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

// ── Outfield role suitability and tactical functions ─────────────────
//
// Evidence-Informed Match Planning, Bundle 5 (ADR-0116). Goalkeeper is
// deliberately excluded from OutfieldStructuralRole at the type level —
// this is the compile-time half of the goalkeeper boundary invariant
// (AGENTS.md "Goalkeeper boundary"): a generic outfield suitability
// calculation can never even express a goalkeeper eligibility claim.

export type OutfieldStructuralRole = Exclude<StructuralRole, "GOALKEEPER">;

export const OUTFIELD_STRUCTURAL_ROLES: readonly OutfieldStructuralRole[] =
  STRUCTURAL_ROLES.filter((role): role is OutfieldStructuralRole => role !== "GOALKEEPER");

/**
 * Reuses the same three-level vocabulary as combination/match-phase/opponent-tendency
 * evidence (`ConfidenceLevel`, `src/lib/evidence/combination-topology.ts`) — declared
 * independently here rather than imported, since `src/domain/team-composition/` must stay free
 * of any dependency on `src/lib/evidence/` (that module imports Prisma's `db`; a type-only
 * import would erase at build time, but the domain layer's own convention — see
 * `league-team-adapter.ts`'s header comment — is to keep this directory decoupled from
 * persistence-layer modules even for types). The two declarations are structurally identical
 * and interchangeable.
 */
export type OutfieldEvidenceConfidence = "INSUFFICIENT" | "EMERGING" | "ESTABLISHED";

export type OutfieldRoleSuitabilityTier = "NATURAL" | "PLAUSIBLE" | "DEVELOPMENTAL" | "UNSUPPORTED";

export const OUTFIELD_ROLE_SUITABILITY_LABELS: Record<OutfieldRoleSuitabilityTier, string> = {
  NATURAL: "Natural",
  PLAUSIBLE: "Plausible",
  DEVELOPMENTAL: "Developmental",
  UNSUPPORTED: "Unsupported",
};

/** Demonstrated realised-position exposure, summarised by outfield role. Derived from the
 * existing I-004 Position & Formation Exposure evidence (`getPositionExposure()`) — never a
 * second position-exposure query. */
export interface OutfieldPositionExposureEvidence {
  matchCountByRole: Partial<Record<OutfieldStructuralRole, number>>;
}

export interface OutfieldRoleSuitabilityResult {
  role: OutfieldStructuralRole;
  tier: OutfieldRoleSuitabilityTier;
  declaredFit: PositionFitTier;
  exposureConfidence: OutfieldEvidenceConfidence;
  exposureMatchCount: number;
  /** Factual, coach-facing rationale — never an opaque score (AGENTS.md Explanation model). */
  explanation: string;
}

export type TacticalFunctionCode =
  | "FIRST_LINE_PRESS"
  | "PACE_IN_BEHIND"
  | "HOLD_UP_LINK_PLAY"
  | "CENTRAL_DEFENSIVE_CONTINUITY"
  | "BALL_PROGRESSION"
  | "WIDTH";

export const TACTICAL_FUNCTION_CODES: readonly TacticalFunctionCode[] = [
  "FIRST_LINE_PRESS",
  "PACE_IN_BEHIND",
  "HOLD_UP_LINK_PLAY",
  "CENTRAL_DEFENSIVE_CONTINUITY",
  "BALL_PROGRESSION",
  "WIDTH",
];

export const TACTICAL_FUNCTION_LABELS: Record<TacticalFunctionCode, string> = {
  FIRST_LINE_PRESS: "First-line press",
  PACE_IN_BEHIND: "Pace in behind",
  HOLD_UP_LINK_PLAY: "Hold-up / link play",
  CENTRAL_DEFENSIVE_CONTINUITY: "Central defensive continuity",
  BALL_PROGRESSION: "Ball progression",
  WIDTH: "Width",
};

export type TacticalFunctionFitTier = "STRONG_FIT" | "MODERATE_FIT" | "WEAK_FIT" | "NOT_APPLICABLE";

export interface TacticalFunctionFit {
  function: TacticalFunctionCode;
  tier: TacticalFunctionFitTier;
  /** 1-10 composite score, or null when not applicable / no supporting attributes recorded. */
  score: number | null;
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
    | PreserveAndRepairProfile
    | PreserveAndFillProfile;
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

export interface PreserveAndFillProfile {
  type: "PRESERVE_AND_FILL";
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
  playerDisplayName?: string;
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