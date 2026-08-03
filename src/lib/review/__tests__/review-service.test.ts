import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import {
  setupTestDb,
  teardownTestDb,
  getTestDb,
} from "@/test/test-db";
import {
  createReviewRequest,
  resolveReviewRequest,
  supersedePendingReviews,
  getPendingReviewsForReviewer,
  getReviewHistory,
} from "../review-service";

vi.mock("@/lib/db", () => {
  let _db: PrismaClient;
  return {
    get db() {
      return _db ?? getTestDb();
    },
    set db(v: PrismaClient) {
      _db = v;
    },
  };
});

describe("review-service", () => {
  let db: PrismaClient;

  beforeAll(async () => {
    db = await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  describe("createReviewRequest", () => {
    it("creates a pending review request", async () => {
      const org = await db.organisation.create({
        data: { name: "Test Org", slug: `test-org-${Date.now()}` },
      });

      const user = await db.user.create({
        data: { email: `coach-${Date.now()}@test.com`, name: "Test Coach" },
      });

      const membership = await db.organisationMembership.create({
        data: { userId: user.id, organisationId: org.id, role: "COACH" },
      });

      const review = await createReviewRequest({
        targetType: "EVENT_SQUAD",
        targetId: "squad-123",
        targetRevision: "rev-1",
        requestMessage: "Please review this squad",
      }, org.id, membership.id);

      expect(review.status).toBe("PENDING");
      expect(review.targetType).toBe("EVENT_SQUAD");
      expect(review.targetId).toBe("squad-123");
      expect(review.targetRevision).toBe("rev-1");
      expect(review.requestMessage).toBe("Please review this squad");
      expect(review.organisationId).toBe(org.id);
      expect(review.requestedByMembershipId).toBe(membership.id);
    });

    it("rejects a second pending review for the same target", async () => {
      const org = await db.organisation.create({
        data: { name: "Test Org 2", slug: `test-org-2-${Date.now()}` },
      });

      const user = await db.user.create({
        data: { email: `coach2-${Date.now()}@test.com`, name: "Test Coach 2" },
      });

      const membership = await db.organisationMembership.create({
        data: { userId: user.id, organisationId: org.id, role: "COACH" },
      });

      await createReviewRequest({
        targetType: "EVENT_SQUAD",
        targetId: "squad-456",
        targetRevision: "rev-1",
      }, org.id, membership.id);

      await expect(
        createReviewRequest({
          targetType: "EVENT_SQUAD",
          targetId: "squad-456",
          targetRevision: "rev-2",
        }, org.id, membership.id),
      ).rejects.toThrow("A pending review request already exists");
    });

    it("rejects requesting a review from yourself", async () => {
      const org = await db.organisation.create({
        data: { name: "Test Org Self", slug: `test-org-self-${Date.now()}` },
      });

      const user = await db.user.create({
        data: { email: `coach-self-${Date.now()}@test.com`, name: "Self Coach" },
      });

      const membership = await db.organisationMembership.create({
        data: { userId: user.id, organisationId: org.id, role: "COACH" },
      });

      await expect(
        createReviewRequest({
          targetType: "EVENT_SQUAD",
          targetId: "squad-self-1",
          targetRevision: "rev-1",
          reviewerMembershipId: membership.id,
        }, org.id, membership.id),
      ).rejects.toThrow("Cannot request a review from yourself");
    });

    it("rejects reviewer from different organisation", async () => {
      const org1 = await db.organisation.create({
        data: { name: "Test Org A", slug: `test-org-a-${Date.now()}` },
      });

      const org2 = await db.organisation.create({
        data: { name: "Test Org B", slug: `test-org-b-${Date.now()}` },
      });

      const user1 = await db.user.create({
        data: { email: `coach-a-${Date.now()}@test.com`, name: "Coach A" },
      });

      const user2 = await db.user.create({
        data: { email: `coach-b-${Date.now()}@test.com`, name: "Coach B" },
      });

      const membership1 = await db.organisationMembership.create({
        data: { userId: user1.id, organisationId: org1.id, role: "COACH" },
      });

      const membership2 = await db.organisationMembership.create({
        data: { userId: user2.id, organisationId: org2.id, role: "COACH" },
      });

      await expect(
        createReviewRequest({
          targetType: "EVENT_SQUAD",
          targetId: "squad-cross-org",
          targetRevision: "rev-1",
          reviewerMembershipId: membership2.id,
        }, org1.id, membership1.id),
      ).rejects.toThrow("Reviewer must be a member of the same organisation");
    });
  });

  describe("resolveReviewRequest", () => {
    it("approves a pending review by the assigned reviewer", async () => {
      const org = await db.organisation.create({
        data: { name: "Test Org 3", slug: `test-org-3-${Date.now()}` },
      });

      const user1 = await db.user.create({
        data: { email: `requester-${Date.now()}@test.com`, name: "Requester" },
      });

      const user2 = await db.user.create({
        data: { email: `reviewer-${Date.now()}@test.com`, name: "Reviewer" },
      });

      const membership1 = await db.organisationMembership.create({
        data: { userId: user1.id, organisationId: org.id, role: "COACH" },
      });

      const membership2 = await db.organisationMembership.create({
        data: { userId: user2.id, organisationId: org.id, role: "COACH" },
      });

      const review = await createReviewRequest({
        targetType: "MATCH_LINEUP",
        targetId: "lineup-789",
        targetRevision: "rev-1",
        reviewerMembershipId: membership2.id,
      }, org.id, membership1.id);

      const resolved = await resolveReviewRequest(review.id, {
        status: "APPROVED",
        reviewerComment: "Looks good",
      }, org.id, membership2.id);

      expect(resolved.review.status).toBe("APPROVED");
      expect(resolved.review.reviewerComment).toBe("Looks good");
      expect(resolved.review.resolvedAt).not.toBeNull();
    });

    it("rejects resolving by non-assigned reviewer", async () => {
      const org = await db.organisation.create({
        data: { name: "Test Org 4", slug: `test-org-4-${Date.now()}` },
      });

      const user1 = await db.user.create({
        data: { email: `req4-${Date.now()}@test.com`, name: "Requester 4" },
      });

      const user2 = await db.user.create({
        data: { email: `rev4-${Date.now()}@test.com`, name: "Reviewer 4" },
      });

      const user3 = await db.user.create({
        data: { email: `other4-${Date.now()}@test.com`, name: "Other 4" },
      });

      const membership1 = await db.organisationMembership.create({
        data: { userId: user1.id, organisationId: org.id, role: "COACH" },
      });

      const membership2 = await db.organisationMembership.create({
        data: { userId: user2.id, organisationId: org.id, role: "COACH" },
      });

      const membership3 = await db.organisationMembership.create({
        data: { userId: user3.id, organisationId: org.id, role: "COACH" },
      });

      const review = await createReviewRequest({
        targetType: "EVENT_SQUAD",
        targetId: "squad-999",
        targetRevision: "rev-1",
        reviewerMembershipId: membership2.id,
      }, org.id, membership1.id);

      await expect(
        resolveReviewRequest(review.id, { status: "APPROVED" }, org.id, membership3.id),
      ).rejects.toThrow("Only the assigned reviewer can resolve");
    });

    it("rejects resolving a non-pending review", async () => {
      const org = await db.organisation.create({
        data: { name: "Test Org 5b", slug: `test-org-5b-${Date.now()}` },
      });

      const user1 = await db.user.create({
        data: { email: `req5b-${Date.now()}@test.com`, name: "Requester 5b" },
      });

      const user2 = await db.user.create({
        data: { email: `rev5b-${Date.now()}@test.com`, name: "Reviewer 5b" },
      });

      const membership1 = await db.organisationMembership.create({
        data: { userId: user1.id, organisationId: org.id, role: "COACH" },
      });

      const membership2 = await db.organisationMembership.create({
        data: { userId: user2.id, organisationId: org.id, role: "COACH" },
      });

      const review = await createReviewRequest({
        targetType: "EVENT_SQUAD",
        targetId: "squad-resolved",
        targetRevision: "rev-1",
        reviewerMembershipId: membership2.id,
      }, org.id, membership1.id);

      await resolveReviewRequest(review.id, { status: "APPROVED" }, org.id, membership2.id);

      await expect(
        resolveReviewRequest(review.id, { status: "CHANGES_REQUESTED" }, org.id, membership2.id),
      ).rejects.toThrow("Only pending review requests can be resolved");
    });

    it("rejects resolving from different organisation", async () => {
      const org1 = await db.organisation.create({
        data: { name: "Test Org Cross", slug: `test-org-cross-${Date.now()}` },
      });

      const org2 = await db.organisation.create({
        data: { name: "Test Org Cross 2", slug: `test-org-cross2-${Date.now()}` },
      });

      const user1 = await db.user.create({
        data: { email: `req-cross-${Date.now()}@test.com`, name: "Requester Cross" },
      });

      const user2 = await db.user.create({
        data: { email: `rev-cross-${Date.now()}@test.com`, name: "Reviewer Cross" },
      });

      const user3 = await db.user.create({
        data: { email: `rev3-cross-${Date.now()}@test.com`, name: "Reviewer Org1" },
      });

      const membership1 = await db.organisationMembership.create({
        data: { userId: user1.id, organisationId: org1.id, role: "COACH" },
      });

      const membership2 = await db.organisationMembership.create({
        data: { userId: user2.id, organisationId: org2.id, role: "COACH" },
      });

      const membership3 = await db.organisationMembership.create({
        data: { userId: user3.id, organisationId: org1.id, role: "COACH" },
      });

      const review = await createReviewRequest({
        targetType: "EVENT_SQUAD",
        targetId: "squad-cross-org-resolve",
        targetRevision: "rev-1",
        reviewerMembershipId: membership3.id,
      }, org1.id, membership1.id);

      await expect(
        resolveReviewRequest(review.id, { status: "APPROVED" }, org2.id, membership2.id),
      ).rejects.toThrow("Review request not found or access denied");
    });
  });

  describe("supersedePendingReviews", () => {
    it("supersedes pending reviews for a target", async () => {
      const org = await db.organisation.create({
        data: { name: "Test Org 5", slug: `test-org-5-${Date.now()}` },
      });

      const user = await db.user.create({
        data: { email: `coach5-${Date.now()}@test.com`, name: "Test Coach 5" },
      });

      const membership = await db.organisationMembership.create({
        data: { userId: user.id, organisationId: org.id, role: "COACH" },
      });

      await createReviewRequest({
        targetType: "EVENT_SQUAD",
        targetId: "squad-super-1",
        targetRevision: "rev-1",
      }, org.id, membership.id);

      const result = await supersedePendingReviews("EVENT_SQUAD", "squad-super-1");

      expect(result.count).toBe(1);
      expect(result.superseded).toHaveLength(1);

      const history = await getReviewHistory("EVENT_SQUAD", "squad-super-1");
      expect(history[0].status).toBe("SUPERSEDED");
    });
  });

  describe("getPendingReviewsForReviewer", () => {
    it("returns only pending reviews for the reviewer", async () => {
      const org = await db.organisation.create({
        data: { name: "Test Org 6", slug: `test-org-6-${Date.now()}` },
      });

      const user = await db.user.create({
        data: { email: `coach6-${Date.now()}@test.com`, name: "Test Coach 6" },
      });

      const membership = await db.organisationMembership.create({
        data: { userId: user.id, organisationId: org.id, role: "COACH" },
      });

      await createReviewRequest({
        targetType: "EVENT_SQUAD",
        targetId: "squad-pending-1",
        targetRevision: "rev-1",
      }, org.id, membership.id);

      const pending = await getPendingReviewsForReviewer(org.id, membership.id);

      expect(pending.length).toBeGreaterThanOrEqual(1);
      expect(pending.every((r) => r.status === "PENDING")).toBe(true);
    });
  });
});