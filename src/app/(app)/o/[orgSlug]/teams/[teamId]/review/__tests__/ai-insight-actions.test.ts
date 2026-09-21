import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, cleanTestDb } from "@/test/test-db";
import { mockAuthContext } from "@/test/support/auth-mock";
import { createTestOrganisation, createTestGroup, createTestTeam, createTestPlayer } from "@/test/support/factories";
import { buildWeeklyTeamReviewScopeId } from "@/lib/ai/context/weekly-team-review";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

let testDb: PrismaClient;

vi.mock("@/lib/db", () => ({
  get db() {
    return testDb;
  },
}));

const auth = mockAuthContext({ role: "COACH" });

import { confirmAiDevelopmentSuggestionAction, dismissAiInsightAction } from "../ai-insight-actions";

const WEEK_KEY = "2025-W18";

describe("ai-insight-actions (weekly-team-review Advisor confirm/dismiss)", () => {
  let organisationId: string;
  let teamId: string;
  let playerId: string;
  let scopeId: string;

  beforeAll(async () => {
    testDb = await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await cleanTestDb(testDb);

    const org = await createTestOrganisation(testDb);
    organisationId = org.id;
    const group = await createTestGroup(testDb, organisationId);
    const team = await createTestTeam(testDb, organisationId, group.id);
    teamId = team.id;
    scopeId = buildWeeklyTeamReviewScopeId(teamId, WEEK_KEY);
    const player = await createTestPlayer(testDb, organisationId, team.id, { firstName: "Ada", lastName: "One" });
    playerId = player.id;

    auth.mockRequireActorContext.mockResolvedValue({
      userId: "test-user-id",
      email: "coach@example.com",
      membershipId: "test-membership-id",
      organisationId,
      organisationSlug: "test-org",
      role: "COACH",
      accessibleGroupIds: [group.id],
      groupAccesses: [],
      orgFilter: {
        type: "org" as const,
        get filter() { return { organisationId }; },
        get filterNullable() { return { organisationId }; },
        get organisationId() { return organisationId; },
      },
    });
  });

  async function createSuggestionInsight(overrides?: { category?: string; observation?: string }) {
    const review = await testDb.aiAdvisorReview.create({
      data: {
        organisationId,
        capability: "WEEKLY_TEAM_REVIEW",
        scopeType: "TEAM_WEEK",
        scopeId,
        sourceFingerprint: "fp-1",
        status: "SUCCEEDED",
        contractVersion: "1",
        terminologyVersion: "1",
        completedAt: new Date(),
      },
    });
    return testDb.aiAdvisorInsight.create({
      data: {
        organisationId,
        reviewId: review.id,
        kind: "DEVELOPMENT_SUGGESTION",
        subjectType: "PLAYER",
        subjectId: playerId,
        title: "Development suggestion",
        body: overrides?.observation ?? "Showed clearer decision-making in possession this week.",
        evidenceRefs: [],
        actionType: "CONFIRM_DEVELOPMENT_OBSERVATION",
        actionPayload: {
          playerId,
          category: overrides?.category ?? "decision making",
          observation: overrides?.observation ?? "Showed clearer decision-making in possession this week.",
        },
      },
    });
  }

  it("confirms a suggestion: creates a development thread + observation (with no matchId) and marks the insight ACCEPTED", async () => {
    const insight = await createSuggestionInsight();

    const result = await confirmAiDevelopmentSuggestionAction("test-org", insight.id);
    expect(result).toEqual({ success: true });

    const updated = await testDb.aiAdvisorInsight.findUniqueOrThrow({ where: { id: insight.id } });
    expect(updated.state).toBe("ACCEPTED");

    const threads = await testDb.developmentThread.findMany({ where: { playerId } });
    expect(threads).toHaveLength(1);
    expect(threads[0].focus).toBe("decision making");
    expect(threads[0].recordedBy).toBe("coach@example.com");

    const observations = await testDb.developmentThreadObservation.findMany({ where: { threadId: threads[0].id } });
    expect(observations).toHaveLength(1);
    expect(observations[0].evidence).toBe("Showed clearer decision-making in possession this week.");
    expect(observations[0].matchId).toBeNull();
  });

  it("truncates evidence longer than 1000 characters instead of failing", async () => {
    const longObservation = "x".repeat(1500);
    const insight = await createSuggestionInsight({ observation: longObservation });

    const result = await confirmAiDevelopmentSuggestionAction("test-org", insight.id);
    expect(result).toEqual({ success: true });

    const threads = await testDb.developmentThread.findMany({ where: { playerId } });
    const observations = await testDb.developmentThreadObservation.findMany({ where: { threadId: threads[0].id } });
    expect(observations[0].evidence).toHaveLength(1000);
  });

  it("rejects confirming an insight that belongs to a different organisation", async () => {
    const otherOrg = await createTestOrganisation(testDb);
    const otherGroup = await createTestGroup(testDb, otherOrg.id);
    const otherTeam = await createTestTeam(testDb, otherOrg.id, otherGroup.id);
    const otherPlayer = await createTestPlayer(testDb, otherOrg.id, otherTeam.id);
    const otherReview = await testDb.aiAdvisorReview.create({
      data: {
        organisationId: otherOrg.id,
        capability: "WEEKLY_TEAM_REVIEW",
        scopeType: "TEAM_WEEK",
        scopeId: buildWeeklyTeamReviewScopeId(otherTeam.id, WEEK_KEY),
        sourceFingerprint: "fp-2",
        status: "SUCCEEDED",
        contractVersion: "1",
        terminologyVersion: "1",
        completedAt: new Date(),
      },
    });
    const otherInsight = await testDb.aiAdvisorInsight.create({
      data: {
        organisationId: otherOrg.id,
        reviewId: otherReview.id,
        kind: "DEVELOPMENT_SUGGESTION",
        subjectType: "PLAYER",
        subjectId: otherPlayer.id,
        title: "Development suggestion",
        body: "evidence",
        evidenceRefs: [],
        actionType: "CONFIRM_DEVELOPMENT_OBSERVATION",
        actionPayload: { playerId: otherPlayer.id, category: "focus", observation: "evidence" },
      },
    });

    const result = await confirmAiDevelopmentSuggestionAction("test-org", otherInsight.id);
    expect(result.success).toBe(false);
  });

  it("dismisses an insight: marks it DISMISSED without writing a development thread", async () => {
    const insight = await createSuggestionInsight();

    const result = await dismissAiInsightAction("test-org", insight.id);
    expect(result).toEqual({ success: true });

    const updated = await testDb.aiAdvisorInsight.findUniqueOrThrow({ where: { id: insight.id } });
    expect(updated.state).toBe("DISMISSED");

    const threads = await testDb.developmentThread.findMany({ where: { playerId } });
    expect(threads).toHaveLength(0);
  });
});
