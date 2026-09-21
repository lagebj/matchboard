import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, seedTestFixture, getTestDb, type TestFixtureIds } from "@/test/test-db";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({
  get db() {
    return getTestDb();
  },
}));

import { getRoundBoardAdvisorViewModel } from "@/lib/ai/presentation/round-board-advisor";
import { buildRoundReviewContext } from "@/lib/ai/context/round-review";
import { computeSourceFingerprint } from "@/lib/ai/fingerprints";
import { generateAiProviderConnectionId } from "@/lib/ai/connection-id";

let testDb: PrismaClient;
let fixtureIds: TestFixtureIds;

async function enableAi(organisationId: string) {
  const connectionId = generateAiProviderConnectionId();
  await testDb.aiProviderConnection.create({
    data: { id: connectionId, organisationId, provider: "OPENAI", status: "READY", model: "gpt-5" },
  });
  await testDb.organisationAiSettings.create({
    data: { organisationId, enabled: true, activeConnectionId: connectionId, roundReviewEnabled: true },
  });
}

describe("ai/presentation/round-board-advisor", () => {
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
    await testDb.warning.deleteMany({});
    await testDb.matchHelperAssignment.deleteMany({});
    await testDb.availability.deleteMany({});
    await testDb.selection.deleteMany({});
    await testDb.matchRound.update({ where: { id: fixtureIds.matchRoundId }, data: { status: "DRAFT" } });
  });

  it("returns null when AI is not enabled for the organisation, even with a SUCCEEDED review present", async () => {
    await testDb.matchRound.update({ where: { id: fixtureIds.matchRoundId }, data: { status: "FINALIZED" } });
    const context = await buildRoundReviewContext({ organisationId: fixtureIds.organisationId, scopeId: fixtureIds.matchRoundId });
    const fingerprint = computeSourceFingerprint(context!.normalizedContext);

    const review = await testDb.aiAdvisorReview.create({
      data: {
        organisationId: fixtureIds.organisationId,
        capability: "ROUND_REVIEW",
        scopeType: "MATCH_ROUND",
        scopeId: fixtureIds.matchRoundId,
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
        subjectType: "ROUND",
        subjectId: fixtureIds.matchRoundId,
        title: "Position coverage",
        body: "Support movement is concentrated on the same players.",
        evidenceRefs: [],
      },
    });

    const result = await getRoundBoardAdvisorViewModel({ organisationId: fixtureIds.organisationId, matchRoundId: fixtureIds.matchRoundId });
    expect(result).toBeNull();
  });

  it("returns null when there is no SUCCEEDED review for this round", async () => {
    await testDb.matchRound.update({ where: { id: fixtureIds.matchRoundId }, data: { status: "FINALIZED" } });
    await enableAi(fixtureIds.organisationId);

    const result = await getRoundBoardAdvisorViewModel({ organisationId: fixtureIds.organisationId, matchRoundId: fixtureIds.matchRoundId });
    expect(result).toBeNull();
  });

  it("returns null when the review has zero ACTIVE insights", async () => {
    await testDb.matchRound.update({ where: { id: fixtureIds.matchRoundId }, data: { status: "FINALIZED" } });
    await enableAi(fixtureIds.organisationId);
    const context = await buildRoundReviewContext({ organisationId: fixtureIds.organisationId, scopeId: fixtureIds.matchRoundId });
    const fingerprint = computeSourceFingerprint(context!.normalizedContext);

    const review = await testDb.aiAdvisorReview.create({
      data: {
        organisationId: fixtureIds.organisationId,
        capability: "ROUND_REVIEW",
        scopeType: "MATCH_ROUND",
        scopeId: fixtureIds.matchRoundId,
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
        subjectType: "ROUND",
        subjectId: fixtureIds.matchRoundId,
        title: "Dismissed",
        body: "No longer relevant.",
        evidenceRefs: [],
        state: "DISMISSED",
      },
    });

    const result = await getRoundBoardAdvisorViewModel({ organisationId: fixtureIds.organisationId, matchRoundId: fixtureIds.matchRoundId });
    expect(result).toBeNull();
  });

  it("returns a stale view model when the round has changed since the review was generated", async () => {
    await testDb.matchRound.update({ where: { id: fixtureIds.matchRoundId }, data: { status: "FINALIZED" } });
    await enableAi(fixtureIds.organisationId);

    const review = await testDb.aiAdvisorReview.create({
      data: {
        organisationId: fixtureIds.organisationId,
        capability: "ROUND_REVIEW",
        scopeType: "MATCH_ROUND",
        scopeId: fixtureIds.matchRoundId,
        sourceFingerprint: "stale-fingerprint-does-not-match-current-round",
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
        subjectType: "ROUND",
        subjectId: fixtureIds.matchRoundId,
        title: "Position coverage",
        body: "Support movement is concentrated on the same players.",
        evidenceRefs: [],
      },
    });

    const result = await getRoundBoardAdvisorViewModel({ organisationId: fixtureIds.organisationId, matchRoundId: fixtureIds.matchRoundId });
    expect(result).toEqual({ status: "stale" });
  });

  it("resolves ephemeral player refs back to real player names and returns a fresh view model when the fingerprint still matches", async () => {
    await testDb.matchRound.update({ where: { id: fixtureIds.matchRoundId }, data: { status: "FINALIZED" } });
    const [player] = fixtureIds.players.filter((p) => p.coreTeamName === "Bla");
    await testDb.selection.create({
      data: {
        matchId: fixtureIds.matches["Bla"],
        matchRoundId: fixtureIds.matchRoundId,
        playerId: player.id,
        role: "CORE",
        status: "FINALIZED",
        organisationId: fixtureIds.organisationId,
      },
    });
    await enableAi(fixtureIds.organisationId);
    const context = await buildRoundReviewContext({ organisationId: fixtureIds.organisationId, scopeId: fixtureIds.matchRoundId });
    expect(context).not.toBeNull();
    const fingerprint = computeSourceFingerprint(context!.normalizedContext);

    const [playerRef] = [...context!.refMap.entries()].find(([, target]) => target.entityId === player.id)!;

    const review = await testDb.aiAdvisorReview.create({
      data: {
        organisationId: fixtureIds.organisationId,
        capability: "ROUND_REVIEW",
        scopeType: "MATCH_ROUND",
        scopeId: fixtureIds.matchRoundId,
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
        subjectId: player.id,
        title: `${playerRef} played every match`,
        body: `${playerRef} was allocated CORE in every fixture this round.`,
        evidenceRefs: [],
      },
    });

    const result = await getRoundBoardAdvisorViewModel({ organisationId: fixtureIds.organisationId, matchRoundId: fixtureIds.matchRoundId });
    expect(result?.status).toBe("fresh");
    if (result?.status !== "fresh") return;
    expect(result.insights).toHaveLength(1);
    expect(result.insights[0].title).toContain(player.firstName);
    expect(result.insights[0].title).not.toContain(playerRef);
  });
});
