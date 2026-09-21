import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, seedTestFixture, getTestDb, type TestFixtureIds } from "@/test/test-db";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({
  get db() {
    return getTestDb();
  },
}));

import { getPlannedMatchAdvisorViewModel } from "@/lib/ai/presentation/planned-match-advisor";
import { buildLineupReviewContext } from "@/lib/ai/context/lineup-review";
import { computeSourceFingerprint } from "@/lib/ai/fingerprints";
import { generateAiProviderConnectionId } from "@/lib/ai/connection-id";

let testDb: PrismaClient;
let fixtureIds: TestFixtureIds;

async function setUpCompleteLineup(matchId: string) {
  const [core1, core2, support1] = fixtureIds.players.filter((p) => p.coreTeamName === "Bla");
  await testDb.match.update({ where: { id: matchId }, data: { formation: "4-4-2" } });
  await testDb.selection.createMany({
    data: [
      { matchId, matchRoundId: fixtureIds.matchRoundId, playerId: core1.id, role: "CORE", status: "FINALIZED", organisationId: fixtureIds.organisationId },
      { matchId, matchRoundId: fixtureIds.matchRoundId, playerId: core2.id, role: "CORE", status: "FINALIZED", organisationId: fixtureIds.organisationId },
      { matchId, matchRoundId: fixtureIds.matchRoundId, playerId: support1.id, role: "SUPPORT", status: "DRAFT", organisationId: fixtureIds.organisationId },
    ],
  });
  return { core1, core2, support1 };
}

async function enableAi(organisationId: string, capabilityField: "lineupReviewEnabled" | "matchPrepEnabled") {
  const connectionId = generateAiProviderConnectionId();
  await testDb.aiProviderConnection.create({
    data: { id: connectionId, organisationId, provider: "OPENAI", status: "READY", model: "gpt-5" },
  });
  await testDb.organisationAiSettings.create({
    data: { organisationId, enabled: true, activeConnectionId: connectionId, [capabilityField]: true },
  });
}

describe("ai/presentation/planned-match-advisor", () => {
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
    await testDb.plannedRotationChange.deleteMany({});
    await testDb.plannedRotation.deleteMany({});
    await testDb.selection.deleteMany({});
    await testDb.match.update({ where: { id: fixtureIds.matches["Bla"] }, data: { squadSize: 2 } });
  });

  it("returns null when AI is not enabled for the organisation, even with a SUCCEEDED review present", async () => {
    const matchId = fixtureIds.matches["Bla"];
    await setUpCompleteLineup(matchId);
    const context = await buildLineupReviewContext({ organisationId: fixtureIds.organisationId, scopeId: matchId });
    const fingerprint = computeSourceFingerprint(context!.normalizedContext);

    const review = await testDb.aiAdvisorReview.create({
      data: {
        organisationId: fixtureIds.organisationId,
        capability: "LINEUP_REVIEW",
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
        subjectId: context!.refMap.get("P00")?.entityId,
        title: "P00 played every minute",
        body: "P00 covered the full match without rotation.",
        evidenceRefs: [],
      },
    });

    const result = await getPlannedMatchAdvisorViewModel({ organisationId: fixtureIds.organisationId, matchId });
    expect(result).toBeNull();
  });

  it("returns null when there is no SUCCEEDED review for this match", async () => {
    const matchId = fixtureIds.matches["Bla"];
    await setUpCompleteLineup(matchId);
    await enableAi(fixtureIds.organisationId, "lineupReviewEnabled");

    const result = await getPlannedMatchAdvisorViewModel({ organisationId: fixtureIds.organisationId, matchId });
    expect(result).toBeNull();
  });

  it("returns null when the review has zero ACTIVE insights", async () => {
    const matchId = fixtureIds.matches["Bla"];
    await setUpCompleteLineup(matchId);
    await enableAi(fixtureIds.organisationId, "lineupReviewEnabled");
    const context = await buildLineupReviewContext({ organisationId: fixtureIds.organisationId, scopeId: matchId });
    const fingerprint = computeSourceFingerprint(context!.normalizedContext);

    const review = await testDb.aiAdvisorReview.create({
      data: {
        organisationId: fixtureIds.organisationId,
        capability: "LINEUP_REVIEW",
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
        subjectId: context!.refMap.get("P00")?.entityId,
        title: "P00 dismissed",
        body: "P00 no longer relevant.",
        evidenceRefs: [],
        state: "DISMISSED",
      },
    });

    const result = await getPlannedMatchAdvisorViewModel({ organisationId: fixtureIds.organisationId, matchId });
    expect(result).toBeNull();
  });

  it("resolves ephemeral P0x refs back to real player names and returns a fresh view model when the fingerprint still matches", async () => {
    const matchId = fixtureIds.matches["Bla"];
    const { core1 } = await setUpCompleteLineup(matchId);
    await enableAi(fixtureIds.organisationId, "lineupReviewEnabled");
    const context = await buildLineupReviewContext({ organisationId: fixtureIds.organisationId, scopeId: matchId });
    expect(context).not.toBeNull();
    const fingerprint = computeSourceFingerprint(context!.normalizedContext);

    const [core1Ref] = [...context!.refMap.entries()].find(([, target]) => target.entityId === core1.id)!;

    const review = await testDb.aiAdvisorReview.create({
      data: {
        organisationId: fixtureIds.organisationId,
        capability: "LINEUP_REVIEW",
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
        subjectId: core1.id,
        title: `${core1Ref} played every minute`,
        body: `${core1Ref} covered the full match without rotation.`,
        evidenceRefs: [],
      },
    });

    const result = await getPlannedMatchAdvisorViewModel({ organisationId: fixtureIds.organisationId, matchId });
    expect(result?.status).toBe("fresh");
    if (result?.status !== "fresh") return;
    expect(result.insights).toHaveLength(1);
    expect(result.insights[0].title).toContain(core1.firstName);
    expect(result.insights[0].title).not.toContain(core1Ref);
    expect(result.insights[0].body).toContain(core1.firstName);
  });

  it("returns a stale view model when the plan has changed since the review was generated", async () => {
    const matchId = fixtureIds.matches["Bla"];
    await setUpCompleteLineup(matchId);
    await enableAi(fixtureIds.organisationId, "lineupReviewEnabled");

    const review = await testDb.aiAdvisorReview.create({
      data: {
        organisationId: fixtureIds.organisationId,
        capability: "LINEUP_REVIEW",
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
        subjectType: "PLAYER",
        subjectId: fixtureIds.players[0].id,
        title: "P00 played every minute",
        body: "P00 covered the full match without rotation.",
        evidenceRefs: [],
      },
    });

    const result = await getPlannedMatchAdvisorViewModel({ organisationId: fixtureIds.organisationId, matchId });
    expect(result).toEqual({ status: "stale" });
  });
});
