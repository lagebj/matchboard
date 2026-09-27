import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, seedTestFixture, getTestDb, type TestFixtureIds } from "@/test/test-db";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({
  get db() {
    return getTestDb();
  },
}));

import { getPlayerDevelopmentCycleInsight } from "@/lib/ai/presentation/player-development-cycle-insight";
import { buildDevelopmentCycleScopeId } from "@/lib/ai/context/development-cycle-review";
import { generateAiProviderConnectionId } from "@/lib/ai/connection-id";

let testDb: PrismaClient;
let fixtureIds: TestFixtureIds;

const NOW = new Date("2025-05-05T10:00:00Z");

async function enableAi(organisationId: string) {
  const connectionId = generateAiProviderConnectionId();
  await testDb.aiProviderConnection.create({
    data: { id: connectionId, organisationId, provider: "OPENAI", status: "READY", model: "gpt-5" },
  });
  await testDb.organisationAiSettings.create({
    data: { organisationId, enabled: true, activeConnectionId: connectionId, developmentCycleReviewEnabled: true },
  });
}

describe("ai/presentation/player-development-cycle-insight", () => {
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
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function seedCycleReviewWithPlayerInsight(params: {
    playerId: string;
    teamId: string;
    title?: string;
    body: string;
    completedAt?: Date;
    windowEndOffsetDays?: number;
  }) {
    const windowEndOffsetDays = params.windowEndOffsetDays ?? 0;
    const windowEnd = new Date(NOW.getTime() - windowEndOffsetDays * 24 * 60 * 60 * 1000);
    const windowStart = new Date(windowEnd.getTime() - 35 * 24 * 60 * 60 * 1000);
    const review = await testDb.aiAdvisorReview.create({
      data: {
        organisationId: fixtureIds.organisationId,
        capability: "DEVELOPMENT_CYCLE_REVIEW",
        scopeType: "TEAM_WINDOW",
        scopeId: buildDevelopmentCycleScopeId(params.teamId, windowStart, windowEnd),
        sourceFingerprint: `fp-${Math.random()}`,
        status: "SUCCEEDED",
        contractVersion: "2",
        terminologyVersion: "1",
        completedAt: params.completedAt ?? windowEnd,
        summary: "Cycle summary.",
      },
    });
    await testDb.aiAdvisorInsight.create({
      data: {
        organisationId: fixtureIds.organisationId,
        reviewId: review.id,
        kind: "OBSERVATION",
        subjectType: "PLAYER",
        subjectId: params.playerId,
        title: params.title ?? "Cycle insight",
        body: params.body,
        evidenceRefs: [],
        state: "ACTIVE",
      },
    });
    return review;
  }

  it("returns null when AI or the capability is disabled", async () => {
    const [player] = fixtureIds.players.filter((p) => p.coreTeamName === "Bla");
    await seedCycleReviewWithPlayerInsight({ playerId: player.id, teamId: fixtureIds.teams["Bla"], body: "Improving." });

    const result = await getPlayerDevelopmentCycleInsight({ organisationId: fixtureIds.organisationId, playerId: player.id });
    expect(result).toBeNull();
  });

  it("returns the latest ACTIVE player-specific cycle insight with its date window", async () => {
    const [player] = fixtureIds.players.filter((p) => p.coreTeamName === "Bla");
    const teamId = fixtureIds.teams["Bla"];
    await enableAi(fixtureIds.organisationId);
    await seedCycleReviewWithPlayerInsight({
      playerId: player.id,
      teamId,
      body: "Improving: two coach observations describe earlier scanning.",
      windowEndOffsetDays: 70,
    });
    await seedCycleReviewWithPlayerInsight({
      playerId: player.id,
      teamId,
      body: "Unresolved: mixed evidence across the cycle.",
      windowEndOffsetDays: 35,
    });

    const result = await getPlayerDevelopmentCycleInsight({ organisationId: fixtureIds.organisationId, playerId: player.id });
    expect(result).not.toBeNull();
    expect(result!.body).toBe("Unresolved: mixed evidence across the cycle.");
    expect(result!.windowLabel).toBe("24 Feb – 31 Mar 2025");
  });

  it("ignores a DISMISSED insight and another player's insight", async () => {
    const [player1, player2] = fixtureIds.players.filter((p) => p.coreTeamName === "Bla");
    const teamId = fixtureIds.teams["Bla"];
    await enableAi(fixtureIds.organisationId);
    // player1's insight dismissed; player2's active — player1 must get null.
    const review = await seedCycleReviewWithPlayerInsight({
      playerId: player1.id,
      teamId,
      body: "Dismissed insight.",
    });
    await testDb.aiAdvisorInsight.updateMany({
      where: { reviewId: review.id, subjectId: player1.id },
      data: { state: "DISMISSED" },
    });
    await seedCycleReviewWithPlayerInsight({ playerId: player2.id, teamId, body: "Other player's insight." });

    const result1 = await getPlayerDevelopmentCycleInsight({ organisationId: fixtureIds.organisationId, playerId: player1.id });
    expect(result1).toBeNull();
    const result2 = await getPlayerDevelopmentCycleInsight({ organisationId: fixtureIds.organisationId, playerId: player2.id });
    expect(result2?.body).toBe("Other player's insight.");
  });
});