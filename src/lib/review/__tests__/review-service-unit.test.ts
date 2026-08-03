import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockDb, mocks } = vi.hoisted(() => {
  const mocks = {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    orgMembershipFindUnique: vi.fn(),
  };
  const mockDb = {
    reviewRequest: {
      findFirst: mocks.findFirst,
      findUnique: mocks.findUnique,
      findMany: mocks.findMany,
      create: mocks.create,
      update: mocks.update,
      updateMany: mocks.updateMany,
    },
    organisationMembership: {
      findUnique: mocks.orgMembershipFindUnique,
    },
  };
  return { mockDb, mocks };
});

vi.mock("@/lib/db", () => ({ db: mockDb }));

const { mockComputeTargetContentHash, mockHasTargetChanged } = vi.hoisted(() => ({
  mockComputeTargetContentHash: vi.fn(),
  mockHasTargetChanged: vi.fn(),
}));

vi.mock("@/lib/review/content-hash", () => ({
  computeTargetContentHash: mockComputeTargetContentHash,
  hasTargetChanged: mockHasTargetChanged,
}));

import {
  createReviewRequest,
  resolveReviewRequest,
  supersedePendingReviews,
  getReviewHistory,
} from "@/lib/review/review-service";

const ORG_ID = "org-1";
const MEMBERSHIP_ID = "mem-1";

describe("createReviewRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockComputeTargetContentHash.mockResolvedValue("computed-hash");
  });

  it("creates a review request when no pending review exists", async () => {
    mocks.findFirst.mockResolvedValue(null);
    mocks.orgMembershipFindUnique.mockResolvedValue({ id: "mem-2", organisationId: ORG_ID });
    mocks.create.mockResolvedValue({
      id: "review-1",
      organisationId: ORG_ID,
      targetType: "EVENT_SQUAD",
      targetId: "target-1",
      targetRevision: "v1",
      requestedByMembershipId: MEMBERSHIP_ID,
      reviewerMembershipId: "mem-2",
      status: "PENDING",
    });

    await createReviewRequest(
      { targetType: "EVENT_SQUAD", targetId: "target-1", targetRevision: "v1", reviewerMembershipId: "mem-2" },
      ORG_ID,
      MEMBERSHIP_ID,
    );

    expect(mocks.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organisationId: ORG_ID,
        targetType: "EVENT_SQUAD",
        targetId: "target-1",
        requestedByMembershipId: MEMBERSHIP_ID,
        reviewerMembershipId: "mem-2",
      }),
    });
  });

  it("rejects creation when a pending review already exists", async () => {
    mocks.findFirst.mockResolvedValue({ id: "existing-1", status: "PENDING" });

    await expect(
      createReviewRequest(
        { targetType: "EVENT_SQUAD", targetId: "target-1", targetRevision: "v1" },
        ORG_ID,
        MEMBERSHIP_ID,
      ),
    ).rejects.toThrow("pending review request already exists");
  });

  it("rejects self-review", async () => {
    mocks.findFirst.mockResolvedValue(null);

    await expect(
      createReviewRequest(
        { targetType: "EVENT_SQUAD", targetId: "target-1", targetRevision: "v1", reviewerMembershipId: MEMBERSHIP_ID },
        ORG_ID,
        MEMBERSHIP_ID,
      ),
    ).rejects.toThrow("Cannot request a review from yourself");
  });

  it("rejects cross-org reviewer", async () => {
    mocks.findFirst.mockResolvedValue(null);
    mocks.orgMembershipFindUnique.mockResolvedValue({ id: "mem-2", organisationId: "org-other" });

    await expect(
      createReviewRequest(
        { targetType: "EVENT_SQUAD", targetId: "target-1", targetRevision: "v1", reviewerMembershipId: "mem-2" },
        ORG_ID,
        MEMBERSHIP_ID,
      ),
    ).rejects.toThrow("same organisation");
  });

  it("defaults reviewerMembershipId to requester when not specified", async () => {
    mocks.findFirst.mockResolvedValue(null);
    mocks.create.mockResolvedValue({
      id: "review-1",
      organisationId: ORG_ID,
      targetType: "EVENT_SQUAD",
      targetId: "target-1",
      targetRevision: "v1",
      requestedByMembershipId: MEMBERSHIP_ID,
      reviewerMembershipId: MEMBERSHIP_ID,
      status: "PENDING",
    });

    await createReviewRequest(
      { targetType: "EVENT_SQUAD", targetId: "target-1", targetRevision: "v1" },
      ORG_ID,
      MEMBERSHIP_ID,
    );

    expect(mocks.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        reviewerMembershipId: MEMBERSHIP_ID,
      }),
    });
  });

  it("computes content hash when targetRevision is empty", async () => {
    mocks.findFirst.mockResolvedValue(null);
    mockComputeTargetContentHash.mockResolvedValue("computed-hash-abc");
    mocks.create.mockResolvedValue({
      id: "review-2",
      organisationId: ORG_ID,
      targetType: "MATCH_LINEUP",
      targetId: "lineup-1",
      targetRevision: "computed-hash-abc",
      requestedByMembershipId: MEMBERSHIP_ID,
      reviewerMembershipId: MEMBERSHIP_ID,
      status: "PENDING",
    });

    await createReviewRequest(
      { targetType: "MATCH_LINEUP", targetId: "lineup-1" },
      ORG_ID,
      MEMBERSHIP_ID,
    );

    expect(mockComputeTargetContentHash).toHaveBeenCalledWith("MATCH_LINEUP", "lineup-1", ORG_ID);
    expect(mocks.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        targetRevision: "computed-hash-abc",
      }),
    });
  });
});

describe("resolveReviewRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockComputeTargetContentHash.mockResolvedValue("hash-abc");
    mockHasTargetChanged.mockReturnValue(false);
  });

  it("resolves a pending review as APPROVED and returns targetChanged false", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "review-1",
      organisationId: ORG_ID,
      targetType: "EVENT_SQUAD",
      targetId: "target-1",
      targetRevision: "hash-abc",
      status: "PENDING",
      requestedByMembershipId: "mem-1",
      reviewerMembershipId: "mem-2",
    });
    mocks.update.mockResolvedValue({ id: "review-1", status: "APPROVED" });

    const result = await resolveReviewRequest("review-1", { status: "APPROVED" }, ORG_ID, "mem-2");

    expect(result.review.status).toBe("APPROVED");
    expect(result.targetChanged).toBe(false);
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "review-1" },
      data: expect.objectContaining({ status: "APPROVED" }),
    });
  });

  it("detects target changed when current hash differs", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "review-1",
      organisationId: ORG_ID,
      targetType: "EVENT_SQUAD",
      targetId: "target-1",
      targetRevision: "hash-old",
      status: "PENDING",
      requestedByMembershipId: "mem-1",
      reviewerMembershipId: "mem-2",
    });
    mocks.update.mockResolvedValue({ id: "review-1", status: "APPROVED" });
    mockHasTargetChanged.mockReturnValue(true);

    const result = await resolveReviewRequest("review-1", { status: "APPROVED" }, ORG_ID, "mem-2");

    expect(result.targetChanged).toBe(true);
  });

  it("handles missing target gracefully", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "review-1",
      organisationId: ORG_ID,
      targetType: "EVENT_SQUAD",
      targetId: "target-1",
      targetRevision: "hash-abc",
      status: "PENDING",
      requestedByMembershipId: "mem-1",
      reviewerMembershipId: "mem-2",
    });
    mocks.update.mockResolvedValue({ id: "review-1", status: "APPROVED" });
    mockComputeTargetContentHash.mockRejectedValue(new Error("not found"));

    const result = await resolveReviewRequest("review-1", { status: "APPROVED" }, ORG_ID, "mem-2");

    expect(result.targetChanged).toBe(false);
  });

  it("rejects cross-org resolution", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "review-1",
      organisationId: "org-other",
      status: "PENDING",
      requestedByMembershipId: "mem-1",
      reviewerMembershipId: "mem-2",
    });

    await expect(
      resolveReviewRequest("review-1", { status: "APPROVED" }, ORG_ID, "mem-2"),
    ).rejects.toThrow("access denied");
  });

  it("rejects non-assigned reviewer resolving someone else's review", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "review-1",
      organisationId: ORG_ID,
      status: "PENDING",
      requestedByMembershipId: "mem-1",
      reviewerMembershipId: "mem-2",
    });

    await expect(
      resolveReviewRequest("review-1", { status: "APPROVED" }, ORG_ID, "mem-3"),
    ).rejects.toThrow("assigned reviewer");
  });

  it("allows the requester to cancel their own review", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "review-1",
      organisationId: ORG_ID,
      targetType: "EVENT_SQUAD",
      targetId: "target-1",
      targetRevision: "hash-abc",
      status: "PENDING",
      requestedByMembershipId: "mem-1",
      reviewerMembershipId: "mem-2",
    });
    mocks.update.mockResolvedValue({ id: "review-1", status: "CANCELLED" });

    const result = await resolveReviewRequest("review-1", { status: "CANCELLED" }, ORG_ID, "mem-1");

    expect(mocks.update).toHaveBeenCalled();
    expect(result.review.status).toBe("CANCELLED");
  });

  it("rejects resolution of non-pending review", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "review-1",
      organisationId: ORG_ID,
      status: "APPROVED",
      requestedByMembershipId: "mem-1",
      reviewerMembershipId: "mem-2",
    });

    await expect(
      resolveReviewRequest("review-1", { status: "APPROVED" }, ORG_ID, "mem-2"),
    ).rejects.toThrow("pending");
  });

  it("rejects review not found", async () => {
    mocks.findUnique.mockResolvedValue(null);

    await expect(
      resolveReviewRequest("nonexistent", { status: "APPROVED" }, ORG_ID, "mem-2"),
    ).rejects.toThrow("not found");
  });
});

describe("supersedePendingReviews", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("supersedes pending reviews and returns count with superseded info", async () => {
    mocks.findMany.mockResolvedValue([{ id: "review-1", requestedByMembershipId: "mem-1", reviewerMembershipId: "mem-2", targetType: "EVENT_SQUAD", targetId: "target-1" }, { id: "review-2", requestedByMembershipId: "mem-3", reviewerMembershipId: "mem-4", targetType: "EVENT_SQUAD", targetId: "target-1" }]);
    mocks.updateMany.mockResolvedValue({ count: 2 });

    const result = await supersedePendingReviews("EVENT_SQUAD", "target-1");

    expect(result.count).toBe(2);
    expect(result.superseded).toHaveLength(2);
    expect(result.superseded[0].id).toBe("review-1");
    expect(result.superseded[1].id).toBe("review-2");
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["review-1", "review-2"] } },
      data: expect.objectContaining({
        status: "SUPERSEDED",
        resolvedAt: expect.any(Date),
      }),
    });
  });

  it("sets supersededById when provided", async () => {
    mocks.findMany.mockResolvedValue([{ id: "review-1", requestedByMembershipId: "mem-1", reviewerMembershipId: "mem-2", targetType: "EVENT_SQUAD", targetId: "target-1" }]);
    mocks.updateMany.mockResolvedValue({ count: 1 });

    await supersedePendingReviews("EVENT_SQUAD", "target-1", "new-review-1");

    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["review-1"] } },
      data: expect.objectContaining({
        status: "SUPERSEDED",
        supersededById: "new-review-1",
      }),
    });
  });

  it("does not set supersededById when not provided", async () => {
    mocks.findMany.mockResolvedValue([{ id: "review-1", requestedByMembershipId: "mem-1", reviewerMembershipId: "mem-2", targetType: "EVENT_SQUAD", targetId: "target-1" }]);
    mocks.updateMany.mockResolvedValue({ count: 1 });

    await supersedePendingReviews("EVENT_SQUAD", "target-1");

    const callData = mocks.updateMany.mock.calls[0][0].data;
    expect(callData).not.toHaveProperty("supersededById");
  });

  it("returns empty superseded array when no pending reviews exist", async () => {
    mocks.findMany.mockResolvedValue([]);

    const result = await supersedePendingReviews("EVENT_SQUAD", "nonexistent");

    expect(result.count).toBe(0);
    expect(result.superseded).toHaveLength(0);
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });
});

describe("getReviewHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("queries with organisationId when provided", async () => {
    mocks.findMany.mockResolvedValue([]);

    await getReviewHistory("EVENT_SQUAD", "target-1", "org-1");

    expect(mocks.findMany).toHaveBeenCalledWith({
      where: { targetType: "EVENT_SQUAD", targetId: "target-1", organisationId: "org-1" },
      orderBy: { createdAt: "desc" },
    });
  });

  it("queries without organisationId filter when not provided", async () => {
    mocks.findMany.mockResolvedValue([]);

    await getReviewHistory("EVENT_SQUAD", "target-1");

    expect(mocks.findMany).toHaveBeenCalledWith({
      where: { targetType: "EVENT_SQUAD", targetId: "target-1" },
      orderBy: { createdAt: "desc" },
    });
  });
});