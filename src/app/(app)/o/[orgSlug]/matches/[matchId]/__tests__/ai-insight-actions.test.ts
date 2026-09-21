import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, cleanTestDb } from "@/test/test-db";
import { mockAuthContext } from "@/test/support/auth-mock";
import { createTestOrganisation, createTestGroup, createTestTeam, createTestPlayer, createTestSeason, createTestLeagueSeason, createTestRound, createTestMatch } from "@/test/support/factories";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

let testDb: PrismaClient;

vi.mock("@/lib/db", () => ({
  get db() {
    return testDb;
  },
}));

const auth = mockAuthContext({ role: "COACH" });

import { confirmAiDevelopmentSuggestionAction, dismissAiInsightAction } from "../ai-insight-actions";

async function createTestMatchRound(testDb: PrismaClient, organisationId: string, groupId: string) {
  const season = await createTestSeason(testDb, organisationId);
  const leagueSeason = await createTestLeagueSeason(testDb, organisationId, groupId, season.id);
  return createTestRound(testDb, organisationId, leagueSeason.id);
}

describe("ai-insight-actions (completed-match Advisor confirm/dismiss)", () => {
  let organisationId: string;
  let matchId: string;
  let playerId: string;

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
    const player = await createTestPlayer(testDb, organisationId, team.id, { firstName: "Ada", lastName: "One" });
    playerId = player.id;
    const round = await createTestMatchRound(testDb, organisationId, group.id);
    const match = await createTestMatch(testDb, organisationId, round.id, team.id, null);
    matchId = match.id;

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
        capability: "POST_MATCH_REVIEW",
        scopeType: "MATCH",
        scopeId: matchId,
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
        body: overrides?.observation ?? "Struggled to track back after losing possession.",
        evidenceRefs: [],
        actionType: "CONFIRM_DEVELOPMENT_OBSERVATION",
        actionPayload: {
          playerId,
          category: overrides?.category ?? "positional understanding",
          observation: overrides?.observation ?? "Struggled to track back after losing possession.",
        },
      },
    });
  }

  it("confirms a suggestion: creates a development thread + observation and marks the insight ACCEPTED", async () => {
    const insight = await createSuggestionInsight();

    const result = await confirmAiDevelopmentSuggestionAction("test-org", insight.id);
    expect(result).toEqual({ success: true });

    const updated = await testDb.aiAdvisorInsight.findUniqueOrThrow({ where: { id: insight.id } });
    expect(updated.state).toBe("ACCEPTED");

    const threads = await testDb.developmentThread.findMany({ where: { playerId } });
    expect(threads).toHaveLength(1);
    expect(threads[0].focus).toBe("positional understanding");
    expect(threads[0].recordedBy).toBe("coach@example.com");

    const observations = await testDb.developmentThreadObservation.findMany({ where: { threadId: threads[0].id } });
    expect(observations).toHaveLength(1);
    expect(observations[0].evidence).toBe("Struggled to track back after losing possession.");
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

  it("returns a friendly error, without crashing, when the player already has the maximum active threads", async () => {
    for (let i = 0; i < 3; i++) {
      await createSuggestionInsight({ category: `focus-${i}` });
    }
    const insights = await testDb.aiAdvisorInsight.findMany({ where: { organisationId } });
    for (const insight of insights) {
      const result = await confirmAiDevelopmentSuggestionAction("test-org", insight.id);
      expect(result.success).toBe(true);
    }

    const fourthInsight = await createSuggestionInsight({ category: "focus-4" });
    const result = await confirmAiDevelopmentSuggestionAction("test-org", fourthInsight.id);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toBeTruthy();

    const stillActive = await testDb.aiAdvisorInsight.findUniqueOrThrow({ where: { id: fourthInsight.id } });
    expect(stillActive.state).toBe("ACTIVE");
  });

  it("rejects confirming an insight that belongs to a different organisation", async () => {
    const otherOrg = await createTestOrganisation(testDb);
    const otherGroup = await createTestGroup(testDb, otherOrg.id);
    const otherTeam = await createTestTeam(testDb, otherOrg.id, otherGroup.id);
    const otherRound = await createTestMatchRound(testDb, otherOrg.id, otherGroup.id);
    const otherMatch = await createTestMatch(testDb, otherOrg.id, otherRound.id, otherTeam.id, null);
    const otherPlayer = await createTestPlayer(testDb, otherOrg.id, otherTeam.id);
    const otherReview = await testDb.aiAdvisorReview.create({
      data: {
        organisationId: otherOrg.id,
        capability: "POST_MATCH_REVIEW",
        scopeType: "MATCH",
        scopeId: otherMatch.id,
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
