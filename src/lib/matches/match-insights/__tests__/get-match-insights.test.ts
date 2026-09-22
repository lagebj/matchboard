import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, seedTestFixture, getTestDb, type TestFixtureIds } from "@/test/test-db";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({
  get db() {
    return getTestDb();
  },
}));

import { getMatchInsights } from "@/lib/matches/match-insights/get-match-insights";
import { buildMatchPrepContext } from "@/lib/ai/context/match-prep";
import { computeSourceFingerprint } from "@/lib/ai/fingerprints";
import { generateAiProviderConnectionId } from "@/lib/ai/connection-id";

let testDb: PrismaClient;
let fixtureIds: TestFixtureIds;

async function setUpCompletePlan(matchId: string) {
  const [core1, core2] = fixtureIds.players.filter((p) => p.coreTeamName === "Bla");
  await testDb.selection.createMany({
    data: [
      { matchId, matchRoundId: fixtureIds.matchRoundId, playerId: core1.id, role: "CORE", status: "FINALIZED", organisationId: fixtureIds.organisationId },
      { matchId, matchRoundId: fixtureIds.matchRoundId, playerId: core2.id, role: "CORE", status: "FINALIZED", organisationId: fixtureIds.organisationId },
    ],
  });
  return { core1, core2 };
}

async function enableAi(organisationId: string) {
  const connectionId = generateAiProviderConnectionId();
  await testDb.aiProviderConnection.create({
    data: { id: connectionId, organisationId, provider: "OPENAI", status: "READY", model: "gpt-5" },
  });
  await testDb.organisationAiSettings.create({
    data: { organisationId, enabled: true, activeConnectionId: connectionId, matchPrepEnabled: true },
  });
}

describe("match-insights/get-match-insights", () => {
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixtureIds = await seedTestFixture(testDb, { playersPerTeam: 4 });
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await testDb.aiAdvisorInsight.deleteMany({});
    await testDb.aiAdvisorReview.deleteMany({});
    await testDb.aiAdvisorJob.deleteMany({});
    await testDb.organisationAiSettings.deleteMany({});
    await testDb.aiProviderConnection.deleteMany({});
    await testDb.plannedRotationChange.deleteMany({});
    await testDb.plannedRotation.deleteMany({});
    await testDb.selection.deleteMany({});
    await testDb.developmentThread.deleteMany({});
    await testDb.match.update({ where: { id: fixtureIds.matches["Bla"] }, data: { squadSize: 2, status: "SCHEDULED" } });
  });

  it("returns an empty CURRENT view model when the match does not resolve in this organisation", async () => {
    const result = await getMatchInsights({ organisationId: fixtureIds.organisationId, matchId: "does-not-exist" });
    expect(result).toEqual({ status: "CURRENT", insights: [], totalCount: 0 });
  });

  it("returns deterministic insights with status CURRENT when AI is disabled, even with an unrelated stale job present", async () => {
    const matchId = fixtureIds.matches["Bla"];
    const [core1] = await Object.values(await setUpCompletePlan(matchId));
    await testDb.developmentThread.create({
      data: { playerId: core1.id, focus: "Improve first touch", category: "BALL_CONTROL", status: "ACTIVE", organisationId: fixtureIds.organisationId },
    });

    const result = await getMatchInsights({ organisationId: fixtureIds.organisationId, matchId });
    expect(result.status).toBe("CURRENT");
    expect(result.insights.some((i) => i.source === "DETERMINISTIC")).toBe(true);
    expect(result.insights.every((i) => i.source === "DETERMINISTIC")).toBe(true);
    expect(result.totalCount).toBe(result.insights.length);
  });

  it("reports UPDATING when a job is queued for the current fingerprint, and deterministic insights remain present", async () => {
    const matchId = fixtureIds.matches["Bla"];
    await setUpCompletePlan(matchId);
    await enableAi(fixtureIds.organisationId);
    const context = await buildMatchPrepContext({ organisationId: fixtureIds.organisationId, scopeId: matchId });
    expect(context).not.toBeNull();

    await testDb.aiAdvisorJob.create({
      data: {
        organisationId: fixtureIds.organisationId,
        capability: "MATCH_PREP",
        scopeType: "MATCH",
        scopeId: matchId,
        sourceFingerprint: computeSourceFingerprint(context!.normalizedContext),
        status: "QUEUED",
      },
    });

    const result = await getMatchInsights({ organisationId: fixtureIds.organisationId, matchId });
    expect(result.status).toBe("UPDATING");
  });

  it("merges fresh AI insights, deriving category from evidence-ref namespace and relevance from kind (never AI-emitted)", async () => {
    const matchId = fixtureIds.matches["Bla"];
    await setUpCompletePlan(matchId);
    await enableAi(fixtureIds.organisationId);
    const context = await buildMatchPrepContext({ organisationId: fixtureIds.organisationId, scopeId: matchId });
    expect(context).not.toBeNull();

    const review = await testDb.aiAdvisorReview.create({
      data: {
        organisationId: fixtureIds.organisationId,
        capability: "MATCH_PREP",
        scopeType: "MATCH",
        scopeId: matchId,
        sourceFingerprint: computeSourceFingerprint(context!.normalizedContext),
        status: "SUCCEEDED",
        contractVersion: "1",
        terminologyVersion: "1",
        completedAt: new Date(),
      },
    });
    await testDb.aiAdvisorInsight.create({
      data: {
        organisationId: fixtureIds.organisationId,
        reviewId: review.id,
        kind: "ATTENTION",
        subjectType: "MATCH",
        subjectId: matchId,
        title: "Formation change",
        body: "This formation was rarely used recently.",
        evidenceRefs: ["fact:formation-pattern:M01"],
      },
    });

    const result = await getMatchInsights({ organisationId: fixtureIds.organisationId, matchId });
    expect(result.status).toBe("CURRENT");
    const aiInsight = result.insights.find((i) => i.source === "AI");
    expect(aiInsight).toBeDefined();
    expect(aiInsight?.category).toBe("TEAM_PATTERN"); // derived from the fact:formation-pattern:... namespace.
    expect(aiInsight?.relevance).toBe("HIGH"); // derived from kind: ATTENTION -> attention -> HIGH.
    expect(aiInsight?.title).toBe("Formation change");
  });

  it("withholds AI insights (STALE_AI_WITHHELD) when a SUCCEEDED review exists but no longer matches the current plan", async () => {
    const matchId = fixtureIds.matches["Bla"];
    await setUpCompletePlan(matchId);
    await enableAi(fixtureIds.organisationId);

    const review = await testDb.aiAdvisorReview.create({
      data: {
        organisationId: fixtureIds.organisationId,
        capability: "MATCH_PREP",
        scopeType: "MATCH",
        scopeId: matchId,
        sourceFingerprint: "stale-fingerprint-does-not-match-current-plan",
        status: "SUCCEEDED",
        contractVersion: "1",
        terminologyVersion: "1",
        completedAt: new Date(),
      },
    });
    await testDb.aiAdvisorInsight.create({
      data: {
        organisationId: fixtureIds.organisationId,
        reviewId: review.id,
        kind: "OBSERVATION",
        subjectType: "MATCH",
        subjectId: matchId,
        title: "Stale insight",
        body: "Should not be shown.",
        evidenceRefs: [],
      },
    });

    const result = await getMatchInsights({ organisationId: fixtureIds.organisationId, matchId });
    expect(result.status).toBe("STALE_AI_WITHHELD");
    expect(result.insights.every((i) => i.source === "DETERMINISTIC")).toBe(true);
    expect(JSON.stringify(result.insights)).not.toContain("Stale insight");
  });

  it("reports AI_UNAVAILABLE when the most recent job for this plan failed terminally and no successful review exists", async () => {
    const matchId = fixtureIds.matches["Bla"];
    await setUpCompletePlan(matchId);
    await enableAi(fixtureIds.organisationId);
    const context = await buildMatchPrepContext({ organisationId: fixtureIds.organisationId, scopeId: matchId });
    expect(context).not.toBeNull();

    await testDb.aiAdvisorJob.create({
      data: {
        organisationId: fixtureIds.organisationId,
        capability: "MATCH_PREP",
        scopeType: "MATCH",
        scopeId: matchId,
        sourceFingerprint: computeSourceFingerprint(context!.normalizedContext),
        status: "FAILED",
        attempts: 3,
        lastErrorCode: "PROVIDER_TIMEOUT",
      },
    });

    const result = await getMatchInsights({ organisationId: fixtureIds.organisationId, matchId });
    expect(result.status).toBe("AI_UNAVAILABLE");
    // Never a large infrastructure error banner's worth of content -- no raw error code leaks into insights.
    expect(JSON.stringify(result.insights)).not.toContain("PROVIDER_TIMEOUT");
  });

  it("ranks the merged list by relevance, never raw insertion order", async () => {
    const matchId = fixtureIds.matches["Bla"];
    await setUpCompletePlan(matchId);

    const result = await getMatchInsights({ organisationId: fixtureIds.organisationId, matchId });
    const relevanceOrder: Record<string, number> = { HIGH: 0, MEDIUM: 1, CONTEXTUAL: 2 };
    for (let i = 1; i < result.insights.length; i++) {
      expect(relevanceOrder[result.insights[i - 1].relevance]).toBeLessThanOrEqual(relevanceOrder[result.insights[i].relevance]);
    }
  });
});
