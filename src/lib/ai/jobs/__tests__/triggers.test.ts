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
// effect -- irrelevant to this trigger-logic test and heavier than needed, so it's mocked away
// here; triggers.test.ts registers its own fake handler per test instead.
vi.mock("@/lib/ai/register-capabilities", () => ({}));

import { triggerAiCapability } from "@/lib/ai/jobs/triggers";
import { registerAiCapabilityHandler, resetAiCapabilityHandlers, type AiCapabilityHandler } from "@/lib/ai/jobs/capability-handler";

let organisationId: string;

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

function fakeHandler(buildContext: AiCapabilityHandler["buildContext"]): AiCapabilityHandler {
  return { capability: "POST_MATCH_REVIEW", buildContext };
}

const baseParams = () => ({
  organisationId,
  capability: "POST_MATCH_REVIEW" as const,
  scopeType: "MATCH" as const,
  scopeId: "match-1",
});

describe("ai/jobs/triggers: triggerAiCapability", () => {
  it("does nothing when the organisation has no AI settings row at all", async () => {
    const org = await testDb.organisation.create({ data: { name: "Org", slug: `org-${Date.now()}-1` } });
    organisationId = org.id;
    registerAiCapabilityHandler(fakeHandler(async () => fakeContext));

    await triggerAiCapability(baseParams());

    const jobs = await testDb.aiAdvisorJob.findMany({ where: { organisationId } });
    expect(jobs).toHaveLength(0);
  });

  it("does nothing when the master switch is enabled but this capability's toggle is off", async () => {
    const org = await testDb.organisation.create({ data: { name: "Org", slug: `org-${Date.now()}-2` } });
    organisationId = org.id;
    await testDb.organisationAiSettings.create({
      data: { organisationId, enabled: true, postMatchReviewEnabled: false },
    });
    registerAiCapabilityHandler(fakeHandler(async () => fakeContext));

    await triggerAiCapability(baseParams());

    const jobs = await testDb.aiAdvisorJob.findMany({ where: { organisationId } });
    expect(jobs).toHaveLength(0);
  });

  it("does nothing when no handler is registered for the capability", async () => {
    const org = await testDb.organisation.create({ data: { name: "Org", slug: `org-${Date.now()}-3` } });
    organisationId = org.id;
    await testDb.organisationAiSettings.create({
      data: { organisationId, enabled: true, postMatchReviewEnabled: true },
    });

    await triggerAiCapability(baseParams());

    const jobs = await testDb.aiAdvisorJob.findMany({ where: { organisationId } });
    expect(jobs).toHaveLength(0);
  });

  it("does nothing when the handler reports the scope is not (or no longer) eligible", async () => {
    const org = await testDb.organisation.create({ data: { name: "Org", slug: `org-${Date.now()}-4` } });
    organisationId = org.id;
    await testDb.organisationAiSettings.create({
      data: { organisationId, enabled: true, postMatchReviewEnabled: true },
    });
    registerAiCapabilityHandler(fakeHandler(async () => null));

    await triggerAiCapability(baseParams());

    const jobs = await testDb.aiAdvisorJob.findMany({ where: { organisationId } });
    expect(jobs).toHaveLength(0);
  });

  it("enqueues a job with the fingerprint computed from the handler's normalized context, when enabled end to end", async () => {
    const org = await testDb.organisation.create({ data: { name: "Org", slug: `org-${Date.now()}-5` } });
    organisationId = org.id;
    await testDb.organisationAiSettings.create({
      data: { organisationId, enabled: true, postMatchReviewEnabled: true },
    });
    registerAiCapabilityHandler(fakeHandler(async () => fakeContext));

    await triggerAiCapability(baseParams());

    const jobs = await testDb.aiAdvisorJob.findMany({ where: { organisationId } });
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ capability: "POST_MATCH_REVIEW", scopeType: "MATCH", scopeId: "match-1", status: "QUEUED" });
  });

  it("never throws, even when the handler itself throws", async () => {
    const org = await testDb.organisation.create({ data: { name: "Org", slug: `org-${Date.now()}-6` } });
    organisationId = org.id;
    await testDb.organisationAiSettings.create({
      data: { organisationId, enabled: true, postMatchReviewEnabled: true },
    });
    registerAiCapabilityHandler(
      fakeHandler(async () => {
        throw new Error("boom");
      }),
    );

    await expect(triggerAiCapability(baseParams())).resolves.toBeUndefined();

    const jobs = await testDb.aiAdvisorJob.findMany({ where: { organisationId } });
    expect(jobs).toHaveLength(0);
  });
});
