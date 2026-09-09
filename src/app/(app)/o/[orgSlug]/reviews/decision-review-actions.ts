'use server';

import { revalidatePath } from 'next/cache';
import { requirePageActorContext, requireMutationRole } from '@/lib/auth/actor-context';
import { setTenantOrganisationId } from '@/lib/tenancy/tenant-async-storage';
import {
  resolveDecisionReview,
  deferDecisionReview,
  getDecisionReviewHistoryForTarget,
} from '@/lib/review/decision-review';
import { updateThread } from '@/lib/planned-rotation/development-thread';
import { updateTeamFocus } from '@/lib/coaching/team-focus';
import type { DecisionReviewOutcome, DecisionReviewTargetType } from '@/generated/prisma/client';

/**
 * Keep / Change / Complete a due Decision review (ADR-0132).
 *
 * - Keep     → resolve KEEP; a fresh review is scheduled 42 days out.
 * - Change   → resolve CHANGE; a fresh review is scheduled. The coach then edits the target on
 *              its detail page — a subsequent material save supersedes the fresh review and
 *              schedules another (net: one extra SUPERSEDED row, matching the spec's
 *              "next review 42 days unless changed").
 * - Complete → resolve COMPLETE (stops the cadence) AND close the target.
 */
export async function resolveDecisionReviewAction(
  reviewId: string,
  outcome: DecisionReviewOutcome,
  opts: { note?: string | null; targetType: DecisionReviewTargetType; targetId: string } = {
    targetType: 'DEVELOPMENT_THREAD',
    targetId: '',
  },
) {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);
  requireMutationRole(ctx);

  const resolved = await resolveDecisionReview(reviewId, outcome, ctx.orgFilter, {
    reviewNote: opts.note ?? null,
    resolvedBy: ctx.membershipId,
  });

  if (outcome === 'COMPLETE' && opts.targetId) {
    // Close the underlying target. Its own close hook calls supersedeDecisionReviewsOnClose,
    // which is a no-op here since this review is already COMPLETED.
    if (opts.targetType === 'DEVELOPMENT_THREAD') {
      await updateThread(opts.targetId, { status: 'COMPLETED' }, ctx.orgFilter);
    } else {
      await updateTeamFocus(opts.targetId, { status: 'COMPLETED' }, ctx.orgFilter);
    }
  }

  revalidatePath('/today');
  return resolved;
}

/** "Later" — push the due date out by seven days; the review stays pending. */
export async function deferDecisionReviewAction(reviewId: string) {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);
  requireMutationRole(ctx);
  const deferred = await deferDecisionReview(reviewId, ctx.orgFilter);
  revalidatePath('/today');
  return deferred;
}

export async function getDecisionReviewHistoryAction(
  targetType: DecisionReviewTargetType,
  targetId: string,
) {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);
  return getDecisionReviewHistoryForTarget(targetType, targetId, ctx.orgFilter);
}
