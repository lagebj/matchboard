"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireCoachAccess } from "@/lib/auth";
import { createFormationSnapshot } from "@/lib/formations/snapshot";
import type { GameFormat } from "@/generated/prisma/client";
import type { FormationSlotRoleType, BroadPosition } from "@/lib/formations/types";

export async function getMatchLineup(matchId: string, teamId: string) {
  await requireCoachAccess();
  return db.matchLineup.findFirst({
    where: { matchId, teamId },
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
  await requireCoachAccess();

  const formation = await db.formation.findUnique({
    where: { id: data.formationId },
    include: { slots: { orderBy: { sortOrder: "asc" } } },
  });

  if (!formation) throw new Error("Formation not found");
  if (formation.isArchived) throw new Error("Cannot use an archived formation");

  const existing = await db.matchLineup.findFirst({
    where: { matchId: data.matchId, teamId: data.teamId },
  });

  if (existing) throw new Error("A lineup already exists for this match and team");

  const snapshot = createFormationSnapshot(
    formation.id,
    formation.name,
    formation.gameFormat as GameFormat,
    formation.slots.map((s) => ({
      id: s.id,
      gridX: s.gridX,
      gridY: s.gridY,
      label: s.label,
      shortLabel: s.shortLabel,
      roleType: s.roleType as FormationSlotRoleType,
      acceptedPositionIds: s.acceptedPositionIds as BroadPosition[],
      sortOrder: s.sortOrder,
    })),
  );

  const lineup = await db.matchLineup.create({
    data: {
      matchId: data.matchId,
      teamId: data.teamId,
      formationId: data.formationId,
      status: "DRAFT",
      formationSnapshot: snapshot,
      benchPlayerIds: [],
      assignments: {
        create: formation.slots.map((slot) => ({
          slotId: slot.id,
          playerId: null,
          locked: false,
          source: "MANUAL" as const,
        })),
      },
    },
    include: {
      formation: { include: { slots: { orderBy: { sortOrder: "asc" } } } },
      assignments: true,
    },
  });

  revalidatePath(`/matches/${data.matchId}`);
  return lineup;
}

export async function assignPlayerToSlot(
  assignmentId: string,
  playerId: string,
  locked: boolean = false,
) {
  await requireCoachAccess();

  const assignment = await db.matchLineupAssignment.findUnique({
    where: { id: assignmentId },
    include: { matchLineup: true },
  });

  if (!assignment) throw new Error("Assignment not found");
  if (assignment.matchLineup.status === "CONFIRMED") {
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
  await requireCoachAccess();

  const assignment = await db.matchLineupAssignment.findUnique({
    where: { id: assignmentId },
    include: { matchLineup: true },
  });

  if (!assignment) throw new Error("Assignment not found");
  if (assignment.matchLineup.status === "CONFIRMED") {
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
  await requireCoachAccess();

  const assignment = await db.matchLineupAssignment.findUnique({
    where: { id: assignmentId },
    include: { matchLineup: true },
  });

  if (!assignment) throw new Error("Assignment not found");
  if (assignment.matchLineup.status === "CONFIRMED") {
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
  await requireCoachAccess();

  const lineup = await db.matchLineup.findUnique({
    where: { id: lineupId },
    include: { assignments: true },
  });

  if (!lineup) throw new Error("Lineup not found");

  const unassigned = lineup.assignments.filter((a) => !a.playerId);
  if (unassigned.length > 0) {
    throw new Error(`Cannot confirm: ${unassigned.length} slot(s) have no player assigned`);
  }

  const updated = await db.matchLineup.update({
    where: { id: lineupId },
    data: { status: "CONFIRMED" },
  });

  revalidatePath(`/matches/${lineup.matchId}`);
  return updated;
}

export async function archiveLineup(lineupId: string) {
  await requireCoachAccess();

  const updated = await db.matchLineup.update({
    where: { id: lineupId },
    data: { status: "ARCHIVED" },
  });

  revalidatePath(`/matches/${updated.matchId}`);
  return updated;
}

export async function revertLineupToDraft(lineupId: string) {
  await requireCoachAccess();

  const updated = await db.matchLineup.update({
    where: { id: lineupId },
    data: { status: "DRAFT" },
  });

  revalidatePath(`/matches/${updated.matchId}`);
  return updated;
}

export async function updateLineupNotes(lineupId: string, notes: string) {
  await requireCoachAccess();

  const updated = await db.matchLineup.update({
    where: { id: lineupId },
    data: { notes },
  });

  return updated;
}

export async function updateBenchPlayers(lineupId: string, benchPlayerIds: string[]) {
  await requireCoachAccess();

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