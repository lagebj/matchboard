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
        <h1 className="text-2xl font-bold tracking-tight">Peer reviews</h1>
        <p className="text-[var(--text-muted)]">No membership found.</p>
      </div>
    );
  }

  const reviews = await db.reviewRequest.findMany({
    where: { organisationId: ctx.organisationId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      targetType: true,
      targetId: true,
      targetRevision: true,
      status: true,
      requestMessage: true,
      reviewerComment: true,
      resolvedAt: true,
      createdAt: true,
      requestedByMembershipId: true,
      reviewerMembershipId: true,
    },
  });

  // Touchline Design Atlas (ADR-0136 Phase 7, `10_ROUTE_COMPOSITION_CONFIG_MORE_
  // REVIEWS_AUTH.md §F`): each request must show its requester, not only the target and
  // status. `ReviewRequest` stores only membership ids (no Prisma relation to
  // OrganisationMembership), so requester display names are resolved here in one batched
  // query and handed to the client as a plain id -> name map.
  const membershipIds = Array.from(
    new Set(reviews.map((r) => r.requestedByMembershipId)),
  );
  const requesterMemberships =
    membershipIds.length > 0
      ? await db.organisationMembership.findMany({
          where: { id: { in: membershipIds } },
          select: { id: true, user: { select: { name: true, email: true } } },
        })
      : [];
  const requesterNames: Record<string, string> = {};
  for (const m of requesterMemberships) {
    requesterNames[m.id] = m.user.name ?? m.user.email;
  }

  return (
    <ReviewListClient reviews={reviews} myMembershipId={membership.id} requesterNames={requesterNames} />
  );
}
