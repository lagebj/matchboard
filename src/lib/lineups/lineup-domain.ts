import { db } from "@/lib/db";
import type { GameFormat } from "@/generated/prisma/client";
import type { FormationSlotRoleType, BroadPosition, FormationSlotData } from "@/lib/formations/types";
import { createFormationSnapshot } from "@/lib/formations/snapshot";
import { preserveAssignmentsOnChange } from "@/lib/formations/suggest";
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

function toFormationSlotData(slot: {
  id: string;
  gridX: number;
  gridY: number;
  label: string;
  shortLabel: string;
  roleType: string;
  acceptedPositionIds: unknown;
  sortOrder: number;
}): FormationSlotData {
  return {
    id: slot.id,
    gridX: slot.gridX,
    gridY: slot.gridY,
    label: slot.label,
    shortLabel: slot.shortLabel,
    roleType: slot.roleType as FormationSlotRoleType,
    acceptedPositionIds: slot.acceptedPositionIds as BroadPosition[],
    sortOrder: slot.sortOrder,
  };
}

/**
 * Switches an existing lineup to a different formation IN PLACE — never creates a second
 * MatchLineup row (that was the production bug: formation switching went through
 * createLineupFromFormation, which always creates a new row and is rejected by
 * requireNoExistingLineup once one already exists for this match/team).
 *
 * Reconciles MatchLineupAssignment rows against the new formation's slots via the existing
 * preserveAssignmentsOnChange() reconciliation (same-slot-ID, then same-coordinate-and-role,
 * then any same-role-type slot), rather than reimplementing slot-matching here. Players who
 * cannot be preserved onto any slot in the new formation move to the bench rather than being
 * silently dropped. Safe to call repeatedly, including with the same formationId (no-op).
 */
export async function changeLineupFormation(data: {
  lineupId: string;
  newFormationId: string;
  orgFilter: OrgFilterMode;
}) {
  const lineup = await db.matchLineup.findFirst({
    where: { id: data.lineupId, ...data.orgFilter.filter },
    include: {
      formation: { include: { slots: { orderBy: { sortOrder: "asc" } } } },
      assignments: true,
    },
  });
  if (!lineup) throw new Error("Lineup not found");
  requireModifiableLineup(lineup.status);

  if (lineup.formationId === data.newFormationId) {
    // Already on this formation — nothing to reconcile.
    return db.matchLineup.findFirstOrThrow({
      where: { id: data.lineupId },
      include: { formation: { include: { slots: { orderBy: { sortOrder: "asc" } } } }, assignments: true },
    });
  }

  const newFormation = await requireFormationExists(data.newFormationId);
  const oldSlots = (lineup.formation?.slots ?? []).map(toFormationSlotData);
  const newSlots = newFormation.slots.map(toFormationSlotData);

  const assignedAssignments = lineup.assignments
    .filter((a): a is typeof a & { playerId: string } => a.playerId !== null)
    .map((a) => ({ slotId: a.slotId, playerId: a.playerId, locked: a.locked }));

  const migrations = preserveAssignmentsOnChange(oldSlots, newSlots, assignedAssignments);
  const playerByNewSlotId = new Map(
    migrations.filter((m) => m.preserved && m.newSlotId).map((m) => [m.newSlotId!, m.playerId]),
  );
  const benchedPlayerIds = migrations.filter((m) => !m.preserved).map((m) => m.playerId);

  const existingBenchIds = Array.isArray(lineup.benchPlayerIds) ? (lineup.benchPlayerIds as string[]) : [];
  const newBenchPlayerIds = [...new Set([...existingBenchIds, ...benchedPlayerIds])];

  const snapshot = createFormationSnapshot(
    newFormation.id,
    newFormation.name,
    newFormation.gameFormat as GameFormat,
    newFormation.slots.map((s) => ({
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

  await db.$transaction([
    db.matchLineupAssignment.deleteMany({ where: { matchLineupId: data.lineupId } }),
    db.matchLineupAssignment.createMany({
      data: newFormation.slots.map((slot) => ({
        organisationId: lineup.organisationId,
        matchLineupId: data.lineupId,
        slotId: slot.id,
        playerId: playerByNewSlotId.get(slot.id) ?? null,
        locked: false,
        source: "MANUAL" as const,
      })),
    }),
    db.matchLineup.update({
      where: { id: data.lineupId },
      data: {
        formationId: newFormation.id,
        formationSnapshot: snapshot,
        benchPlayerIds: newBenchPlayerIds,
      },
    }),
  ]);

  return db.matchLineup.findFirstOrThrow({
    where: { id: data.lineupId },
    include: { formation: { include: { slots: { orderBy: { sortOrder: "asc" } } } }, assignments: true },
  });
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