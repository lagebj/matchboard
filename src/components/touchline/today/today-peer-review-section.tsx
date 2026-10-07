import { db } from "@/lib/db";
import { ReviewListClient } from "@/app/(app)/o/[orgSlug]/reviews/review-list-client";

/**
 * Today's peer-review due-work section (ADR-0157 slice C8, `10_INFORMATION_ARCHITECTURE_
 * CONVERGENCE.md` "/reviews": "Peer-review initiation belongs on the object being reviewed.
 * Due work belongs on Today."). Renders the existing `ReviewListClient` verbatim — same
 * grouping (Pending for me / Requested by me / History) and same resolve/cancel server
 * actions the retired standalone hub used, so retiring `/reviews` strands no workflow.
 * Returns null when there is no peer-review activity at all (Today never renders empty
 * sections — `04_TODAY_SURFACE.md`).
 */
export async function TodayPeerReviewSection({
  organisationId,
  membershipId,
}: {
  organisationId: string;
  membershipId: string;
}) {
  const reviews = await db.reviewRequest.findMany({
    where: { organisationId },
    orderBy: { createdAt: "desc" },
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

  if (reviews.length === 0) return null;

  const membershipIds = Array.from(new Set(reviews.map((r) => r.requestedByMembershipId)));
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
    <section className="flex flex-col gap-2">
      <h2 className="text-[var(--text-micro)] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
        Peer reviews
        <span className="ml-2 text-[var(--text-disabled)]">{reviews.length}</span>
      </h2>
      <ReviewListClient
        reviews={reviews}
        myMembershipId={membershipId}
        requesterNames={requesterNames}
        hideHeader
      />
    </section>
  );
}