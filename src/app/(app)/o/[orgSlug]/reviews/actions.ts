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
import { enqueueNotification } from '@/lib/email/outbox';

export async function requestReviewAction(input: CreateReviewRequestInput) {
  const ctx = await requireActorContext();
  requireMutationRole(ctx);
  const review = await createReviewRequest(input, ctx.organisationId, ctx.membershipId);

  if (review.reviewerMembershipId && review.reviewerMembershipId !== ctx.membershipId) {
    const reviewer = await db.organisationMembership.findUnique({
      where: { id: review.reviewerMembershipId },
      include: { user: { select: { email: true } } },
    });

    if (reviewer?.user?.email) {
      const organisation = await db.organisation.findUnique({
        where: { id: ctx.organisationId },
        select: { name: true, slug: true },
      });

      await enqueueNotification({
        organisationId: ctx.organisationId,
        idempotencyKey: `review-requested-${review.id}`,
        template: 'REVIEW_REQUESTED',
        payload: {
          organisationName: organisation?.name ?? 'Matchboard',
          requesterName: ctx.email,
          requesterEmail: ctx.email,
          reviewerName: reviewer.user.email,
          reviewerEmail: reviewer.user.email,
          targetType: input.targetType,
          targetId: input.targetId,
          targetLabel: input.targetId,
          requestMessage: input.requestMessage ?? null,
          reviewUrl: `/assistant`,
          organisationSlug: organisation?.slug ?? ctx.organisationSlug,
        },
        recipientEmail: reviewer.user.email,
        recipientUserId: reviewer.userId,
      });
    }
  }

  revalidatePath('/assistant');
  revalidatePath('/events');
  return review;
}

export async function resolveReviewAction(reviewId: string, input: ResolveReviewRequestInput) {
  const ctx = await requireActorContext();
  requireMutationRole(ctx);
  const review = await resolveReviewRequest(reviewId, input, ctx.organisationId, ctx.membershipId);

  if (input.status === 'CHANGES_REQUESTED' && review.requestedByMembershipId !== ctx.membershipId) {
    const requester = await db.organisationMembership.findUnique({
      where: { id: review.requestedByMembershipId },
      include: { user: { select: { email: true } } },
    });

    if (requester?.user?.email) {
      const organisation = await db.organisation.findUnique({
        where: { id: ctx.organisationId },
        select: { name: true, slug: true },
      });

      const reviewer = await db.organisationMembership.findUnique({
        where: { id: ctx.membershipId },
        include: { user: { select: { email: true, name: true } } },
      });

      await enqueueNotification({
        organisationId: ctx.organisationId,
        idempotencyKey: `review-changes-requested-${review.id}`,
        template: 'REVIEW_CHANGES_REQUESTED',
        payload: {
          organisationName: organisation?.name ?? 'Matchboard',
          requesterName: requester.user.email,
          requesterEmail: requester.user.email,
          reviewerName: reviewer?.user?.name ?? reviewer?.user?.email ?? ctx.email,
          reviewerEmail: ctx.email,
          targetType: review.targetType,
          targetId: review.targetId,
          targetLabel: review.targetId,
          reviewerComment: input.reviewerComment ?? null,
          reviewUrl: `/assistant`,
          organisationSlug: organisation?.slug ?? ctx.organisationSlug,
        },
        recipientEmail: requester.user.email,
        recipientUserId: requester.userId,
      });
    }
  }

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