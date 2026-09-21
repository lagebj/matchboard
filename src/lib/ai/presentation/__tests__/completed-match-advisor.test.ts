import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, seedTestFixture, getTestDb, type TestFixtureIds } from "@/test/test-db";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({
  get db() {
    return getTestDb();
  },
}));

import { getCompletedMatchAdvisorViewModel } from "@/lib/ai/presentation/completed-match-advisor";
import { buildPostMatchReviewContext } from "@/lib/ai/context/post-match-review";
import { computeSourceFingerprint } from "@/lib/ai/fingerprints";
import { generateAiProviderConnectionId } from "@/lib/ai/connection-id";

let testDb: PrismaClient;
let fixtureIds: TestFixtureIds;

async function lockReport(matchId: string) {
  const match = await testDb.match.findUniqueOrThrow({ where: { id: matchId }, select: { homeAway: true } });
  return testDb.postMatchReport.create({
    data: {
      matchId,
      status: "LOCKED",
      organisationId: fixtureIds.organisationId,
      homeGoals: match.homeAway === "HOME" ? 2 : 0,
      awayGoals: match.homeAway === "HOME" ? 0 : 2,
    },
  });
}

async function enableAi(organisationId: string) {
  const connectionId = generateAiProviderConnectionId();
  await testDb.aiProviderConnection.create({
    data: { id: connectionId, organisationId, provider: "OPENAI", status: "READY", model: "gpt-5" },
  });
  await testDb.organisationAiSettings.create({
    data: { organisationId, enabled: true, activeConnectionId: connectionId, postMatchReviewEnabled: true },
  });
}

describe("ai/presentation/completed-match-advisor", () => {
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
    await testDb.organisationAiSettings.deleteMany({});
    await testDb.aiProviderConnection.deleteMany({});
    await testDb.goal.deleteMany({});
    await testDb.assist.deleteMany({});
    await testDb.postMatchPlayerActual.deleteMany({});
    await testDb.postMatchReport.deleteMany({});
  });

  it("returns null when AI is not enabled for the organisation, even with a SUCCEEDED review present", async () => {
    const matchId = fixtureIds.matches["Bla"];
    const report = await lockReport(matchId);
    const context = await buildPostMatchReviewContext({ organisationId: fixtureIds.organisationId, scopeId: matchId });
    const fingerprint = computeSourceFingerprint(context!.normalizedContext);

    const review = await testDb.aiAdvisorReview.create({
      data: {
        organisationId: fixtureIds.organisationId,
        capability: "POST_MATCH_REVIEW",
        scopeType: "MATCH",
        scopeId: matchId,
        sourceFingerprint: fingerprint,
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
        title: "Strong first half",
        body: "The team dominated possession in the first half.",
        evidenceRefs: [],
      },
    });

    const result = await getCompletedMatchAdvisorViewModel({ organisationId: fixtureIds.organisationId, matchId });
    expect(result).toBeNull();
    void report;
  });

  it("returns null when there is no SUCCEEDED review for this match", async () => {
    const matchId = fixtureIds.matches["Bla"];
    await lockReport(matchId);
    await enableAi(fixtureIds.organisationId);

    const result = await getCompletedMatchAdvisorViewModel({ organisationId: fixtureIds.organisationId, matchId });
    expect(result).toBeNull();
  });

  it("returns null when the review has zero ACTIVE insights", async () => {
    const matchId = fixtureIds.matches["Bla"];
    await lockReport(matchId);
    await enableAi(fixtureIds.organisationId);
    const context = await buildPostMatchReviewContext({ organisationId: fixtureIds.organisationId, scopeId: matchId });
    const fingerprint = computeSourceFingerprint(context!.normalizedContext);

    const review = await testDb.aiAdvisorReview.create({
      data: {
        organisationId: fixtureIds.organisationId,
        capability: "POST_MATCH_REVIEW",
        scopeType: "MATCH",
        scopeId: matchId,
        sourceFingerprint: fingerprint,
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
        title: "Dismissed",
        body: "No longer relevant.",
        evidenceRefs: [],
        state: "DISMISSED",
      },
    });

    const result = await getCompletedMatchAdvisorViewModel({ organisationId: fixtureIds.organisationId, matchId });
    expect(result).toBeNull();
  });

  it("returns a stale view model when the report has changed since the review was generated", async () => {
    const matchId = fixtureIds.matches["Bla"];
    await lockReport(matchId);
    await enableAi(fixtureIds.organisationId);

    const review = await testDb.aiAdvisorReview.create({
      data: {
        organisationId: fixtureIds.organisationId,
        capability: "POST_MATCH_REVIEW",
        scopeType: "MATCH",
        scopeId: matchId,
        sourceFingerprint: "stale-fingerprint-does-not-match-current-report",
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
        title: "Strong first half",
        body: "The team dominated possession in the first half.",
        evidenceRefs: [],
      },
    });

    const result = await getCompletedMatchAdvisorViewModel({ organisationId: fixtureIds.organisationId, matchId });
    expect(result).toEqual({ status: "stale" });
  });

  it("returns fresh plain insights, resolving ephemeral refs back to real player names", async () => {
    const matchId = fixtureIds.matches["Bla"];
    const [scorer] = fixtureIds.players.filter((p) => p.coreTeamName === "Bla");
    const report = await lockReport(matchId);
    await testDb.postMatchPlayerActual.create({
      data: { reportId: report.id, matchId, playerId: scorer.id, attendanceStatus: "PRESENT", organisationId: fixtureIds.organisationId },
    });
    await enableAi(fixtureIds.organisationId);
    const context = await buildPostMatchReviewContext({ organisationId: fixtureIds.organisationId, scopeId: matchId });
    expect(context).not.toBeNull();
    const fingerprint = computeSourceFingerprint(context!.normalizedContext);

    const [scorerRef] = [...context!.refMap.entries()].find(([, target]) => target.entityId === scorer.id)!;

    const review = await testDb.aiAdvisorReview.create({
      data: {
        organisationId: fixtureIds.organisationId,
        capability: "POST_MATCH_REVIEW",
        scopeType: "MATCH",
        scopeId: matchId,
        sourceFingerprint: fingerprint,
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
        subjectType: "PLAYER",
        subjectId: scorer.id,
        title: `${scorerRef} stood out`,
        body: `${scorerRef} showed strong composure in front of goal.`,
        evidenceRefs: [],
      },
    });

    const result = await getCompletedMatchAdvisorViewModel({ organisationId: fixtureIds.organisationId, matchId });
    expect(result?.status).toBe("fresh");
    if (result?.status !== "fresh") return;
    expect(result.insights).toHaveLength(1);
    expect(result.insights[0].title).toContain(scorer.firstName);
    expect(result.insights[0].title).not.toContain(scorerRef);
    expect(result.suggestions).toHaveLength(0);
  });

  it("separates a development-suggestion insight, resolving the player's real name into the title", async () => {
    const matchId = fixtureIds.matches["Bla"];
    const [player] = fixtureIds.players.filter((p) => p.coreTeamName === "Bla");
    await lockReport(matchId);
    await enableAi(fixtureIds.organisationId);
    const context = await buildPostMatchReviewContext({ organisationId: fixtureIds.organisationId, scopeId: matchId });
    const fingerprint = computeSourceFingerprint(context!.normalizedContext);

    const review = await testDb.aiAdvisorReview.create({
      data: {
        organisationId: fixtureIds.organisationId,
        capability: "POST_MATCH_REVIEW",
        scopeType: "MATCH",
        scopeId: matchId,
        sourceFingerprint: fingerprint,
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
        kind: "DEVELOPMENT_SUGGESTION",
        subjectType: "PLAYER",
        subjectId: player.id,
        title: "Development suggestion",
        body: "Struggled to track back after losing possession in wide areas.",
        evidenceRefs: [],
        actionType: "CONFIRM_DEVELOPMENT_OBSERVATION",
        actionPayload: {
          playerId: player.id,
          category: "positional understanding",
          observation: "Struggled to track back after losing possession in wide areas.",
        },
      },
    });

    const result = await getCompletedMatchAdvisorViewModel({ organisationId: fixtureIds.organisationId, matchId });
    expect(result?.status).toBe("fresh");
    if (result?.status !== "fresh") return;
    expect(result.insights).toHaveLength(0);
    expect(result.suggestions).toHaveLength(1);
    expect(result.suggestions[0].title).toBe(`${player.firstName} ${player.lastName ?? ""}`.trim() + " · positional understanding");
  });
});
