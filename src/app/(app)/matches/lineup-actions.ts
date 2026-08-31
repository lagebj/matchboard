"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePageActorContext, requireMutationRole, requireMatchGroupAccess, requireTeamGroupAccess } from "@/lib/auth/actor-context";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";
import {
  requireAssignmentExists,
  createLineupFromFormation,
  changeLineupFormation,
} from "@/lib/lineups/lineup-domain";
import { isMatchPlanningEditable } from "@/lib/selection/planning-boundary";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";

async function requirePlanningEditable(matchId: string): Promise<void> {
  const boundary = await isMatchPlanningEditable(matchId);
  if (!boundary.editable) {
    throw new Error(boundary.reason ?? "Planning is closed for this match.");
  }
}

async function requireMatchOrgAccess(matchId: string, orgFilter: OrgFilterMode): Promise<void> {
  const match = await db.match.findFirst({
    where: { id: matchId, ...orgFilter.filter },
    select: { id: true },
  });
  if (!match) throw new Error("Match not found or access denied.");
}

async function requireLineupOrgAccess(lineupId: string, orgFilter: OrgFilterMode): Promise<{ matchId: string }> {
  const lineup = await db.matchLineup.findFirst({
    where: { id: lineupId, ...orgFilter.filter },
    select: { matchId: true },
  });
  if (!lineup) throw new Error("Lineup not found or access denied.");
  return { matchId: lineup.matchId };
}

async function requireAssignmentOrgAccess(assignmentId: string, orgFilter: OrgFilterMode): Promise<{ matchId: string; matchLineupId: string }> {
  const assignment = await db.matchLineupAssignment.findFirst({
    where: { id: assignmentId, matchLineup: orgFilter.filter },
    select: { matchLineupId: true, matchLineup: { select: { matchId: true } } },
  });
  if (!assignment) throw new Error("Assignment not found or access denied.");
  return { matchId: assignment.matchLineup.matchId, matchLineupId: assignment.matchLineupId };
}

export async function getMatchLineup(matchId: string, teamId: string) {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);
  const orgFilter = ctx.orgFilter;
  await requireMatchOrgAccess(matchId, orgFilter);
  return db.matchLineup.findFirst({
    where: { matchId, teamId, ...orgFilter.filter },
    include: {
      formation: { include: { slots: { orderBy: { sortOrder: "asc" } } } },
      assignments: true,
    },
  });
}

export async function createMatchLineup(data: {
  matchId: string;
  teamId: string;
  formationId: string;
}) {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);
  requireMutationRole(ctx);
  const orgFilter = ctx.orgFilter;
  await requireMatchOrgAccess(data.matchId, orgFilter);
  await requireTeamGroupAccess(ctx, data.teamId);

  const lineup = await createLineupFromFormation({ ...data, orgFilter: ctx.orgFilter });

  revalidatePath(`/o/${ctx.organisationSlug}/matches/${data.matchId}`);
  return lineup;
}

/**
 * Switches an existing lineup to a different formation in place. Never creates a second
 * MatchLineup row — see changeLineupFormation() for the reconciliation behavior.
 */
export async function changeMatchLineupFormation(lineupId: string, formationId: string) {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);
  requireMutationRole(ctx);
  const orgFilter = ctx.orgFilter;

  const lineupInfo = await requireLineupOrgAccess(lineupId, orgFilter);
  await requireMatchGroupAccess(ctx, lineupInfo.matchId);
  await requirePlanningEditable(lineupInfo.matchId);

  const lineup = await changeLineupFormation({ lineupId, newFormationId: formationId, orgFilter });

  revalidatePath(`/o/${ctx.organisationSlug}/matches/${lineupInfo.matchId}`);
  return lineup;
}

export async function assignPlayerToSlot(
  assignmentId: string,
  playerId: string,
  locked: boolean = false,
) {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);
  requireMutationRole(ctx);
  const orgFilter = ctx.orgFilter;
  const assignmentInfo = await requireAssignmentOrgAccess(assignmentId, orgFilter);
  await requireMatchGroupAccess(ctx, assignmentInfo.matchId);
  await requirePlanningEditable(assignmentInfo.matchId);

  const assignment = await requireAssignmentExists(assignmentId);

  const existingAssignment = await db.matchLineupAssignment.findFirst({
    where: {
      matchLineupId: assignment.matchLineupId,
      playerId,
      id: { not: assignmentId },
    },
  });

  if (existingAssignment) {
    await db.matchLineupAssignment.update({
      where: { id: existingAssignment.id },
      data: { playerId: null, locked: false },
    });
  }

  const updated = await db.matchLineupAssignment.update({
    where: { id: assignmentId },
    data: { playerId, locked, source: "MANUAL" },
  });

  const lineup = await db.matchLineup.findFirst({
    where: { id: assignment.matchLineupId, ...orgFilter.filter },
    include: { assignments: true },
  });

  const allAssigned = lineup?.assignments.every((a) => a.playerId !== null) ?? false;

  if (lineup && allAssigned) {
    await db.matchLineup.update({
      where: { id: lineup.id },
      data: { status: "DRAFT" },
    });
  }

  revalidatePath(`/o/${ctx.organisationSlug}/matches/${assignment.matchLineup.matchId}`);
  return updated;
}

export async function removePlayerFromSlot(assignmentId: string) {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);
  requireMutationRole(ctx);
  const orgFilter = ctx.orgFilter;
  const assignmentInfo = await requireAssignmentOrgAccess(assignmentId, orgFilter);
  await requireMatchGroupAccess(ctx, assignmentInfo.matchId);
  await requirePlanningEditable(assignmentInfo.matchId);

  const assignment = await requireAssignmentExists(assignmentId);

  const updated = await db.matchLineupAssignment.update({
    where: { id: assignmentId },
    data: { playerId: null, locked: false },
  });

  revalidatePath(`/o/${ctx.organisationSlug}/matches/${assignment.matchLineup.matchId}`);
  return updated;
}

export async function toggleSlotLock(assignmentId: string) {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);
  requireMutationRole(ctx);
  const orgFilter = ctx.orgFilter;
  const assignmentInfo = await requireAssignmentOrgAccess(assignmentId, orgFilter);
  await requireMatchGroupAccess(ctx, assignmentInfo.matchId);
  await requirePlanningEditable(assignmentInfo.matchId);

  const assignment = await requireAssignmentExists(assignmentId);

  const updated = await db.matchLineupAssignment.update({
    where: { id: assignmentId },
    data: { locked: !assignment.locked },
  });

  revalidatePath(`/o/${ctx.organisationSlug}/matches/${assignment.matchLineup.matchId}`);
  return updated;
}

export async function updateLineupNotes(lineupId: string, notes: string) {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);
  requireMutationRole(ctx);
  const orgFilter = ctx.orgFilter;
  const { matchId } = await requireLineupOrgAccess(lineupId, orgFilter);
  await requireMatchGroupAccess(ctx, matchId);

  const updated = await db.matchLineup.update({
    where: { id: lineupId },
    data: { notes },
  });

  return updated;
}

export async function updateBenchPlayers(lineupId: string, benchPlayerIds: string[]) {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);
  requireMutationRole(ctx);
  const orgFilter = ctx.orgFilter;
  const { matchId } = await requireLineupOrgAccess(lineupId, orgFilter);
  await requireMatchGroupAccess(ctx, matchId);

  const lineup = await db.matchLineup.findFirst({
    where: { id: lineupId, ...orgFilter.filter },
  });

  if (!lineup) throw new Error("Lineup not found");

  const assignedPlayerIds = lineup.benchPlayerIds as string[] ?? [];

  const uniqueBench = benchPlayerIds.filter(
    (id) => !assignedPlayerIds.includes(id),
  );

  const updated = await db.matchLineup.update({
    where: { id: lineupId },
    data: { benchPlayerIds: uniqueBench },
  });

  revalidatePath(`/o/${ctx.organisationSlug}/matches/${updated.matchId}`);
  return updated;
}