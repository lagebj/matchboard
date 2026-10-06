import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, cleanTestDb } from "@/test/test-db";
import { mockAuthContext } from "@/test/support/auth-mock";
import { createTestOrganisation, createTestGroup, createTestTeam, createTestPlayer } from "@/test/support/factories";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

let testDb: PrismaClient;

vi.mock("@/lib/db", () => ({
  get db() {
    return testDb;
  },
}));

const auth = mockAuthContext({ role: "COACH" });

import { confirmAssistantCoachHypothesisAction, dismissAssistantCoachHypothesisAction } from "../assistant-coach-actions";

/**
 * ADR-0155 step B7: explicit coach promotion of a hypothesis into a real development-thread
 * observation, and dismissal. Covers bundle §07's "Persistence" rules directly: promotion
 * creates a new assessment, preserves provenance, and never changes an earlier promotion.
 */
describe("assistant-coach-actions (explicit coach promotion/dismissal)", () => {
  let organisationId: string;
  let playerId: string;

  beforeAll(async () => {
    testDb = await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await cleanTestDb(testDb);

    const org = await createTestOrganisation(testDb);
    organisationId = org.id;
    const group = await createTestGroup(testDb, organisationId);
    const team = await createTestTeam(testDb, organisationId, group.id);
    const player = await createTestPlayer(testDb, organisationId, team.id, { firstName: "Ada", lastName: "One" });
    playerId = player.id;

    auth.mockRequireActorContext.mockResolvedValue({
      userId: "test-user-id",
      email: "coach@example.com",
      membershipId: "test-membership-id",
      organisationId,
      organisationSlug: "test-org",
      role: "COACH",
      accessibleGroupIds: [group.id],
      groupAccesses: [],
      orgFilter: {
        type: "org" as const,
        get filter() {
          return { organisationId };
        },
        get filterNullable() {
          return { organisationId };
        },
        get organisationId() {
          return organisationId;
        },
      },
    });
  });

  async function createHypothesis(overrides?: { statement?: string }) {
    const run = await testDb.assistantCoachRun.create({
      data: { organisationId, playerId, sourceFingerprint: "fp-1", status: "SUCCEEDED", completedAt: new Date() },
    });
    return testDb.assistantCoachHypothesis.create({
      data: {
        organisationId,
        runId: run.id,
        statement: overrides?.statement ?? "Role-adjusted actions increased across the latest eligible window.",
        uncertainty: "MEDIUM",
        supportingRefs: [{ kind: "DERIVED_MEASUREMENT", id: "meas-1" }],
        contradictingRefs: [],
        missingEvidence: [],
      },
    });
  }

  it("promotes a hypothesis into a new development thread + observation, preserving provenance", async () => {
    const hypothesis = await createHypothesis();

    const result = await confirmAssistantCoachHypothesisAction("test-org", hypothesis.id, "Scanning before receiving");
    expect(result).toEqual({ success: true });

    const thread = await testDb.developmentThread.findFirst({ where: { playerId, organisationId } });
    expect(thread).toMatchObject({ focus: "Scanning before receiving", rationale: "Promoted from an Assistant Coach hypothesis." });

    const observation = await testDb.developmentThreadObservation.findFirst({ where: { threadId: thread!.id } });
    expect(observation).toMatchObject({
      evidence: "Role-adjusted actions increased across the latest eligible window.",
      context: "Promoted from an Assistant Coach hypothesis.",
    });

    const updated = await testDb.assistantCoachHypothesis.findUnique({ where: { id: hypothesis.id } });
    expect(updated).toMatchObject({ state: "PROMOTED", promotedDevelopmentThreadId: thread!.id, promotedBy: "coach@example.com" });
    expect(updated?.promotedAt).not.toBeNull();
  });

  it("rejects an empty or over-length focus without creating anything", async () => {
    const hypothesis = await createHypothesis();

    const empty = await confirmAssistantCoachHypothesisAction("test-org", hypothesis.id, "   ");
    expect(empty.success).toBe(false);

    const tooLong = await confirmAssistantCoachHypothesisAction("test-org", hypothesis.id, "x".repeat(201));
    expect(tooLong.success).toBe(false);

    expect(await testDb.developmentThread.findFirst({ where: { playerId } })).toBeNull();
  });

  it("never re-promotes an already-promoted hypothesis", async () => {
    const hypothesis = await createHypothesis();
    await confirmAssistantCoachHypothesisAction("test-org", hypothesis.id, "First focus");

    const second = await confirmAssistantCoachHypothesisAction("test-org", hypothesis.id, "Second focus");
    expect(second).toEqual({ success: false, error: "This hypothesis is no longer available." });

    const threads = await testDb.developmentThread.findMany({ where: { playerId } });
    expect(threads).toHaveLength(1);
    expect(threads[0]!.focus).toBe("First focus");
  });

  it("dismisses a hypothesis without creating any canonical write", async () => {
    const hypothesis = await createHypothesis();

    const result = await dismissAssistantCoachHypothesisAction("test-org", hypothesis.id);
    expect(result).toEqual({ success: true });

    const updated = await testDb.assistantCoachHypothesis.findUnique({ where: { id: hypothesis.id } });
    expect(updated?.state).toBe("DISMISSED");
    expect(await testDb.developmentThread.findFirst({ where: { playerId } })).toBeNull();
  });
});
