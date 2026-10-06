import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, seedTestFixture, getTestDb, type TestFixtureIds } from "@/test/test-db";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({
  get db() {
    return getTestDb();
  },
}));

import { getPlayerAssistantCoachHypotheses } from "@/lib/ai/presentation/player-assistant-coach-hypotheses";
import { generateAiProviderConnectionId } from "@/lib/ai/connection-id";

let testDb: PrismaClient;
let fixtureIds: TestFixtureIds;

async function enableAssistantCoach(organisationId: string) {
  const connectionId = generateAiProviderConnectionId();
  await testDb.aiProviderConnection.create({
    data: { id: connectionId, organisationId, provider: "OPENAI", status: "READY", model: "gpt-5" },
  });
  await testDb.organisationAiSettings.create({
    data: { organisationId, enabled: true, activeConnectionId: connectionId, assistantCoachEnabled: true },
  });
}

async function createRun(playerId: string, status: "SUCCEEDED" | "SUPERSEDED" = "SUCCEEDED") {
  return testDb.assistantCoachRun.create({
    data: {
      organisationId: fixtureIds.organisationId,
      playerId,
      sourceFingerprint: `fp-${Math.random()}`,
      status,
      completedAt: new Date(),
    },
  });
}

describe("ai/presentation/player-assistant-coach-hypotheses (ADR-0155 B7 / ADR-0157 C5)", () => {
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixtureIds = await seedTestFixture(testDb, { playersPerTeam: 2 });
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await testDb.assistantCoachHypothesis.deleteMany({});
    await testDb.assistantCoachRun.deleteMany({});
    await testDb.organisationAiSettings.deleteMany({});
    await testDb.aiProviderConnection.deleteMany({});
  });

  it("returns [] when Assistant Coach is disabled for the organisation — Development/Evidence stay useful with AI off", async () => {
    const playerId = fixtureIds.players[0]!.id;
    const run = await createRun(playerId);
    await testDb.assistantCoachHypothesis.create({
      data: {
        organisationId: fixtureIds.organisationId,
        runId: run.id,
        statement: "This player may be developing into a left-sided role.",
        uncertainty: "MEDIUM",
        supportingRefs: [],
        contradictingRefs: [],
        missingEvidence: [],
        state: "ACTIVE",
      },
    });

    const result = await getPlayerAssistantCoachHypotheses(fixtureIds.organisationId, playerId);
    expect(result).toEqual([]);
  });

  it("returns only ACTIVE hypotheses from the current SUCCEEDED run, in displayOrder", async () => {
    const playerId = fixtureIds.players[0]!.id;
    await enableAssistantCoach(fixtureIds.organisationId);
    const run = await createRun(playerId);
    await testDb.assistantCoachHypothesis.create({
      data: {
        organisationId: fixtureIds.organisationId,
        runId: run.id,
        statement: "Second hypothesis.",
        uncertainty: "LOW",
        supportingRefs: [{ kind: "DERIVED_TREND", id: "t1" }],
        contradictingRefs: [],
        missingEvidence: [],
        displayOrder: 1,
        state: "ACTIVE",
      },
    });
    await testDb.assistantCoachHypothesis.create({
      data: {
        organisationId: fixtureIds.organisationId,
        runId: run.id,
        statement: "First hypothesis.",
        uncertainty: "HIGH",
        supportingRefs: [],
        contradictingRefs: [{ kind: "QUALITATIVE_OBSERVATION", id: "o1" }],
        missingEvidence: ["More recorded minutes at this position."],
        displayOrder: 0,
        state: "ACTIVE",
      },
    });
    // A dismissed hypothesis from the same run must never reappear as a current hypothesis.
    await testDb.assistantCoachHypothesis.create({
      data: {
        organisationId: fixtureIds.organisationId,
        runId: run.id,
        statement: "Dismissed hypothesis.",
        uncertainty: "LOW",
        supportingRefs: [],
        contradictingRefs: [],
        missingEvidence: [],
        displayOrder: 2,
        state: "DISMISSED",
      },
    });

    const result = await getPlayerAssistantCoachHypotheses(fixtureIds.organisationId, playerId);
    expect(result).toHaveLength(2);
    expect(result[0]!.statement).toBe("First hypothesis.");
    expect(result[1]!.statement).toBe("Second hypothesis.");
    expect(result[0]!.missingEvidence).toEqual(["More recorded minutes at this position."]);
    expect(result[1]!.supportingRefs).toEqual([{ kind: "DERIVED_TREND", id: "t1" }]);
  });

  it("never returns hypotheses from a SUPERSEDED (stale) run, even if their own state is still ACTIVE", async () => {
    const playerId = fixtureIds.players[1]!.id;
    await enableAssistantCoach(fixtureIds.organisationId);
    const staleRun = await createRun(playerId, "SUPERSEDED");
    await testDb.assistantCoachHypothesis.create({
      data: {
        organisationId: fixtureIds.organisationId,
        runId: staleRun.id,
        statement: "Stale hypothesis from a superseded run.",
        uncertainty: "MEDIUM",
        supportingRefs: [],
        contradictingRefs: [],
        missingEvidence: [],
        state: "ACTIVE",
      },
    });

    const result = await getPlayerAssistantCoachHypotheses(fixtureIds.organisationId, playerId);
    expect(result).toEqual([]);
  });
});
