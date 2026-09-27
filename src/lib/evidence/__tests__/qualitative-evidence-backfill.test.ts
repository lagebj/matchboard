import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, seedTestFixture, getTestDb, type TestFixtureIds } from "@/test/test-db";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({
  get db() {
    return getTestDb();
  },
}));

// The real capability handlers need real contexts; the backfill test cares only that the right
// trigger was *called* with the right scope, so a permissive fake handler stands in for every
// capability (the same convention scheduled-triggers.test.ts established).
vi.mock("@/lib/ai/register-capabilities", () => ({}));

import { runAiBackfill } from "@/lib/evidence/qualitative-evidence-backfill";
import { registerAiCapabilityHandler, resetAiCapabilityHandlers } from "@/lib/ai/jobs/capability-handler";

let testDb: PrismaClient;
let fixtureIds: TestFixtureIds;

const NOW = new Date("2025-05-05T10:00:00Z");

afterAll(async () => {
  await teardownTestDb();
});

beforeAll(async () => {
  testDb = await setupTestDb();
  fixtureIds = await seedTestFixture(testDb, { playersPerTeam: 4 });
});

const fakeContext = {
  normalizedContext: { ok: true },
  instructions: "x",
  refMap: new Map(),
  evidenceRefs: new Set<string>(),
};

describe("evidence/qualitative-evidence-backfill", () => {
  let organisationId: string;
  let teamId: string;

  beforeEach(async () => {
    resetAiCapabilityHandlers();
    for (const capability of ["POST_MATCH_REVIEW", "WEEKLY_TEAM_REVIEW", "DEVELOPMENT_CYCLE_REVIEW"] as const) {
      registerAiCapabilityHandler({ capability, buildContext: async () => fakeContext });
    }

    organisationId = fixtureIds.organisationId;
    teamId = fixtureIds.teams["Bla"];

    vi.useFakeTimers();
    vi.setSystemTime(NOW);

    await testDb.organisationAiSettings.deleteMany({ where: { organisationId } });
    await testDb.qualitativeEvidenceObservation.deleteMany({ where: { organisationId } });
    await testDb.qualitativeEvidenceExtractionRun.deleteMany({ where: { organisationId } });
    await testDb.aiAdvisorReview.deleteMany({ where: { organisationId } });
    await testDb.aiAdvisorJob.deleteMany({ where: { organisationId } });
    await testDb.teamReflection.deleteMany({ where: { organisationId } });
    await testDb.opponentEncounterObservation.deleteMany({ where: { organisationId } });
    await testDb.quickObservation.deleteMany({ where: { organisationId } });
    await testDb.postMatchReport.deleteMany({ where: { organisationId } });
    await testDb.match.updateMany({ where: { organisationId }, data: { notes: null } });
  });

  afterEach(() => {
    vi.useRealTimers();
    resetAiCapabilityHandlers();
  });

  it("does not enqueue anything when AI is disabled", async () => {
    await testDb.organisationAiSettings.create({ data: { organisationId, enabled: false } });

    const report = await runAiBackfillForTest();
    expect(report.aiDisabled).toBe(true);
    expect(report.extraction).toEqual([]);
    expect(report.advisor.matchReviewsEnqueued).toBe(0);
    const runs = await testDb.qualitativeEvidenceExtractionRun.findMany({ where: { organisationId } });
    expect(runs).toHaveLength(0);
  });

  it("enqueues legacy extraction sources within the window and marks reruns already-tracked", async () => {
    await enableAiWithConnection(organisationId);
    await seedLockedMatchWithLegacyText({
      teamNote: "We struggled to play out from the back under their press.",
      matchNote: "Wind made long passes unreliable.",
      teamReflectionNote: "Second half effort was much better.",
      opponentText: "Their first line pressed high on goal kicks.",
      quickNote: "Took the extra corner quickly.",
    });

    const first = await runAiBackfillForTest();
    expect(first.aiDisabled).toBe(false);

    const teamNoteSummary = first.extraction.find((s) => s.sourceType === "POST_MATCH_TEAM_NOTE");
    expect(teamNoteSummary).toMatchObject({ considered: 1, enqueued: 1, alreadyTracked: 0 });
    const matchNoteSummary = first.extraction.find((s) => s.sourceType === "MATCH_NOTE");
    expect(matchNoteSummary).toMatchObject({ enqueued: 1 });
    const reflectionSummary = first.extraction.find((s) => s.sourceType === "TEAM_REFLECTION_NOTE");
    expect(reflectionSummary).toMatchObject({ enqueued: 1 });
    const opponentSummary = first.extraction.find((s) => s.sourceType === "OPPONENT_ENCOUNTER_TEXT");
    expect(opponentSummary).toMatchObject({ enqueued: 1 });
    const quickSummary = first.extraction.find((s) => s.sourceType === "QUICK_OBSERVATION");
    expect(quickSummary).toMatchObject({ enqueued: 1 });

    // Rerun is a no-op: every source's fingerprint is already tracked.
    const second = await runAiBackfillForTest();
    expect(second.extraction.find((s) => s.sourceType === "POST_MATCH_TEAM_NOTE")).toMatchObject({ considered: 1, enqueued: 0, alreadyTracked: 1 });
    const runs = await testDb.qualitativeEvidenceExtractionRun.findMany({ where: { organisationId, sourceType: "POST_MATCH_TEAM_NOTE" } });
    expect(runs).toHaveLength(1);
  });

  it("respects the max-sources budget across all source types", async () => {
    await enableAiWithConnection(organisationId);
    await seedLockedMatchWithLegacyText({ teamNote: "Note one.", matchNote: "Note two.", teamReflectionNote: "Note three." });

    const report = await runAiBackfillForTest({ maxSources: 2 });
    const totalEnqueued = report.extraction.reduce((n, s) => n + s.enqueued, 0);
    expect(totalEnqueued).toBe(2);
    const outOfBudget = report.extraction.reduce((n, s) => n + s.outOfBudget, 0);
    expect(outOfBudget).toBe(1);
  });

  it("excludes sources outside the window", async () => {
    await enableAiWithConnection(organisationId);
    const inWindow = await createMatchAt(new Date("2025-04-20T10:00:00Z"));
    await testDb.postMatchReport.create({ data: { organisationId, matchId: inWindow.id, status: "LOCKED", teamNote: "In window." } });
    const outside = await createMatchAt(new Date("2024-01-10T10:00:00Z"));
    await testDb.postMatchReport.create({ data: { organisationId, matchId: outside.id, status: "LOCKED", teamNote: "Outside window." } });

    const report = await runAiBackfillForTest();
    expect(report.extraction.find((s) => s.sourceType === "POST_MATCH_TEAM_NOTE")).toMatchObject({ considered: 1, enqueued: 1 });
  });

  it("runs the advisor family: post-match, weekly, and cycle triggers for eligible scopes", async () => {
    await enableAiWithConnection(organisationId);
    const seeded = await seedLockedMatchWithLegacyText({});

    const report = await runAiBackfillForTest();
    expect(report.advisor.lockedMatchesConsidered).toBe(1);

    // The real triggerAiCapability ran (fake handlers, real fingerprint/enqueue machinery): the
    // enqueued job rows prove each capability was actually triggered with the right scopes.
    const jobs = await testDb.aiAdvisorJob.findMany({ where: { organisationId } });
    const postMatch = jobs.filter((j) => j.capability === "POST_MATCH_REVIEW");
    expect(postMatch.map((j) => j.scopeId)).toContain(seeded.id);
    const weekly = jobs.filter((j) => j.capability === "WEEKLY_TEAM_REVIEW");
    expect(weekly.length).toBeGreaterThanOrEqual(1);
    expect(report.advisor.weeksConsidered).toBeGreaterThanOrEqual(1);
    // Cycle: one locked match in window < the >=3 gate, so nothing enqueued but scanned.
    expect(report.advisor.developmentCycleScanned).toBeGreaterThanOrEqual(1);
    expect(report.advisor.developmentCycleEnqueued).toBe(0);
  });

  it("respects the team filter", async () => {
    await enableAiWithConnection(organisationId);
    await seedLockedMatchWithLegacyText({ teamNote: "Team-scoped note." });

    const report = await runAiBackfillForTest({ teamId: teamId });
    expect(report.extraction.find((s) => s.sourceType === "POST_MATCH_TEAM_NOTE")).toMatchObject({ considered: 1 });
    const otherTeamReport = await runAiBackfillForTest({ teamId: "does-not-exist" });
    expect(otherTeamReport.extraction.find((s) => s.sourceType === "POST_MATCH_TEAM_NOTE")).toMatchObject({ considered: 0 });
  });
});

async function runAiBackfillForTest(options?: Parameters<typeof runAiBackfill>[1]) {
  return runAiBackfill(fixtureIds.organisationId, options);
}

async function enableAiWithConnection(organisationId: string) {
  const { generateAiProviderConnectionId } = await import("@/lib/ai/connection-id");
  const connectionId = generateAiProviderConnectionId();
  await testDb.aiProviderConnection.create({ data: { id: connectionId, organisationId, provider: "OPENAI", status: "READY", model: "gpt-5" } });
  await testDb.organisationAiSettings.create({
    data: {
      organisationId,
      enabled: true,
      activeConnectionId: connectionId,
      postMatchReviewEnabled: true,
      weeklyTeamReviewEnabled: true,
      developmentCycleReviewEnabled: true,
    },
  });
}

async function createMatchAt(startsAt: Date) {
  return testDb.match.create({
    data: {
      matchRoundId: fixtureIds.matchRoundId,
      teamId: fixtureIds.teams["Bla"],
      opponent: "Backfill Opponent",
      startsAt,
      homeAway: "HOME",
      status: "SCHEDULED",
      organisationId: fixtureIds.organisationId,
    },
  });
}

async function seedLockedMatchWithLegacyText(params: {
  teamNote?: string;
  matchNote?: string;
  teamReflectionNote?: string;
  opponentText?: string;
  quickNote?: string;
}) {
  const match = await createMatchAt(new Date("2025-04-28T10:00:00Z"));
  if (params.matchNote) await testDb.match.update({ where: { id: match.id }, data: { notes: params.matchNote } });
  await testDb.postMatchReport.create({ data: { organisationId: fixtureIds.organisationId, matchId: match.id, status: "LOCKED", teamNote: params.teamNote ?? null } });
  if (params.teamReflectionNote) {
    await testDb.teamReflection.create({
      data: { organisationId: fixtureIds.organisationId, matchId: match.id, note: params.teamReflectionNote },
    });
  }
  if (params.opponentText) {
    const opponentTeam = await testDb.opponentTeam.findFirstOrThrow({ where: { organisationId: fixtureIds.organisationId } });
    await testDb.opponentEncounterObservation.create({
      data: { organisationId: fixtureIds.organisationId, matchId: match.id, opponentTeamId: opponentTeam.id, factualSummary: params.opponentText },
    });
  }
  if (params.quickNote) {
    await testDb.quickObservation.create({
      data: { organisationId: fixtureIds.organisationId, matchId: match.id, note: params.quickNote },
    });
  }
  return match;
}