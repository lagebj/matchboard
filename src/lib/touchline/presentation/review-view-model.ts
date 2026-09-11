/**
 * Peer reviews presentation view model (Touchline Design Atlas,
 * `10_ROUTE_COMPOSITION_CONFIG_MORE_REVIEWS_AUTH.md §F`).
 *
 * Uses only real `ReviewRequest` fields (`targetType: EVENT_SQUAD|MATCH_LINEUP`, `status`,
 * `requestMessage`, `reviewerComment`) — no "Formation changed X → Y" structured annotation (not
 * a stored field; see provenance §0.16). `DecisionReview` is a distinct model/route (`10§G`),
 * never mixed into this list.
 *
 * Sources:
 * - reviews -> EXISTING_DIRECT (getPendingReviewsForReviewer()/getReviewHistory(), src/lib/review/review-service.ts)
 * Derived:
 * - grouping into Pending for me / Requested by me / History -> DERIVED_PRESENTATION (based on membership id comparison, existing logic in review-list-client.tsx, reused not reinvented)
 */

export type ReviewTargetType = "EVENT_SQUAD" | "MATCH_LINEUP";
export type ReviewStatus = "PENDING" | "APPROVED" | "CHANGES_REQUESTED" | "CANCELLED" | "SUPERSEDED";

export interface ReviewRowInput {
  id: string;
  targetType: ReviewTargetType;
  targetLabel: string;
  status: ReviewStatus;
  requestMessage: string | null;
  reviewerComment: string | null;
  requestedByMembershipId: string;
  reviewerMembershipId: string;
  createdAt: string;
}

export interface ReviewsViewModel {
  pendingForMe: ReviewRowInput[];
  requestedByMe: ReviewRowInput[];
  history: ReviewRowInput[];
}

export function buildReviewsViewModel(reviews: ReviewRowInput[], myMembershipId: string): ReviewsViewModel {
  const pendingForMe: ReviewRowInput[] = [];
  const requestedByMe: ReviewRowInput[] = [];
  const history: ReviewRowInput[] = [];

  for (const r of reviews) {
    if (r.status === "PENDING" && r.reviewerMembershipId === myMembershipId) {
      pendingForMe.push(r);
    } else if (r.requestedByMembershipId === myMembershipId && r.status === "PENDING") {
      requestedByMe.push(r);
    } else {
      history.push(r);
    }
  }

  return { pendingForMe, requestedByMe, history };
}
