import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, getTestDb } from "@/test/test-db";
import { getRoundReview, getTeamReadiness, getMatchReview, recordDecision, getSelectionExplanation } from "../service";

vi.mock("@/lib/db", () => ({
  get db() { return getTestDb(); },
}));

let testDb: PrismaClient;

describe("Assistant Manager Service (DB)", () => {
  beforeAll(async () => {
    testDb = await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  describe("getRoundReview", () => {
    it("returns default for unknown round", async () => {
      const review = await getRoundReview("nonexistent-round");
      expect(review.roundId).toBe("nonexistent-round");
      expect(review.blockedConditionCount).toBe(0);
      expect(review.finalizeable).toBe(true);
    });
  });

  describe("getTeamReadiness", () => {
    it("returns default for unknown team", async () => {
      const readiness = await getTeamReadiness("nonexistent-team");
      expect(readiness.readinessState).toBe("READY");
    });
  });

  describe("getMatchReview", () => {
    it("returns default for unknown match", async () => {
      const review = await getMatchReview("nonexistent-match");
      expect(review.matchId).toBe("nonexistent-match");
      expect(review.readinessState).toBe("READY");
    });
  });

  describe("getSelectionExplanation", () => {
    it("returns null for nonexistent explanation", async () => {
      const explanation = await getSelectionExplanation("MATCH", "nonexistent");
      expect(explanation).toBeNull();
    });

    it("returns explanation from database", async () => {
      const org = await testDb.organisation.create({
        data: { name: "Test Org Expl", slug: `test-org-expl-${Date.now()}` },
      });
      await testDb.selectionExplanation.create({
        data: {
          scopeType: "MATCH",
          scopeId: "test-match-expl",
          summary: "Test explanation",
          rulesApplied: [],
          blockers: [],
          warnings: [],
          recommendations: [],
          crossTeamImpacts: [],
          organisationId: org.id,
        },
      });

      const explanation = await getSelectionExplanation("MATCH", "test-match-expl");
      expect(explanation).not.toBeNull();
      expect(explanation!.summary).toBe("Test explanation");
      expect(explanation!.scopeType).toBe("MATCH");
    });
  });

  describe("recordDecision", () => {
    let testOrgId: string;

    beforeAll(async () => {
      const org = await testDb.organisation.create({
        data: { name: "Test Org", slug: "test-org-decision" },
      });
      testOrgId = org.id;
    });

    it("persists decision to database", async () => {
      const decision = await recordDecision({
        decisionType: "ROUND_REVIEW",
        entityType: "ROUND",
        entityId: "round-test",
        action: "FINALIZE",
        organisationId: testOrgId,
      });

      expect(decision.id).toBeDefined();
      expect(decision.action).toBe("FINALIZE");
      expect(decision.createdBy).toBe("coach");

      const dbRecord = await testDb.decisionRecord.findUnique({ where: { id: decision.id } });
      expect(dbRecord).not.toBeNull();
      expect(dbRecord!.action).toBe("FINALIZE");
    });

    it("stores reason when provided", async () => {
      const decision = await recordDecision({
        decisionType: "MATCH_REVIEW",
        entityType: "MATCH",
        entityId: "match-test",
        action: "OVERRIDE_BLOCKER",
        reason: "Coach decided to publish despite blocker",
        organisationId: testOrgId,
      });

      expect(decision.reason).toBe("Coach decided to publish despite blocker");

      const dbRecord = await testDb.decisionRecord.findUnique({ where: { id: decision.id } });
      expect(dbRecord!.reason).toBe("Coach decided to publish despite blocker");
    });
  });
});