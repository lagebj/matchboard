import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb } from "@/test/test-db";

vi.mock("server-only", () => ({}));

let testDb: PrismaClient;

vi.mock("@/lib/db", () => ({
  get db() {
    return testDb;
  },
}));

vi.mock("@/lib/ai/register-capabilities", () => ({}));

import { enqueueDueDevelopmentCycleReviewJobs } from "@/lib/ai/jobs/scheduled-triggers";
import { registerAiCapabilityHandler, resetAiCapabilityHandlers, type AiCapabilityHandler } from "@/lib/ai/jobs/capability-handler";
import { buildDevelopmentCycleScopeId } from "@/lib/ai/context/development-cycle-review";

beforeAll(async () => {
  testDb = await setupTestDb();
});

afterAll(async () => {
  await teardownTestDb();
});

afterEach(async () => {
  resetAiCapabilityHandlers();
  vi.useRealTimers();
});

const fakeContext = {
  normalizedContext: { players: [{ ref: "P01" }] },
  instructions: "x",
  refMap: new Map([["P01", { subjectType: "PLAYER" as const, entityId: "real-player-id" }]]),
  evidenceRefs: new Set(["fact:x:P01"]),
};

function fakeDevelopmentCycleHandler(buildContext: AiCapabilityHandler["buildContext"]): AiCapabilityHandler {
  return { capability: "DEVELOPMENT_CYCLE_REVIEW", buildContext };
}

const NOW = new Date("2025-05-05T10:00:00Z");

type SeededOrg = {
  organisationId: string;
  teamId: string;
  matchRoundId: string;
};

async function seedOrgWithTeam(): Promise<SeededOrg> {
  const org = await testDb.organisation.create({ data: { name: "Org", slug: `org-${Date.now()}-${Math.random()}` } });
  await testDb.organisationAiSettings.create({ data: { organisationId: org.id, enabled: true, developmentCycleReviewEnabled: true } });
  const group = await testDb.footballGroup.create({ data: { name: "Group", slug: `group-${Date.now()}-${Math.random()}`, type: "AGE_GROUP", organisationId: org.id } });
  const season = await testDb.season.create({ data: { name: "Season", year: 2025, organisationId: org.id } });
  const period = await testDb.leagueSeason.create({
    data: { name: "Period", part: "SPRING", seasonId: season.id, startDate: new Date("2025-01-01"), endDate: new Date("2025-12-31"), organisationId: org.id, footballGroupId: group.id },
  });
  const round = await testDb.matchRound.create({ data: { name: "Round", leagueSeasonId: period.id, status: "DRAFT", organisationId: org.id } });
  const team = await testDb.team.create({ data: { name: `Team-${org.id}`, organisationId: org.id, footballGroupId: group.id } });
  return { organisationId: org.id, teamId: team.id, matchRoundId: round.id };
}

async function seedCompletedMatch(seed: SeededOrg, startsAt: Date) {
  const match = await testDb.match.create({
    data: {
      matchRoundId: seed.matchRoundId,
      teamId: seed.teamId,
      opponent: "Opponent",
      startsAt,
      homeAway: "HOME",
      status: "SCHEDULED",
      organisationId: seed.organisationId,
    },
  });
  await testDb.postMatchReport.create({ data: { matchId: match.id, status: "LOCKED", organisationId: seed.organisationId } });
  return match;
}

/** Bundle §9: ">=35 days since previous successful cycle ending before current date". A previous
 * SUCCEEDED review whose window ended >=35 days ago (or no previous review at all) makes the team
 * eligible; one that ended more recently makes it ineligible. */
async function seedPreviousCycleReview(seed: SeededOrg, windowEnd: Date) {
  const windowStart = new Date(windowEnd.getTime() - 35 * 24 * 60 * 60 * 1000);
  return testDb.aiAdvisorReview.create({
    data: {
      organisationId: seed.organisationId,
      capability: "DEVELOPMENT_CYCLE_REVIEW",
      scopeType: "TEAM_WINDOW",
      scopeId: buildDevelopmentCycleScopeId(seed.teamId, windowStart, windowEnd),
      sourceFingerprint: "fp-previous-cycle",
      status: "SUCCEEDED",
      contractVersion: "2",
      terminologyVersion: "1",
      completedAt: windowEnd,
    },
  });
}

describe("ai/jobs/scheduled-triggers: enqueueDueDevelopmentCycleReviewJobs", () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    await testDb.organisation.deleteMany({});
    await testDb.footballGroup.deleteMany({});
    await testDb.season.deleteMany({});
    await testDb.leagueSeason.deleteMany({});
    await testDb.matchRound.deleteMany({});
    await testDb.team.deleteMany({});
    await testDb.match.deleteMany({});
    await testDb.postMatchReport.deleteMany({});
    await testDb.aiAdvisorReview.deleteMany({});
    await testDb.aiAdvisorJob.deleteMany({});
    await testDb.organisationAiSettings.deleteMany({});
  });

  it("enqueues a cycle review when no previous cycle exists and >=3 matches completed since", async () => {
    registerAiCapabilityHandler(fakeDevelopmentCycleHandler(async () => fakeContext));
    const seed = await seedOrgWithTeam();
    await seedCompletedMatch(seed, new Date("2025-04-12T10:00:00Z"));
    await seedCompletedMatch(seed, new Date("2025-04-19T10:00:00Z"));
    await seedCompletedMatch(seed, new Date("2025-04-28T10:00:00Z"));

    const result = await enqueueDueDevelopmentCycleReviewJobs();
    expect(result.scanned).toBeGreaterThanOrEqual(1);

    const jobs = await testDb.aiAdvisorJob.findMany({ where: { organisationId: seed.organisationId, capability: "DEVELOPMENT_CYCLE_REVIEW" } });
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ scopeType: "TEAM_WINDOW", status: "QUEUED" });
    expect(jobs[0].scopeId.startsWith(`${seed.teamId}:`)).toBe(true);
  });

  it("does not enqueue when fewer than three matches completed since the previous cycle", async () => {
    registerAiCapabilityHandler(fakeDevelopmentCycleHandler(async () => fakeContext));
    const seed = await seedOrgWithTeam();
    // Previous cycle window ended 40 days before NOW -> >=35 days elapsed.
    await seedPreviousCycleReview(seed, new Date("2025-03-26T10:00:00Z"));
    // Only two completed matches since.
    await seedCompletedMatch(seed, new Date("2025-04-12T10:00:00Z"));
    await seedCompletedMatch(seed, new Date("2025-04-19T10:00:00Z"));

    await enqueueDueDevelopmentCycleReviewJobs();

    const jobs = await testDb.aiAdvisorJob.findMany({ where: { organisationId: seed.organisationId, capability: "DEVELOPMENT_CYCLE_REVIEW" } });
    expect(jobs).toHaveLength(0);
  });

  it("does not enqueue when the previous successful cycle ended less than 35 days ago", async () => {
    registerAiCapabilityHandler(fakeDevelopmentCycleHandler(async () => fakeContext));
    const seed = await seedOrgWithTeam();
    // Previous cycle window ended only 10 days before NOW -> <35 days elapsed.
    await seedPreviousCycleReview(seed, new Date("2025-04-25T10:00:00Z"));
    await seedCompletedMatch(seed, new Date("2025-04-26T10:00:00Z"));
    await seedCompletedMatch(seed, new Date("2025-04-27T10:00:00Z"));
    await seedCompletedMatch(seed, new Date("2025-04-28T10:00:00Z"));

    await enqueueDueDevelopmentCycleReviewJobs();

    const jobs = await testDb.aiAdvisorJob.findMany({ where: { organisationId: seed.organisationId, capability: "DEVELOPMENT_CYCLE_REVIEW" } });
    expect(jobs).toHaveLength(0);
  });

  it("does not enqueue when the capability is disabled even with full eligibility", async () => {
    registerAiCapabilityHandler(fakeDevelopmentCycleHandler(async () => fakeContext));
    const seed = await seedOrgWithTeam();
    await testDb.organisationAiSettings.update({ where: { organisationId: seed.organisationId }, data: { developmentCycleReviewEnabled: false } });
    await seedCompletedMatch(seed, new Date("2025-04-12T10:00:00Z"));
    await seedCompletedMatch(seed, new Date("2025-04-19T10:00:00Z"));
    await seedCompletedMatch(seed, new Date("2025-04-28T10:00:00Z"));

    await enqueueDueDevelopmentCycleReviewJobs();

    const jobs = await testDb.aiAdvisorJob.findMany({ where: { organisationId: seed.organisationId, capability: "DEVELOPMENT_CYCLE_REVIEW" } });
    expect(jobs).toHaveLength(0);
  });

  it("does not enqueue when the handler reports the scope is not eligible", async () => {
    registerAiCapabilityHandler(fakeDevelopmentCycleHandler(async () => null));
    const seed = await seedOrgWithTeam();
    await seedCompletedMatch(seed, new Date("2025-04-12T10:00:00Z"));
    await seedCompletedMatch(seed, new Date("2025-04-19T10:00:00Z"));
    await seedCompletedMatch(seed, new Date("2025-04-28T10:00:00Z"));

    await enqueueDueDevelopmentCycleReviewJobs();

    const jobs = await testDb.aiAdvisorJob.findMany({ where: { organisationId: seed.organisationId, capability: "DEVELOPMENT_CYCLE_REVIEW" } });
    expect(jobs).toHaveLength(0);
  });

  it("never throws even when the handler itself throws for one team among several", async () => {
    registerAiCapabilityHandler(
      fakeDevelopmentCycleHandler(async () => {
        throw new Error("boom");
      }),
    );
    const seed = await seedOrgWithTeam();
    await seedCompletedMatch(seed, new Date("2025-04-12T10:00:00Z"));
    await seedCompletedMatch(seed, new Date("2025-04-19T10:00:00Z"));
    await seedCompletedMatch(seed, new Date("2025-04-28T10:00:00Z"));

    await expect(enqueueDueDevelopmentCycleReviewJobs()).resolves.toMatchObject({ scanned: expect.any(Number) });

    const jobs = await testDb.aiAdvisorJob.findMany({ where: { organisationId: seed.organisationId, capability: "DEVELOPMENT_CYCLE_REVIEW" } });
    expect(jobs).toHaveLength(0);
  });
});