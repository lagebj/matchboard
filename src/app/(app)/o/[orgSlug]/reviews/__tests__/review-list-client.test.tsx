import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReviewListClient } from "../review-list-client";

const { resolveReviewActionMock, cancelReviewActionMock } = vi.hoisted(() => ({
  resolveReviewActionMock: vi.fn(async () => ({
    status: "APPROVED",
    reviewerComment: null,
    resolvedAt: new Date(),
  })),
  cancelReviewActionMock: vi.fn(async () => ({ status: "SUPERSEDED", resolvedAt: new Date() })),
}));

vi.mock("../actions", () => ({
  resolveReviewAction: resolveReviewActionMock,
  cancelReviewAction: cancelReviewActionMock,
}));

const baseReview = {
  id: "review-1",
  targetType: "EVENT_SQUAD",
  targetId: "squad-1",
  targetRevision: "rev-1",
  status: "PENDING" as const,
  requestMessage: null,
  reviewerComment: null,
  resolvedAt: null,
  createdAt: new Date("2026-09-01T00:00:00Z"),
  requestedByMembershipId: "membership-requester",
  reviewerMembershipId: "membership-me",
};

/**
 * Touchline Design Atlas (ADR-0136 Phase 7, `10_ROUTE_COMPOSITION_CONFIG_MORE_REVIEWS_AUTH.md
 * §F`): "Each request: target; requester; change/superseded state; primary action." The prior
 * composition rendered target, state, and a primary action, but never the requester — this test
 * locks in the fix (page.tsx resolves membership ids to display names, this component renders
 * them per row).
 */
describe("ReviewListClient (Touchline Design Atlas Phase 7, §F)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the requester's name on a pending review", () => {
    render(
      <ReviewListClient
        reviews={[baseReview]}
        myMembershipId="membership-me"
        requesterNames={{ "membership-requester": "Kari Nordmann" }}
      />,
    );

    expect(screen.getByText("Requested by Kari Nordmann")).toBeInTheDocument();
  });

  it("falls back to a neutral label when the requester's name cannot be resolved", () => {
    render(
      <ReviewListClient reviews={[baseReview]} myMembershipId="membership-me" requesterNames={{}} />,
    );

    expect(screen.getByText("Requested by a teammate")).toBeInTheDocument();
  });

  it("places a pending review addressed to me under Pending for me with its actions", () => {
    render(
      <ReviewListClient
        reviews={[baseReview]}
        myMembershipId="membership-me"
        requesterNames={{ "membership-requester": "Kari Nordmann" }}
      />,
    );

    const pendingSection = screen.getByText("Pending for me").closest("section");
    expect(pendingSection).not.toBeNull();
    expect(pendingSection).toHaveTextContent("Requested by Kari Nordmann");
    expect(screen.getByRole("button", { name: "Approve" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Request changes" })).toBeInTheDocument();
  });

  it("places a review I requested under Requested by me with a cancel action", () => {
    const requestedByMe = {
      ...baseReview,
      id: "review-2",
      requestedByMembershipId: "membership-me",
      reviewerMembershipId: "membership-other",
    };
    render(
      <ReviewListClient
        reviews={[requestedByMe]}
        myMembershipId="membership-me"
        requesterNames={{ "membership-me": "You" }}
      />,
    );

    const requestedSection = screen.getByText("Requested by me").closest("section");
    expect(requestedSection).not.toBeNull();
    expect(screen.getByRole("button", { name: "Cancel request" })).toBeInTheDocument();
  });

  it("places a resolved review under History with no action controls", () => {
    const resolved = {
      ...baseReview,
      id: "review-3",
      status: "APPROVED" as const,
    };
    render(
      <ReviewListClient
        reviews={[resolved]}
        myMembershipId="membership-me"
        requesterNames={{ "membership-requester": "Kari Nordmann" }}
      />,
    );

    const historySection = screen.getByText("History").closest("section");
    expect(historySection).not.toBeNull();
    expect(historySection).toHaveTextContent("Approved");
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
  });
});
