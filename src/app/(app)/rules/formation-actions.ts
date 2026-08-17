"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireActorContext, requireMutationRole, requireTeamAccess } from "@/lib/auth/actor-context";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";
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

async function requireFormationOrgAccess(formationId: string, orgFilter: OrgFilterMode): Promise<string | null> {
  const formation = await db.formation.findFirst({
    where: { id: formationId, ...orgFilter.filter },
    select: { id: true, teamId: true },
  });
  if (!formation) throw new Error("Formation not found or access denied.");
  return formation.teamId;
}

export async function getFormationsForFormat(gameFormat: GameFormat) {
  const ctx = await requireActorContext();
  const orgFilter = ctx.orgFilter;
  return db.formation.findMany({
    where: { gameFormat, isArchived: false, ...orgFilter.filter },
    include: { slots: { orderBy: { sortOrder: "asc" } } },
    orderBy: [{ source: "asc" }, { name: "asc" }],
  });
}

export async function getFormationById(formationId: string) {
  const ctx = await requireActorContext();
  const orgFilter = ctx.orgFilter;
  await requireFormationOrgAccess(formationId, orgFilter);
  return db.formation.findFirst({
    where: { id: formationId, ...orgFilter.filter },
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
  const ctx = await requireActorContext();
  requireMutationRole(ctx);
  if (data.teamId) await requireTeamAccess(ctx, data.teamId);
  const orgFilter = ctx.orgFilter;

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
      organisationId: orgFilter.organisationId,
      slots: { create: slots },
    },
    include: { slots: { orderBy: { sortOrder: "asc" } } },
  });

  revalidateFormationPaths();
  return formation;
}

export async function duplicateFormation(formationId: string, newName?: string) {
  const ctx = await requireActorContext();
  requireMutationRole(ctx);
  const orgFilter = ctx.orgFilter;

  const source = await db.formation.findFirst({
    where: { id: formationId, ...orgFilter.filter },
    include: { slots: { orderBy: { sortOrder: "asc" } } },
  });

  if (!source) throw new Error("Formation not found");

  if (source.organisationId !== orgFilter.organisationId) {
    throw new Error("Formation not found or access denied.");
  }

  if (source.teamId) await requireTeamAccess(ctx, source.teamId);

  const name = newName?.trim() ?? `${source.name} (copy)`;

  const formation = await db.formation.create({
    data: {
      name,
      gameFormat: source.gameFormat,
      source: "CUSTOM",
      description: source.description,
      isArchived: false,
      organisationId: orgFilter.organisationId,
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
  const ctx = await requireActorContext();
  requireMutationRole(ctx);
  const orgFilter = ctx.orgFilter;

  const formation = await db.formation.findFirst({
    where: { id: formationId, ...orgFilter.filter },
    include: { slots: true },
  });

  if (!formation) throw new Error("Formation not found");
  if (formation.source === "SYSTEM") throw new Error("System formations cannot be edited");

  if (formation.organisationId !== orgFilter.organisationId) {
    throw new Error("Formation not found or access denied.");
  }

  if (formation.teamId) await requireTeamAccess(ctx, formation.teamId);

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
  return db.formation.findFirst({
    where: { id: formationId, ...ctx.orgFilter.filter },
    include: { slots: { orderBy: { sortOrder: "asc" } } },
  });
}

export async function archiveFormation(formationId: string) {
  const ctx = await requireActorContext();
  requireMutationRole(ctx);
  const orgFilter = ctx.orgFilter;

  const formation = await db.formation.findFirst({
    where: { id: formationId, ...orgFilter.filter },
  });

  if (!formation) throw new Error("Formation not found");
  if (formation.source === "SYSTEM") throw new Error("System formations cannot be archived");

  if (formation.organisationId !== orgFilter.organisationId) {
    throw new Error("Formation not found or access denied.");
  }

  if (formation.teamId) await requireTeamAccess(ctx, formation.teamId);

  await db.formation.update({
    where: { id: formationId },
    data: { isArchived: true },
  });

  revalidateFormationPaths();
}

export async function deleteCustomFormation(formationId: string) {
  const ctx = await requireActorContext();
  requireMutationRole(ctx);
  const orgFilter = ctx.orgFilter;

  const formation = await db.formation.findFirst({
    where: { id: formationId, ...orgFilter.filter },
  });

  if (!formation) throw new Error("Formation not found");
  if (formation.source === "SYSTEM") throw new Error("System formations cannot be deleted");

  if (formation.organisationId !== orgFilter.organisationId) {
    throw new Error("Formation not found or access denied.");
  }

  if (formation.teamId) await requireTeamAccess(ctx, formation.teamId);

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
  const ctx = await requireActorContext();
  requireMutationRole(ctx);
  const orgFilter = ctx.orgFilter;
  const formationTeamId = await requireFormationOrgAccess(formationId, orgFilter);
  if (formationTeamId) await requireTeamAccess(ctx, formationTeamId);

  const formation = await db.formation.findFirst({
    where: { id: formationId, ...orgFilter.filter },
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
      organisationId: formation.organisationId,
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
  const ctx = await requireActorContext();
  requireMutationRole(ctx);
  const orgFilter = ctx.orgFilter;

  if (data.roleType && !isValidRoleType(data.roleType)) {
    throw new Error(`Invalid role type: ${data.roleType}`);
  }

  const existingSlot = await db.formationSlot.findFirst({ where: { id: slotId }, select: { formationId: true } });
  if (!existingSlot) throw new Error("Slot not found");
  const slotFormationTeamId = await requireFormationOrgAccess(existingSlot.formationId, orgFilter);
  if (slotFormationTeamId) await requireTeamAccess(ctx, slotFormationTeamId);

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
  const ctx = await requireActorContext();
  requireMutationRole(ctx);
  const orgFilter = ctx.orgFilter;

  const existingSlot = await db.formationSlot.findFirst({ where: { id: slotId }, select: { formationId: true } });
  if (!existingSlot) throw new Error("Slot not found");
  const slotFormationTeamId = await requireFormationOrgAccess(existingSlot.formationId, orgFilter);
  if (slotFormationTeamId) await requireTeamAccess(ctx, slotFormationTeamId);

  await db.formationSlot.delete({ where: { id: slotId } });
  revalidateFormationPaths();
}