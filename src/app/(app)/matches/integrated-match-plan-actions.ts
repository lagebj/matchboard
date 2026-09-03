"use server";

// ─────────────────────────────────────────────────────────────────
// Integrated starting-line-up + rotation-plan generation.
//
// Evidence-Informed Match Planning programme, Bundle 8 (ADR-0119).
// "Starting line-up and rotation generation must reason together. Do not optimise the starting
// seven and force rotation generation to repair an unfair or structurally brittle plan later"
// (PROGRAMME.md). Realised here as one action generating both stages from one shared evidence
// context (fairness, role suitability, opponent tendency, combination evidence, transition
// evidence) in a single pass — not two independently-optimised stages bolted together.
//
// Does NOT generate a "best XI" (PROGRAMME.md): suggestLineupForFormation()'s existing
// position-fit scoring remains the base; this only adds a bounded evidence layer on top via its
// evidenceBonusForSlot() hook (Bundle 8's own addition to that shared owner).
// ─────────────────────────────────────────────────────────────────

import { revalidatePath } from "next/cache";
import { requirePageActorContext, requireMutationRole, requireMatchGroupAccess } from "@/lib/auth/actor-context";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import { db } from "@/lib/db";
import { suggestLineupForFormation, type LineupEvidenceBonus } from "@/lib/formations/suggest";
import type { FormationSlotRoleType, BroadPosition } from "@/lib/formations/types";
import { getPlayerPoolWithHelpers } from "@/app/(app)/matches/suggest-actions";
import { applySuggestedLineup } from "@/app/(app)/matches/suggest-actions";
import { getLeagueSeasonFairness } from "@/lib/selection/get-planning-period-fairness";
import { getOpponentTacticalTendencies } from "@/lib/opponents/playing-style-query";
import { getSeasonCombinationEvidence, aggregateSeasonCombinations } from "@/lib/evidence/combination-aggregation";
import { getCombinationScoreModifier } from "@/lib/selection/combination-scoring";
import { capEvidenceBonus, assertEvidenceDidNotExcludeCandidates } from "@/lib/policies/evidence-guardrails";
import { computeOutfieldRoleSuitabilityProfile } from "@/domain/team-composition/outfield-role-evidence";
import {
  mapPositionCodeToBroad,
  mapPositionLabelToOutfieldRole,
} from "@/domain/team-composition/position-suitability";
import type { OutfieldPositionExposureEvidence } from "@/domain/team-composition/team-composition-types";
import { getPositionExposure } from "@/lib/insights/position-exposure";
import { summarizeExposureByOutfieldRole } from "@/lib/players/get-player-outfield-role-suitability";
import { preferredFunctionFor, computeOpponentFunctionBonus } from "@/lib/planned-rotation/opponent-function-preference";
import { computePositionContextBonus, getTeamPositionContextEvidenceForPairs } from "@/lib/evidence/position-context-evidence";
import { generateRotationPlan, type RotationPlanPlayer, type RotationPlanDecisionPoint } from "@/lib/planned-rotation/generate-rotation-plan";
import { getTeamSeasonTransitionPatterns } from "@/lib/evidence/transition-structure-evidence";
import { createPlannedRotation, type PlannedRotationChangeData } from "@/lib/planned-rotation/planned-rotation";
import { getLeaguePeriodConfig, getTotalPeriodDurationMs, getCumulativePeriodOffsetsMs, type PeriodConfig } from "@/lib/live-match/period-config";
import { logMutationEvent } from "@/lib/security/audit-log";

const ROLE_FAIRNESS_CAP = 20;
const ROLE_DEVELOPMENTAL_BONUS = 8;
const ROLE_COMBINATION_CAP = 4;

function buildDecisionPoints(periodConfig: PeriodConfig[]): RotationPlanDecisionPoint[] {
  const offsets = getCumulativePeriodOffsetsMs(periodConfig);
  const playingPeriods = periodConfig.filter((p) => p.type === "playing" && p.durationMs != null);
  const points: RotationPlanDecisionPoint[] = [];

  playingPeriods.forEach((period, index) => {
    const startMs = offsets[period.key] ?? 0;
    const durationMs = period.durationMs!;

    if (index > 0) {
      points.push({ atSeconds: Math.round(startMs / 1000), period: period.key, isNaturalBreak: true });
    }

    const thirdMs = durationMs / 3;
    points.push({ atSeconds: Math.round((startMs + thirdMs) / 1000), period: period.key, isNaturalBreak: false });
    points.push({ atSeconds: Math.round((startMs + 2 * thirdMs) / 1000), period: period.key, isNaturalBreak: false });
  });

  return points;
}

/**
 * Generates a starting line-up and a full rotation plan together, from one shared evidence
 * context. Only offered when no rotation plan exists yet for the match/team (mirrors Bundle 7's
 * generateRotationPlanAction() — createPlannedRotation() already refuses otherwise). The lineup
 * itself CAN be regenerated independently afterward via the existing "Suggest lineup" flow; this
 * action's own job is the first, evidence-aware pass across both stages together.
 */
export async function generateIntegratedMatchPlanAction(
  matchId: string,
  formationId: string,
): Promise<{ success: true; changeCount: number } | { success: false; error: string }> {
  try {
    const ctx = await requirePageActorContext();
    setTenantOrganisationId(ctx.organisationId);
    requireMutationRole(ctx);
    await requireMatchGroupAccess(ctx, matchId);

    const match = await db.match.findFirst({
      where: { id: matchId, ...ctx.orgFilter.filter },
      select: {
        id: true,
        teamId: true,
        gameFormat: true,
        matchType: true,
        status: true,
        opponentTeamId: true,
        matchRound: { select: { leagueSeasonId: true } },
      },
    });
    if (!match) return { success: false, error: "Match not found or access denied." };
    if (match.status === "CANCELLED") return { success: false, error: "Cannot generate a plan for a cancelled match." };

    const existingRotation = await db.plannedRotation.findUnique({
      where: { matchId_teamId: { matchId, teamId: match.teamId } },
    });
    if (existingRotation) {
      return { success: false, error: "A rotation plan already exists for this match — clear it first to regenerate from scratch." };
    }

    const formation = await db.formation.findFirst({
      where: { id: formationId, ...ctx.orgFilter.filter },
      include: { slots: { orderBy: { sortOrder: "asc" } } },
    });
    if (!formation) return { success: false, error: "Formation not found." };

    const playerPool = await getPlayerPoolWithHelpers(matchId, ctx.orgFilter);
    if (playerPool.length === 0) {
      return { success: false, error: "No players available to plan — add players to the squad first." };
    }

    const leagueSeasonId = match.matchRound.leagueSeasonId;

    const [fairness, opponentTendencies, seasonCombinationEvidence, exposureRows] = await Promise.all([
      leagueSeasonId ? getLeagueSeasonFairness(leagueSeasonId) : Promise.resolve({ players: [] }),
      match.opponentTeamId ? getOpponentTacticalTendencies(match.opponentTeamId, ctx.orgFilter) : Promise.resolve([]),
      leagueSeasonId ? getSeasonCombinationEvidence(leagueSeasonId) : Promise.resolve([]),
      leagueSeasonId
        ? getPositionExposure({ leagueSeasonId, scope: "full_year", context: "league", includeInactive: true })
        : Promise.resolve([]),
    ]);

    const coreCountByPlayerId = new Map(fairness.players.map((p) => [p.playerId, p.coreCount]));
    const maxCoreCount = Math.max(0, ...fairness.players.map((p) => p.coreCount));
    const combinationEvidence = aggregateSeasonCombinations(seasonCombinationEvidence);
    const preferredFunction = preferredFunctionFor(opponentTendencies.map((t) => ({ tag: t.tag, confidence: t.confidence })));

    const exposureByPlayerId = new Map<string, OutfieldPositionExposureEvidence>();
    for (const row of exposureRows) {
      exposureByPlayerId.set(row.playerId, summarizeExposureByOutfieldRole(row.realisedPositions));
    }

    // Position-context evidence addendum: one shared evidence context for both stages (starting
    // line-up scoring below, and rotation-plan generation further down) -- loaded once, matching
    // this bundle's own "one shared evidence context, not two independently-loaded stages"
    // design. Covers every (playerPool player, formation role) pair either stage could look up.
    const distinctRoleTypes = [...new Set(formation.slots.map((s) => (s.roleType as FormationSlotRoleType) === "GOALKEEPER" ? "GK" : s.roleType))];
    const positionContextEvidence = leagueSeasonId
      ? await getTeamPositionContextEvidenceForPairs(
          leagueSeasonId,
          match.teamId,
          playerPool.flatMap((p) => distinctRoleTypes.map((position) => ({ playerId: p.id, position }))),
          ctx.orgFilter,
        )
      : [];

    const evidenceBonusForSlot = (playerId: string, slot: { roleType: FormationSlotRoleType }, alreadyAssignedPlayerIds: string[]): LineupEvidenceBonus | undefined => {
      if (slot.roleType === "GOALKEEPER") return undefined; // Goalkeeper boundary — never evidence-scored.

      const player = playerPool.find((p) => p.id === playerId);
      if (!player) return undefined;

      const reasons: string[] = [];
      let score = 0;

      const coreCount = coreCountByPlayerId.get(playerId) ?? 0;
      const fairnessScore = capEvidenceBonus(maxCoreCount - coreCount, ROLE_FAIRNESS_CAP);
      if (fairnessScore > 0) {
        score += fairnessScore;
        reasons.push("Behind an equal share of starting opportunity this season");
      }

      const declaredPositions = {
        primary: mapPositionCodeToBroad(player.primaryPosition ?? ""),
        secondary: player.secondaryPosition ? mapPositionCodeToBroad(player.secondaryPosition) : undefined,
        tertiary: player.tertiaryPosition ? mapPositionCodeToBroad(player.tertiaryPosition) : undefined,
      };
      const exposure = exposureByPlayerId.get(playerId) ?? { matchCountByRole: {} };
      const outfieldProfile = computeOutfieldRoleSuitabilityProfile(declaredPositions, exposure);
      const vacatedRole = mapPositionLabelToOutfieldRole(slot.roleType);
      const roleResult = outfieldProfile.find((r) => r.role === vacatedRole);
      if (roleResult?.tier === "DEVELOPMENTAL") {
        score += ROLE_DEVELOPMENTAL_BONUS;
        reasons.push(`Recorded exposure supports this role (${roleResult.exposureConfidence.toLowerCase()})`);
      }

      if (preferredFunction) {
        const tacticalAttributes = {
          ballControl: player.ballControl,
          passing: player.passing,
          firstTouch: player.firstTouch,
          oneVOneAttacking: player.oneVOneAttacking,
          positioning: player.positioning,
          oneVOneDefending: player.oneVOneDefending,
          decisionMaking: player.decisionMaking,
          effort: player.effort,
          teamplay: player.teamplay,
          concentration: player.concentration,
          speed: player.speed,
          strength: player.strength,
        };
        const opponentBonus = computeOpponentFunctionBonus(tacticalAttributes, outfieldProfile, preferredFunction);
        if (opponentBonus > 0) {
          score += opponentBonus;
          reasons.push("Preserves a useful function against a recorded opponent tendency");
        }
      }

      const combinationBonus = capEvidenceBonus(
        getCombinationScoreModifier(playerId, alreadyAssignedPlayerIds, combinationEvidence),
        ROLE_COMBINATION_CAP,
      );
      if (combinationBonus > 0) {
        score += combinationBonus;
        reasons.push("Recorded partnership evidence with an already-placed teammate");
      }

      const positionContextBonus = computePositionContextBonus(
        positionContextEvidence.find((e) => e.playerId === playerId && e.position === slot.roleType),
      );
      if (positionContextBonus > 0) {
        score += positionContextBonus;
        reasons.push("Recorded outcomes at this position have historically been more favorable for this player");
      }

      if (score === 0) return undefined;
      return { score, reasons };
    };

    const beforeCandidateIds = playerPool.map((p) => p.id);

    const suggestion = suggestLineupForFormation({
      formationSlots: formation.slots.map((s) => ({
        id: s.id,
        gridX: s.gridX,
        gridY: s.gridY,
        label: s.label,
        shortLabel: s.shortLabel,
        roleType: s.roleType as FormationSlotRoleType,
        acceptedPositionIds: s.acceptedPositionIds as BroadPosition[],
        sortOrder: s.sortOrder,
      })),
      playerPool,
      evidenceBonusForSlot,
    });

    const afterCandidateIds = [...suggestion.assignments.map((a) => a.playerId), ...suggestion.benchPlayerIds];
    assertEvidenceDidNotExcludeCandidates(beforeCandidateIds, afterCandidateIds, "generateIntegratedMatchPlanAction lineup suggestion");

    const applyResult = await applySuggestedLineup(
      matchId,
      formationId,
      suggestion.assignments.map((a) => ({ slotId: a.slotId, playerId: a.playerId, source: "SUGGESTED" as const })),
      suggestion.benchPlayerIds,
    );
    if (!applyResult.success) return { success: false, error: "Failed to apply the generated lineup." };

    const starters = suggestion.assignments.map((a) => {
      const slot = formation.slots.find((s) => s.id === a.slotId);
      const roleType = slot?.roleType;
      return { playerId: a.playerId, position: roleType === "GOALKEEPER" ? "GK" : (roleType ?? "FLEXIBLE") };
    });

    const rotationPlayers = new Map<string, RotationPlanPlayer>(
      playerPool.map((p) => [
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

    let changeCount = 0;
    if (totalMatchSeconds > 0 && suggestion.benchPlayerIds.length > 0) {
      const transitionPatterns = leagueSeasonId
        ? await getTeamSeasonTransitionPatterns(leagueSeasonId, match.teamId, ctx.orgFilter)
        : [];
      const decisionPoints = buildDecisionPoints(periodConfig);

      const generated = generateRotationPlan({
        starters,
        benchPlayerIds: suggestion.benchPlayerIds,
        players: rotationPlayers,
        totalMatchSeconds,
        decisionPoints,
        opponentTendencies: opponentTendencies.map((t) => ({ tag: t.tag, confidence: t.confidence })),
        transitionPatterns,
        positionContextEvidence,
        seed: `${matchId}:${match.teamId}`,
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

      const rotationResult = await createPlannedRotation({ matchId, teamId: match.teamId, changes }, ctx.orgFilter);
      if (rotationResult.success) changeCount = changes.length;
    }

    logMutationEvent("planned_rotation_generate", ctx.email || "unknown", "planned_rotation", matchId, "success");
    revalidatePath(`/matches/${matchId}`);
    revalidatePath(`/o/[orgSlug]/matches/${matchId}`);

    return { success: true, changeCount };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to generate the integrated match plan." };
  }
}
