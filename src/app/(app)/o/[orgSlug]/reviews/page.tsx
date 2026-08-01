import { requireCoachAccess } from '@/lib/auth';
import { resolveOrgFilterForUser } from '@/lib/tenancy/resolve-org-filter';
import { db } from '@/lib/db';
import { ReviewListClient } from './review-list-client';

export default async function ReviewsPage() {
  const coach = await requireCoachAccess();
  const orgFilter = await resolveOrgFilterForUser(coach.id ?? '');

  if (orgFilter.type !== 'org') {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Reviews</h1>
        <p className="text-muted-foreground">No organisation selected.</p>
      </div>
    );
  }

  const membership = await db.organisationMembership.findFirst({
    where: { userId: coach.id, organisationId: orgFilter.organisationId },
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
    where: { organisationId: orgFilter.organisationId },
    orderBy: { createdAt: 'desc' },
  });

  return <ReviewListClient reviews={reviews} />;
}