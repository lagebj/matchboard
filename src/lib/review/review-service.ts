import { db } from '@/lib/db';
import type { OrgFilterMode } from '@/lib/tenancy/resolve-org-filter';
import type { ReviewTargetType, ReviewStatus } from '@/generated/prisma/client';

export type CreateReviewRequestInput = {
  targetType: ReviewTargetType;
  targetId: string;
  targetRevision: string;
  requestMessage?: string;
  reviewerMembershipId?: string;
};

export type ResolveReviewRequestInput = {
  status: 'APPROVED' | 'CHANGES_REQUESTED' | 'CANCELLED';
  reviewerComment?: string;
};

export type ReviewRequestWithRelations = {
  id: string;
  organisationId: string | null;
  targetType: ReviewTargetType;
  targetId: string;
  targetRevision: string;
  requestedByMembershipId: string;
  reviewerMembershipId: string;
  status: ReviewStatus;
  requestMessage: string | null;
  reviewerComment: string | null;
  resolvedAt: Date | null;
  supersededById: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function requireOrganisationAccess(orgFilter: OrgFilterMode): string {
  if (orgFilter.type !== 'org') {
    throw new Error('Review requires an active organisation membership.');
  }
  return orgFilter.organisationId;
}

export async function createReviewRequest(
  input: CreateReviewRequestInput,
  organisationId: string,
  requestedByMembershipId: string,
): Promise<ReviewRequestWithRelations> {
  const existingPending = await db.reviewRequest.findFirst({
    where: {
      targetType: input.targetType,
      targetId: input.targetId,
      status: 'PENDING',
    },
  });

  if (existingPending) {
    throw new Error('A pending review request already exists for this target.');
  }

  if (input.reviewerMembershipId && input.reviewerMembershipId === requestedByMembershipId) {
    throw new Error('Cannot request a review from yourself.');
  }

  if (input.reviewerMembershipId) {
    const reviewerMembership = await db.organisationMembership.findUnique({
      where: { id: input.reviewerMembershipId },
    });

    if (!reviewerMembership || reviewerMembership.organisationId !== organisationId) {
      throw new Error('Reviewer must be a member of the same organisation.');
    }
  }

  const review = await db.reviewRequest.create({
    data: {
      organisationId,
      targetType: input.targetType,
      targetId: input.targetId,
      targetRevision: input.targetRevision,
      requestedByMembershipId,
      reviewerMembershipId: input.reviewerMembershipId ?? requestedByMembershipId,
      requestMessage: input.requestMessage ?? null,
    },
  });

  return review;
}

export async function resolveReviewRequest(
  reviewId: string,
  input: ResolveReviewRequestInput,
  organisationId: string,
  resolvedByMembershipId: string,
): Promise<ReviewRequestWithRelations> {
  const existing = await db.reviewRequest.findUnique({
    where: { id: reviewId },
  });

  if (!existing) {
    throw new Error('Review request not found.');
  }

  if (existing.organisationId !== organisationId) {
    throw new Error('Review request not found or access denied.');
  }

  if (existing.status !== 'PENDING') {
    throw new Error('Only pending review requests can be resolved.');
  }

  if (existing.requestedByMembershipId === existing.reviewerMembershipId && input.status !== 'CANCELLED') {
    throw new Error('Cannot review your own request.');
  }

  if (resolvedByMembershipId !== existing.reviewerMembershipId && input.status !== 'CANCELLED') {
    throw new Error('Only the assigned reviewer can resolve this review request.');
  }

  const updated = await db.reviewRequest.update({
    where: { id: reviewId },
    data: {
      status: input.status,
      reviewerComment: input.reviewerComment ?? null,
      resolvedAt: new Date(),
    },
  });

  return updated;
}

export async function supersedePendingReviews(
  targetType: ReviewTargetType,
  targetId: string,
): Promise<number> {
  const result = await db.reviewRequest.updateMany({
    where: {
      targetType,
      targetId,
      status: 'PENDING',
    },
    data: {
      status: 'SUPERSEDED',
      resolvedAt: new Date(),
    },
  });

  return result.count;
}

export async function getPendingReviewsForReviewer(
  organisationId: string,
  reviewerMembershipId: string,
): Promise<ReviewRequestWithRelations[]> {
  const reviews = await db.reviewRequest.findMany({
    where: {
      organisationId,
      reviewerMembershipId,
      status: 'PENDING',
    },
    orderBy: { createdAt: 'asc' },
  });

  return reviews;
}

export async function getReviewHistory(
  targetType: ReviewTargetType,
  targetId: string,
): Promise<ReviewRequestWithRelations[]> {
  const reviews = await db.reviewRequest.findMany({
    where: {
      targetType,
      targetId,
    },
    orderBy: { createdAt: 'desc' },
  });

  return reviews;
}