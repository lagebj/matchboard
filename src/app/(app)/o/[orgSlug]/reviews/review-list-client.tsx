'use client';

import { useState } from 'react';
import type { ReviewStatus } from '@/generated/prisma/client';
import { resolveReviewAction, cancelReviewAction } from './actions';

type ReviewRequestRow = {
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

const statusStyles: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  APPROVED: 'bg-green-100 text-green-800',
  CHANGES_REQUESTED: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-slate-100 text-slate-600',
  SUPERSEDED: 'bg-slate-100 text-slate-500 line-through',
};

const targetLabels: Record<string, string> = {
  EVENT_SQUAD: 'Event squad',
  MATCH_LINEUP: 'Match lineup',
};

export function ReviewListClient({ reviews: initialReviews }: { reviews: ReviewRequestRow[] }) {
  const [reviews, setReviews] = useState(initialReviews);
  const [loading, setLoading] = useState<string | null>(null);
  const [comment, setComment] = useState<Record<string, string>>({});

  async function handleResolve(reviewId: string, status: 'APPROVED' | 'CHANGES_REQUESTED') {
    setLoading(reviewId);
    try {
      const updated = await resolveReviewAction(reviewId, {
        status,
        reviewerComment: comment[reviewId] ?? undefined,
      });
      setReviews((prev) => prev.map((r) => (r.id === reviewId ? { ...r, status: updated.status, reviewerComment: updated.reviewerComment, resolvedAt: updated.resolvedAt } : r)));
    } finally {
      setLoading(null);
    }
  }

  async function handleCancel(reviewId: string) {
    setLoading(reviewId);
    try {
      const updated = await cancelReviewAction(reviewId);
      setReviews((prev) => prev.map((r) => (r.id === reviewId ? { ...r, status: updated.status, resolvedAt: updated.resolvedAt } : r)));
    } finally {
      setLoading(null);
    }
  }

  if (reviews.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Reviews</h1>
        <p className="text-muted-foreground">No review requests yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Reviews</h1>
      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium">Target</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium">Message</th>
              <th className="px-4 py-3 text-left font-medium">Created</th>
              <th className="px-4 py-3 text-left font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {reviews.map((review) => (
              <tr key={review.id} className="border-b last:border-0">
                <td className="px-4 py-3">
                  <a href={review.targetType === 'EVENT_SQUAD' ? `/events/${review.targetId}` : `/matches/${review.targetId}`} className="font-medium hover:underline">
                    {targetLabels[review.targetType] ?? review.targetType}
                  </a>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusStyles[review.status] ?? 'bg-slate-100 text-slate-600'}`}>
                    {review.status === 'CHANGES_REQUESTED' ? 'Changes requested' : review.status.charAt(0) + review.status.slice(1).toLowerCase()}
                  </span>
                </td>
                <td className="px-4 py-3 max-w-xs truncate text-muted-foreground">
                  {review.requestMessage ?? review.reviewerComment ?? '-'}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{review.createdAt.toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  {review.status === 'PENDING' && (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Comment (optional)"
                        className="rounded border px-2 py-1 text-xs"
                        value={comment[review.id] ?? ''}
                        onChange={(e) => setComment((prev) => ({ ...prev, [review.id]: e.target.value }))}
                        disabled={loading === review.id}
                      />
                      <button
                        onClick={() => handleResolve(review.id, 'APPROVED')}
                        disabled={loading === review.id}
                        className="rounded bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-700 disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleResolve(review.id, 'CHANGES_REQUESTED')}
                        disabled={loading === review.id}
                        className="rounded bg-amber-600 px-2 py-1 text-xs text-white hover:bg-amber-700 disabled:opacity-50"
                      >
                        Request changes
                      </button>
                      <button
                        onClick={() => handleCancel(review.id)}
                        disabled={loading === review.id}
                        className="rounded bg-slate-400 px-2 py-1 text-xs text-white hover:bg-slate-500 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}