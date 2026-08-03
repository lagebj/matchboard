import { db } from '@/lib/db';
import type { OrgFilterMode } from '@/lib/tenancy/resolve-org-filter';
import type { ReviewTargetType, ReviewStatus } from '@/generated/prisma/client';
import { computeTargetContentHash, hasTargetChanged } from './content-hash';

export type CreateReviewRequestInput = {
  targetType: ReviewTargetType;
  targetId: string;
  targetRevision?: string;
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

  const targetRevision = input.targetRevision && input.targetRevision.trim() !== ''
    ? input.targetRevision
    : await computeTargetContentHash(input.targetType, input.targetId, organisationId);

  const review = await db.reviewRequest.create({
    data: {
      organisationId,
      targetType: input.targetType,
      targetId: input.targetId,
      targetRevision,
      requestedByMembershipId,
      reviewerMembershipId: input.reviewerMembershipId ?? requestedByMembershipId,
      requestMessage: input.requestMessage ?? null,
    },
  });

  return review;
}

export type ResolveReviewResult = {
  review: ReviewRequestWithRelations;
  targetChanged: boolean;
};

export async function resolveReviewRequest(
  reviewId: string,
  input: ResolveReviewRequestInput,
  organisationId: string,
  resolvedByMembershipId: string,
): Promise<ResolveReviewResult> {
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

  let targetChanged = false;
  try {
    const currentHash = await computeTargetContentHash(
      existing.targetType,
      existing.targetId,
      organisationId,
    );
    targetChanged = hasTargetChanged(existing.targetRevision, currentHash);
  } catch {
    // If the target no longer exists, the review is still resolvable
    // but we can't verify content. Leave targetChanged as false.
  }

  const updated = await db.reviewRequest.update({
    where: { id: reviewId },
    data: {
      status: input.status,
      reviewerComment: input.reviewerComment ?? null,
      resolvedAt: new Date(),
    },
  });

  return { review: updated, targetChanged };
}

export type SupersededReviewInfo = {
  id: string;
  requestedByMembershipId: string;
  reviewerMembershipId: string;
  targetType: ReviewTargetType;
  targetId: string;
};

export async function supersedePendingReviews(
  targetType: ReviewTargetType,
  targetId: string,
  supersededById?: string,
): Promise<{ count: number; superseded: SupersededReviewInfo[] }> {
  const pending = await db.reviewRequest.findMany({
    where: {
      targetType,
      targetId,
      status: 'PENDING',
    },
    select: {
      id: true,
      requestedByMembershipId: true,
      reviewerMembershipId: true,
      targetType: true,
      targetId: true,
    },
  });

  if (pending.length === 0) return { count: 0, superseded: [] };

  await db.reviewRequest.updateMany({
    where: {
      id: { in: pending.map((r) => r.id) },
    },
    data: {
      status: 'SUPERSEDED',
      resolvedAt: new Date(),
      ...(supersededById ? { supersededById } : {}),
    },
  });

  return {
    count: pending.length,
    superseded: pending,
  };
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
  organisationId?: string,
): Promise<ReviewRequestWithRelations[]> {
  const reviews = await db.reviewRequest.findMany({
    where: {
      targetType,
      targetId,
      ...(organisationId ? { organisationId } : {}),
    },
    orderBy: { createdAt: 'desc' },
  });

  return reviews;
}