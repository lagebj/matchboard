import { db } from "@/lib/db";
import type { GameFormat } from "@/generated/prisma/client";
import type { FormationSlotRoleType, BroadPosition } from "@/lib/formations/types";
import { createFormationSnapshot } from "@/lib/formations/snapshot";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";

export function canModifyLineup(status: string): boolean {
  return status !== "CONFIRMED";
}

export function requireModifiableLineup(status: string): void {
  if (!canModifyLineup(status)) {
    throw new Error("Cannot modify a confirmed lineup");
  }
}

export async function requireLineupExists(lineupId: string) {
  const lineup = await db.matchLineup.findFirst({
    where: { id: lineupId },
    include: { assignments: true },
  });

  if (!lineup) throw new Error("Lineup not found");
  return lineup;
}

export async function requireAssignmentExists(assignmentId: string) {
  const assignment = await db.matchLineupAssignment.findFirst({
    where: { id: assignmentId },
    include: { matchLineup: true },
  });

  if (!assignment) throw new Error("Assignment not found");
  return assignment;
}

export async function requireFormationExists(formationId: string) {
  const formation = await db.formation.findFirst({
    where: { id: formationId },
    include: { slots: { orderBy: { sortOrder: "asc" } } },
  });

  if (!formation) throw new Error("Formation not found");
  if (formation.isArchived) throw new Error("Cannot use an archived formation");
  return formation;
}

export async function requireNoExistingLineup(matchId: string, teamId: string) {
  const existing = await db.matchLineup.findFirst({
    where: { matchId, teamId },
  });

  if (existing) throw new Error("A lineup already exists for this match and team");
}

export function requireAllSlotsAssigned(assignments: { playerId: string | null }[]): void {
  const unassigned = assignments.filter((a) => !a.playerId);
  if (unassigned.length > 0) {
    throw new Error(`Cannot confirm: ${unassigned.length} slot(s) have no player assigned`);
  }
}

export async function createLineupFromFormation(data: {
  matchId: string;
  teamId: string;
  formationId: string;
  orgFilter: OrgFilterMode;
}) {
  const formation = await requireFormationExists(data.formationId);
  await requireNoExistingLineup(data.matchId, data.teamId);

  const match = await db.match.findFirst({ where: { id: data.matchId, ...data.orgFilter.filter }, select: { organisationId: true } });
  const organisationId = match?.organisationId ?? "";

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

  return db.matchLineup.create({
    data: {
      organisationId,
      matchId: data.matchId,
      teamId: data.teamId,
      formationId: data.formationId,
      status: "DRAFT",
      formationSnapshot: snapshot,
      benchPlayerIds: [],
      assignments: {
        create: formation.slots.map((slot) => ({
          organisationId,
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
}