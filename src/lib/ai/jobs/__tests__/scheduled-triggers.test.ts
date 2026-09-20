import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";

vi.mock("server-only", () => ({}));

import { setupTestDb, teardownTestDb } from "@/test/test-db";

let testDb: PrismaClient;

vi.mock("@/lib/db", () => ({
  get db() {
    return testDb;
  },
}));

// register-capabilities.ts imports the real context/*.ts modules for their registration side
// effect -- irrelevant to this discovery-scan test and heavier than needed; a fake MATCH_PREP
// handler is registered per test instead, matching triggers.test.ts's own convention.
vi.mock("@/lib/ai/register-capabilities", () => ({}));

import { enqueueDueMatchPrepJobs } from "@/lib/ai/jobs/scheduled-triggers";
import { registerAiCapabilityHandler, resetAiCapabilityHandlers, type AiCapabilityHandler } from "@/lib/ai/jobs/capability-handler";

beforeAll(async () => {
  testDb = await setupTestDb();
});

afterAll(async () => {
  await teardownTestDb();
});

afterEach(() => {
  resetAiCapabilityHandlers();
});

const fakeContext = {
  normalizedContext: { players: [{ ref: "P01" }] },
  instructions: "x",
  refMap: new Map([["P01", { subjectType: "PLAYER" as const, entityId: "real-player-id" }]]),
  evidenceRefs: new Set(["fact:x:P01"]),
};

function fakeMatchPrepHandler(buildContext: AiCapabilityHandler["buildContext"]): AiCapabilityHandler {
  return { capability: "MATCH_PREP", buildContext };
}

async function seedOrgWithMatch(params: { startsAt: Date; status?: "SCHEDULED" | "CANCELLED" }) {
  const org = await testDb.organisation.create({ data: { name: "Org", slug: `org-${Date.now()}-${Math.random()}` } });
  await testDb.organisationAiSettings.create({ data: { organisationId: org.id, enabled: true, matchPrepEnabled: true } });
  const group = await testDb.footballGroup.create({ data: { name: "Group", slug: `group-${Date.now()}-${Math.random()}`, type: "AGE_GROUP", organisationId: org.id } });
  const season = await testDb.season.create({ data: { name: "Season", year: 2026, organisationId: org.id } });
  const period = await testDb.leagueSeason.create({
    data: { name: "Period", part: "SPRING", seasonId: season.id, startDate: new Date("2025-01-01"), endDate: new Date("2025-12-31"), organisationId: org.id, footballGroupId: group.id },
  });
  const round = await testDb.matchRound.create({ data: { name: "Round", leagueSeasonId: period.id, status: "DRAFT", organisationId: org.id } });
  const team = await testDb.team.create({ data: { name: `Team-${org.id}`, organisationId: org.id, footballGroupId: group.id } });
  const match = await testDb.match.create({
    data: {
      matchRoundId: round.id,
      teamId: team.id,
      opponent: "Opponent",
      startsAt: params.startsAt,
      homeAway: "HOME",
      status: params.status ?? "SCHEDULED",
      organisationId: org.id,
    },
  });
  return { organisationId: org.id, matchId: match.id };
}

describe("ai/jobs/scheduled-triggers: enqueueDueMatchPrepJobs", () => {
  it("enqueues match_prep for a fixture within the 24h-to-kickoff window", async () => {
    registerAiCapabilityHandler(fakeMatchPrepHandler(async () => fakeContext));
    const { organisationId, matchId } = await seedOrgWithMatch({ startsAt: new Date(Date.now() + 12 * 60 * 60 * 1000) });

    const result = await enqueueDueMatchPrepJobs();
    expect(result.scanned).toBeGreaterThanOrEqual(1);

    const jobs = await testDb.aiAdvisorJob.findMany({ where: { organisationId, capability: "MATCH_PREP", scopeId: matchId } });
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ scopeType: "MATCH", status: "QUEUED" });
  });

  it("does not enqueue for a fixture more than 24h away", async () => {
    registerAiCapabilityHandler(fakeMatchPrepHandler(async () => fakeContext));
    const { organisationId, matchId } = await seedOrgWithMatch({ startsAt: new Date(Date.now() + 48 * 60 * 60 * 1000) });

    await enqueueDueMatchPrepJobs();

    const jobs = await testDb.aiAdvisorJob.findMany({ where: { organisationId, capability: "MATCH_PREP", scopeId: matchId } });
    expect(jobs).toHaveLength(0);
  });

  it("does not enqueue for a fixture already in the past", async () => {
    registerAiCapabilityHandler(fakeMatchPrepHandler(async () => fakeContext));
    const { organisationId, matchId } = await seedOrgWithMatch({ startsAt: new Date(Date.now() - 60 * 60 * 1000) });

    await enqueueDueMatchPrepJobs();

    const jobs = await testDb.aiAdvisorJob.findMany({ where: { organisationId, capability: "MATCH_PREP", scopeId: matchId } });
    expect(jobs).toHaveLength(0);
  });

  it("does not enqueue for a cancelled fixture within the window", async () => {
    registerAiCapabilityHandler(fakeMatchPrepHandler(async () => fakeContext));
    const { organisationId, matchId } = await seedOrgWithMatch({ startsAt: new Date(Date.now() + 12 * 60 * 60 * 1000), status: "CANCELLED" });

    await enqueueDueMatchPrepJobs();

    const jobs = await testDb.aiAdvisorJob.findMany({ where: { organisationId, capability: "MATCH_PREP", scopeId: matchId } });
    expect(jobs).toHaveLength(0);
  });

  it("never throws even when the handler itself throws for one match among several", async () => {
    registerAiCapabilityHandler(
      fakeMatchPrepHandler(async () => {
        throw new Error("boom");
      }),
    );
    const { organisationId, matchId } = await seedOrgWithMatch({ startsAt: new Date(Date.now() + 12 * 60 * 60 * 1000) });

    await expect(enqueueDueMatchPrepJobs()).resolves.toMatchObject({ scanned: expect.any(Number) });

    const jobs = await testDb.aiAdvisorJob.findMany({ where: { organisationId, capability: "MATCH_PREP", scopeId: matchId } });
    expect(jobs).toHaveLength(0);
  });
});
