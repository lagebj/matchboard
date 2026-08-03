"use server";

import { AuthorizationError } from "@/lib/auth";
import { requireActorContext, requireMutationRole } from "@/lib/auth/actor-context";
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
  requireMutationRole(ctx);

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
  requireMutationRole(ctx);

  return handoverWorkOwnership({
    ownershipId: input.ownershipId,
    newOwnerMembershipId: input.newOwnerMembershipId,
    handoverNote: input.handoverNote,
    assignedByMembershipId: ctx.membershipId,
    organisationId: ctx.organisationId,
  });
}

export async function acknowledgeWorkOwnerAction(ownershipId: string) {
  const ctx = await requireActorContext();
  requireMutationRole(ctx);
  return acknowledgeWorkOwnership(ownershipId, ctx.organisationId);
}

export async function completeWorkOwnerAction(targetType: WorkTargetType, targetId: string) {
  const ctx = await requireActorContext();
  requireMutationRole(ctx);
  return completeWorkOwnership(targetType, targetId, ctx.organisationId);
}

export async function getWorkOwnershipsAction(targetType: WorkTargetType, targetId: string) {
  const ctx = await requireActorContext();
  return getWorkOwnershipForTarget(targetType, targetId, ctx.organisationId);
}

export async function getActiveWorkOwnerAction(targetType: WorkTargetType, targetId: string) {
  const ctx = await requireActorContext();
  return getActiveWorkOwnershipForTarget(targetType, targetId, ctx.organisationId);
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