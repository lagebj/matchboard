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
import { db } from "@/lib/db";
import { enqueueNotification } from "@/lib/email/outbox";

export async function assignWorkOwnerAction(input: {
  targetType: WorkTargetType;
  targetId: string;
  ownerMembershipId: string;
  dueAt?: Date | null;
}) {
  const ctx = await requireActorContext();
  requireMutationRole(ctx);

  const ownership = await assignWorkOwnership({
    organisationId: ctx.organisationId,
    targetType: input.targetType,
    targetId: input.targetId,
    ownerMembershipId: input.ownerMembershipId,
    assignedByMembershipId: ctx.membershipId,
    dueAt: input.dueAt,
  });

  const owner = await db.organisationMembership.findUnique({
    where: { id: input.ownerMembershipId },
    include: { user: { select: { email: true } } },
  });

  if (owner?.user?.email) {
    const organisation = await db.organisation.findUnique({
      where: { id: ctx.organisationId },
      select: { name: true, slug: true },
    });

    await enqueueNotification({
      organisationId: ctx.organisationId,
      idempotencyKey: `ownership-assigned-${ownership.id}`,
      template: 'OWNERSHIP_ASSIGNED',
      payload: {
        organisationName: organisation?.name ?? "Matchboard",
        assignerName: ctx.email,
        assignerEmail: ctx.email,
        assigneeName: owner.user.email,
        assigneeEmail: owner.user.email,
        targetType: input.targetType,
        targetId: input.targetId,
        targetLabel: input.targetId,
        ownershipUrl: `/assistant`,
        organisationSlug: organisation?.slug ?? ctx.organisationSlug,
      },
      recipientEmail: owner.user.email,
      recipientUserId: owner.userId,
    });
  }

  return ownership;
}

export async function handoverWorkOwnerAction(input: {
  ownershipId: string;
  newOwnerMembershipId: string;
  handoverNote?: string | null;
}) {
  const ctx = await requireActorContext();
  requireMutationRole(ctx);

  const ownership = await handoverWorkOwnership({
    ownershipId: input.ownershipId,
    newOwnerMembershipId: input.newOwnerMembershipId,
    handoverNote: input.handoverNote,
    assignedByMembershipId: ctx.membershipId,
    organisationId: ctx.organisationId,
  });

  const newOwner = await db.organisationMembership.findUnique({
    where: { id: input.newOwnerMembershipId },
    include: { user: { select: { email: true } } },
  });

  if (newOwner?.user?.email) {
    const organisation = await db.organisation.findUnique({
      where: { id: ctx.organisationId },
      select: { name: true, slug: true },
    });

    await enqueueNotification({
      organisationId: ctx.organisationId,
      idempotencyKey: `ownership-handover-${ownership.id}`,
      template: 'OWNERSHIP_HANDOVER_REQUESTED',
      payload: {
        organisationName: organisation?.name ?? "Matchboard",
        assignerName: ctx.email,
        assignerEmail: ctx.email,
        assigneeName: newOwner.user.email,
        assigneeEmail: newOwner.user.email,
        targetType: ownership.targetType,
        targetId: ownership.targetId,
        targetLabel: ownership.targetId,
        ownershipUrl: `/assistant`,
        organisationSlug: organisation?.slug ?? ctx.organisationSlug,
      },
      recipientEmail: newOwner.user.email,
      recipientUserId: newOwner.userId,
    });
  }

  return ownership;
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