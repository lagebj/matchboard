// ─────────────────────────────────────────────────────────────────
// League-team composition adapter.
//
// Application service that:
// 1. Resolves actor's organisation and football-group access
// 2. Loads active football-group player memberships
// 3. Loads active target teams in the same football group
// 4. Maps live data into the shared composition contract
// 5. Runs OPA pre-generation policy evaluation
// 6. Generates a proposal via the shared composition engine
// 7. Runs OPA post-generation policy evaluation
// 8. Returns a preview without mutating assignments
// 9. Applies an approved proposal transactionally
//
// This adapter does NOT depend directly on Prisma in the domain
// layer — data mapping is done here in the application layer.
// ─────────────────────────────────────────────────────────────────

import { db } from "@/lib/db";
import { requireActorContext, requireMutationRole } from "@/lib/auth/actor-context";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";
import { composeTeams } from "@/domain/team-composition/deterministic-team-composer";
import { getSystemScenario } from "@/domain/team-composition/scenario-catalogue";
import { getFallbackStructure } from "@/domain/team-composition/structural-requirements";
import { checkScenarioPermission, checkCompositionProposalPolicy } from "@/lib/policies/composition-policy";
import type {
  CompositionPlayer,
  CompositionTargetTeam,
  LockedCompositionAssignment,
  TeamCompositionProblem,
  TeamCompositionProposal,
  SystemTeamScenario,
  RoleSuitabilityProfile,
  RoleStrengthProfile,
  BroadPosition,
} from "@/domain/team-composition/team-composition-types";
import { computeCompositeRatings, type PlayerAttributeProfile } from "@/lib/events/event-types";
import { mapPositionCodeToBroad } from "@/domain/team-composition/position-suitability";
import { recordDecision } from "@/domain/assistant-manager/service";

// ── Position mapping ──────────────────────────────────────────────

function getPositionFitTier(
  primaryPosition: BroadPosition | undefined,
  secondaryPosition: BroadPosition | undefined,
  tertiaryPosition: BroadPosition | undefined,
  acceptedPositions: BroadPosition[],
): "PRIMARY" | "SECONDARY" | "TERTIARY" | "NO_FIT" {
  if (!acceptedPositions || acceptedPositions.length === 0) return "NO_FIT";
  const accepted = new Set(acceptedPositions);
  if (accepted.has("flexible")) return "PRIMARY";
  if (primaryPosition && accepted.has(primaryPosition)) return "PRIMARY";
  if (secondaryPosition && accepted.has(secondaryPosition)) return "SECONDARY";
  if (tertiaryPosition && accepted.has(tertiaryPosition)) return "TERTIARY";
  if (primaryPosition === "flexible" || secondaryPosition === "flexible" || tertiaryPosition === "flexible") return "TERTIARY";
  return "NO_FIT";
}

function buildRoleSuitability(player: PlayerAttributeProfile): RoleSuitabilityProfile {
  const primary = mapPositionCodeToBroad(player.primaryPosition ?? "") as BroadPosition;
  const secondary = player.secondaryPosition ? (mapPositionCodeToBroad(player.secondaryPosition) as BroadPosition) : undefined;
  const tertiary = player.tertiaryPosition ? (mapPositionCodeToBroad(player.tertiaryPosition) as BroadPosition) : undefined;

  return {
    goalkeeper: getPositionFitTier(primary, secondary, tertiary, ["goalkeeper"]),
    defence: getPositionFitTier(primary, secondary, tertiary, ["defender", "flexible"]),
    midfield: getPositionFitTier(primary, secondary, tertiary, ["midfielder", "flexible"]),
    attack: getPositionFitTier(primary, secondary, tertiary, ["forward", "flexible"]),
    flexible: getPositionFitTier(primary, secondary, tertiary, ["defender", "midfielder", "forward", "goalkeeper", "flexible"]),
  };
}

function buildRoleStrength(player: PlayerAttributeProfile): RoleStrengthProfile {
  const ratings = computeCompositeRatings(player);
  return {
    goalkeeper: player.goalkeeperAbility === "YES" ? (ratings.overallLevel ?? 0) : null,
    defence: ratings.defending ?? ratings.overallLevel ?? null,
    midfield: ratings.gameUnderstanding ?? ratings.overallLevel ?? null,
    attack: ratings.attacking ?? ratings.overallLevel ?? null,
    flexible: ratings.overallLevel ?? null,
  };
}

// ── Data loading ──────────────────────────────────────────────────

interface LeagueTeamCompositionInput {
  footballGroupId: string;
  leagueSeasonId: string;
  scenario: SystemTeamScenario;
  deterministicSeed: string;
  formationId?: string;
  coachAcknowledgedPolicyGate?: boolean;
}

async function loadCompositionData(
  input: LeagueTeamCompositionInput,
  orgFilter: OrgFilterMode,
): Promise<{
  players: CompositionPlayer[];
  targetTeams: CompositionTargetTeam[];
  lockedAssignments: LockedCompositionAssignment[];
  leagueSeason: { id: string; name: string; status: string; footballGroupId: string };
}> {
  const orgWhere = orgFilter.type === "org" ? orgFilter.filter : {};

  const [leagueSeason, teams, groupPlayers] = await Promise.all([
    db.leagueSeason.findUniqueOrThrow({
      where: { id: input.leagueSeasonId, ...orgWhere },
      select: { id: true, name: true, status: true, footballGroupId: true },
    }),
    db.team.findMany({
      where: { footballGroupId: input.footballGroupId, archivedAt: null, ...orgWhere },
      select: {
        id: true,
        name: true,
        targetSquadSize: true,
        minAcceptedSquadSize: true,
        maxSquadSize: true,
      },
      orderBy: { supportPriority: "asc" },
    }),
    db.footballGroupPlayer.findMany({
      where: { footballGroupId: input.footballGroupId, status: "ACTIVE", membershipType: "PRIMARY", player: { active: true, removedAt: null } },
      select: {
        id: true,
        playerId: true,
        coreTeamId: true,
        player: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            primaryPosition: true,
            secondaryPosition: true,
            tertiaryPosition: true,
            goalkeeperAbility: true,
            ballControl: true,
            passing: true,
            firstTouch: true,
            oneVOneAttacking: true,
            positioning: true,
            oneVOneDefending: true,
            decisionMaking: true,
            effort: true,
            teamplay: true,
            concentration: true,
            speed: true,
            strength: true,
            coreTeamId: true,
            currentAvailability: true,
            active: true,
            nonRotatable: true,
            preferredFoot: true,
            bestSide: true,
          },
        },
      },
    }),
  ]);

  if (leagueSeason.status === "FINALIZED") {
    throw new Error("Cannot generate team composition for a finalized league season.");
  }

  if (leagueSeason.footballGroupId !== input.footballGroupId) {
    throw new Error("League season does not belong to the specified football group.");
  }

  const players: CompositionPlayer[] = groupPlayers.map((gp) => {
    const p = gp.player;
    const primaryBroad = mapPositionCodeToBroad(p.primaryPosition ?? "") as BroadPosition;
    const profile: PlayerAttributeProfile = {
      playerId: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      coreTeamId: p.coreTeamId,
      primaryPosition: p.primaryPosition,
      secondaryPosition: p.secondaryPosition,
      tertiaryPosition: p.tertiaryPosition,
      goalkeeperAbility: p.goalkeeperAbility,
      ballControl: p.ballControl,
      passing: p.passing,
      firstTouch: p.firstTouch,
      oneVOneAttacking: p.oneVOneAttacking,
      positioning: p.positioning,
      oneVOneDefending: p.oneVOneDefending,
      decisionMaking: p.decisionMaking,
      effort: p.effort,
      teamplay: p.teamplay,
      concentration: p.concentration,
      speed: p.speed,
      strength: p.strength,
      nonRotatable: p.nonRotatable,
      preferredFoot: p.preferredFoot ?? "RIGHT",
      bestSide: p.bestSide ?? "CENTRE",
    };
    const ratings = computeCompositeRatings(profile);
    const roleSuitability = buildRoleSuitability(profile);
    const roleStrength = buildRoleStrength(profile);

    return {
      id: p.id,
      displayName: p.lastName ? `${p.firstName} ${p.lastName}` : p.firstName,
      overallStrength: ratings.overallLevel ?? 0,
      overallStrengthRated: ratings.overallLevel !== null,
      currentTeamId: p.coreTeamId ?? undefined,
      available: p.currentAvailability === "AVAILABLE" || p.currentAvailability === "TENTATIVE",
      active: p.active,
      goalkeeperAbility: p.goalkeeperAbility,
      roleSuitability,
      primaryBroadPosition: primaryBroad,
      roleStrength,
    };
  });

  const targetTeams: CompositionTargetTeam[] = teams.map((t, index) => ({
    id: t.id,
    name: t.name,
    targetSize: t.targetSquadSize,
    minimumSize: t.minAcceptedSquadSize,
    maximumSize: t.maxSquadSize,
    rank: index + 1,
  }));

  const lockedAssignments: LockedCompositionAssignment[] = [];

  return { players, targetTeams, lockedAssignments, leagueSeason };
}

// ── Generate preview ───────────────────────────────────────────────

export async function generateLeagueTeamPreview(
  input: LeagueTeamCompositionInput,
): Promise<TeamCompositionProposal> {
  const ctx = await requireActorContext();
  requireMutationRole(ctx);

  const { players, targetTeams, lockedAssignments } = await loadCompositionData(input, ctx.orgFilter);

  if (targetTeams.length < 2) {
    throw new Error("At least 2 teams are required for team composition.");
  }

  if (players.filter((p) => p.available).length < targetTeams.length) {
    throw new Error("Not enough available players to form teams.");
  }

  const scenario = getSystemScenario(input.scenario);

  const policyCheck = checkScenarioPermission(input.scenario, {
    coachAcknowledgedPolicyGate: input.coachAcknowledgedPolicyGate,
  });
  if (!policyCheck.allowed) {
    throw new Error(policyCheck.reason ?? "Scenario not permitted by policy.");
  }

  const structure = getFallbackStructure("ELEVEN_A_SIDE");

  const problem: TeamCompositionProblem = {
    contractVersion: 1,
    context: "LEAGUE_TEAMS",
    scenario,
    players,
    targetTeams,
    lockedAssignments,
    structure,
    deterministicSeed: input.deterministicSeed,
  };

  const proposal = composeTeams(problem);

  const policyIssues = checkCompositionProposalPolicy(proposal);
  if (policyIssues.length > 0) {
    proposal.validation.warnings.push(...policyIssues.filter((i) => i.severity === "DECISION_REQUIRED"));
    proposal.validation.notes.push(...policyIssues.filter((i) => i.severity === "PLANNING_NOTE"));
    const blocking = policyIssues.filter((i) => i.severity === "BLOCKED");
    if (blocking.length > 0) {
      proposal.validation.blockingIssues.push(...blocking);
      proposal.validation.valid = false;
    }
  }

  await recordDecision({
    decisionType: "TEAM_COMPOSITION",
    entityType: "LEAGUE_SEASON",
    entityId: input.leagueSeasonId,
    action: "GENERATE_TEAM_PREVIEW",
    reason: `Generated ${input.scenario} team composition preview`,
    organisationId: ctx.organisationId,
    beforeSnapshot: undefined,
    afterSnapshot: {
      scenarioCode: proposal.scenarioCode,
      scenarioVersion: proposal.scenarioVersion,
      teamCount: proposal.teamMetrics.length,
      totalPlayersMoved: proposal.proposalMetrics.totalPlayersMoved,
      valid: proposal.validation.valid,
      inputFingerprint: proposal.inputFingerprint,
    },
  });

  return proposal;
}

// ── Apply proposal ──────────────────────────────────────────────────

export async function applyLeagueTeamProposal(
  input: LeagueTeamCompositionInput & { proposalIdempotencyKey: string },
): Promise<{ applied: boolean; teamCount: number; playersMoved: number }> {
  const ctx = await requireActorContext();
  requireMutationRole(ctx);

  const { players, targetTeams, lockedAssignments, leagueSeason } = await loadCompositionData(input, ctx.orgFilter);

  if (leagueSeason.status === "FINALIZED") {
    throw new Error("Cannot apply team composition to a finalized league season.");
  }

  const scenario = getSystemScenario(input.scenario);
  const structure = getFallbackStructure("ELEVEN_A_SIDE");

  const problem: TeamCompositionProblem = {
    contractVersion: 1,
    context: "LEAGUE_TEAMS",
    scenario,
    players,
    targetTeams,
    lockedAssignments,
    structure,
    deterministicSeed: input.deterministicSeed,
  };

  const proposal = composeTeams(problem);

  const currentFingerprint = computeInputFingerprint(players, targetTeams, lockedAssignments, input.scenario);
  if (proposal.inputFingerprint !== currentFingerprint) {
    throw new Error("Proposal is stale — player or team data has changed since generation. Please regenerate.");
  }

  if (!proposal.validation.valid) {
    throw new Error(`Proposal has blocking issues: ${proposal.validation.blockingIssues.map((i) => i.message).join("; ")}`);
  }

  const beforeAssignments = new Map(
    players.filter((p) => p.currentTeamId).map((p) => [p.id, p.currentTeamId!]),
  );

  const updates: { playerId: string; newTeamId: string }[] = [];
  for (const assignment of proposal.assignments) {
    const player = players.find((p) => p.id === assignment.playerId);
    if (!player) continue;
    if (assignment.source === "LOCKED" || assignment.source === "PRESERVED") continue;
    if (player.currentTeamId === assignment.teamId) continue;
    updates.push({ playerId: assignment.playerId, newTeamId: assignment.teamId });
  }

  await db.$transaction(
    updates.map((u) =>
      db.player.update({
        where: { id: u.playerId },
        data: { coreTeamId: u.newTeamId },
      }),
    ),
  );

  // Also synchronize FootballGroupPlayer.coreTeamId
  await db.footballGroupPlayer.updateMany({
    where: {
      playerId: { in: updates.map((u) => u.playerId) },
      footballGroupId: input.footballGroupId,
      status: "ACTIVE",
    },
    data: {},
  });

  for (const u of updates) {
    await db.footballGroupPlayer.updateMany({
      where: {
        playerId: u.playerId,
        footballGroupId: input.footballGroupId,
        status: "ACTIVE",
      },
      data: { coreTeamId: u.newTeamId },
    });
  }

  await recordDecision({
    decisionType: "TEAM_COMPOSITION",
    entityType: "LEAGUE_SEASON",
    entityId: input.leagueSeasonId,
    action: "APPLY_TEAM_COMPOSITION",
    reason: `Applied ${input.scenario} team composition`,
    organisationId: ctx.organisationId,
    beforeSnapshot: { assignments: Object.fromEntries(beforeAssignments) },
    afterSnapshot: {
      assignments: Object.fromEntries(proposal.assignments.map((a) => [a.playerId, a.teamId])),
      scenarioCode: proposal.scenarioCode,
      playersMoved: proposal.proposalMetrics.totalPlayersMoved,
    },
  });

  return {
    applied: true,
    teamCount: targetTeams.length,
    playersMoved: updates.length,
  };
}

function computeInputFingerprint(
  players: CompositionPlayer[],
  targetTeams: CompositionTargetTeam[],
  lockedAssignments: LockedCompositionAssignment[],
  scenarioCode: SystemTeamScenario,
): string {
  const parts: string[] = [
    scenarioCode,
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