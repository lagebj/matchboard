"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireCoachAccess } from "@/lib/auth";
import {
  validateFormationForMatchUse,
  isValidRoleType,
  isValidGridX,
  isValidGridY,
  GAME_FORMAT_PLAYERS,
  suggestSlotDefaults,
} from "@/lib/formations/index";
import type { GameFormat } from "@/generated/prisma/client";
import type { FormationSlotRoleType, BroadPosition } from "@/lib/formations/types";

function revalidateFormationPaths() {
  revalidatePath("/rules");
  revalidatePath("/formations");
}

export async function getFormationsForFormat(gameFormat: GameFormat) {
  await requireCoachAccess();
  return db.formation.findMany({
    where: { gameFormat, isArchived: false },
    include: { slots: { orderBy: { sortOrder: "asc" } } },
    orderBy: [{ source: "asc" }, { name: "asc" }],
  });
}

export async function getFormationById(formationId: string) {
  await requireCoachAccess();
  return db.formation.findUnique({
    where: { id: formationId },
    include: { slots: { orderBy: { sortOrder: "asc" } } },
  });
}

export async function createCustomFormation(data: {
  name: string;
  gameFormat: GameFormat;
  teamId?: string;
  description?: string;
  slots: {
    gridX: number;
    gridY: number;
    label: string;
    shortLabel: string;
    roleType: string;
    acceptedPositionIds: string[];
    sortOrder: number;
  }[];
}) {
  await requireCoachAccess();

  if (!data.name.trim()) throw new Error("Formation name is required");
  if (!data.slots || data.slots.length === 0) throw new Error("Formation must have at least one slot");

  const slots = data.slots.map((s) => {
    if (!isValidGridX(s.gridX) || !isValidGridY(s.gridY)) {
      throw new Error(`Invalid grid coordinates (${s.gridX}, ${s.gridY})`);
    }
    if (!isValidRoleType(s.roleType)) {
      throw new Error(`Invalid role type: ${s.roleType}`);
    }
    return {
      gridX: s.gridX,
      gridY: s.gridY,
      label: s.label,
      shortLabel: s.shortLabel,
      roleType: s.roleType as FormationSlotRoleType,
      acceptedPositionIds: s.acceptedPositionIds as BroadPosition[],
      sortOrder: s.sortOrder,
    };
  });

  const validation = validateFormationForMatchUse({ gameFormat: data.gameFormat, slots });
  if (!validation.valid) {
    const errors = validation.issues.filter((i) => i.type === "error");
    if (errors.length > 0) {
      throw new Error(errors[0].message);
    }
  }

  const formation = await db.formation.create({
    data: {
      name: data.name.trim(),
      gameFormat: data.gameFormat,
      source: "CUSTOM",
      teamId: data.teamId ?? null,
      description: data.description ?? null,
      isArchived: false,
      slots: { create: slots },
    },
    include: { slots: { orderBy: { sortOrder: "asc" } } },
  });

  revalidateFormationPaths();
  return formation;
}

export async function duplicateFormation(formationId: string, newName?: string) {
  await requireCoachAccess();

  const source = await db.formation.findUnique({
    where: { id: formationId },
    include: { slots: { orderBy: { sortOrder: "asc" } } },
  });

  if (!source) throw new Error("Formation not found");

  const name = newName?.trim() ?? `${source.name} (copy)`;

  const formation = await db.formation.create({
    data: {
      name,
      gameFormat: source.gameFormat,
      source: "CUSTOM",
      description: source.description,
      isArchived: false,
      slots: {
        create: source.slots.map((s) => ({
          gridX: s.gridX,
          gridY: s.gridY,
          label: s.label,
          shortLabel: s.shortLabel,
          roleType: s.roleType,
          acceptedPositionIds: s.acceptedPositionIds as BroadPosition[],
          sortOrder: s.sortOrder,
        })),
      },
    },
    include: { slots: { orderBy: { sortOrder: "asc" } } },
  });

  revalidateFormationPaths();
  return formation;
}

export async function updateCustomFormation(
  formationId: string,
  data: {
    name?: string;
    description?: string;
    slots?: {
      gridX: number;
      gridY: number;
      label: string;
      shortLabel: string;
      roleType: string;
      acceptedPositionIds: string[];
      sortOrder: number;
    }[];
  },
) {
  await requireCoachAccess();

  const formation = await db.formation.findUnique({
    where: { id: formationId },
    include: { slots: true },
  });

  if (!formation) throw new Error("Formation not found");
  if (formation.source === "SYSTEM") throw new Error("System formations cannot be edited");

  const lineupUsage = await db.matchLineup.count({
    where: { formationId },
  });

  if (lineupUsage > 0) {
    return duplicateFormation(formationId, data.name);
  }

  if (data.name !== undefined) {
    await db.formation.update({
      where: { id: formationId },
      data: { name: data.name.trim() },
    });
  }

  if (data.description !== undefined) {
    await db.formation.update({
      where: { id: formationId },
      data: { description: data.description },
    });
  }

  if (data.slots) {
    const slots = data.slots.map((s) => {
      if (!isValidGridX(s.gridX) || !isValidGridY(s.gridY)) {
        throw new Error(`Invalid grid coordinates (${s.gridX}, ${s.gridY})`);
      }
      if (!isValidRoleType(s.roleType)) {
        throw new Error(`Invalid role type: ${s.roleType}`);
      }
      return {
        gridX: s.gridX,
        gridY: s.gridY,
        label: s.label,
        shortLabel: s.shortLabel,
        roleType: s.roleType as FormationSlotRoleType,
        acceptedPositionIds: s.acceptedPositionIds as BroadPosition[],
        sortOrder: s.sortOrder,
      };
    });

    const validation = validateFormationForMatchUse({
      gameFormat: formation.gameFormat as GameFormat,
      slots,
    });

    if (validation.issues.filter((i) => i.type === "error").length > 0) {
      throw new Error(validation.issues.filter((i) => i.type === "error").map((i) => i.message).join("; "));
    }

    await db.formationSlot.deleteMany({ where: { formationId } });
    await db.formation.update({
      where: { id: formationId },
      data: {
        slots: { create: slots },
      },
    });
  }

  revalidateFormationPaths();
  return db.formation.findUnique({
    where: { id: formationId },
    include: { slots: { orderBy: { sortOrder: "asc" } } },
  });
}

export async function archiveFormation(formationId: string) {
  await requireCoachAccess();

  const formation = await db.formation.findUnique({
    where: { id: formationId },
  });

  if (!formation) throw new Error("Formation not found");
  if (formation.source === "SYSTEM") throw new Error("System formations cannot be archived");

  await db.formation.update({
    where: { id: formationId },
    data: { isArchived: true },
  });

  revalidateFormationPaths();
}

export async function deleteCustomFormation(formationId: string) {
  await requireCoachAccess();

  const formation = await db.formation.findUnique({
    where: { id: formationId },
  });

  if (!formation) throw new Error("Formation not found");
  if (formation.source === "SYSTEM") throw new Error("System formations cannot be deleted");

  const lineupUsage = await db.matchLineup.count({
    where: { formationId },
  });

  if (lineupUsage > 0) {
    await archiveFormation(formationId);
    return;
  }

  await db.formationSlot.deleteMany({ where: { formationId } });
  await db.formation.delete({ where: { id: formationId } });

  revalidateFormationPaths();
}

export async function addFormationSlot(
  formationId: string,
  gridX: number,
  gridY: number,
) {
  await requireCoachAccess();

  const formation = await db.formation.findUnique({
    where: { id: formationId },
    include: { slots: true },
  });

  if (!formation) throw new Error("Formation not found");
  if (formation.source === "SYSTEM") throw new Error("System formations cannot be edited");

  const duplicate = formation.slots.find((s) => s.gridX === gridX && s.gridY === gridY);
  if (duplicate) throw new Error("A slot already exists at this position");

  const maxPlayers = GAME_FORMAT_PLAYERS[formation.gameFormat as GameFormat];
  if (formation.slots.length >= maxPlayers) {
    throw new Error(`This formation already has ${maxPlayers} slots (${formation.gameFormat})`);
  }

  const defaults = suggestSlotDefaults(gridX, gridY, formation.gameFormat as GameFormat);
  const maxSortOrder = formation.slots.reduce((max, s) => Math.max(max, s.sortOrder), -1);

  const slot = await db.formationSlot.create({
    data: {
      formationId,
      gridX,
      gridY,
      label: defaults.label,
      shortLabel: defaults.shortLabel,
      roleType: defaults.roleType,
      acceptedPositionIds: defaults.acceptedPositionIds,
      sortOrder: maxSortOrder + 1,
    },
  });

  revalidateFormationPaths();
  return slot;
}

export async function updateFormationSlot(
  slotId: string,
  data: {
    label?: string;
    shortLabel?: string;
    roleType?: string;
    acceptedPositionIds?: string[];
  },
) {
  await requireCoachAccess();

  if (data.roleType && !isValidRoleType(data.roleType)) {
    throw new Error(`Invalid role type: ${data.roleType}`);
  }

  const updateData: Record<string, unknown> = {};
  if (data.label !== undefined) updateData.label = data.label;
  if (data.shortLabel !== undefined) updateData.shortLabel = data.shortLabel;
  if (data.roleType !== undefined) updateData.roleType = data.roleType;
  if (data.acceptedPositionIds !== undefined) updateData.acceptedPositionIds = data.acceptedPositionIds;

  const slot = await db.formationSlot.update({
    where: { id: slotId },
    data: updateData,
  });

  revalidateFormationPaths();
  return slot;
}

export async function removeFormationSlot(slotId: string) {
  await requireCoachAccess();

  await db.formationSlot.delete({ where: { id: slotId } });
  revalidateFormationPaths();
}