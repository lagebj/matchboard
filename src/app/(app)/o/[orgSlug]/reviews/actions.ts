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
import { requireActorContext } from '@/lib/auth/actor-context';
import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';

export async function requestReviewAction(input: CreateReviewRequestInput) {
  const review = await createReviewRequest(input);
  revalidatePath('/assistant');
  revalidatePath('/events');
  return review;
}

export async function resolveReviewAction(reviewId: string, input: ResolveReviewRequestInput) {
  const review = await resolveReviewRequest(reviewId, input);
  revalidatePath('/assistant');
  revalidatePath('/events');
  return review;
}

export async function cancelReviewAction(reviewId: string) {
  const review = await resolveReviewRequest(reviewId, {
    status: 'CANCELLED',
  });
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