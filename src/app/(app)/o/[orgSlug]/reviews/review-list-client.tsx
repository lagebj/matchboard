'use client';

import { useState } from 'react';
import type { ReviewStatus } from '@/generated/prisma/client';
import { Button } from '@/components/ui/button';
import { Surface } from '@/components/ui/surface';
import { SectionHeader } from '@/components/ui/section-header';
import { StatusPill } from '@/components/ui/status-pill';
import {
  CheckCircle2,
  MessageSquareWarning,
  XCircle,
  Clock,
  Ban,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';
import { resolveReviewAction, cancelReviewAction } from './actions';

type ReviewRow = {
  id: string;
  targetType: string;
  targetId: string;
  targetRevision: string;
  status: ReviewStatus;
  requestMessage: string | null;
  reviewerComment: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
};

function statusConfig(status: ReviewStatus) {
  switch (status) {
    case 'PENDING':
      return { label: 'Pending', icon: Clock, variant: 'warning' as const };
    case 'APPROVED':
      return { label: 'Approved', icon: CheckCircle2, variant: 'success' as const };
    case 'CHANGES_REQUESTED':
      return { label: 'Changes requested', icon: MessageSquareWarning, variant: 'danger' as const };
    case 'CANCELLED':
      return { label: 'Cancelled', icon: XCircle, variant: 'neutral' as const };
    case 'SUPERSEDED':
      return { label: 'Superseded', icon: Ban, variant: 'neutral' as const };
    default:
      return { label: status, icon: Clock, variant: 'neutral' as const };
  }
}

function targetHref(targetType: string, targetId: string) {
  return targetType === 'EVENT_SQUAD' ? `/events/${targetId}` : `/matches/${targetId}`;
}

export function ReviewListClient({ reviews: initial }: { reviews: ReviewRow[] }) {
  const [reviews, setReviews] = useState(initial);

  async function handleResolve(reviewId: string, status: 'APPROVED' | 'CHANGES_REQUESTED') {
    const result = await resolveReviewAction(reviewId, { status });
    setReviews((prev) => prev.map((r) => (r.id === reviewId ? { ...r, status: result.status, resolvedAt: result.resolvedAt } : r)));
  }

  async function handleCancel(reviewId: string) {
    const result = await cancelReviewAction(reviewId);
    setReviews((prev) => prev.map((r) => (r.id === reviewId ? { ...r, status: result.status, resolvedAt: result.resolvedAt } : r)));
  }

  if (reviews.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Reviews</h1>
        <p className="text-muted-foreground">No review requests found.</p>
      </div>
    );
  }

  const pending = reviews.filter((r) => r.status === 'PENDING');
  const resolved = reviews.filter((r) => r.status !== 'PENDING');

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Reviews"
        description="Review requests and outcomes."
        eyebrow={`${reviews.length} total`}
      />

      {pending.length > 0 && (
        <Surface padding="md" className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-zinc-100">Pending ({pending.length})</h2>
          <ul className="flex flex-col gap-2">
            {pending.map((review) => {
              const config = statusConfig(review.status);
              const Icon = config.icon;
              return (
                <li key={review.id} className="flex items-center justify-between gap-3 py-2 px-3 -mx-3 rounded-lg hover:bg-[var(--surface-muted)]/30">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-sm font-medium text-zinc-100 truncate">
                      {review.targetType === 'EVENT_SQUAD' ? 'Event squad' : 'Match lineup'} review
                    </span>
                    {review.requestMessage && (
                      <span className="text-xs text-[var(--text-muted)] line-clamp-1">{review.requestMessage}</span>
                    )}
                    <span className="text-[10px] text-[var(--text-muted)]">
                      {new Date(review.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <StatusPill variant={config.variant} size="sm" icon={Icon}>
                      {config.label}
                    </StatusPill>
                    <Button
                      as={Link}
                      href={targetHref(review.targetType, review.targetId)}
                      variant="ghost"
                      size="sm"
                      trailingIcon={<ArrowRight className="h-3 w-3" aria-hidden="true" />}
                    >
                      View
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleResolve(review.id, 'APPROVED')}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleResolve(review.id, 'CHANGES_REQUESTED')}
                    >
                      Request changes
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCancel(review.id)}
                    >
                      Cancel
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </Surface>
      )}

      {resolved.length > 0 && (
        <Surface padding="md" className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-[var(--text-muted)]">Resolved ({resolved.length})</h2>
          <ul className="flex flex-col gap-2">
            {resolved.map((review) => {
              const config = statusConfig(review.status);
              const Icon = config.icon;
              return (
                <li key={review.id} className="flex items-center justify-between gap-3 py-2 px-3 -mx-3 rounded-lg hover:bg-[var(--surface-muted)]/30">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-sm font-medium text-[var(--text-muted)] truncate">
                      {review.targetType === 'EVENT_SQUAD' ? 'Event squad' : 'Match lineup'} review
                    </span>
                    {review.reviewerComment && (
                      <span className="text-xs text-[var(--text-muted)] line-clamp-1">{review.reviewerComment}</span>
                    )}
                    <span className="text-[10px] text-[var(--text-muted)]">
                      Resolved {review.resolvedAt ? new Date(review.resolvedAt).toLocaleDateString() : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <StatusPill variant={config.variant} size="sm" icon={Icon}>
                      {config.label}
                    </StatusPill>
                    <Button
                      as={Link}
                      href={targetHref(review.targetType, review.targetId)}
                      variant="ghost"
                      size="sm"
                      trailingIcon={<ArrowRight className="h-3 w-3" aria-hidden="true" />}
                    >
                      View
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </Surface>
      )}
    </div>
  );
}