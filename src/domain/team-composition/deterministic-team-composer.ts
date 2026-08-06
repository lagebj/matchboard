// ─────────────────────────────────────────────────────────────────
// Deterministic team composer: 6-phase allocation algorithm.
//
// This is the shared composition engine used by both event-squad
// generation and league-team auto-selection.
//
// The algorithm is deterministic given the same input, scenario
// version, and deterministic seed. It uses no random number
// generation — all tie-breaking is based on stable sorting with
// the seed string.
// ─────────────────────────────────────────────────────────────────

import type {
  CompositionPlayer,
  CompositionTargetTeam,
  LockedCompositionAssignment,
  TeamStructuralRequirements,
  ResolvedTeamScenario,
  ProposedTeamAssignment,
  ProposedTeamMetrics,
  TeamCompositionProposal,
  StructuralRole,
  BroadPosition,
  PositionFitTier,
  AssignmentSource,
  ProposalSeverity,
} from "./team-composition-types";

import { FIT_TIER_PRIORITY } from "./team-composition-types";

import {
  computePositionScarcity,
  getPositionFit,
  getRoleFit,
  computeRoleStrength,
  isGoalkeeperCapable,
  sortByRoleRelevantStrength,
  sortByOverallStrength,
  stableCompare,
  type PositionScarcity,
} from "./position-suitability";

import {
  computeTeamMetrics,
  computeProposalMetrics,
  generateExplanations,
  validateProposal,
  computeInputFingerprint,
} from "./proposal-validation";

import { countRoleRequirements } from "./structural-requirements";

// ── Phase 1: Normalize inputs ─────────────────────────────────────

interface NormalizedInput {
  eligiblePlayers: CompositionPlayer[];
  ineligiblePlayers: CompositionPlayer[];
  targetTeams: CompositionTargetTeam[];
  lockedAssignments: Map<string, string>;
  structure: TeamStructuralRequirements;
  scenario: ResolvedTeamScenario;
  seed: string;
  scarcity: PositionScarcity[];
}

function normalizeInputs(
  players: CompositionPlayer[],
  targetTeams: CompositionTargetTeam[],
  lockedAssignments: LockedCompositionAssignment[],
  structure: TeamStructuralRequirements,
  scenario: ResolvedTeamScenario,
  seed: string,
): NormalizedInput {
  const eligiblePlayers = players.filter((p) => p.active && p.available);
  const ineligiblePlayers = players.filter((p) => !p.active || !p.available);
  const locked = new Map<string, string>();
  for (const la of lockedAssignments) {
    locked.set(la.playerId, la.teamId);
  }
  const scarcity = computePositionScarcity(eligiblePlayers, targetTeams.length);
  return {
    eligiblePlayers,
    ineligiblePlayers,
    targetTeams,
    lockedAssignments: locked,
    structure,
    scenario,
    seed,
    scarcity,
  };
}

// ── Phase 2: Allocate scarce roles ───────────────────────────────

function allocateScarceRoles(
  input: NormalizedInput,
  assignments: Map<string, ProposedTeamAssignment>,
  teamAssignments: Map<string, Set<string>>,
): void {
  const { eligiblePlayers, targetTeams, structure, seed, scarcity, lockedAssignments } = input;
  const assignedPlayerIds = new Set(assignments.keys());
  const requiredRoles = countRoleRequirements(structure.slots);

  // Sort roles by scarcity (fewest primary candidates per team first)
  const sortedRoles = (Object.entries(requiredRoles) as [StructuralRole, number][])
    .filter(([role]) => role !== "FLEXIBLE")
    .sort(([roleA], [roleB]) => {
      const scarcityA = scarcity.find((s) => s.position === broadPositionForRole(roleA));
      const scarcityB = scarcity.find((s) => s.position === broadPositionForRole(roleB));
      const ratioA = scarcityA ? scarcityA.primaryCandidateCount / Math.max(1, scarcityA.teamCount) : 999;
      const ratioB = scarcityB ? scarcityB.primaryCandidateCount / Math.max(1, scarcityB.teamCount) : 999;
      return ratioA - ratioB;
    })
    .map(([role]) => role);

  for (const role of sortedRoles) {
    const count = requiredRoles[role] || 0;
    let candidates = eligiblePlayers.filter((p) => !assignedPlayerIds.has(p.id) && !lockedAssignments.has(p.id));

    // Only GK-capable players can be assigned the GOALKEEPER role
    if (role === "GOALKEEPER") {
      candidates = candidates.filter((p) => isGoalkeeperCapable(p));
    }

    const rolePlayers = sortByRoleRelevantStrength(candidates, role, seed);

    // Distribute players for this role across teams using snake draft
    let teamIndex = 0;
    const direction = 1;
    let placed = 0;

    for (const player of rolePlayers) {
      if (placed >= count * targetTeams.length) break;

      // Find next team that needs this role
      let attempts = 0;
      while (attempts < targetTeams.length) {
        const team = targetTeams[teamIndex % targetTeams.length];
        const teamPlayers = teamAssignments.get(team.id) ?? new Set<string>();
        const currentRoleCount = [...assignments.values()]
          .filter((a) => a.teamId === team.id && a.assignedRole === role)
          .length;

        if (currentRoleCount < count) {
          const positionFit = player.roleSuitability[roleToKey(role)];
          const assignedPosition = broadPositionForRole(role);
          const assignment: ProposedTeamAssignment = {
            playerId: player.id,
            teamId: team.id,
            assignedRole: role,
            assignedBroadPosition: assignedPosition,
            positionFit,
            source: "STRUCTURAL_ROLE",
            selectionReason: buildSlotReason(player, role, positionFit),
            overallStrength: player.overallStrength,
            isGoalkeeper: isGoalkeeperCapable(player),
          };
          assignments.set(player.id, assignment);
          if (!teamAssignments.has(team.id)) teamAssignments.set(team.id, new Set());
          teamAssignments.get(team.id)!.add(player.id);
          assignedPlayerIds.add(player.id);
          placed++;
          break;
        }
        teamIndex++;
        attempts++;
      }
    }
  }
}

// ── Phase 3: Build viable spine ───────────────────────────────────

function buildViableSpine(
  input: NormalizedInput,
  assignments: Map<string, ProposedTeamAssignment>,
  teamAssignments: Map<string, Set<string>>,
): void {
  const { eligiblePlayers, targetTeams, structure, seed, scarcity, lockedAssignments } = input;
  const assignedPlayerIds = new Set(assignments.keys());

  // Ensure every team has minimum required roles filled
  for (const team of targetTeams) {
    const teamPlayers = teamAssignments.get(team.id) ?? new Set<string>();
    const currentAssignments = [...assignments.values()].filter((a) => a.teamId === team.id);

    // Check goalkeeper requirement
    if (structure.requireGoalkeeper) {
      const hasGk = currentAssignments.some((a) => a.assignedRole === "GOALKEEPER");
      if (!hasGk) {
        // Find best available GK
        const availableGks = sortByRoleRelevantStrength(
          eligiblePlayers.filter((p) => !assignedPlayerIds.has(p.id) && !lockedAssignments.has(p.id) && isGoalkeeperCapable(p)),
          "GOALKEEPER",
          seed,
        );
        if (availableGks.length > 0) {
          const gk = availableGks[0];
          const fit = gk.roleSuitability.goalkeeper;
          assignments.set(gk.id, {
            playerId: gk.id,
            teamId: team.id,
            assignedRole: "GOALKEEPER",
            assignedBroadPosition: "goalkeeper",
            positionFit: fit,
            source: "STRUCTURAL_ROLE",
            selectionReason: buildSlotReason(gk, "GOALKEEPER", fit),
            overallStrength: gk.overallStrength,
            isGoalkeeper: true,
          });
          if (!teamAssignments.has(team.id)) teamAssignments.set(team.id, new Set());
          teamAssignments.get(team.id)!.add(gk.id);
          assignedPlayerIds.add(gk.id);
        }
      }
    }

    // Check each structural role has at least one player
    const roleRequirements = countRoleRequirements(structure.slots);
    for (const [role, requiredCount] of Object.entries(roleRequirements)) {
      if (role === "FLEXIBLE") continue;
      const currentCount = currentAssignments.filter((a) => a.assignedRole === role).length;
      if (currentCount >= requiredCount) continue;

      // Find best available player for this role
      const available = sortByRoleRelevantStrength(
        eligiblePlayers.filter((p) => !assignedPlayerIds.has(p.id) && !lockedAssignments.has(p.id) && getRoleFit(p, role as StructuralRole) !== "NO_FIT"),
        role as StructuralRole,
        seed,
      );
      for (let i = currentCount; i < requiredCount && i - currentCount < available.length; i++) {
        const player = available[i - currentCount];
        if (!player) break;
        const fit = player.roleSuitability[roleToKey(role as StructuralRole)];
        const assignedPosition = broadPositionForRole(role as StructuralRole);
        assignments.set(player.id, {
          playerId: player.id,
          teamId: team.id,
          assignedRole: role as StructuralRole,
          assignedBroadPosition: assignedPosition,
          positionFit: fit,
          source: "STRUCTURAL_ROLE",
          selectionReason: buildSlotReason(player, role as StructuralRole, fit),
          overallStrength: player.overallStrength,
          isGoalkeeper: isGoalkeeperCapable(player),
        });
        if (!teamAssignments.has(team.id)) teamAssignments.set(team.id, new Set());
        teamAssignments.get(team.id)!.add(player.id);
        assignedPlayerIds.add(player.id);
      }
    }
  }
}

// ── Phase 4: Apply scenario distribution ──────────────────────────

function applyScenarioDistribution(
  input: NormalizedInput,
  assignments: Map<string, ProposedTeamAssignment>,
  teamAssignments: Map<string, Set<string>>,
): void {
  const { scenario, eligiblePlayers, targetTeams, seed, lockedAssignments } = input;
  const assignedPlayerIds = new Set(assignments.keys());
  const unassigned = eligiblePlayers.filter((p) => !assignedPlayerIds.has(p.id) && !lockedAssignments.has(p.id));

  switch (scenario.code) {
    case "PRESERVE_AND_REPAIR":
      distributePreserveAndRepair(input, unassigned, assignments, teamAssignments, assignedPlayerIds);
      break;
    case "BALANCED":
      distributeBalanced(input, unassigned, assignments, teamAssignments, assignedPlayerIds);
      break;
    case "ONE_STRONG_REST_BALANCED":
      distributeOneStrong(input, unassigned, assignments, teamAssignments, assignedPlayerIds);
      break;
    case "TIERED_DESCENDING":
      distributeTiered(input, unassigned, assignments, teamAssignments, assignedPlayerIds);
      break;
  }
}

// ── Preserve and repair distribution ──────────────────────────────

function distributePreserveAndRepair(
  input: NormalizedInput,
  unassigned: CompositionPlayer[],
  assignments: Map<string, ProposedTeamAssignment>,
  teamAssignments: Map<string, Set<string>>,
  assignedPlayerIds: Set<string>,
): void {
  const { eligiblePlayers, targetTeams } = input;

  // First: preserve current assignments for unassigned players
  for (const player of unassigned) {
    if (player.currentTeamId) {
      const targetTeam = targetTeams.find((t) => t.id === player.currentTeamId);
      if (targetTeam) {
        const teamSize = (teamAssignments.get(targetTeam.id) ?? new Set()).size;
        if (teamSize < targetTeam.maximumSize) {
          const role = determineBestRole(player);
          const fit = player.roleSuitability[roleToKey(role)];
          const assignedPosition = player.primaryBroadPosition ?? "flexible" as BroadPosition;
          assignments.set(player.id, {
            playerId: player.id,
            teamId: targetTeam.id,
            assignedRole: role,
            assignedBroadPosition: assignedPosition,
            positionFit: fit,
            source: "PRESERVED",
            selectionReason: `Retained in current team as ${role.toLowerCase()}`,
            overallStrength: player.overallStrength,
            isGoalkeeper: isGoalkeeperCapable(player),
          });
          if (!teamAssignments.has(targetTeam.id)) teamAssignments.set(targetTeam.id, new Set());
          teamAssignments.get(targetTeam.id)!.add(player.id);
          assignedPlayerIds.add(player.id);
        }
      }
    }
  }

  // Second: fill teams that are below minimum
  const remaining = unassigned.filter((p) => !assignedPlayerIds.has(p.id));
  const sorted = sortByOverallStrength(remaining, input.seed);

  for (const player of sorted) {
    if (assignedPlayerIds.has(player.id)) continue;
    // Find smallest team below minimum
    const smallTeams = targetTeams
      .filter((t) => (teamAssignments.get(t.id) ?? new Set()).size < t.minimumSize)
      .sort((a, b) => (teamAssignments.get(a.id) ?? new Set()).size - (teamAssignments.get(b.id) ?? new Set()).size);

    if (smallTeams.length > 0) {
      const team = smallTeams[0];
      assignPlayerToTeam(player, team, assignments, teamAssignments, assignedPlayerIds, input.seed);
    }
  }

  // Third: fill remaining spots on teams below target
  const stillRemaining = unassigned.filter((p) => !assignedPlayerIds.has(p.id));
  const stillSorted = sortByOverallStrength(stillRemaining, input.seed);

  for (const player of stillSorted) {
    if (assignedPlayerIds.has(player.id)) continue;
    const teamsBelowTarget = targetTeams
      .filter((t) => (teamAssignments.get(t.id) ?? new Set()).size < t.targetSize)
      .sort((a, b) => {
        const sizeA = (teamAssignments.get(a.id) ?? new Set()).size;
        const sizeB = (teamAssignments.get(b.id) ?? new Set()).size;
        if (sizeA !== sizeB) return sizeA - sizeB;
        return stableCompare(a.id, b.id, input.seed);
      });

    if (teamsBelowTarget.length > 0) {
      const team = teamsBelowTarget[0];
      assignPlayerToTeam(player, team, assignments, teamAssignments, assignedPlayerIds, input.seed);
    }
  }
}

// ── Balanced distribution ─────────────────────────────────────────

function distributeBalanced(
  input: NormalizedInput,
  unassigned: CompositionPlayer[],
  assignments: Map<string, ProposedTeamAssignment>,
  teamAssignments: Map<string, Set<string>>,
  assignedPlayerIds: Set<string>,
): void {
  const { targetTeams, seed } = input;

  // Sort players by overall strength
  const sorted = sortByOverallStrength(unassigned, seed);

  // Snake draft: distribute by alternating direction
  let direction = 1;
  let teamIndex = 0;

  for (const player of sorted) {
    if (assignedPlayerIds.has(player.id)) continue;

    // Try to place in a role-appropriate team
    const team = targetTeams[teamIndex % targetTeams.length];
    const teamSize = (teamAssignments.get(team.id) ?? new Set()).size;

    if (teamSize < team.maximumSize) {
      assignPlayerToTeam(player, team, assignments, teamAssignments, assignedPlayerIds, seed);
    } else {
      // Find smallest team
      const smallestTeam = targetTeams
        .filter((t) => (teamAssignments.get(t.id) ?? new Set()).size < t.maximumSize)
        .sort((a, b) => (teamAssignments.get(a.id) ?? new Set()).size - (teamAssignments.get(b.id) ?? new Set()).size)[0];
      if (smallestTeam) {
        assignPlayerToTeam(player, smallestTeam, assignments, teamAssignments, assignedPlayerIds, seed);
      }
    }

    teamIndex += direction;
    if (teamIndex >= targetTeams.length - 1 || teamIndex <= 0) {
      direction *= -1;
    }
  }
}

// ── One strong, rest balanced distribution ────────────────────────

function distributeOneStrong(
  input: NormalizedInput,
  unassigned: CompositionPlayer[],
  assignments: Map<string, ProposedTeamAssignment>,
  teamAssignments: Map<string, Set<string>>,
  assignedPlayerIds: Set<string>,
): void {
  const { targetTeams, seed } = input;

  if (targetTeams.length < 2) {
    distributeBalanced(input, unassigned, assignments, teamAssignments, assignedPlayerIds);
    return;
  }

  // Sort by overall strength descending
  const sorted = sortByOverallStrength(unassigned, seed);

  const strongTeam = targetTeams[0];
  const otherTeams = targetTeams.slice(1);

  // Allocate top players to strong team first, respecting structural roles
  const strongTarget = strongTeam.targetSize;

  for (const player of sorted) {
    if (assignedPlayerIds.has(player.id)) continue;
    const strongSize = (teamAssignments.get(strongTeam.id) ?? new Set()).size;

    if (strongSize < strongTarget) {
      assignPlayerToTeam(player, strongTeam, assignments, teamAssignments, assignedPlayerIds, seed);
    } else {
      break;
    }
  }

  // Then balance remaining teams
  const remaining = sorted.filter((p) => !assignedPlayerIds.has(p.id));
  distributeBalancedToTeams(remaining, otherTeams, assignments, teamAssignments, assignedPlayerIds, seed);
}

// ── Tiered descending distribution ─────────────────────────────────

function distributeTiered(
  input: NormalizedInput,
  unassigned: CompositionPlayer[],
  assignments: Map<string, ProposedTeamAssignment>,
  teamAssignments: Map<string, Set<string>>,
  assignedPlayerIds: Set<string>,
): void {
  const { targetTeams, seed } = input;

  // Sort by overall strength descending
  const sorted = sortByOverallStrength(unassigned, seed);

  // Allocate structurally: for each role, give best to Team 1, next to Team 2, etc.
  const roles: StructuralRole[] = ["GOALKEEPER", "DEFENCE", "MIDFIELD", "ATTACK", "FLEXIBLE"];

  for (const role of roles) {
    const rolePlayers = sortByRoleRelevantStrength(
      sorted.filter((p) => !assignedPlayerIds.has(p.id) && getRoleFit(p, role) !== "NO_FIT"),
      role,
      seed,
    );

    let playerIndex = 0;
    while (playerIndex < rolePlayers.length) {
      for (const team of targetTeams) {
        if (playerIndex >= rolePlayers.length) break;
        const player = rolePlayers[playerIndex];
        const teamSize = (teamAssignments.get(team.id) ?? new Set()).size;
        if (teamSize < team.maximumSize && !assignedPlayerIds.has(player.id)) {
          assignPlayerToTeam(player, team, assignments, teamAssignments, assignedPlayerIds, seed);
        }
        playerIndex++;
      }
    }
  }

  // Fill remaining with overall strength distribution
  const stillRemaining = sorted.filter((p) => !assignedPlayerIds.has(p.id));
  for (const player of stillRemaining) {
    const smallestTeam = targetTeams
      .filter((t) => (teamAssignments.get(t.id) ?? new Set()).size < t.maximumSize)
      .sort((a, b) => {
        const diffA = (teamAssignments.get(a.id) ?? new Set()).size;
        const diffB = (teamAssignments.get(b.id) ?? new Set()).size;
        return diffA - diffB;
      })[0];

    if (smallestTeam) {
      assignPlayerToTeam(player, smallestTeam, assignments, teamAssignments, assignedPlayerIds, seed);
    }
  }
}

// ── Phase 6: Bounded local improvement ────────────────────────────

function improveProposal(
  assignments: Map<string, ProposedTeamAssignment>,
  teamAssignments: Map<string, Set<string>>,
  players: CompositionPlayer[],
  targetTeams: CompositionTargetTeam[],
  input: NormalizedInput,
): Map<string, ProposedTeamAssignment> {
  const MAX_ITERATIONS = 50;
  const IMPROVEMENT_THRESHOLD = 0.01;

  const playerMap = new Map(players.map((p) => [p.id, p]));
  let currentAssignments = new Map(assignments);
  const currentTeamAssignments = new Map(teamAssignments);

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    let improved = false;

    // Try pairwise swaps
    const teamIds = targetTeams.map((t) => t.id);
    for (let i = 0; i < teamIds.length; i++) {
      for (let j = i + 1; j < teamIds.length; j++) {
        const teamA = teamIds[i];
        const teamB = teamIds[j];
        const playersA = [...(currentAssignments.values())].filter((a) => a.teamId === teamA && a.source !== "LOCKED");
        const playersB = [...(currentAssignments.values())].filter((a) => a.teamId === teamB && a.source !== "LOCKED");

        for (const a of playersA) {
          for (const b of playersB) {
            const playerA = playerMap.get(a.playerId);
            const playerB = playerMap.get(b.playerId);
            if (!playerA || !playerB) continue;

            // Don't swap primary-fit players
            if (a.positionFit === "PRIMARY" || b.positionFit === "PRIMARY") continue;

            const currentSpread = computeSpread(currentAssignments, playerMap, teamA, teamB);

            // Try swap
            const newAssignments = new Map(currentAssignments);
            newAssignments.set(a.playerId, { ...a, teamId: teamB });
            newAssignments.set(b.playerId, { ...b, teamId: teamA });

            const newSpread = computeSpread(newAssignments, playerMap, teamA, teamB);

            if (currentSpread !== null && newSpread !== null && newSpread < currentSpread - IMPROVEMENT_THRESHOLD) {
              currentAssignments = newAssignments;
              improved = true;
              break;
            }
          }
          if (improved) break;
        }
        if (improved) break;
      }
      if (improved) break;
    }

    // Try single moves (if a team has too many players)
    if (!improved) {
      for (const team of targetTeams) {
        const teamSize = (currentTeamAssignments.get(team.id) ?? new Set()).size;
        if (teamSize > team.targetSize) {
          const excessPlayers = [...currentAssignments.values()]
            .filter((a) => a.teamId === team.id && a.source !== "LOCKED")
            .sort((a, b) => {
              const pa = playerMap.get(a.playerId);
              const pb = playerMap.get(b.playerId);
              return (pa?.overallStrength ?? 0) - (pb?.overallStrength ?? 0);
            });

          for (const excess of excessPlayers) {
            const smallestTeam = targetTeams
              .filter((t) => t.id !== team.id && (currentTeamAssignments.get(t.id) ?? new Set()).size < t.maximumSize)
              .sort((a, b) => (currentTeamAssignments.get(a.id) ?? new Set()).size - (currentTeamAssignments.get(b.id) ?? new Set()).size)[0];

            if (smallestTeam) {
              currentAssignments.set(excess.playerId, {
                ...excess,
                teamId: smallestTeam.id,
                source: "BALANCE_FILL" as AssignmentSource,
                selectionReason: `Moved to balance squad sizes`,
              });
              improved = true;
              break;
            }
          }
          if (improved) break;
        }
      }
    }

    if (!improved) break;
  }

  return currentAssignments;
}

function computeSpread(
  assignments: Map<string, ProposedTeamAssignment>,
  playerMap: Map<string, CompositionPlayer>,
  teamA: string,
  teamB: string,
): number | null {
  const teamAAvg = computeTeamAverage(assignments, playerMap, teamA);
  const teamBAvg = computeTeamAverage(assignments, playerMap, teamB);
  if (teamAAvg === null || teamBAvg === null) return null;
  return Math.abs(teamAAvg - teamBAvg);
}

function computeTeamAverage(
  assignments: Map<string, ProposedTeamAssignment>,
  playerMap: Map<string, CompositionPlayer>,
  teamId: string,
): number | null {
  const teamPlayers = [...assignments.values()].filter((a) => a.teamId === teamId);
  const rated = teamPlayers.filter((a) => playerMap.get(a.playerId)?.overallStrengthRated);
  if (rated.length === 0) return null;
  return rated.reduce((s, a) => s + (playerMap.get(a.playerId)?.overallStrength ?? 0), 0) / rated.length;
}

// ── Helper functions ──────────────────────────────────────────────

function roleToKey(role: StructuralRole): "goalkeeper" | "defence" | "midfield" | "attack" | "flexible" {
  switch (role) {
    case "GOALKEEPER": return "goalkeeper";
    case "DEFENCE": return "defence";
    case "MIDFIELD": return "midfield";
    case "ATTACK": return "attack";
    case "FLEXIBLE": return "flexible";
  }
}

function broadPositionForRole(role: StructuralRole): BroadPosition {
  switch (role) {
    case "GOALKEEPER": return "goalkeeper";
    case "DEFENCE": return "defender";
    case "MIDFIELD": return "midfielder";
    case "ATTACK": return "forward";
    case "FLEXIBLE": return "flexible";
  }
}

function determineBestRole(player: CompositionPlayer): StructuralRole {
  const suitability = player.roleSuitability;
  let bestRole: StructuralRole = "FLEXIBLE";
  let bestFit: PositionFitTier = "NO_FIT";

  const roles: StructuralRole[] = ["GOALKEEPER", "DEFENCE", "MIDFIELD", "ATTACK", "FLEXIBLE"];
  for (const role of roles) {
    const fit = suitability[roleToKey(role)];
    if (FIT_TIER_PRIORITY[fit] > FIT_TIER_PRIORITY[bestFit]) {
      bestFit = fit;
      bestRole = role;
    }
  }
  return bestRole;
}

function assignPlayerToTeam(
  player: CompositionPlayer,
  team: CompositionTargetTeam,
  assignments: Map<string, ProposedTeamAssignment>,
  teamAssignments: Map<string, Set<string>>,
  assignedPlayerIds: Set<string>,
  seed: string,
): void {
  const role = determineBestRole(player);
  const fit = player.roleSuitability[roleToKey(role)];
  const assignedPosition = player.primaryBroadPosition ?? "flexible" as BroadPosition;

  assignments.set(player.id, {
    playerId: player.id,
    teamId: team.id,
    assignedRole: role,
    assignedBroadPosition: assignedPosition,
    positionFit: fit,
    source: "SCENARIO_DISTRIBUTION",
    selectionReason: buildSlotReason(player, role, fit),
    overallStrength: player.overallStrength,
    isGoalkeeper: isGoalkeeperCapable(player),
  });

  if (!teamAssignments.has(team.id)) teamAssignments.set(team.id, new Set());
  teamAssignments.get(team.id)!.add(player.id);
  assignedPlayerIds.add(player.id);
}

function buildSlotReason(player: CompositionPlayer, role: StructuralRole, fit: PositionFitTier): string {
  const roleLabel = role === "GOALKEEPER" ? "goalkeeper" : role.toLowerCase();
  switch (fit) {
    case "PRIMARY": return `Selected for ${roleLabel} coverage (primary position)`;
    case "SECONDARY": return `Selected for ${roleLabel} coverage (secondary position)`;
    case "TERTIARY": return `Selected for ${roleLabel} coverage (tertiary position)`;
    case "NO_FIT": return `Assigned as ${roleLabel} (no known positional fit)`;
  }
}

function distributeBalancedToTeams(
  players: CompositionPlayer[],
  teams: CompositionTargetTeam[],
  assignments: Map<string, ProposedTeamAssignment>,
  teamAssignments: Map<string, Set<string>>,
  assignedPlayerIds: Set<string>,
  seed: string,
): void {
  const sorted = sortByOverallStrength(players, seed);
  let direction = 1;
  let teamIndex = 0;

  for (const player of sorted) {
    if (assignedPlayerIds.has(player.id)) continue;
    const team = teams[teamIndex % teams.length];
    const teamSize = (teamAssignments.get(team.id) ?? new Set()).size;
    if (teamSize < team.maximumSize) {
      assignPlayerToTeam(player, team, assignments, teamAssignments, assignedPlayerIds, seed);
    } else {
      const smallest = teams
        .filter((t) => (teamAssignments.get(t.id) ?? new Set()).size < t.maximumSize)
        .sort((a, b) => (teamAssignments.get(a.id) ?? new Set()).size - (teamAssignments.get(b.id) ?? new Set()).size)[0];
      if (smallest) {
        assignPlayerToTeam(player, smallest, assignments, teamAssignments, assignedPlayerIds, seed);
      }
    }
    teamIndex += direction;
    if (teamIndex >= teams.length - 1 || teamIndex <= 0) direction *= -1;
  }
}

// ── Main entry point ──────────────────────────────────────────────

export function composeTeams(
  problem: import("./team-composition-types").TeamCompositionProblem,
): import("./team-composition-types").TeamCompositionProposal {
  const { context, scenario, players, targetTeams, lockedAssignments, structure, deterministicSeed } = problem;

  // Phase 1: Normalize inputs
  const input = normalizeInputs(players, targetTeams, lockedAssignments, structure, scenario, deterministicSeed);

  const assignments = new Map<string, ProposedTeamAssignment>();
  const teamAssignments = new Map<string, Set<string>>();
  const assignedPlayerIds = new Set<string>();

  // Seed locked assignments
  for (const [playerId, teamId] of input.lockedAssignments) {
    const player = players.find((p) => p.id === playerId);
    if (!player) continue;
    const role = determineBestRole(player);
    const fit = player.roleSuitability[roleToKey(role)];
    const assignedPosition = player.primaryBroadPosition ?? "flexible" as BroadPosition;
    assignments.set(playerId, {
      playerId,
      teamId,
      assignedRole: role,
      assignedBroadPosition: assignedPosition,
      positionFit: fit,
      source: "LOCKED",
      selectionReason: "Coach-locked assignment",
      overallStrength: player.overallStrength,
      isGoalkeeper: isGoalkeeperCapable(player),
    });
    if (!teamAssignments.has(teamId)) teamAssignments.set(teamId, new Set());
    teamAssignments.get(teamId)!.add(playerId);
    assignedPlayerIds.add(playerId);
  }

  // Phase 2: Allocate scarce roles (goalkeepers, critical positions)
  allocateScarceRoles(input, assignments, teamAssignments);

  // Phase 3: Build viable spine for every team
  buildViableSpine(input, assignments, teamAssignments);

  // Phase 4: Apply scenario distribution
  applyScenarioDistribution(input, assignments, teamAssignments);

  // Phase 5: Fill remaining squad places
  // (handled within scenario distribution for now)

  // Phase 6: Bounded local improvement
  const improvedAssignments = improveProposal(assignments, teamAssignments, players, targetTeams, input);

  // Collect final assignments
  const finalAssignments = [...improvedAssignments.values()];

  // Compute metrics
  const playerMap = new Map(players.map((p) => [p.id, p]));

  // Populate player display names
  for (const a of finalAssignments) {
    const player = playerMap.get(a.playerId);
    if (player) {
      a.playerDisplayName = player.displayName;
    }
  }
  const teamMetrics: ProposedTeamMetrics[] = targetTeams.map((team) => {
    const teamAssignmentList = finalAssignments.filter((a) => a.teamId === team.id);
    return computeTeamMetrics(team.id, team.name, teamAssignmentList, players);
  });

  const totalMoved = finalAssignments.filter(
    (a) => a.source !== "LOCKED" && a.source !== "PRESERVED" && playerMap.get(a.playerId)?.currentTeamId && playerMap.get(a.playerId)!.currentTeamId !== a.teamId,
  ).length;

  const proposalMetrics = computeProposalMetrics(teamMetrics, totalMoved);

  const lockedPlayerIds = new Set(input.lockedAssignments.keys());

  // Validate
  const validation = validateProposal(finalAssignments, players, targetTeams, structure, lockedPlayerIds, scenario);

  // Generate explanations
  const explanations = generateExplanations(finalAssignments, players, scenario);

  // Fingerprint
  const structureHash = structure.source + ":" + structure.slots.map((s) => `${s.role}:${s.count}:${s.acceptedPositions.join("+")}`).join("|") + ":" + (structure.formationId ?? "none");
  const fingerprint = computeInputFingerprint(players, targetTeams, lockedAssignments, scenario.code, structureHash);

  return {
    assignments: finalAssignments,
    teamMetrics,
    proposalMetrics,
    validation,
    explanations,
    scenarioCode: scenario.code,
    scenarioVersion: scenario.version,
    deterministicSeed,
    inputFingerprint: fingerprint,
  };
}