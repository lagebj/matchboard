import { db } from "@/lib/db";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";
import type { PlannedChangeStatus } from "@/generated/prisma/client";
import {
  getPlannedRotation,
  type PlannedRotationWithChanges,
} from "./planned-rotation";

export type { PlannedChangeStatus };

export type ApplyPlannedChangeResult = {
  success: true;
  outEventId: string;
  inEventId: string | null;
  changeId: string;
} | {
  success: false;
  error: string;
};

export type SkipPlannedChangeResult = {
  success: true;
  changeId: string;
} | {
  success: false;
  error: string;
};

export type DelayPlannedChangeResult = {
  success: true;
  changeId: string;
} | {
  success: false;
  error: string;
};

export type ModifyPlannedChangeResult = {
  success: true;
  change: PlannedRotationWithChanges["changes"][number];
} | {
  success: false;
  error: string;
};

export async function applyPlannedChange(
  rotationId: string,
  changeId: string,
  liveEventIds: { outEventId: string; inEventId?: string },
  orgFilter: OrgFilterMode,
  actualMatchSeconds?: number,
): Promise<ApplyPlannedChangeResult> {
  const orgId = orgFilter.filter.organisationId;
  if (!orgId) return { success: false, error: "Organisation context required" };

  const rotation = await db.plannedRotation.findFirst({
    where: { id: rotationId, organisationId: orgId },
    include: {
      changes: {
        orderBy: { sequence: "asc" },
        include: {
          outPlayer: { select: { id: true, firstName: true, lastName: true } },
          inPlayer: { select: { id: true, firstName: true, lastName: true } },
        },
      },
    },
  });

  if (!rotation) return { success: false, error: "Rotation plan not found" };
  if (rotation.status !== "DRAFT" && rotation.status !== "APPLIED") {
    return { success: false, error: "Only DRAFT or APPLIED rotation plans can have changes applied" };
  }

  const change = rotation.changes.find((c) => c.id === changeId);
  if (!change) return { success: false, error: "Change not found in rotation plan" };
  if (change.status !== "PENDING" && change.status !== "DELAYED") {
    return { success: false, error: `Change has status ${change.status}, expected PENDING or DELAYED` };
  }

  const updatedChange = await db.plannedRotationChange.update({
    where: { id: changeId },
    data: {
      status: "APPLIED" as PlannedChangeStatus,
      liveEventId: liveEventIds.outEventId,
      secondaryLiveEventId: liveEventIds.inEventId ?? null,
      actualMatchSeconds: actualMatchSeconds ?? null,
    },
  });

  const anyPending = rotation.changes.some((c) => c.id !== changeId && c.status === "PENDING");

  if (!anyPending && rotation.status === "DRAFT") {
    await db.plannedRotation.update({
      where: { id: rotationId },
      data: { status: "APPLIED" },
    });
  }

  return {
    success: true,
    outEventId: liveEventIds.outEventId,
    inEventId: liveEventIds.inEventId ?? null,
    changeId: updatedChange.id,
  };
}

export async function skipPlannedChange(
  rotationId: string,
  changeId: string,
  orgFilter: OrgFilterMode,
): Promise<SkipPlannedChangeResult> {
  const orgId = orgFilter.filter.organisationId;
  if (!orgId) return { success: false, error: "Organisation context required" };

  const rotation = await db.plannedRotation.findFirst({
    where: { id: rotationId, organisationId: orgId },
    include: { changes: { orderBy: { sequence: "asc" } } },
  });

  if (!rotation) return { success: false, error: "Rotation plan not found" };
  if (rotation.status !== "DRAFT" && rotation.status !== "APPLIED") {
    return { success: false, error: "Only DRAFT or APPLIED rotation plans can have changes skipped" };
  }

  const change = rotation.changes.find((c) => c.id === changeId);
  if (!change) return { success: false, error: "Change not found in rotation plan" };
  if (change.status !== "PENDING" && change.status !== "DELAYED") {
    return { success: false, error: `Change has status ${change.status}, expected PENDING or DELAYED` };
  }

  await db.plannedRotationChange.update({
    where: { id: changeId },
    data: { status: "SKIPPED" as PlannedChangeStatus },
  });

  return { success: true, changeId };
}

/**
 * Delay is a re-visitable state, unlike SKIPPED/APPLIED — a delayed change stays actionable and
 * is surfaced again by getNextPlannedChange() until it is eventually applied or skipped. It
 * preserves the original planned time (approximateMatchSeconds is untouched); the actual
 * execution time is recorded separately, on apply (see DECISIONS.md "Live execution of plan").
 */
export async function delayPlannedChange(
  rotationId: string,
  changeId: string,
  orgFilter: OrgFilterMode,
): Promise<DelayPlannedChangeResult> {
  const orgId = orgFilter.filter.organisationId;
  if (!orgId) return { success: false, error: "Organisation context required" };

  const rotation = await db.plannedRotation.findFirst({
    where: { id: rotationId, organisationId: orgId },
    include: { changes: { orderBy: { sequence: "asc" } } },
  });

  if (!rotation) return { success: false, error: "Rotation plan not found" };
  if (rotation.status !== "DRAFT" && rotation.status !== "APPLIED") {
    return { success: false, error: "Only DRAFT or APPLIED rotation plans can have changes delayed" };
  }

  const change = rotation.changes.find((c) => c.id === changeId);
  if (!change) return { success: false, error: "Change not found in rotation plan" };
  if (change.status !== "PENDING") {
    return { success: false, error: `Change has status ${change.status}, expected PENDING` };
  }

  await db.plannedRotationChange.update({
    where: { id: changeId },
    data: { status: "DELAYED" as PlannedChangeStatus },
  });

  return { success: true, changeId };
}

export async function modifyPlannedChange(
  rotationId: string,
  changeId: string,
  modification: {
    outPlayerId?: string | null;
    inPlayerId?: string | null;
    outPosition?: string | null;
    inPosition?: string | null;
    positionOnly?: boolean;
    approximateMatchSeconds?: number | null;
    notes?: string | null;
    liveEventId?: string;
  },
  orgFilter: OrgFilterMode,
): Promise<ModifyPlannedChangeResult> {
  const orgId = orgFilter.filter.organisationId;
  if (!orgId) return { success: false, error: "Organisation context required" };

  const rotation = await db.plannedRotation.findFirst({
    where: { id: rotationId, organisationId: orgId },
    include: {
      changes: {
        orderBy: { sequence: "asc" },
        include: {
          outPlayer: { select: { id: true, firstName: true, lastName: true } },
          inPlayer: { select: { id: true, firstName: true, lastName: true } },
        },
      },
    },
  });

  if (!rotation) return { success: false, error: "Rotation plan not found" };
  if (rotation.status !== "DRAFT" && rotation.status !== "APPLIED") {
    return { success: false, error: "Only DRAFT or APPLIED rotation plans can have changes modified" };
  }

  const change = rotation.changes.find((c) => c.id === changeId);
  if (!change) return { success: false, error: "Change not found in rotation plan" };
  if (change.status !== "PENDING") {
    return { success: false, error: `Change has status ${change.status}, expected PENDING` };
  }

  const updateData: Record<string, unknown> = {
    status: "MODIFIED" as PlannedChangeStatus,
  };

  if (modification.outPlayerId !== undefined) updateData.outPlayerId = modification.outPlayerId;
  if (modification.inPlayerId !== undefined) updateData.inPlayerId = modification.inPlayerId;
  if (modification.outPosition !== undefined) updateData.outPosition = modification.outPosition;
  if (modification.inPosition !== undefined) updateData.inPosition = modification.inPosition;
  if (modification.positionOnly !== undefined) updateData.positionOnly = modification.positionOnly;
  if (modification.approximateMatchSeconds !== undefined) updateData.approximateMatchSeconds = modification.approximateMatchSeconds;
  if (modification.notes !== undefined) updateData.notes = modification.notes;
  if (modification.liveEventId !== undefined) updateData.liveEventId = modification.liveEventId;

  const updatedChange = await db.plannedRotationChange.update({
    where: { id: changeId },
    data: updateData,
    include: {
      outPlayer: { select: { id: true, firstName: true, lastName: true } },
      inPlayer: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  return {
    success: true,
    change: {
      id: updatedChange.id,
      sequence: updatedChange.sequence,
      outPlayerId: updatedChange.outPlayerId,
      inPlayerId: updatedChange.inPlayerId,
      outPosition: updatedChange.outPosition,
      inPosition: updatedChange.inPosition,
      positionOnly: updatedChange.positionOnly,
      approximateMatchSeconds: updatedChange.approximateMatchSeconds,
      status: updatedChange.status,
      notes: updatedChange.notes,
      outPlayerFirstName: updatedChange.outPlayer?.firstName ?? null,
      outPlayerLastName: updatedChange.outPlayer?.lastName ?? null,
      inPlayerFirstName: updatedChange.inPlayer?.firstName ?? null,
      inPlayerLastName: updatedChange.inPlayer?.lastName ?? null,
    },
  };
}

export async function getNextPlannedChange(
  matchId: string,
  teamId: string,
  orgFilter: OrgFilterMode,
): Promise<PlannedRotationWithChanges["changes"][number] | null> {
  const rotation = await getPlannedRotation(matchId, teamId, orgFilter);
  if (!rotation) return null;
  if (rotation.status !== "DRAFT" && rotation.status !== "APPLIED") return null;

  // PENDING changes are surfaced in plan order before any DELAYED change is revisited, so a
  // coach who delays one change still sees the next due change first, not the delayed one
  // repeatedly.
  const actionableChanges = rotation.changes.filter((c) => c.status === "PENDING" || c.status === "DELAYED");
  if (actionableChanges.length === 0) return null;

  const pending = actionableChanges.filter((c) => c.status === "PENDING");
  return pending[0] ?? actionableChanges[0]!;
}

export async function getPlannedChangesForMatch(
  matchId: string,
  teamId: string,
  orgFilter: OrgFilterMode,
): Promise<PlannedRotationWithChanges | null> {
  return getPlannedRotation(matchId, teamId, orgFilter);
}