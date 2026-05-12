import { describe, it, expect } from "vitest";
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

describe("getAssistantIssues", () => {
  it("returns mock issues with required fields", async () => {
    const issues = await getAssistantIssues();
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0].id).toBeDefined();
    expect(issues[0].severity).toBeDefined();
    expect(issues[0].status).toBeDefined();
  });

  it("uses player IDs not human names in affectedPlayerIds", async () => {
    const issues = await getAssistantIssues();
    for (const issue of issues) {
      for (const playerId of issue.affectedPlayerIds) {
        expect(playerId).not.toContain(" ");
        expect(playerId).toMatch(/^[a-zA-Z0-9_-]+$/);
      }
    }
  });

  it("uses player IDs not names in summary and title", async () => {
    const issues = await getAssistantIssues();
    for (const issue of issues) {
      expect(issue.affectedPlayerIds).toBeDefined();
      expect(Array.isArray(issue.affectedPlayerIds)).toBe(true);
    }
  });
});

describe("getRoundReview", () => {
  it("returns mock W21 data", async () => {
    const review = await getRoundReview("W21");
    expect(review.roundId).toBe("W21");
    expect(review.hardBlockerCount).toBe(1);
    expect(review.publishable).toBe(false);
  });

  it("returns default for unknown round", async () => {
    const review = await getRoundReview("unknown");
    expect(review.roundId).toBe("unknown");
  });
});

describe("getTeamReadiness", () => {
  it("returns Rod as AT_RISK", async () => {
    const readiness = await getTeamReadiness("ROD");
    expect(readiness.readinessState).toBe("AT_RISK");
    expect(readiness.supportNeeded).toBe(2);
  });

  it("returns Blå as READY", async () => {
    const readiness = await getTeamReadiness("BLA");
    expect(readiness.readinessState).toBe("READY");
  });

  it("returns default for unknown team", async () => {
    const readiness = await getTeamReadiness("unknown");
    expect(readiness.teamId).toBe("unknown");
  });
});

describe("getMatchReview", () => {
  it("returns mock data for ROD match", async () => {
    const review = await getMatchReview("match-ROD-W21");
    expect(review.matchId).toBe("match-ROD-W21");
    expect(review.readinessState).toBe("AT_RISK");
  });
});

describe("getPostMatchReport", () => {
  it("returns NOT_STARTED for unknown match", async () => {
    const report = await getPostMatchReport("match-new");
    expect(report.status).toBe("NOT_STARTED");
    expect(report.playerActuals).toHaveLength(0);
  });
});

describe("completePostMatchReport", () => {
  it("changes status to COMPLETED", async () => {
    const report = await completePostMatchReport("match-HVIT-W20", {
      playerActuals: [
        { playerId: "h01", attendanceStatus: "PRESENT" },
        { playerId: "h05", attendanceStatus: "NO_SHOW" },
      ],
      teamNote: "Good effort",
    });
    expect(report.status).toBe("COMPLETED");
    expect(report.playerActuals).toHaveLength(2);
    expect(report.playerActuals[0].attendanceStatus).toBe("PRESENT");
    expect(report.playerActuals[1].attendanceStatus).toBe("NO_SHOW");
  });
});

describe("recordDecision", () => {
  it("creates a DecisionRecord", async () => {
    const decision = await recordDecision({
      decisionType: "ROUND_REVIEW",
      entityType: "ROUND",
      entityId: "W21",
      action: "PUBLISH",
    });
    expect(decision.id).toBeDefined();
    expect(decision.action).toBe("PUBLISH");
    expect(decision.createdBy).toBe("coach");
  });

  it("stores reason when provided", async () => {
    const decision = await recordDecision({
      decisionType: "MATCH_REVIEW",
      entityType: "MATCH",
      entityId: "match-1",
      action: "OVERRIDE_BLOCKER",
      reason: "Coach decided to publish despite blocker",
    });
    expect(decision.reason).toBe("Coach decided to publish despite blocker");
  });
});

describe("getSelectionExplanation", () => {
  it("returns explanation for given scope", async () => {
    const explanation = await getSelectionExplanation("MATCH", "match-ROD-W21");
    expect(explanation).not.toBeNull();
    expect(explanation!.id).toBe("expl-MATCH-match-ROD-W21");
  });
});