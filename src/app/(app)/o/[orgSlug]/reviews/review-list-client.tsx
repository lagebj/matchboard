'use client';

import { useMemo, useState } from 'react';
import type { ReviewStatus } from '@/generated/prisma/client';
import { resolveReviewAction, cancelReviewAction } from './actions';
import { Button } from '@/components/ui/button';

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
  requestedByMembershipId: string;
  reviewerMembershipId: string;
};

const targetLabels: Record<string, string> = {
  EVENT_SQUAD: 'Event squad',
  MATCH_LINEUP: 'Match lineup',
};

function statusLabel(status: ReviewStatus): string {
  if (status === 'CHANGES_REQUESTED') return 'Changes requested';
  return status.charAt(0) + status.slice(1).toLowerCase();
}

// Neutral status treatment (Product Surface 1.0): no light-mode red/green pills, colour is
// never the only signal — the word carries the meaning.
function statusToneClass(status: ReviewStatus): string {
  switch (status) {
    case 'PENDING':
      return 'text-[var(--warning)]';
    case 'CHANGES_REQUESTED':
      return 'text-[var(--text-soft)]';
    case 'SUPERSEDED':
      return 'text-[var(--text-disabled)] line-through';
    default:
      return 'text-[var(--text-muted)]';
  }
}

export function ReviewListClient({
  reviews: initialReviews,
  myMembershipId,
}: {
  reviews: ReviewRequestRow[];
  myMembershipId: string;
}) {
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
      setReviews((prev) =>
        prev.map((r) =>
          r.id === reviewId
            ? { ...r, status: updated.status, reviewerComment: updated.reviewerComment, resolvedAt: updated.resolvedAt }
            : r,
        ),
      );
    } finally {
      setLoading(null);
    }
  }

  async function handleCancel(reviewId: string) {
    setLoading(reviewId);
    try {
      const updated = await cancelReviewAction(reviewId);
      setReviews((prev) =>
        prev.map((r) => (r.id === reviewId ? { ...r, status: updated.status, resolvedAt: updated.resolvedAt } : r)),
      );
    } finally {
      setLoading(null);
    }
  }

  const { pendingForMe, requestedByMe, history } = useMemo(() => {
    const pendingForMe: ReviewRequestRow[] = [];
    const requestedByMe: ReviewRequestRow[] = [];
    const history: ReviewRequestRow[] = [];
    for (const r of reviews) {
      const isOpen = r.status === 'PENDING' || r.status === 'CHANGES_REQUESTED';
      if (isOpen && r.reviewerMembershipId === myMembershipId && r.status === 'PENDING') {
        pendingForMe.push(r);
      } else if (isOpen && r.requestedByMembershipId === myMembershipId) {
        requestedByMe.push(r);
      } else {
        history.push(r);
      }
    }
    return { pendingForMe, requestedByMe, history };
  }, [reviews, myMembershipId]);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold tracking-tight">Peer reviews</h1>

      <ReviewSection
        title="Pending for me"
        empty="Nothing is waiting for your review."
        rows={pendingForMe}
        renderActions={(review) => (
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              placeholder="Comment (optional)"
              className="rounded-[var(--radius-control)] border border-[var(--border-strong)] bg-[var(--surface-base)] px-2 py-1 text-[var(--text-meta)] text-[var(--foreground)]"
              value={comment[review.id] ?? ''}
              onChange={(e) => setComment((prev) => ({ ...prev, [review.id]: e.target.value }))}
              disabled={loading === review.id}
            />
            <Button size="sm" variant="primary" onClick={() => handleResolve(review.id, 'APPROVED')} disabled={loading === review.id}>
              Approve
            </Button>
            <Button size="sm" variant="secondary" onClick={() => handleResolve(review.id, 'CHANGES_REQUESTED')} disabled={loading === review.id}>
              Request changes
            </Button>
          </div>
        )}
      />

      <ReviewSection
        title="Requested by me"
        empty="You have no open peer review requests."
        rows={requestedByMe}
        renderActions={(review) => (
          <Button size="sm" variant="ghost" onClick={() => handleCancel(review.id)} disabled={loading === review.id}>
            Cancel request
          </Button>
        )}
      />

      <ReviewSection title="History" empty="No resolved peer reviews yet." rows={history} />
    </div>
  );
}

function ReviewSection({
  title,
  empty,
  rows,
  renderActions,
}: {
  title: string;
  empty: string;
  rows: ReviewRequestRow[];
  renderActions?: (review: ReviewRequestRow) => React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-[var(--text-micro)] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
        {title}
        {rows.length > 0 && <span className="ml-2 text-[var(--text-disabled)]">{rows.length}</span>}
      </h2>
      {rows.length === 0 ? (
        <p className="text-[var(--text-meta)] text-[var(--text-muted)]">{empty}</p>
      ) : (
        <ul className="divide-y divide-[var(--border-soft)] rounded-[var(--radius-object)] border border-[var(--border-soft)] bg-[var(--surface-raised)]">
          {rows.map((review) => (
            <li key={review.id} className="flex flex-col gap-2 px-4 py-3">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <a
                  href={review.targetType === 'EVENT_SQUAD' ? `/events/${review.targetId}` : `/matches/${review.targetId}`}
                  className="text-[var(--text-row-title)] font-medium text-[var(--foreground)] hover:underline"
                >
                  {targetLabels[review.targetType] ?? review.targetType}
                </a>
                <span className={`text-[var(--text-meta)] font-medium ${statusToneClass(review.status)}`}>
                  {statusLabel(review.status)}
                </span>
                <span className="text-[var(--text-meta)] text-[var(--text-muted)]">
                  {new Date(review.createdAt).toLocaleDateString()}
                </span>
              </div>
              {(review.requestMessage || review.reviewerComment) && (
                <p className="text-[var(--text-meta)] text-[var(--text-soft)]">
                  {review.reviewerComment ?? review.requestMessage}
                </p>
              )}
              {renderActions && review.status === 'PENDING' && renderActions(review)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
