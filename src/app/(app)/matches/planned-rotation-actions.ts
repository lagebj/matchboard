"use server";

import { revalidatePath } from "next/cache";
import { requirePageActorContext, requireMutationRole } from "@/lib/auth/actor-context";
import { logMutationEvent } from "@/lib/security/audit-log";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import { db } from "@/lib/db";
import {
  getPlannedRotation,
  createPlannedRotation,
  updatePlannedRotation,
  deletePlannedRotation,
  validatePlannedChanges,
  checkPlannedRotationCoverage,
  type PlannedRotationWithChanges,
  type PlannedRotationChangeData,
  type PlannedRotationValidationIssue,
  type PlannedRotationCoverageIssue,
} from "@/lib/planned-rotation/planned-rotation";
import type { CreatePlannedRotationInput, UpdatePlannedRotationInput } from "@/lib/planned-rotation/planned-rotation";
import { GAME_FORMAT_PLAYERS } from "@/lib/formations/types";
import type { GameFormat } from "@/generated/prisma/client";
import {
  getSeasonCombinationEvidence,
  aggregateSeasonCombinations,
  selectRelevantPartnerships,
  type SeasonCombinationSummary,
} from "@/lib/evidence/combination-aggregation";
import { getMatchPhaseWindows } from "@/lib/evidence/match-state-timeline";
import { getLeaguePeriodConfig, getTotalPeriodDurationMs } from "@/lib/live-match/period-config";
import { getTeamSeasonMatchPhasePatterns } from "@/lib/evidence/match-phase-pattern-evidence";
import { getTeamPositionContextEvidenceForPairs } from "@/lib/evidence/position-context-evidence";
import { getOpponentTacticalTendencies } from "@/lib/opponents/playing-style-query";
import {
  evaluatePlannedScenario,
  type PlannedScenarioEvaluation,
} from "@/lib/planned-rotation/scenario-evaluation";
import { generateRotationPlan, type RotationPlanDecisionPoint, type RotationPlanPlayer } from "@/lib/planned-rotation/generate-rotation-plan";
import { getTeamSeasonTransitionPatterns } from "@/lib/evidence/transition-structure-evidence";
import { getCumulativePeriodOffsetsMs, type PeriodConfig } from "@/lib/live-match/period-config";
import { mapPositionCodeToBroad } from "@/domain/team-composition/position-suitability";

async function requireMatchOrgAccess(matchId: string, orgFilter: { type: string; filter: Record<string, unknown> }): Promise<void> {
  if (orgFilter.type !== "org") return;
  const match = await db.match.findFirst({ where: { id: matchId, ...orgFilter.filter }, select: { id: true } });
  if (!match) throw new Error("Match not found or access denied.");
}

async function requireRotationOrgAccess(rotationId: string, orgFilter: { type: string; filter: Record<string, unknown> }): Promise<void> {
  if (orgFilter.type !== "org") return;
  const rotation = await db.plannedRotation.findFirst({ where: { id: rotationId, ...orgFilter.filter }, select: { id: true } });
  if (!rotation) throw new Error("Rotation plan not found or access denied.");
}

function revalidateMatchPaths(matchId: string): void {
  revalidatePath(`/matches/${matchId}`);
  revalidatePath(`/o/[orgSlug]/matches/${matchId}`);
}

export async function getPlannedRotationAction(
  matchId: string,
  teamId: string,
): Promise<{ success: true; rotation: PlannedRotationWithChanges | null } | { success: false; error: string }> {
  try {
    const ctx = await requirePageActorContext();
    setTenantOrganisationId(ctx.organisationId);
    const rotation = await getPlannedRotation(matchId, teamId, ctx.orgFilter);
    return { success: true, rotation };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to get rotation plan." };
  }
}

export async function createPlannedRotationAction(
  input: CreatePlannedRotationInput,
): Promise<{ success: true; rotation: PlannedRotationWithChanges } | { success: false; error: string }> {
  try {
    const ctx = await requirePageActorContext();
    setTenantOrganisationId(ctx.organisationId);
    requireMutationRole(ctx);

    const match = await db.match.findFirst({
      where: { id: input.matchId, ...ctx.orgFilter.filter },
      select: { id: true, teamId: true, status: true },
    });
    if (!match) return { success: false, error: "Match not found or access denied." };
    if (match.teamId !== input.teamId) return { success: false, error: "Team does not belong to this match." };
    if (match.status === "CANCELLED") return { success: false, error: "Cannot create rotation plan for a cancelled match." };

    const result = await createPlannedRotation(input, ctx.orgFilter);
    if (!result.success) return { success: false, error: result.error };

    if (input.changes && input.changes.length > 0) {
      const selections = await db.selection.findMany({
        where: {
          matchId: input.matchId,
          status: { in: ["DRAFT", "FINALIZED"] },
          match: { teamId: input.teamId },
        },
        select: { playerId: true },
      });
      const squadPlayerIds = new Set(selections.map((s) => s.playerId));
      const validationIssues = validatePlannedChanges(input.changes, squadPlayerIds);
      if (validationIssues.some((issue) => issue.type === "error")) {
        const errorMessages = validationIssues
          .filter((issue) => issue.type === "error")
          .map((issue) => issue.message);
        return { success: false, error: `Validation failed: ${errorMessages.join("; ")}` };
      }
    }

    logMutationEvent("planned_rotation_create", ctx.email || "unknown", "planned_rotation", result.rotation.id, "success");
    revalidateMatchPaths(input.matchId);

    return { success: true, rotation: result.rotation };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to create rotation plan." };
  }
}

export async function updatePlannedRotationAction(
  rotationId: string,
  input: UpdatePlannedRotationInput,
): Promise<{ success: true; rotation: PlannedRotationWithChanges } | { success: false; error: string }> {
  try {
    const ctx = await requirePageActorContext();
    setTenantOrganisationId(ctx.organisationId);
    requireMutationRole(ctx);

    await requireRotationOrgAccess(rotationId, ctx.orgFilter);

    const result = await updatePlannedRotation(rotationId, input, ctx.orgFilter);
    if (!result.success) return { success: false, error: result.error };

    if (input.changes && input.changes.length > 0) {
      const selections = await db.selection.findMany({
        where: {
          matchId: result.rotation.matchId,
          status: { in: ["DRAFT", "FINALIZED"] },
          match: { teamId: result.rotation.teamId },
        },
        select: { playerId: true },
      });
      const squadPlayerIds = new Set(selections.map((s) => s.playerId));
      const validationIssues = validatePlannedChanges(input.changes, squadPlayerIds);
      if (validationIssues.some((issue) => issue.type === "error")) {
        const errorMessages = validationIssues
          .filter((issue) => issue.type === "error")
          .map((issue) => issue.message);
        return { success: false, error: `Validation failed: ${errorMessages.join("; ")}` };
      }
    }

    const matchId = result.rotation.matchId;
    logMutationEvent("planned_rotation_update", ctx.email || "unknown", "planned_rotation", rotationId, "success");
    revalidateMatchPaths(matchId);

    return { success: true, rotation: result.rotation };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to update rotation plan." };
  }
}

export async function deletePlannedRotationAction(
  rotationId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const ctx = await requirePageActorContext();
    setTenantOrganisationId(ctx.organisationId);
    requireMutationRole(ctx);

    const rotation = await db.plannedRotation.findFirst({
      where: { id: rotationId, ...ctx.orgFilter.filter },
      select: { id: true, matchId: true, status: true },
    });
    if (!rotation) return { success: false, error: "Rotation plan not found." };

    const result = await deletePlannedRotation(rotationId, ctx.orgFilter);
    if (!result.success) return { success: false, error: result.error };

    logMutationEvent("planned_rotation_delete", ctx.email || "unknown", "planned_rotation", rotationId, "success");
    revalidateMatchPaths(rotation.matchId);

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to delete rotation plan." };
  }
}

export async function validatePlannedChangesAction(
  matchId: string,
  teamId: string,
  changes: PlannedRotationChangeData[],
): Promise<{ success: true; issues: PlannedRotationValidationIssue[] } | { success: false; error: string }> {
  try {
    const ctx = await requirePageActorContext();
    setTenantOrganisationId(ctx.organisationId);

    await requireMatchOrgAccess(matchId, ctx.orgFilter);

    const selections = await db.selection.findMany({
      where: {
        matchId,
        status: { in: ["DRAFT", "FINALIZED"] },
        match: { teamId },
      },
      select: { playerId: true },
    });
    const squadPlayerIds = new Set(selections.map((s) => s.playerId));

    const issues = validatePlannedChanges(changes, squadPlayerIds);
    return { success: true, issues };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to validate changes." };
  }
}

/**
 * Coverage check for a rotation plan (Phase 5, previously computed and tested but never wired to
 * any UI). Starters are read from the team's current match line-up (Tactics tab), never
 * fabricated from the full drafted squad — if no line-up has been set yet, `hasLineup: false` is
 * returned so the UI can say so honestly instead of guessing who is actually starting.
 */
export async function checkPlannedRotationCoverageAction(
  matchId: string,
  teamId: string,
  changes: PlannedRotationChangeData[],
): Promise<
  | {
      success: true;
      hasLineup: true;
      issues: PlannedRotationCoverageIssue[];
      partnershipEvidence: SeasonCombinationSummary[];
      scenario: PlannedScenarioEvaluation;
    }
  | { success: true; hasLineup: false; issues: []; partnershipEvidence: []; scenario: null }
  | { success: false; error: string }
> {
  try {
    const ctx = await requirePageActorContext();
    setTenantOrganisationId(ctx.organisationId);

    const match = await db.match.findFirst({
      where: { id: matchId, ...ctx.orgFilter.filter },
      select: {
        id: true,
        gameFormat: true,
        matchType: true,
        opponentTeamId: true,
        matchRound: { select: { leagueSeasonId: true } },
      },
    });
    if (!match) return { success: false, error: "Match not found or access denied." };

    const lineup = await db.matchLineup.findFirst({
      where: { matchId, teamId, ...ctx.orgFilter.filter },
      include: {
        formation: { include: { slots: { select: { id: true, roleType: true } } } },
        assignments: { where: { playerId: { not: null } }, select: { playerId: true, slotId: true } },
      },
    });
    if (!lineup || lineup.assignments.length === 0) {
      return { success: true, hasLineup: false, issues: [], partnershipEvidence: [], scenario: null };
    }

    const selections = await db.selection.findMany({
      where: { matchId, status: { in: ["DRAFT", "FINALIZED"] }, match: { teamId } },
      select: { playerId: true },
    });
    const squadPlayerIds = new Set(selections.map((s) => s.playerId));

    const slotsById = new Map((lineup.formation?.slots ?? []).map((s) => [s.id, s]));
    const starters = lineup.assignments
      .filter((a): a is typeof a & { playerId: string } => a.playerId !== null)
      .map((a) => {
        const roleType = slotsById.get(a.slotId)?.roleType;
        return { playerId: a.playerId, position: roleType === "GOALKEEPER" ? "GK" : (roleType ?? "FLEXIBLE") };
      });

    const minimumOnPitch = GAME_FORMAT_PLAYERS[match.gameFormat as GameFormat] ?? starters.length;

    // Total match duration in seconds (Evidence-Informed Match Planning programme, Bundle 4) --
    // previously always 0 ("no per-change duration model exists"); the League period config
    // (Bundle 1) already gives a real answer via its configured half lengths.
    const periodConfig = getLeaguePeriodConfig(match.matchType);
    const totalMatchDurationMs = getTotalPeriodDurationMs(periodConfig);
    const totalMatchSeconds = totalMatchDurationMs !== null ? Math.round(totalMatchDurationMs / 1000) : null;

    const issues = checkPlannedRotationCoverage(starters, changes, squadPlayerIds, {
      totalMatchSeconds: totalMatchSeconds ?? 0,
      minimumOnPitch,
      positions: [],
    });

    const seasonEvidence = await getSeasonCombinationEvidence(match.matchRound.leagueSeasonId);
    const combinationEvidence = aggregateSeasonCombinations(seasonEvidence);
    const partnershipEvidence = selectRelevantPartnerships(
      starters.map((s) => s.playerId),
      combinationEvidence,
    );

    const [matchPhasePatterns, opponentTendencies] = await Promise.all([
      getTeamSeasonMatchPhasePatterns(match.matchRound.leagueSeasonId, teamId, ctx.orgFilter),
      match.opponentTeamId ? getOpponentTacticalTendencies(match.opponentTeamId, ctx.orgFilter) : Promise.resolve([]),
    ]);

    // Position-context evidence addendum: every distinct (playerId, position) pair the plan can
    // possibly touch -- starting assignments plus every change's incoming position -- evaluated
    // once up front so evaluatePlannedScenario (pure/DB-free) can look each up by key.
    const positionContextPairs = new Map<string, { playerId: string; position: string }>();
    for (const starter of starters) {
      positionContextPairs.set(`${starter.playerId}:${starter.position}`, starter);
    }
    for (const change of changes) {
      if (change.inPlayerId && change.inPosition) {
        positionContextPairs.set(`${change.inPlayerId}:${change.inPosition}`, {
          playerId: change.inPlayerId,
          position: change.inPosition,
        });
      }
    }
    const positionContextEvidence = await getTeamPositionContextEvidenceForPairs(
      match.matchRound.leagueSeasonId,
      teamId,
      [...positionContextPairs.values()],
      ctx.orgFilter,
    );

    const scenario = evaluatePlannedScenario({
      starters,
      changes,
      totalMatchSeconds,
      phaseWindows: getMatchPhaseWindows(periodConfig),
      matchPhasePatterns,
      combinationEvidence,
      opponentTendencies,
      positionContextEvidence,
    });

    return { success: true, hasLineup: true, issues, partnershipEvidence, scenario };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to check rotation coverage." };
  }
}
/**
 * Bounded internal decision-point grid (Evidence-Informed Match Planning, Bundle 7, ADR-0118):
 * 1/3 and 2/3 of each playing period's own duration, plus the absolute start of every playing
 * period after the first (a natural-break rotation opportunity). A computational search bound,
 * not asserted footballing doctrine — see generate-rotation-plan.ts's own header comment.
 */
function buildDecisionPoints(periodConfig: PeriodConfig[]): RotationPlanDecisionPoint[] {
  const offsets = getCumulativePeriodOffsetsMs(periodConfig);
  const playingPeriods = periodConfig.filter((p) => p.type === "playing" && p.durationMs != null);
  const points: RotationPlanDecisionPoint[] = [];

  playingPeriods.forEach((period, index) => {
    const startMs = offsets[period.key] ?? 0;
    const durationMs = period.durationMs!;
    const startSeconds = Math.round(startMs / 1000);

    if (index > 0) {
      points.push({ atSeconds: startSeconds, period: period.key, isNaturalBreak: true });
    }

    const thirdMs = durationMs / 3;
    points.push({ atSeconds: Math.round((startMs + thirdMs) / 1000), period: period.key, isNaturalBreak: false });
    points.push({ atSeconds: Math.round((startMs + 2 * thirdMs) / 1000), period: period.key, isNaturalBreak: false });
  });

  return points;
}

/**
 * Evidence-aware automatic rotation plan generation (Evidence-Informed Match Planning, Bundle 7,
 * ADR-0118). Only offered when no rotation plan exists yet for this match/team — matching the
 * existing round-draft "clear first, then regenerate" convention rather than adding a new
 * MANUAL/AUTO source column to PlannedRotationChange. A coach who wants to regenerate from
 * scratch deletes the existing plan first (the existing "Clear rotation plan" action), exactly
 * as clearing a round's draft selections before regenerating it.
 */
export async function generateRotationPlanAction(
  matchId: string,
  teamId: string,
): Promise<{ success: true; rotation: PlannedRotationWithChanges } | { success: false; error: string }> {
  try {
    const ctx = await requirePageActorContext();
    setTenantOrganisationId(ctx.organisationId);
    requireMutationRole(ctx);

    const match = await db.match.findFirst({
      where: { id: matchId, teamId, ...ctx.orgFilter.filter },
      select: {
        id: true,
        gameFormat: true,
        matchType: true,
        status: true,
        opponentTeamId: true,
        matchRound: { select: { leagueSeasonId: true } },
      },
    });
    if (!match) return { success: false, error: "Match not found or access denied." };
    if (match.status === "CANCELLED") return { success: false, error: "Cannot generate a rotation plan for a cancelled match." };

    const lineup = await db.matchLineup.findFirst({
      where: { matchId, teamId, ...ctx.orgFilter.filter },
      include: {
        formation: { include: { slots: { select: { id: true, roleType: true } } } },
        assignments: { where: { playerId: { not: null } }, select: { playerId: true, slotId: true } },
      },
    });
    if (!lineup || lineup.assignments.length === 0) {
      return { success: false, error: "Set a match line-up before generating a rotation plan." };
    }

    const slotsById = new Map((lineup.formation?.slots ?? []).map((s) => [s.id, s]));
    const starters = lineup.assignments
      .filter((a): a is typeof a & { playerId: string } => a.playerId !== null)
      .map((a) => {
        const roleType = slotsById.get(a.slotId)?.roleType;
        return { playerId: a.playerId, position: roleType === "GOALKEEPER" ? "GK" : (roleType ?? "FLEXIBLE") };
      });

    const selections = await db.selection.findMany({
      where: { matchId, status: { in: ["DRAFT", "FINALIZED"] }, match: { teamId } },
      select: { playerId: true },
    });
    const starterIds = new Set(starters.map((s) => s.playerId));
    const benchPlayerIds = selections.map((s) => s.playerId).filter((id) => !starterIds.has(id));

    if (benchPlayerIds.length === 0) {
      return { success: false, error: "No bench players available to rotate — add players to the squad first." };
    }

    const squadPlayerIds = [...starterIds, ...benchPlayerIds];
    const squadPlayers = await db.player.findMany({
      where: { id: { in: squadPlayerIds }, ...ctx.orgFilter.filter },
      select: {
        id: true,
        primaryPosition: true,
        secondaryPosition: true,
        tertiaryPosition: true,
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
      },
    });

    const players = new Map<string, RotationPlanPlayer>(
      squadPlayers.map((p) => [
        p.id,
        {
          playerId: p.id,
          declaredPositions: {
            primary: mapPositionCodeToBroad(p.primaryPosition ?? ""),
            secondary: p.secondaryPosition ? mapPositionCodeToBroad(p.secondaryPosition) : undefined,
            tertiary: p.tertiaryPosition ? mapPositionCodeToBroad(p.tertiaryPosition) : undefined,
          },
          tacticalAttributes: {
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
          },
        },
      ]),
    );

    const periodConfig = getLeaguePeriodConfig(match.matchType);
    const totalMatchDurationMs = getTotalPeriodDurationMs(periodConfig);
    const totalMatchSeconds = totalMatchDurationMs !== null ? Math.round(totalMatchDurationMs / 1000) : 0;
    if (totalMatchSeconds <= 0) {
      return { success: false, error: "Match duration is not configured." };
    }
    const decisionPoints = buildDecisionPoints(periodConfig);

    const [transitionPatterns, opponentTendencies] = await Promise.all([
      match.matchRound.leagueSeasonId
        ? getTeamSeasonTransitionPatterns(match.matchRound.leagueSeasonId, teamId, ctx.orgFilter)
        : Promise.resolve([]),
      match.opponentTeamId ? getOpponentTacticalTendencies(match.opponentTeamId, ctx.orgFilter) : Promise.resolve([]),
    ]);

    // Position-context evidence addendum: every (bench player, starting role) pair a
    // substitution could plausibly create -- the generator itself decides which are actually
    // used, this only needs to cover every combination it might look up.
    const distinctStartingRoles = [...new Set(starters.map((s) => s.position))];
    const positionContextEvidence = match.matchRound.leagueSeasonId
      ? await getTeamPositionContextEvidenceForPairs(
          match.matchRound.leagueSeasonId,
          teamId,
          benchPlayerIds.flatMap((playerId) => distinctStartingRoles.map((position) => ({ playerId, position }))),
          ctx.orgFilter,
        )
      : [];

    const generated = generateRotationPlan({
      starters,
      benchPlayerIds,
      players,
      totalMatchSeconds,
      decisionPoints,
      opponentTendencies: opponentTendencies.map((t) => ({ tag: t.tag, confidence: t.confidence })),
      transitionPatterns,
      positionContextEvidence,
      seed: `${matchId}:${teamId}`,
    });

    const changes: PlannedRotationChangeData[] = generated.changes.map((c) => ({
      outPlayerId: c.outPlayerId,
      inPlayerId: c.inPlayerId,
      outPosition: c.outPosition,
      inPosition: c.inPosition,
      positionOnly: c.positionOnly,
      approximateMatchSeconds: c.approximateMatchSeconds,
      notes: `Generated: ${c.explanation}`,
    }));

    const result = await createPlannedRotation({ matchId, teamId, changes }, ctx.orgFilter);
    if (!result.success) return { success: false, error: result.error };

    logMutationEvent("planned_rotation_generate", ctx.email || "unknown", "planned_rotation", result.rotation.id, "success");
    revalidateMatchPaths(matchId);

    return { success: true, rotation: result.rotation };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to generate rotation plan." };
  }
}
