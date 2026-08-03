'use server';

import {
  createReviewRequest,
  resolveReviewRequest,
  supersedePendingReviews,
  getPendingReviewsForReviewer,
  getReviewHistory,
  type CreateReviewRequestInput,
  type ResolveReviewRequestInput,
} from '@/lib/review/review-service';
import { requireActorContext, requireMutationRole } from '@/lib/auth/actor-context';
import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';

export async function requestReviewAction(input: CreateReviewRequestInput) {
  const ctx = await requireActorContext();
  requireMutationRole(ctx);
  const review = await createReviewRequest(input, ctx.organisationId, ctx.membershipId);
  revalidatePath('/assistant');
  revalidatePath('/events');
  return review;
}

export async function resolveReviewAction(reviewId: string, input: ResolveReviewRequestInput) {
  const ctx = await requireActorContext();
  requireMutationRole(ctx);
  const review = await resolveReviewRequest(reviewId, input, ctx.organisationId, ctx.membershipId);
  revalidatePath('/assistant');
  revalidatePath('/events');
  return review;
}

export async function cancelReviewAction(reviewId: string) {
  const ctx = await requireActorContext();
  requireMutationRole(ctx);
  const review = await resolveReviewRequest(reviewId, {
    status: 'CANCELLED',
  }, ctx.organisationId, ctx.membershipId);
  revalidatePath('/assistant');
  return review;
}

export async function getPendingReviewsAction() {
  const ctx = await requireActorContext();

  const membership = await db.organisationMembership.findFirst({
    where: {
      userId: ctx.userId,
      organisationId: ctx.organisationId,
    },
  });

  if (!membership) return [];

  return getPendingReviewsForReviewer(ctx.organisationId, membership.id);
}

export async function getReviewHistoryAction(targetType: string, targetId: string) {
  return getReviewHistory(targetType as 'EVENT_SQUAD' | 'MATCH_LINEUP', targetId);
}