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
  | { success: true; hasLineup: true; issues: PlannedRotationCoverageIssue[]; partnershipEvidence: SeasonCombinationSummary[] }
  | { success: true; hasLineup: false; issues: []; partnershipEvidence: [] }
  | { success: false; error: string }
> {
  try {
    const ctx = await requirePageActorContext();
    setTenantOrganisationId(ctx.organisationId);

    const match = await db.match.findFirst({
      where: { id: matchId, ...ctx.orgFilter.filter },
      select: { id: true, gameFormat: true, matchRound: { select: { leagueSeasonId: true } } },
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
      return { success: true, hasLineup: false, issues: [], partnershipEvidence: [] };
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

    const issues = checkPlannedRotationCoverage(starters, changes, squadPlayerIds, {
      // Unused by the current coverage checks (no per-change duration model exists for League
      // matches — see AGENTS.md/hasLeagueMatchPassed on why duration isn't fabricated); kept only
      // to satisfy the function's options shape.
      totalMatchSeconds: 0,
      minimumOnPitch,
      positions: [],
    });

    const seasonEvidence = await getSeasonCombinationEvidence(match.matchRound.leagueSeasonId);
    const partnershipEvidence = selectRelevantPartnerships(
      starters.map((s) => s.playerId),
      aggregateSeasonCombinations(seasonEvidence),
    );

    return { success: true, hasLineup: true, issues, partnershipEvidence };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to check rotation coverage." };
  }
}