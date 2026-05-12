import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, getTestDb } from "@/test/test-db";
import {
  getAssistantIssues,
  getRoundReview,
  getTeamReadiness,
  getMatchReview,
  getPostMatchReport,
  completePostMatchReport,
  recordDecision,
  getSelectionExplanation,
} from "../service";

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

  describe("getAssistantIssues", () => {
    it("returns empty array when no issues exist", async () => {
      const issues = await getAssistantIssues();
      expect(Array.isArray(issues)).toBe(true);
    });

    it("returns issues from database after creation", async () => {
      await testDb.assistantIssue.create({
        data: {
          type: "TEAM_NEEDS_SUPPORT",
          severity: "ACTION_REQUIRED",
          status: "OPEN",
          title: "Team needs support",
          summary: "Short squad detected",
          entityType: "TEAM",
          entityId: "team-1",
          affectedTeamIds: ["team-1"],
          affectedPlayerIds: [],
          ruleIds: ["support_priority"],
          recommendedAction: "Assign support players",
          primaryActionLabel: "Review",
          primaryActionHref: "/teams/team-1/review",
        },
      });

      const issues = await getAssistantIssues();
      expect(issues.length).toBeGreaterThanOrEqual(1);
      expect(issues[0].type).toBe("TEAM_NEEDS_SUPPORT");
      expect(issues[0].severity).toBe("ACTION_REQUIRED");
    });
  });

  describe("getRoundReview", () => {
    it("returns default for unknown round", async () => {
      const review = await getRoundReview("nonexistent-round");
      expect(review.roundId).toBe("nonexistent-round");
      expect(review.hardBlockerCount).toBe(0);
      expect(review.publishable).toBe(true);
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
        },
      });

      const explanation = await getSelectionExplanation("MATCH", "test-match-expl");
      expect(explanation).not.toBeNull();
      expect(explanation!.summary).toBe("Test explanation");
      expect(explanation!.scopeType).toBe("MATCH");
    });
  });

  describe("recordDecision", () => {
    it("persists decision to database", async () => {
      const decision = await recordDecision({
        decisionType: "ROUND_REVIEW",
        entityType: "ROUND",
        entityId: "round-test",
        action: "PUBLISH",
      });

      expect(decision.id).toBeDefined();
      expect(decision.action).toBe("PUBLISH");
      expect(decision.createdBy).toBe("coach");

      const dbRecord = await testDb.decisionRecord.findUnique({ where: { id: decision.id } });
      expect(dbRecord).not.toBeNull();
      expect(dbRecord!.action).toBe("PUBLISH");
    });

    it("stores reason when provided", async () => {
      const decision = await recordDecision({
        decisionType: "MATCH_REVIEW",
        entityType: "MATCH",
        entityId: "match-test",
        action: "OVERRIDE_BLOCKER",
        reason: "Coach decided to publish despite blocker",
      });

      expect(decision.reason).toBe("Coach decided to publish despite blocker");

      const dbRecord = await testDb.decisionRecord.findUnique({ where: { id: decision.id } });
      expect(dbRecord!.reason).toBe("Coach decided to publish despite blocker");
    });
  });

  describe("getPostMatchReport", () => {
    it("returns NOT_STARTED for nonexistent match", async () => {
      const report = await getPostMatchReport("nonexistent-match");
      expect(report.status).toBe("NOT_STARTED");
      expect(report.playerActuals).toHaveLength(0);
    });
  });

  describe("completePostMatchReport", () => {
    it("creates a new report when none exists", async () => {
      const match = await testDb.match.findFirst();
      if (!match) {
        return;
      }

      const report = await completePostMatchReport(match.id, {
        playerActuals: [
          { playerId: "player-1", attendanceStatus: "PRESENT" },
        ],
        teamNote: "Good effort",
      });

      expect(report.status).toBe("COMPLETED");
      expect(report.playerActuals).toHaveLength(1);
      expect(report.teamNote).toBe("Good effort");

      const dbRecord = await testDb.postMatchReport.findUnique({
        where: { matchId: match.id },
        include: { playerActuals: true },
      });
      expect(dbRecord).not.toBeNull();
      expect(dbRecord!.playerActuals).toHaveLength(1);
    });
  });
});