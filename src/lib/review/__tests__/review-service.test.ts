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

vi.mock("@/lib/auth", () => ({
  requireCoachAccess: vi.fn().mockResolvedValue({ id: "test-coach-id", email: "test@matchboard.test", name: "Test Coach" }),
}));

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
      });

      expect(review.status).toBe("PENDING");
      expect(review.targetType).toBe("EVENT_SQUAD");
      expect(review.targetId).toBe("squad-123");
      expect(review.targetRevision).toBe("rev-1");
      expect(review.requestMessage).toBe("Please review this squad");
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
      });

      await expect(
        createReviewRequest({
          targetType: "EVENT_SQUAD",
          targetId: "squad-456",
          targetRevision: "rev-2",
        }),
      ).rejects.toThrow("A pending review request already exists");
    });
  });

  describe("resolveReviewRequest", () => {
    it("approves a pending review", async () => {
      const org = await db.organisation.create({
        data: { name: "Test Org 3", slug: `test-org-3-${Date.now()}` },
      });

      const user = await db.user.create({
        data: { email: `coach3-${Date.now()}@test.com`, name: "Test Coach 3" },
      });

      const membership = await db.organisationMembership.create({
        data: { userId: user.id, organisationId: org.id, role: "COACH" },
      });

      const review = await createReviewRequest({
        targetType: "MATCH_LINEUP",
        targetId: "lineup-789",
        targetRevision: "rev-1",
      });

      const resolved = await resolveReviewRequest(review.id, {
        status: "APPROVED",
        reviewerComment: "Looks good",
      });

      expect(resolved.status).toBe("APPROVED");
      expect(resolved.reviewerComment).toBe("Looks good");
      expect(resolved.resolvedAt).not.toBeNull();
    });

    it("rejects resolving a non-pending review", async () => {
      const org = await db.organisation.create({
        data: { name: "Test Org 4", slug: `test-org-4-${Date.now()}` },
      });

      const user = await db.user.create({
        data: { email: `coach4-${Date.now()}@test.com`, name: "Test Coach 4" },
      });

      const membership = await db.organisationMembership.create({
        data: { userId: user.id, organisationId: org.id, role: "COACH" },
      });

      const review = await createReviewRequest({
        targetType: "EVENT_SQUAD",
        targetId: "squad-999",
        targetRevision: "rev-1",
      });

      await resolveReviewRequest(review.id, { status: "APPROVED" });

      await expect(
        resolveReviewRequest(review.id, { status: "CHANGES_REQUESTED" }),
      ).rejects.toThrow("Only pending review requests can be resolved");
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
      });

      const count = await supersedePendingReviews("EVENT_SQUAD", "squad-super-1");

      expect(count).toBe(1);

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
      });

      const pending = await getPendingReviewsForReviewer(org.id, membership.id);

      expect(pending.length).toBeGreaterThanOrEqual(1);
      expect(pending.every((r) => r.status === "PENDING")).toBe(true);
    });
  });
});