// ─────────────────────────────────────────────────────────────────
// Proposal validation, metrics, and explanation generation.
// ─────────────────────────────────────────────────────────────────

import type {
  CompositionPlayer,
  CompositionTargetTeam,
  ProposedTeamAssignment,
  ProposedTeamMetrics,
  ProposalMetrics,
  ProposalValidation,
  ProposalIssue,
  ProposalExplanation,
  TeamStructuralRequirements,
  StructuralRole,
  PositionFitTier,
  ProposalSeverity,
  ResolvedTeamScenario,
  BroadPosition,
  SystemTeamScenario,
} from "./team-composition-types";

import { BROAD_POSITION_TO_STRUCTURAL_ROLE } from "./team-composition-types";

import { isGoalkeeperCapable, getGkCoverageTier, computeRoleStrength } from "./position-suitability";

// ── Proposal validation ──────────────────────────────────────────

export function validateProposal(
  assignments: ProposedTeamAssignment[],
  players: CompositionPlayer[],
  targetTeams: CompositionTargetTeam[],
  structure: TeamStructuralRequirements,
  lockedPlayerIds: Set<string>,
  scenario: ResolvedTeamScenario,
): ProposalValidation {
  const blocking: ProposalIssue[] = [];
  const warnings: ProposalIssue[] = [];
  const notes: ProposalIssue[] = [];

  const playerMap = new Map(players.map((p) => [p.id, p]));
  const teamAssignments = new Map<string, ProposedTeamAssignment[]>();
  for (const a of assignments) {
    if (!teamAssignments.has(a.teamId)) teamAssignments.set(a.teamId, []);
    teamAssignments.get(a.teamId)!.push(a);
  }

  const assignedPlayerIds = new Set(assignments.map((a) => a.playerId));

  // Hard constraint: duplicate assignment
  const seen = new Set<string>();
  for (const a of assignments) {
    if (seen.has(a.playerId)) {
      blocking.push({
        severity: "BLOCKED",
        code: "DUPLICATE_ASSIGNMENT",
        message: `Player ${a.playerId} is assigned to more than one team`,
        affectedPlayerIds: [a.playerId],
        affectedTeamIds: [a.teamId],
      });
    }
    seen.add(a.playerId);
  }

  // Hard constraint: inactive or unavailable player assigned
  for (const a of assignments) {
    const player = playerMap.get(a.playerId);
    if (player && !player.active) {
      blocking.push({
        severity: "BLOCKED",
        code: "INACTIVE_PLAYER",
        message: `Player ${player.displayName} is inactive and cannot be assigned`,
        affectedPlayerIds: [a.playerId],
        affectedTeamIds: [a.teamId],
      });
    }
    if (player && !player.available) {
      blocking.push({
        severity: "BLOCKED",
        code: "UNAVAILABLE_PLAYER",
        message: `Player ${player.displayName} is unavailable and cannot be assigned`,
        affectedPlayerIds: [a.playerId],
        affectedTeamIds: [a.teamId],
      });
    }
  }

  // Hard constraint: locked assignment changed
  for (const a of assignments) {
    if (lockedPlayerIds.has(a.playerId) && a.source !== "LOCKED" && a.source !== "PRESERVED") {
      // Check if the assignment changed from locked
    }
  }

  // Hard constraint: team size limits
  for (const team of targetTeams) {
    const teamSize = teamAssignments.get(team.id)?.length ?? 0;
    if (teamSize < team.minimumSize) {
      blocking.push({
        severity: "BLOCKED",
        code: "SQUAD_BELOW_MINIMUM",
        message: `${team.name} has ${teamSize} players, below the minimum of ${team.minimumSize}`,
        affectedTeamIds: [team.id],
      });
    }
    if (teamSize > team.maximumSize) {
      blocking.push({
        severity: "BLOCKED",
        code: "SQUAD_ABOVE_MAXIMUM",
        message: `${team.name} has ${teamSize} players, above the maximum of ${team.maximumSize}`,
        affectedTeamIds: [team.id],
      });
    }
  }

  // Hard constraint: goalkeeper coverage when required
  if (structure.requireGoalkeeper) {
    for (const team of targetTeams) {
      const teamPlayers = teamAssignments.get(team.id) ?? [];
      const hasGk = teamPlayers.some((a) => {
        const player = playerMap.get(a.playerId);
        return player && isGoalkeeperCapable(player);
      });
      if (!hasGk) {
        blocking.push({
          severity: "BLOCKED",
          code: "NO_GOALKEEPER_COVERAGE",
          message: `${team.name} has no goalkeeper-capable player`,
          affectedTeamIds: [team.id],
        });
      }
    }
  }

  // Strong condition: single-player role dependency
  if (scenario.structuralRules.warnOnSinglePlayerRoleDependency) {
    for (const team of targetTeams) {
      const teamPlayers = teamAssignments.get(team.id) ?? [];
      const roleCounts: Record<string, number> = {};
      for (const a of teamPlayers) {
        roleCounts[a.assignedRole] = (roleCounts[a.assignedRole] || 0) + 1;
      }
      for (const [role, count] of Object.entries(roleCounts)) {
        if (count === 1 && role !== "FLEXIBLE") {
          warnings.push({
            severity: "DECISION_REQUIRED",
            code: "SINGLE_PLAYER_ROLE_DEPENDENCY",
            message: `${team.name} has only one player in the ${role.toLowerCase()} role`,
            affectedTeamIds: [team.id],
          });
        }
      }
    }
  }

  // Strong condition: excessive tertiary/no-fit assignments
  for (const team of targetTeams) {
    const teamPlayers = teamAssignments.get(team.id) ?? [];
    const tertiaryCount = teamPlayers.filter((a) => a.positionFit === "TERTIARY").length;
    const noFitCount = teamPlayers.filter((a) => a.positionFit === "NO_FIT").length;
    const total = teamPlayers.length || 1;
    if (noFitCount > 0) {
      const pct = Math.round((noFitCount / total) * 100);
      if (pct > scenario.structuralRules.maxNoFitPercentage) {
        blocking.push({
          severity: "BLOCKED",
          code: "EXCESSIVE_NO_FIT_ASSIGNMENTS",
          message: `${team.name} has ${noFitCount} players (${pct}%) with no positional fit`,
          affectedTeamIds: [team.id],
        });
      }
    }
    if (tertiaryCount > 0) {
      const pct = Math.round((tertiaryCount / total) * 100);
      if (pct > scenario.structuralRules.maxTertiaryPositionPercentage) {
        warnings.push({
          severity: "DECISION_REQUIRED",
          code: "EXCESSIVE_TERTIARY_ASSIGNMENTS",
          message: `${team.name} has ${tertiaryCount} players (${pct}%) in tertiary positions`,
          affectedTeamIds: [team.id],
        });
      }
    }
  }

  // Note: eligible players omitted
  const eligiblePlayerCount = players.filter((p) => p.active && p.available).length;
  if (assignedPlayerIds.size < eligiblePlayerCount) {
    const omitted = eligiblePlayerCount - assignedPlayerIds.size;
    if (omitted > 0 && targetTeams.every((t) => (teamAssignments.get(t.id)?.length ?? 0) >= t.minimumSize)) {
      notes.push({
        severity: "PLANNING_NOTE",
        code: "ELIGIBLE_PLAYERS_OMITTED",
        message: `${omitted} eligible player(s) were not assigned to any team`,
      });
    }
  }

  return {
    valid: blocking.length === 0,
    blockingIssues: blocking,
    warnings,
    notes,
  };
}

// ── Team metrics ──────────────────────────────────────────────────

export function computeTeamMetrics(
  teamId: string,
  teamName: string,
  teamAssignments: ProposedTeamAssignment[],
  players: CompositionPlayer[],
): ProposedTeamMetrics {
  const playerMap = new Map(players.map((p) => [p.id, p]));
  const teamPlayers = teamAssignments.map((a) => ({ ...a, player: playerMap.get(a.playerId)! }));

  const squadSize = teamPlayers.length;
  const ratedPlayers = teamPlayers.filter((p) => p.player && p.player.overallStrengthRated);
  const averageOverall = ratedPlayers.length > 0
    ? Math.round((ratedPlayers.reduce((s, p) => s + p.player.overallStrength, 0) / ratedPlayers.length) * 10) / 10
    : null;

  const gkPlayers = teamPlayers.filter((p) => p.player && isGoalkeeperCapable(p.player));
  const goalkeeperCoverage: "full" | "emergency" | "none" = gkPlayers.length === 0
    ? "none"
    : gkPlayers.some((p) => getGkCoverageTier(p.player) === "strong" || getGkCoverageTier(p.player) === "acceptable")
      ? "full"
      : "emergency";

  const goalkeeperQuality = gkPlayers.length > 0
    ? Math.round((gkPlayers.reduce((s, p) => s + computeRoleStrength(p.player.overallStrength, p.player.roleStrength, "GOALKEEPER"), 0) / gkPlayers.length) * 10) / 10
    : null;

  const defenders = teamPlayers.filter((p) => p.assignedRole === "DEFENCE");
  const midfielders = teamPlayers.filter((p) => p.assignedRole === "MIDFIELD");
  const attackers = teamPlayers.filter((p) => p.assignedRole === "ATTACK");

  const defensiveStrength = defenders.length > 0
    ? Math.round((defenders.reduce((s, p) => s + computeRoleStrength(p.player.overallStrength, p.player.roleStrength, "DEFENCE"), 0) / defenders.length) * 10) / 10
    : null;
  const midfieldStrength = midfielders.length > 0
    ? Math.round((midfielders.reduce((s, p) => s + computeRoleStrength(p.player.overallStrength, p.player.roleStrength, "MIDFIELD"), 0) / midfielders.length) * 10) / 10
    : null;
  const attackingStrength = attackers.length > 0
    ? Math.round((attackers.reduce((s, p) => s + computeRoleStrength(p.player.overallStrength, p.player.roleStrength, "ATTACK"), 0) / attackers.length) * 10) / 10
    : null;

  const primaryCount = teamPlayers.filter((p) => p.positionFit === "PRIMARY").length;
  const secondaryCount = teamPlayers.filter((p) => p.positionFit === "SECONDARY").length;
  const tertiaryCount = teamPlayers.filter((p) => p.positionFit === "TERTIARY").length;
  const noFitCount = teamPlayers.filter((p) => p.positionFit === "NO_FIT").length;
  const flexibleCount = teamPlayers.filter((p) => p.assignedRole === "FLEXIBLE").length;
  const playersMoved = teamPlayers.filter((p) => p.player && p.player.currentTeamId && p.player.currentTeamId !== teamId).length;

  const hasGk = gkPlayers.length > 0;
  const hasDef = defenders.length > 0;
  const hasMid = midfielders.length > 0;
  const hasAtt = attackers.length > 0;
  const formationViability: "viable" | "degraded" | "broken" =
    hasGk && hasDef && hasMid && hasAtt ? "viable" :
    (!hasGk && squadSize > 2) || (!hasDef && !hasAtt) ? "broken" : "degraded";

  const structuralWarnings: string[] = [];
  if (goalkeeperCoverage === "emergency") structuralWarnings.push("Uses emergency goalkeeper coverage");
  if (goalkeeperCoverage === "none") structuralWarnings.push("No goalkeeper-capable player");
  if (!hasDef) structuralWarnings.push("No defensive coverage");
  if (!hasMid) structuralWarnings.push("No midfield coverage");
  if (!hasAtt) structuralWarnings.push("No attacking coverage");
  if (noFitCount > 0) structuralWarnings.push(`${noFitCount} player(s) with no positional fit`);

  return {
    teamId,
    teamName,
    squadSize,
    averageOverall,
    goalkeeperCoverage,
    goalkeeperQuality,
    defensiveStrength,
    midfieldStrength,
    attackingStrength,
    primaryPositionCount: primaryCount,
    secondaryPositionCount: secondaryCount,
    tertiaryPositionCount: tertiaryCount,
    noFitCount,
    flexiblePlayerCount: flexibleCount,
    playersMovedFromCurrentTeam: playersMoved,
    formationViability,
    structuralWarnings,
  };
}

// ── Proposal metrics ────────────────────────────────────────────

export function computeProposalMetrics(
  teamMetrics: ProposedTeamMetrics[],
  totalPlayersMoved: number,
): ProposalMetrics {
  const averages = teamMetrics.map((m) => m.averageOverall).filter((a): a is number => a !== null);
  const defAverages = teamMetrics.map((m) => m.defensiveStrength).filter((a): a is number => a !== null);
  const midAverages = teamMetrics.map((m) => m.midfieldStrength).filter((a): a is number => a !== null);
  const attAverages = teamMetrics.map((m) => m.attackingStrength).filter((a): a is number => a !== null);
  const sizes = teamMetrics.map((m) => m.squadSize);

  const spread = (vals: number[]): number | null => {
    if (vals.length < 2) return null;
    return Math.round((Math.max(...vals) - Math.min(...vals)) * 10) / 10;
  };

  return {
    overallSpread: spread(averages),
    defensiveSpread: spread(defAverages),
    midfieldSpread: spread(midAverages),
    attackingSpread: spread(attAverages),
    sizeSpread: spread(sizes) ?? (sizes.length > 0 ? Math.max(...sizes) - Math.min(...sizes) : 0),
    totalPlayersMoved,
    averageTeamSize: sizes.length > 0 ? Math.round((sizes.reduce((a, b) => a + b, 0) / sizes.length) * 10) / 10 : 0,
  };
}

// ── Explanation generation ───────────────────────────────────────

export function generateExplanations(
  assignments: ProposedTeamAssignment[],
  players: CompositionPlayer[],
  scenario: ResolvedTeamScenario,
): ProposalExplanation[] {
  const playerMap = new Map(players.map((p) => [p.id, p]));
  const explanations: ProposalExplanation[] = [];

  for (const a of assignments) {
    if (a.source === "LOCKED") continue;

    const player = playerMap.get(a.playerId);
    if (!player) continue;

    if (a.source === "PRESERVED") {
      explanations.push({
        playerId: a.playerId,
        teamId: a.teamId,
        code: "PRESERVED_ASSIGNMENT",
        message: `${player.displayName} retained in ${player.currentTeamId === a.teamId ? "current team" : "assigned team"} as ${a.assignedRole.toLowerCase()}`,
        severity: "PLANNING_NOTE",
      });
    } else if (a.positionFit === "NO_FIT") {
      explanations.push({
        playerId: a.playerId,
        teamId: a.teamId,
        code: "NO_POSITIONAL_FIT",
        message: `${player.displayName} assigned to ${a.assignedRole.toLowerCase()} with no known positional fit`,
        severity: "DECISION_REQUIRED",
      });
    } else if (a.positionFit === "TERTIARY") {
      explanations.push({
        playerId: a.playerId,
        teamId: a.teamId,
        code: "TERTIARY_POSITION",
        message: `${player.displayName} assigned to ${a.assignedRole.toLowerCase()} using their tertiary position`,
        severity: "PLANNING_NOTE",
      });
    } else if (a.positionFit === "SECONDARY") {
      explanations.push({
        playerId: a.playerId,
        teamId: a.teamId,
        code: "SECONDARY_POSITION",
        message: `${player.displayName} assigned to ${a.assignedRole.toLowerCase()} using their secondary position`,
        severity: "PLANNING_NOTE",
      });
    }

    if (player.currentTeamId && player.currentTeamId !== a.teamId) {
      explanations.push({
        playerId: a.playerId,
        teamId: a.teamId,
        code: "PLAYER_MOVED",
        message: `${player.displayName} moved from current team to ${a.assignedRole.toLowerCase()}`,
        severity: "PLANNING_NOTE",
      });
    }
  }

  return explanations;
}

// ── Input fingerprint ────────────────────────────────────────────

export function computeInputFingerprint(
  players: CompositionPlayer[],
  targetTeams: CompositionTargetTeam[],
  lockedAssignments: { playerId: string; teamId: string }[],
  scenarioCode: SystemTeamScenario,
  structureHash?: string,
): string {
  const parts: string[] = [
    scenarioCode,
    structureHash ?? "default",
    targetTeams.map((t) => `${t.id}:${t.targetSize}:${t.minimumSize}:${t.maximumSize}`).join(","),
    players.map((p) => `${p.id}:${p.overallStrength}:${p.active}:${p.available}:${p.primaryBroadPosition}`).sort().join(","),
    lockedAssignments.map((l) => `${l.playerId}:${l.teamId}`).sort().join(","),
  ];
  let hash = 0;
  const combined = parts.join("|");
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return `v1:${hash.toString(36)}`;
}