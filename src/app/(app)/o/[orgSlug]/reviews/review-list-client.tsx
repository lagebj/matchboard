'use client';

import type { ReviewStatus } from '@/generated/prisma/client';

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

export function ReviewListClient({ reviews }: { reviews: ReviewRequestRow[] }) {
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
              <th className="px-4 py-3 text-left font-medium">Resolved</th>
            </tr>
          </thead>
          <tbody>
            {reviews.map((review) => (
              <tr key={review.id} className="border-b last:border-0">
                <td className="px-4 py-3">
                  <span className="font-medium">{targetLabels[review.targetType] ?? review.targetType}</span>
                  <span className="ml-2 text-muted-foreground">{review.targetId.slice(0, 8)}...</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusStyles[review.status] ?? 'bg-slate-100 text-slate-600'}`}>
                    {review.status}
                  </span>
                </td>
                <td className="px-4 py-3 max-w-xs truncate text-muted-foreground">
                  {review.requestMessage ?? review.reviewerComment ?? '-'}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{review.createdAt.toLocaleDateString()}</td>
                <td className="px-4 py-3 text-muted-foreground">{review.resolvedAt?.toLocaleDateString() ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}