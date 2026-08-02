import "server-only";

import { db } from "@/lib/db";
import { AuthorizationError } from "@/lib/auth";
import type { WorkTargetType, WorkOwnershipStatus } from "@/generated/prisma/client";

export type AssignWorkOwnershipInput = {
  organisationId: string;
  targetType: WorkTargetType;
  targetId: string;
  ownerMembershipId: string;
  assignedByMembershipId: string;
  dueAt?: Date | null;
};

export type HandoverWorkOwnershipInput = {
  ownershipId: string;
  newOwnerMembershipId: string;
  handoverNote?: string | null;
  assignedByMembershipId: string;
};

export async function assignWorkOwnership(input: AssignWorkOwnershipInput) {
  const existing = await db.workOwnership.findFirst({
    where: {
      targetType: input.targetType,
      targetId: input.targetId,
      status: { in: ["ACTIVE", "HANDED_OVER"] },
    },
  });

  if (existing) {
    throw new AuthorizationError(
      `Work ownership already exists for ${input.targetType}:${input.targetId} with status ${existing.status}`,
    );
  }

  return db.workOwnership.create({
    data: {
      organisationId: input.organisationId,
      targetType: input.targetType,
      targetId: input.targetId,
      ownerMembershipId: input.ownerMembershipId,
      assignedByMembershipId: input.assignedByMembershipId,
      status: "ACTIVE",
      dueAt: input.dueAt ?? null,
    },
  });
}

export async function handoverWorkOwnership(input: HandoverWorkOwnershipInput) {
  const ownership = await db.workOwnership.findUnique({
    where: { id: input.ownershipId },
  });

  if (!ownership) {
    throw new AuthorizationError("Work ownership not found.");
  }

  if (ownership.status === "COMPLETED") {
    throw new AuthorizationError("Cannot hand over completed ownership.");
  }

  await db.workOwnership.update({
    where: { id: input.ownershipId },
    data: {
      status: "HANDED_OVER",
      handoverNote: input.handoverNote ?? null,
    },
  });

  return db.workOwnership.create({
    data: {
      organisationId: ownership.organisationId,
      targetType: ownership.targetType,
      targetId: ownership.targetId,
      ownerMembershipId: input.newOwnerMembershipId,
      assignedByMembershipId: input.assignedByMembershipId,
      status: "ACTIVE",
      dueAt: ownership.dueAt,
      handoverNote: input.handoverNote ?? null,
    },
  });
}

export async function acknowledgeWorkOwnership(ownershipId: string) {
  const ownership = await db.workOwnership.findUnique({
    where: { id: ownershipId },
  });

  if (!ownership) {
    throw new AuthorizationError("Work ownership not found.");
  }

  if (ownership.status === "COMPLETED") {
    throw new AuthorizationError("Cannot acknowledge completed ownership.");
  }

  return db.workOwnership.update({
    where: { id: ownershipId },
    data: { acknowledgedAt: new Date() },
  });
}

export async function completeWorkOwnership(targetType: WorkTargetType, targetId: string) {
  const ownerships = await db.workOwnership.findMany({
    where: {
      targetType,
      targetId,
      status: { in: ["ACTIVE", "HANDED_OVER"] },
    },
  });

  if (ownerships.length === 0) return [];

  return db.workOwnership.updateMany({
    where: {
      id: { in: ownerships.map((o) => o.id) },
    },
    data: { status: "COMPLETED" as WorkOwnershipStatus },
  });
}

export async function getWorkOwnershipForTarget(targetType: WorkTargetType, targetId: string) {
  return db.workOwnership.findMany({
    where: { targetType, targetId },
    orderBy: { createdAt: "desc" },
  });
}

export async function getActiveWorkOwnershipForTarget(targetType: WorkTargetType, targetId: string) {
  return db.workOwnership.findFirst({
    where: {
      targetType,
      targetId,
      status: "ACTIVE",
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getWorkOwnershipsForOwner(
  ownerMembershipId: string,
  status?: WorkOwnershipStatus,
) {
  return db.workOwnership.findMany({
    where: {
      ownerMembershipId,
      ...(status ? { status } : { status: { in: ["ACTIVE", "HANDED_OVER"] } }),
    },
    orderBy: { dueAt: "asc" },
  });
}

export async function getUnownedWorkItems(organisationId: string, targetTypes: WorkTargetType[]) {
  const ownedTargets = await db.workOwnership.findMany({
    where: {
      organisationId,
      targetType: { in: targetTypes },
      status: { in: ["ACTIVE", "HANDED_OVER"] },
    },
    select: { targetType: true, targetId: true },
  });

  const ownedSet = new Set(ownedTargets.map((o) => `${o.targetType}:${o.targetId}`));
  return ownedSet;
}

export async function getUnacknowledgedHandovers(membershipId: string) {
  return db.workOwnership.findMany({
    where: {
      ownerMembershipId: membershipId,
      status: "ACTIVE",
      acknowledgedAt: null,
      assignedByMembershipId: { not: membershipId },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function getExpiringWorkItems(organisationId: string, withinDays: number = 7) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + withinDays);

  return db.workOwnership.findMany({
    where: {
      organisationId,
      status: "ACTIVE",
      dueAt: { not: null, lte: cutoff },
    },
    orderBy: { dueAt: "asc" },
  });
}