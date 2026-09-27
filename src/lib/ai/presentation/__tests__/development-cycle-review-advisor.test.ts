import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, seedTestFixture, getTestDb, type TestFixtureIds } from "@/test/test-db";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({
  get db() {
    return getTestDb();
  },
}));

import { getDevelopmentCycleReviewAdvisorViewModel } from "@/lib/ai/presentation/development-cycle-review-advisor";
import {
  buildDevelopmentCycleReviewContext,
  buildDevelopmentCycleScopeId,
} from "@/lib/ai/context/development-cycle-review";
import { computeSourceFingerprint } from "@/lib/ai/fingerprints";
import { generateAiProviderConnectionId } from "@/lib/ai/connection-id";

let testDb: PrismaClient;
let fixtureIds: TestFixtureIds;

// Pinned "now" so the 35-day window always covers the fixture's default match
// (2025-04-28T10:00:00Z), matching the context-builder test's own anchor.
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

function scopeIdFor(teamId: string) {
  return buildDevelopmentCycleScopeId(teamId, new Date(NOW.getTime() - 35 * 24 * 60 * 60 * 1000), NOW);
}

describe("ai/presentation/development-cycle-review-advisor", () => {
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
    await testDb.postMatchReport.deleteMany({});
    await testDb.playerDevelopmentObservation.deleteMany({});
    await testDb.actualPositionInterval.deleteMany({});
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function seedEligibleWindow(teamId: string) {
    // The context builder requires at least one completed match in the window.
    const blaMatchId = fixtureIds.matches["Bla"];
    await testDb.postMatchReport.create({ data: { matchId: blaMatchId, status: "LOCKED", organisationId: fixtureIds.organisationId } });
    return { scopeId: scopeIdFor(teamId) };
  }

  it("returns null when AI or the capability is not enabled for the organisation, even with a SUCCEEDED review present", async () => {
    const teamId = fixtureIds.teams["Bla"];
    const { scopeId } = await seedEligibleWindow(teamId);
    const context = await buildDevelopmentCycleReviewContext({ organisationId: fixtureIds.organisationId, scopeId });
    const fingerprint = computeSourceFingerprint(context!.normalizedContext);

    const review = await testDb.aiAdvisorReview.create({
      data: {
        organisationId: fixtureIds.organisationId,
        capability: "DEVELOPMENT_CYCLE_REVIEW",
        scopeType: "TEAM_WINDOW",
        scopeId,
        sourceFingerprint: fingerprint,
        status: "SUCCEEDED",
        contractVersion: "2",
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
        title: "Pressing is a recurring strength",
        body: "Pressed well together in 4 of the last 5 reports.",
        evidenceRefs: [],
      },
    });

    const result = await getDevelopmentCycleReviewAdvisorViewModel({ organisationId: fixtureIds.organisationId, teamId });
    expect(result).toBeNull();
  });

  it("returns null when there is no SUCCEEDED review for this team", async () => {
    const teamId = fixtureIds.teams["Bla"];
    await enableAi(fixtureIds.organisationId);
    await seedEligibleWindow(teamId);

    const result = await getDevelopmentCycleReviewAdvisorViewModel({ organisationId: fixtureIds.organisationId, teamId });
    expect(result).toBeNull();
  });

  it("returns fresh insights with the date range, resolving ephemeral refs to real names", async () => {
    const teamId = fixtureIds.teams["Bla"];
    await enableAi(fixtureIds.organisationId);
    const { scopeId } = await seedEligibleWindow(teamId);
    const context = await buildDevelopmentCycleReviewContext({ organisationId: fixtureIds.organisationId, scopeId });
    const fingerprint = computeSourceFingerprint(context!.normalizedContext);
    const [teamRef] = [...context!.refMap.entries()].find(([, target]) => target.entityId === teamId)!;

    const review = await testDb.aiAdvisorReview.create({
      data: {
        organisationId: fixtureIds.organisationId,
        capability: "DEVELOPMENT_CYCLE_REVIEW",
        scopeType: "TEAM_WINDOW",
        scopeId,
        sourceFingerprint: fingerprint,
        status: "SUCCEEDED",
        contractVersion: "2",
        terminologyVersion: "1",
        completedAt: new Date(),
        summary: "The team's pressing has been consistent across the cycle.",
      },
    });
    await testDb.aiAdvisorInsight.create({
      data: {
        organisationId: fixtureIds.organisationId,
        reviewId: review.id,
        kind: "OBSERVATION",
        subjectType: "TEAM",
        subjectId: teamId,
        title: "Pressing is a recurring strength",
        body: `${teamRef} pressed well together in 4 of the last 5 reports.`,
        evidenceRefs: [],
        analysisRole: "RECURRING_PATTERN",
      },
    });

    const result = await getDevelopmentCycleReviewAdvisorViewModel({ organisationId: fixtureIds.organisationId, teamId });
    expect(result?.status).toBe("fresh");
    if (result?.status !== "fresh") return;
    expect(result.windowLabel).toBe("Learning cycle · 31 Mar – 5 May 2025");
    expect(result.summary).toBe("The team's pressing has been consistent across the cycle.");
    expect(result.insights).toHaveLength(1);
    expect(result.insights[0].body).not.toContain(teamRef);
  });

  it("shows the latest SUCCEEDED review even when a newer review exists for a different window (immutable history)", async () => {
    const teamId = fixtureIds.teams["Bla"];
    await enableAi(fixtureIds.organisationId);
    await seedEligibleWindow(teamId);
    const scopeId = scopeIdFor(teamId);

    // An older cycle review (earlier window) — still SUCCEEDED history.
    const olderScopeId = buildDevelopmentCycleScopeId(
      teamId,
      new Date(NOW.getTime() - 70 * 24 * 60 * 60 * 1000),
      new Date(NOW.getTime() - 35 * 24 * 60 * 60 * 1000),
    );
    await testDb.aiAdvisorReview.create({
      data: {
        organisationId: fixtureIds.organisationId,
        capability: "DEVELOPMENT_CYCLE_REVIEW",
        scopeType: "TEAM_WINDOW",
        scopeId: olderScopeId,
        sourceFingerprint: "fp-old-cycle",
        status: "SUCCEEDED",
        contractVersion: "2",
        terminologyVersion: "1",
        completedAt: new Date(NOW.getTime() - 34 * 24 * 60 * 60 * 1000),
        summary: "Older cycle summary.",
      },
    });

    const context = await buildDevelopmentCycleReviewContext({ organisationId: fixtureIds.organisationId, scopeId });
    const fingerprint = computeSourceFingerprint(context!.normalizedContext);

    const latestReview = await testDb.aiAdvisorReview.create({
      data: {
        organisationId: fixtureIds.organisationId,
        capability: "DEVELOPMENT_CYCLE_REVIEW",
        scopeType: "TEAM_WINDOW",
        scopeId,
        sourceFingerprint: fingerprint,
        status: "SUCCEEDED",
        contractVersion: "2",
        terminologyVersion: "1",
        completedAt: new Date(NOW),
        summary: "Latest cycle summary.",
      },
    });
    await testDb.aiAdvisorInsight.create({
      data: {
        organisationId: fixtureIds.organisationId,
        reviewId: latestReview.id,
        kind: "OBSERVATION",
        subjectType: "TEAM",
        subjectId: teamId,
        title: "Next focus",
        body: "Defensive transition: recover centrally before engaging.",
        evidenceRefs: [],
        analysisRole: "NEXT_FOCUS",
      },
    });

    const result = await getDevelopmentCycleReviewAdvisorViewModel({ organisationId: fixtureIds.organisationId, teamId });
    expect(result?.status).toBe("fresh");
    if (result?.status !== "fresh") return;
    expect(result.summary).toBe("Latest cycle summary.");
  });
});