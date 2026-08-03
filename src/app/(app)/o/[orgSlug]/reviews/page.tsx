import { requireActorContext } from '@/lib/auth/actor-context';
import { db } from '@/lib/db';
import { ReviewListClient } from './review-list-client';

export default async function ReviewsPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const ctx = await requireActorContext(orgSlug);

  if (ctx.orgFilter.type !== 'org') {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Reviews</h1>
        <p className="text-muted-foreground">No organisation selected.</p>
      </div>
    );
  }

  const membership = await db.organisationMembership.findFirst({
    where: { userId: ctx.userId, organisationId: ctx.organisationId },
  });

  if (!membership) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Reviews</h1>
        <p className="text-muted-foreground">No membership found.</p>
      </div>
    );
  }

  const reviews = await db.reviewRequest.findMany({
    where: { organisationId: ctx.organisationId },
    orderBy: { createdAt: 'desc' },
  });

  return <ReviewListClient reviews={reviews} />;
}