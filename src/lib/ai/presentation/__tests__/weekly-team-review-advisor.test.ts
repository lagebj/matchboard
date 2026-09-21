import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, seedTestFixture, getTestDb, type TestFixtureIds } from "@/test/test-db";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({
  get db() {
    return getTestDb();
  },
}));

import { getWeeklyTeamReviewAdvisorViewModel } from "@/lib/ai/presentation/weekly-team-review-advisor";
import { buildWeeklyTeamReviewContext, buildWeeklyTeamReviewScopeId } from "@/lib/ai/context/weekly-team-review";
import { computeSourceFingerprint } from "@/lib/ai/fingerprints";
import { generateAiProviderConnectionId } from "@/lib/ai/connection-id";

let testDb: PrismaClient;
let fixtureIds: TestFixtureIds;

// The fixture's default match (`baseDate = 2025-04-28T10:00:00Z`) falls in ISO week 2025-W18 --
// same week the context-builder test relies on.
const WEEK_KEY = "2025-W18";

async function enableAi(organisationId: string) {
  const connectionId = generateAiProviderConnectionId();
  await testDb.aiProviderConnection.create({
    data: { id: connectionId, organisationId, provider: "OPENAI", status: "READY", model: "gpt-5" },
  });
  await testDb.organisationAiSettings.create({
    data: { organisationId, enabled: true, activeConnectionId: connectionId, weeklyTeamReviewEnabled: true },
  });
}

describe("ai/presentation/weekly-team-review-advisor", () => {
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
    // getWeeklyTeamReviewAdvisorViewModel always targets `previousCompletedIsoWeekKey(new Date())`
    // (the same "previous week" the cron scan enqueues reviews for) rather than an
    // externally-supplied week key -- pin the clock so "previous week" always resolves to
    // WEEK_KEY (2025-W18), the week the fixture's default match falls in.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-05-05T10:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns null when AI is not enabled for the organisation, even with a SUCCEEDED review present", async () => {
    const teamId = fixtureIds.teams["Bla"];
    const scopeId = buildWeeklyTeamReviewScopeId(teamId, WEEK_KEY);
    const context = await buildWeeklyTeamReviewContext({ organisationId: fixtureIds.organisationId, scopeId });
    const fingerprint = computeSourceFingerprint(context!.normalizedContext);

    const review = await testDb.aiAdvisorReview.create({
      data: {
        organisationId: fixtureIds.organisationId,
        capability: "WEEKLY_TEAM_REVIEW",
        scopeType: "TEAM_WEEK",
        scopeId,
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
        subjectType: "TEAM",
        subjectId: teamId,
        title: "Steady week",
        body: "Minutes were spread evenly across the squad.",
        evidenceRefs: [],
      },
    });

    const result = await getWeeklyTeamReviewAdvisorViewModel({ organisationId: fixtureIds.organisationId, teamId });
    expect(result).toBeNull();
  });

  it("returns null when there is no SUCCEEDED review for this team's previous week", async () => {
    const teamId = fixtureIds.teams["Bla"];
    await enableAi(fixtureIds.organisationId);

    const result = await getWeeklyTeamReviewAdvisorViewModel({ organisationId: fixtureIds.organisationId, teamId });
    expect(result).toBeNull();
  });

  it("returns null when the review has zero ACTIVE insights", async () => {
    const teamId = fixtureIds.teams["Bla"];
    await enableAi(fixtureIds.organisationId);
    const scopeId = buildWeeklyTeamReviewScopeId(teamId, WEEK_KEY);
    const context = await buildWeeklyTeamReviewContext({ organisationId: fixtureIds.organisationId, scopeId });
    const fingerprint = computeSourceFingerprint(context!.normalizedContext);

    const review = await testDb.aiAdvisorReview.create({
      data: {
        organisationId: fixtureIds.organisationId,
        capability: "WEEKLY_TEAM_REVIEW",
        scopeType: "TEAM_WEEK",
        scopeId,
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
        subjectType: "TEAM",
        subjectId: teamId,
        title: "Dismissed",
        body: "No longer relevant.",
        evidenceRefs: [],
        state: "DISMISSED",
      },
    });

    const result = await getWeeklyTeamReviewAdvisorViewModel({ organisationId: fixtureIds.organisationId, teamId });
    expect(result).toBeNull();
  });

  it("returns a stale view model when the underlying weekly facts have changed since the review was generated", async () => {
    const teamId = fixtureIds.teams["Bla"];
    await enableAi(fixtureIds.organisationId);
    const scopeId = buildWeeklyTeamReviewScopeId(teamId, WEEK_KEY);

    const review = await testDb.aiAdvisorReview.create({
      data: {
        organisationId: fixtureIds.organisationId,
        capability: "WEEKLY_TEAM_REVIEW",
        scopeType: "TEAM_WEEK",
        scopeId,
        sourceFingerprint: "stale-fingerprint-does-not-match-current-week",
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
        subjectType: "TEAM",
        subjectId: teamId,
        title: "Steady week",
        body: "Minutes were spread evenly across the squad.",
        evidenceRefs: [],
      },
    });

    const result = await getWeeklyTeamReviewAdvisorViewModel({ organisationId: fixtureIds.organisationId, teamId });
    expect(result).toEqual({ status: "stale" });
  });

  it("returns fresh plain insights, resolving ephemeral refs back to the real team name", async () => {
    const teamId = fixtureIds.teams["Bla"];
    await enableAi(fixtureIds.organisationId);
    const scopeId = buildWeeklyTeamReviewScopeId(teamId, WEEK_KEY);
    const context = await buildWeeklyTeamReviewContext({ organisationId: fixtureIds.organisationId, scopeId });
    expect(context).not.toBeNull();
    const fingerprint = computeSourceFingerprint(context!.normalizedContext);

    const [teamRef] = [...context!.refMap.entries()].find(([, target]) => target.entityId === teamId)!;

    const review = await testDb.aiAdvisorReview.create({
      data: {
        organisationId: fixtureIds.organisationId,
        capability: "WEEKLY_TEAM_REVIEW",
        scopeType: "TEAM_WEEK",
        scopeId,
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
        subjectType: "TEAM",
        subjectId: teamId,
        title: `${teamRef} had a steady week`,
        body: `${teamRef} spread minutes evenly across the available squad.`,
        evidenceRefs: [],
      },
    });

    const result = await getWeeklyTeamReviewAdvisorViewModel({ organisationId: fixtureIds.organisationId, teamId });
    expect(result?.status).toBe("fresh");
    if (result?.status !== "fresh") return;
    expect(result.insights).toHaveLength(1);
    expect(result.insights[0].title).not.toContain(teamRef);
    expect(result.suggestions).toHaveLength(0);
  });

  it("separates a development-suggestion insight, resolving the player's real name into the title", async () => {
    const teamId = fixtureIds.teams["Bla"];
    const [player] = fixtureIds.players.filter((p) => p.coreTeamName === "Bla");
    await enableAi(fixtureIds.organisationId);
    const scopeId = buildWeeklyTeamReviewScopeId(teamId, WEEK_KEY);
    const context = await buildWeeklyTeamReviewContext({ organisationId: fixtureIds.organisationId, scopeId });
    const fingerprint = computeSourceFingerprint(context!.normalizedContext);

    const review = await testDb.aiAdvisorReview.create({
      data: {
        organisationId: fixtureIds.organisationId,
        capability: "WEEKLY_TEAM_REVIEW",
        scopeType: "TEAM_WEEK",
        scopeId,
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
        body: "Showed clearer decision-making in possession this week.",
        evidenceRefs: [],
        actionType: "CONFIRM_DEVELOPMENT_OBSERVATION",
        actionPayload: {
          playerId: player.id,
          category: "decision making",
          observation: "Showed clearer decision-making in possession this week.",
        },
      },
    });

    const result = await getWeeklyTeamReviewAdvisorViewModel({ organisationId: fixtureIds.organisationId, teamId });
    expect(result?.status).toBe("fresh");
    if (result?.status !== "fresh") return;
    expect(result.insights).toHaveLength(0);
    expect(result.suggestions).toHaveLength(1);
    expect(result.suggestions[0].title).toBe(`${player.firstName} ${player.lastName ?? ""}`.trim() + " · decision making");
  });
});
