"use server";

import { AuthorizationError } from "@/lib/auth";
import { requireActorContext } from "@/lib/auth/actor-context";
import {
  assignWorkOwnership,
  handoverWorkOwnership,
  acknowledgeWorkOwnership,
  completeWorkOwnership,
  getWorkOwnershipForTarget,
  getActiveWorkOwnershipForTarget,
  getWorkOwnershipsForOwner,
  getUnacknowledgedHandovers,
  getExpiringWorkItems,
} from "@/lib/ownership/work-ownership";
import type { WorkTargetType } from "@/generated/prisma/client";

export async function assignWorkOwnerAction(input: {
  targetType: WorkTargetType;
  targetId: string;
  ownerMembershipId: string;
  dueAt?: Date | null;
}) {
  const ctx = await requireActorContext();

  return assignWorkOwnership({
    organisationId: ctx.organisationId,
    targetType: input.targetType,
    targetId: input.targetId,
    ownerMembershipId: input.ownerMembershipId,
    assignedByMembershipId: ctx.membershipId,
    dueAt: input.dueAt,
  });
}

export async function handoverWorkOwnerAction(input: {
  ownershipId: string;
  newOwnerMembershipId: string;
  handoverNote?: string | null;
}) {
  const ctx = await requireActorContext();

  return handoverWorkOwnership({
    ownershipId: input.ownershipId,
    newOwnerMembershipId: input.newOwnerMembershipId,
    handoverNote: input.handoverNote,
    assignedByMembershipId: ctx.membershipId,
  });
}

export async function acknowledgeWorkOwnerAction(ownershipId: string) {
  await requireActorContext();
  return acknowledgeWorkOwnership(ownershipId);
}

export async function completeWorkOwnerAction(targetType: WorkTargetType, targetId: string) {
  await requireActorContext();
  return completeWorkOwnership(targetType, targetId);
}

export async function getWorkOwnershipsAction(targetType: WorkTargetType, targetId: string) {
  await requireActorContext();
  return getWorkOwnershipForTarget(targetType, targetId);
}

export async function getActiveWorkOwnerAction(targetType: WorkTargetType, targetId: string) {
  await requireActorContext();
  return getActiveWorkOwnershipForTarget(targetType, targetId);
}

export async function getOwnerWorkItemsAction(status?: "ACTIVE" | "HANDED_OVER" | "COMPLETED") {
  const ctx = await requireActorContext();
  return getWorkOwnershipsForOwner(ctx.membershipId, status);
}

export async function getUnacknowledgedHandoversAction() {
  const ctx = await requireActorContext();
  return getUnacknowledgedHandovers(ctx.membershipId);
}

export async function getExpiringWorkItemsAction(withinDays?: number) {
  const ctx = await requireActorContext();
  return getExpiringWorkItems(ctx.organisationId, withinDays);
}