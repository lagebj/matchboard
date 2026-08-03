"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireActorContext, requireMutationRole } from "@/lib/auth/actor-context";
import { supersedePendingReviews } from "@/lib/review/review-service";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";
import {
  canModifyLineup,
  requireAssignmentExists,
  requireAllSlotsAssigned,
  requireLineupExists,
  createLineupFromFormation,
} from "@/lib/lineups/lineup-domain";

async function requireMatchOrgAccess(matchId: string, orgFilter: OrgFilterMode): Promise<void> {
  if (orgFilter.type !== "org") return;
  const match = await db.match.findFirst({
    where: { id: matchId, ...orgFilter.filter },
    select: { id: true },
  });
  if (!match) throw new Error("Match not found or access denied.");
}

async function requireLineupOrgAccess(lineupId: string, orgFilter: OrgFilterMode): Promise<{ matchId: string }> {
  if (orgFilter.type !== "org") {
    const lineup = await db.matchLineup.findUnique({ where: { id: lineupId }, select: { matchId: true } });
    if (!lineup) throw new Error("Lineup not found.");
    return { matchId: lineup.matchId };
  }
  const lineup = await db.matchLineup.findFirst({
    where: { id: lineupId, ...orgFilter.filter },
    select: { matchId: true },
  });
  if (!lineup) throw new Error("Lineup not found or access denied.");
  return { matchId: lineup.matchId };
}

async function requireAssignmentOrgAccess(assignmentId: string, orgFilter: OrgFilterMode): Promise<{ matchId: string; matchLineupId: string; matchLineupStatus: string }> {
  if (orgFilter.type !== "org") {
    const assignment = await db.matchLineupAssignment.findUnique({
      where: { id: assignmentId },
      select: { matchLineupId: true, matchLineup: { select: { matchId: true, status: true } } },
    });
    if (!assignment) throw new Error("Assignment not found.");
    return { matchId: assignment.matchLineup.matchId, matchLineupId: assignment.matchLineupId, matchLineupStatus: assignment.matchLineup.status };
  }
  const assignment = await db.matchLineupAssignment.findFirst({
    where: { id: assignmentId, matchLineup: orgFilter.filter },
    select: { matchLineupId: true, matchLineup: { select: { matchId: true, status: true } } },
  });
  if (!assignment) throw new Error("Assignment not found or access denied.");
  return { matchId: assignment.matchLineup.matchId, matchLineupId: assignment.matchLineupId, matchLineupStatus: assignment.matchLineup.status };
}

export async function getMatchLineup(matchId: string, teamId: string) {
  const ctx = await requireActorContext();
  const orgFilter = ctx.orgFilter;
  await requireMatchOrgAccess(matchId, orgFilter);
  return db.matchLineup.findFirst({
    where: { matchId, teamId, ...(orgFilter.type === 'org' ? orgFilter.filter : {}) },
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
  const ctx = await requireActorContext();
  requireMutationRole(ctx);
  const orgFilter = ctx.orgFilter;
  await requireMatchOrgAccess(data.matchId, orgFilter);

  const lineup = await createLineupFromFormation(data);

  revalidatePath(`/matches/${data.matchId}`);
  return lineup;
}

export async function assignPlayerToSlot(
  assignmentId: string,
  playerId: string,
  locked: boolean = false,
) {
  const ctx = await requireActorContext();
  requireMutationRole(ctx);
  const orgFilter = ctx.orgFilter;
  await requireAssignmentOrgAccess(assignmentId, orgFilter);

  const assignment = await requireAssignmentExists(assignmentId);
  if (!canModifyLineup(assignment.matchLineup.status)) {
    throw new Error("Cannot modify a confirmed lineup");
  }

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

  const lineup = await db.matchLineup.findUnique({
    where: { id: assignment.matchLineupId },
    include: { assignments: true },
  });

  const allAssigned = lineup?.assignments.every((a) => a.playerId !== null) ?? false;

  if (lineup && allAssigned) {
    await db.matchLineup.update({
      where: { id: lineup.id },
      data: { status: "DRAFT" },
    });
  }

  revalidatePath(`/matches/${assignment.matchLineup.matchId}`);
  return updated;
}

export async function removePlayerFromSlot(assignmentId: string) {
  const ctx = await requireActorContext();
  requireMutationRole(ctx);
  const orgFilter = ctx.orgFilter;
  await requireAssignmentOrgAccess(assignmentId, orgFilter);

  const assignment = await requireAssignmentExists(assignmentId);
  if (!canModifyLineup(assignment.matchLineup.status)) {
    throw new Error("Cannot modify a confirmed lineup");
  }

  const updated = await db.matchLineupAssignment.update({
    where: { id: assignmentId },
    data: { playerId: null, locked: false },
  });

  revalidatePath(`/matches/${assignment.matchLineup.matchId}`);
  return updated;
}

export async function toggleSlotLock(assignmentId: string) {
  const ctx = await requireActorContext();
  requireMutationRole(ctx);
  const orgFilter = ctx.orgFilter;
  await requireAssignmentOrgAccess(assignmentId, orgFilter);

  const assignment = await requireAssignmentExists(assignmentId);
  if (!canModifyLineup(assignment.matchLineup.status)) {
    throw new Error("Cannot modify a confirmed lineup");
  }

  const updated = await db.matchLineupAssignment.update({
    where: { id: assignmentId },
    data: { locked: !assignment.locked },
  });

  revalidatePath(`/matches/${assignment.matchLineup.matchId}`);
  return updated;
}

export async function confirmLineup(lineupId: string) {
  const ctx = await requireActorContext();
  requireMutationRole(ctx);
  const orgFilter = ctx.orgFilter;
  const { matchId } = await requireLineupOrgAccess(lineupId, orgFilter);

  const lineup = await requireLineupExists(lineupId);
  requireAllSlotsAssigned(lineup.assignments);

  const updated = await db.matchLineup.update({
    where: { id: lineupId },
    data: { status: "CONFIRMED" },
  });

  await supersedePendingReviews("MATCH_LINEUP", lineupId);

  revalidatePath(`/matches/${lineup.matchId}`);
  return updated;
}

export async function archiveLineup(lineupId: string) {
  const ctx = await requireActorContext();
  requireMutationRole(ctx);
  const orgFilter = ctx.orgFilter;
  await requireLineupOrgAccess(lineupId, orgFilter);

  const updated = await db.matchLineup.update({
    where: { id: lineupId },
    data: { status: "ARCHIVED" },
  });

  revalidatePath(`/matches/${updated.matchId}`);
  return updated;
}

export async function revertLineupToDraft(lineupId: string) {
  const ctx = await requireActorContext();
  requireMutationRole(ctx);
  const orgFilter = ctx.orgFilter;
  await requireLineupOrgAccess(lineupId, orgFilter);

  const updated = await db.matchLineup.update({
    where: { id: lineupId },
    data: { status: "DRAFT" },
  });

  revalidatePath(`/matches/${updated.matchId}`);
  return updated;
}

export async function updateLineupNotes(lineupId: string, notes: string) {
  const ctx = await requireActorContext();
  requireMutationRole(ctx);
  const orgFilter = ctx.orgFilter;
  await requireLineupOrgAccess(lineupId, orgFilter);

  const updated = await db.matchLineup.update({
    where: { id: lineupId },
    data: { notes },
  });

  return updated;
}

export async function updateBenchPlayers(lineupId: string, benchPlayerIds: string[]) {
  const ctx = await requireActorContext();
  requireMutationRole(ctx);
  const orgFilter = ctx.orgFilter;
  await requireLineupOrgAccess(lineupId, orgFilter);

  const lineup = await db.matchLineup.findUnique({
    where: { id: lineupId },
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

  revalidatePath(`/matches/${updated.matchId}`);
  return updated;
}