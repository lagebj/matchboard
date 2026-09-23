"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePageActorContext, requireMutationRole, requireMatchGroupAccess, requirePlayerGroupAccess } from "@/lib/auth/actor-context";
import { logMutationEvent } from "@/lib/security/audit-log";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";
import type { HelperProvenance } from "@/generated/prisma/client";
import {
  assertLeagueMatchHelperEligible,
  getLeagueMatchHelperCandidates,
} from "@/lib/matches/match-helper-eligibility";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";

// League Match helpers (ADR-0077) and match-day additions (ADR-0151): temporary match-level
// participation, independent of League Round finalisation. Never touches Selection or
// MatchRound.status — see the ADRs for the full invariant list.
//
// `provenance: HELPER` = traditional support/helper assignment (ADR-0077).
// `provenance: MATCH_DAY_ADDITION` = a real Player added specifically for this match
// without being part of the original Selection (ADR-0151).

async function requireMatchOrgAccess(matchId: string, orgFilter: OrgFilterMode): Promise<void> {
  if (orgFilter.type !== "org") return;
  const match = await db.match.findFirst({ where: { id: matchId, ...orgFilter.filter }, select: { id: true } });
  if (!match) throw new Error("Match not found or access denied.");
}

function revalidateMatchPaths(matchId: string): void {
  revalidatePath(`/matches/${matchId}`);
  revalidatePath(`/matches/${matchId}/live`);
  revalidatePath(`/matches/${matchId}/post-match`);
}

export async function addLeagueMatchHelperAction(input: {
  matchId: string;
  playerId: string;
  note?: string;
  provenance?: HelperProvenance;
}): Promise<{ success: true; assignmentId: string } | { success: false; error: string }> {
  try {
    return await addLeagueMatchHelperInternal(input);
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to add helper." };
  }
}

async function addLeagueMatchHelperInternal(input: {
  matchId: string;
  playerId: string;
  note?: string;
  provenance?: HelperProvenance;
}): Promise<{ success: true; assignmentId: string } | { success: false; error: string }> {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);
  requireMutationRole(ctx);
  await requireMatchOrgAccess(input.matchId, ctx.orgFilter);
  await requireMatchGroupAccess(ctx, input.matchId);

  const provenance = input.provenance ?? "HELPER";

  // ADR-0151: match-day additions require group-level player access too
  if (provenance === "MATCH_DAY_ADDITION") {
    await requirePlayerGroupAccess(ctx, input.playerId);
  }

  const eligibility = await assertLeagueMatchHelperEligible(input.matchId, input.playerId, ctx.orgFilter);
  if (!eligibility.eligible) {
    return { success: false, error: eligibility.reason ?? "Player is not eligible as a helper for this match." };
  }

  const match = await db.match.findFirst({
    where: { id: input.matchId, ...ctx.orgFilter.filter },
    select: { id: true, matchRoundId: true, teamId: true },
  });
  if (!match) return { success: false, error: "Match not found or access denied." };

  // Informational only — never blocks eligibility, only shown for context in the UI.
  const roundSelection = await db.selection.findFirst({
    where: { playerId: input.playerId, matchRoundId: match.matchRoundId },
    select: { match: { select: { teamId: true } } },
  });
  const player = await db.player.findFirst({ where: { id: input.playerId }, select: { coreTeamId: true } });
  const sourceTeamId = roundSelection?.match.teamId ?? player?.coreTeamId ?? match.teamId;

  let assignmentId: string;
  try {
    const assignment = await db.matchHelperAssignment.create({
      data: {
        matchId: input.matchId,
        playerId: input.playerId,
        sourceTeamId,
        provenance,
        note: input.note?.trim() || null,
        addedByUserId: ctx.userId,
        organisationId: ctx.organisationId,
      },
    });
    assignmentId = assignment.id;
  } catch {
    // Unique [matchId, playerId] race — someone else added this exact helper concurrently.
    return { success: false, error: "Player is already a participant in this match." };
  }

  // If a report already exists for this match (started early, or the match already has one for
  // another reason), keep it in sync so the coach never has to add this player again
  // retroactively — the same underlying participation model either way (ADR-0077).
  const report = await db.postMatchReport.findFirst({
    where: { matchId: input.matchId },
    select: { id: true, organisationId: true },
  });
  if (report) {
    const existingActual = await db.postMatchPlayerActual.findFirst({
      where: { reportId: report.id, playerId: input.playerId },
    });
    if (!existingActual) {
      await db.postMatchPlayerActual.create({
        data: {
          organisationId: report.organisationId,
          reportId: report.id,
          matchId: input.matchId,
          playerId: input.playerId,
          source: "EMERGENCY_BACKFILL",
          unplannedAppearanceReason: "EMERGENCY_SQUAD_COVER",
          attendanceStatus: "UNKNOWN",
        },
      });
    }
  }

  logMutationEvent("manual_override", ctx.email || "unknown", "match_helper_assignment", assignmentId, "success");

  revalidateMatchPaths(input.matchId);

  return { success: true, assignmentId };
}

export async function removeLeagueMatchHelperAction(
  assignmentId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    return await removeLeagueMatchHelperInternal(assignmentId);
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to remove helper." };
  }
}

async function removeLeagueMatchHelperInternal(
  assignmentId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);
  requireMutationRole(ctx);

  const assignment = await db.matchHelperAssignment.findFirst({
    where: { id: assignmentId, ...ctx.orgFilter.filter },
    select: { id: true, matchId: true, playerId: true },
  });
  if (!assignment) return { success: false, error: "Helper assignment not found or access denied." };

  await requireMatchGroupAccess(ctx, assignment.matchId);

  const report = await db.postMatchReport.findFirst({
    where: { matchId: assignment.matchId },
    select: { id: true },
  });
  if (report) {
    const actual = await db.postMatchPlayerActual.findFirst({
      where: { reportId: report.id, playerId: assignment.playerId },
    });
    if (actual) {
      return {
        success: false,
        error:
          "Cannot remove: this player already has recorded match participation. Remove their participation from the after-match report instead.",
      };
    }
  }

  const liveEvent = await db.liveMatchEvent.findFirst({
    where: {
      matchId: assignment.matchId,
      OR: [{ playerId: assignment.playerId }, { secondaryPlayerId: assignment.playerId }],
    },
    select: { id: true },
  });
  if (liveEvent) {
    return {
      success: false,
      error: "Cannot remove: this player already has recorded live match events (goals, assists, rotations, or positions).",
    };
  }

  await db.matchHelperAssignment.delete({ where: { id: assignmentId } });

  logMutationEvent("manual_override", ctx.email || "unknown", "match_helper_assignment", assignmentId, "success");

  revalidateMatchPaths(assignment.matchId);

  return { success: true };
}

export async function getLeagueMatchHelpersAction(matchId: string) {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);
  await requireMatchOrgAccess(matchId, ctx.orgFilter);

  const helpers = await db.matchHelperAssignment.findMany({
    where: { matchId, ...ctx.orgFilter.filter },
    include: {
      player: { select: { id: true, firstName: true, lastName: true, primaryPosition: true } },
      sourceTeam: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return helpers.map((h) => ({
    id: h.id,
    playerId: h.playerId,
    playerName: [h.player.firstName, h.player.lastName].filter(Boolean).join(" "),
    primaryPosition: h.player.primaryPosition,
    sourceTeamId: h.sourceTeam.id,
    sourceTeamName: h.sourceTeam.name,
    provenance: h.provenance,
    note: h.note,
    createdAt: h.createdAt.toISOString(),
  }));
}

export async function getLeagueMatchHelperCandidatesAction(matchId: string) {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);
  await requireMatchOrgAccess(matchId, ctx.orgFilter);
  await requireMatchGroupAccess(ctx, matchId);

  return getLeagueMatchHelperCandidates(matchId, ctx.orgFilter);
}
