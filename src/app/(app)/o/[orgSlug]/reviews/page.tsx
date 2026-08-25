import { requirePageActorContext } from '@/lib/auth/actor-context';
import { db } from '@/lib/db';
import { ReviewListClient } from './review-list-client';
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";

export default async function ReviewsPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const ctx = await requirePageActorContext(orgSlug);
  setTenantOrganisationId(ctx.organisationId);

  const membership = await db.organisationMembership.findFirst({
    where: { userId: ctx.userId, organisationId: ctx.organisationId },
  });

  if (!membership) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Reviews</h1>
        <p className="text-[var(--text-muted)]">No membership found.</p>
      </div>
    );
  }

  const reviews = await db.reviewRequest.findMany({
    where: { organisationId: ctx.organisationId },
    orderBy: { createdAt: 'desc' },
  });

  return <ReviewListClient reviews={reviews} />;
}