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
import { getFallbackStructure, type GameFormat } from "@/domain/team-composition/structural-requirements";
import { checkScenarioPermission, checkCompositionProposalPolicy } from "@/lib/policies/composition-policy";
import { computeInputFingerprint } from "@/domain/team-composition/proposal-validation";
import { NEUTRAL_UNRATED_RATING } from "@/lib/ratings/player-rating";
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
  StructuralSlotRequirement,
  StructuralRole,
} from "@/domain/team-composition/team-composition-types";
import { computeCompositeRatings, type PlayerAttributeProfile } from "@/lib/events/event-types";
import { mapPositionCodeToBroad, getPositionFit } from "@/domain/team-composition/position-suitability";
import { recordDecision } from "@/domain/assistant-manager/service";

// ── Position mapping ──────────────────────────────────────────────

function buildRoleSuitability(player: PlayerAttributeProfile): RoleSuitabilityProfile {
  const primary = mapPositionCodeToBroad(player.primaryPosition ?? "") as BroadPosition;
  const secondary = player.secondaryPosition ? (mapPositionCodeToBroad(player.secondaryPosition) as BroadPosition) : undefined;
  const tertiary = player.tertiaryPosition ? (mapPositionCodeToBroad(player.tertiaryPosition) as BroadPosition) : undefined;

  return {
    goalkeeper: getPositionFit(primary, secondary, tertiary, ["goalkeeper"]),
    defence: getPositionFit(primary, secondary, tertiary, ["defender", "flexible"]),
    midfield: getPositionFit(primary, secondary, tertiary, ["midfielder", "flexible"]),
    attack: getPositionFit(primary, secondary, tertiary, ["forward", "flexible"]),
    flexible: getPositionFit(primary, secondary, tertiary, ["defender", "midfielder", "forward", "goalkeeper", "flexible"]),
  };
}

export function buildRoleStrength(player: PlayerAttributeProfile): RoleStrengthProfile {
  const ratings = computeCompositeRatings(player);
  return {
    // Phase 9 audit (§63): preserve null like the sibling fields below — computeRoleStrength
    // correctly excludes null role-strength attributes from its weighted average, but a
    // coerced 0 would drag an unrated GK-capable player's goalkeeper strength down instead.
    goalkeeper: player.goalkeeperAbility === "YES" ? (ratings.overallLevel ?? null) : null,
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
  gameFormat: GameFormat;
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
      // Phase 9 audit (§63): unrated must not sort/score as worse than every rated player.
      // overallStrengthRated is the authoritative "was this a real rating" flag consumers
      // should prefer; this numeric fallback exists only for the many call sites throughout
      // deterministic-team-composer.ts/position-suitability.ts that need a plain number.
      overallStrength: ratings.overallLevel ?? NEUTRAL_UNRATED_RATING,
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

  const structure = input.formationId
    ? await resolveFormationStructure(input.formationId, input.gameFormat, ctx.orgFilter)
    : getFallbackStructure(input.gameFormat);

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
  const structure = input.formationId
    ? await resolveFormationStructure(input.formationId, input.gameFormat, ctx.orgFilter)
    : getFallbackStructure(input.gameFormat);

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

  // Compute structure hash the same way composeTeams does for fingerprint consistency
  const structureHash = structure.source + ":"
    + structure.slots.map((s) => `${s.role}:${s.count}:${s.acceptedPositions.join("+")}`).join("|")
    + ":" + (structure.formationId ?? "none");

  const currentFingerprint = computeInputFingerprint(players, targetTeams, lockedAssignments, input.scenario, structureHash);
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

async function resolveFormationStructure(
  formationId: string,
  fallbackFormat: GameFormat,
  orgFilter: OrgFilterMode,
): Promise<TeamCompositionProblem["structure"]> {
  const orgWhere = orgFilter.type === "org" ? orgFilter.filter : {};
  const formation = await db.formation.findFirst({
    where: { id: formationId, ...orgWhere, isArchived: false },
    include: { slots: { orderBy: { sortOrder: "asc" } } },
  });

  if (!formation) {
    return getFallbackStructure(fallbackFormat);
  }

  const slots: StructuralSlotRequirement[] = formation.slots.map((slot) => ({
    role: formationSlotRoleToStructuralRole(slot.roleType),
    count: 1,
    acceptedPositions: (slot.acceptedPositionIds as string[]).map((p) => p as BroadPosition),
    label: slot.label ?? slot.shortLabel ?? formationSlotRoleToStructuralRole(slot.roleType),
  }));

  const consolidated = consolidateSlots(slots);

  return {
    slots: consolidated,
    requireGoalkeeper: consolidated.some((s) => s.role === "GOALKEEPER"),
    source: "FORMATION" as const,
    formationId: formation.id,
    formationName: formation.name,
  };
}

function formationSlotRoleToStructuralRole(roleType: string): StructuralRole {
  switch (roleType) {
    case "GOALKEEPER": return "GOALKEEPER";
    case "DEFENDER":
    case "DEFENSIVE_MIDFIELDER": return "DEFENCE";
    case "MIDFIELDER":
    case "ATTACKING_MIDFIELDER": return "MIDFIELD";
    case "FORWARD": return "ATTACK";
    default: return "FLEXIBLE";
  }
}

function consolidateSlots(slots: StructuralSlotRequirement[]): StructuralSlotRequirement[] {
  const map = new Map<string, StructuralSlotRequirement>();
  for (const slot of slots) {
    const key = `${slot.role}:${slot.acceptedPositions.sort().join(",")}`;
    const existing = map.get(key);
    if (existing) {
      map.set(key, { ...existing, count: existing.count + slot.count });
    } else {
      map.set(key, { ...slot, count: slot.count });
    }
  }
  return Array.from(map.values());
}