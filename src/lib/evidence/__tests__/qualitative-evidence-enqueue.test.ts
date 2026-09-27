import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb } from "@/test/test-db";
import { generateAiProviderConnectionId } from "@/lib/ai/connection-id";
import { enqueueQualitativeExtraction } from "../qualitative-evidence-enqueue";

/** ADR-0152 §4 (bundle §8 step 7 / §9 / §10 "AI disabled"). Each test creates its own bare
 * Organisation row directly -- no other fixture data is needed for enqueue's own logic. */
vi.mock("@/lib/db", async () => {
  const { getTestDb } = await import("@/test/test-db");
  return {
    get db() {
      return getTestDb();
    },
  };
});

let testDb: PrismaClient;

beforeAll(async () => {
  testDb = await setupTestDb();
});

afterAll(async () => {
  await teardownTestDb();
});

async function enableAi(organisationId: string): Promise<void> {
  const connectionId = generateAiProviderConnectionId();
  await testDb.aiProviderConnection.create({ data: { id: connectionId, organisationId, provider: "OPENAI", status: "READY", model: "gpt-5" } });
  await testDb.organisationAiSettings.create({ data: { organisationId, enabled: true, activeConnectionId: connectionId } });
}

describe("enqueueQualitativeExtraction", () => {
  it("does not enqueue anything when the organisation has no AI settings at all", async () => {
    const org = await testDb.organisation.create({ data: { name: "No AI Settings", slug: `no-ai-${Date.now()}` } });
    const result = await enqueueQualitativeExtraction({
      organisationId: org.id,
      sourceType: "POST_MATCH_DEBRIEF_CHANGE",
      sourceId: "debrief-1",
      fingerprintPayload: { text: "Both teams changed shape." },
    });
    expect(result.status).toBe("AI_DISABLED");
    const runs = await testDb.qualitativeEvidenceExtractionRun.findMany({ where: { organisationId: org.id } });
    expect(runs).toHaveLength(0);
  });

  it("does not enqueue when AI is explicitly disabled", async () => {
    const org = await testDb.organisation.create({ data: { name: "AI Disabled", slug: `ai-off-${Date.now()}` } });
    await testDb.organisationAiSettings.create({ data: { organisationId: org.id, enabled: false } });

    const result = await enqueueQualitativeExtraction({
      organisationId: org.id,
      sourceType: "POST_MATCH_DEBRIEF_OTHER",
      sourceId: "debrief-1",
      fingerprintPayload: { note: "Good response after conceding." },
    });
    expect(result.status).toBe("AI_DISABLED");
  });

  it("queues a new AI_STRUCTURED run when AI is enabled", async () => {
    const org = await testDb.organisation.create({ data: { name: "AI On", slug: `ai-on-${Date.now()}` } });
    await enableAi(org.id);

    const result = await enqueueQualitativeExtraction({
      organisationId: org.id,
      sourceType: "POST_MATCH_DEBRIEF_CHANGE",
      sourceId: "debrief-1",
      fingerprintPayload: { text: "Both teams changed shape." },
    });
    expect(result.status).toBe("QUEUED");
    if (result.status !== "QUEUED") return;

    const run = await testDb.qualitativeEvidenceExtractionRun.findUniqueOrThrow({ where: { id: result.runId } });
    expect(run.status).toBe("QUEUED");
    expect(run.derivationMethod).toBe("AI_STRUCTURED");
  });

  it("is idempotent for the exact same fingerprint, regardless of the existing run's current status", async () => {
    const org = await testDb.organisation.create({ data: { name: "AI Idempotent", slug: `ai-idem-${Date.now()}` } });
    await enableAi(org.id);

    const first = await enqueueQualitativeExtraction({
      organisationId: org.id,
      sourceType: "POST_MATCH_DEBRIEF_OTHER",
      sourceId: "debrief-2",
      fingerprintPayload: { note: "Good response after conceding." },
    });
    expect(first.status).toBe("QUEUED");
    if (first.status !== "QUEUED") return;

    // Simulate the cron having already claimed and succeeded on this exact run.
    await testDb.qualitativeEvidenceExtractionRun.update({ where: { id: first.runId }, data: { status: "SUCCEEDED" } });

    const second = await enqueueQualitativeExtraction({
      organisationId: org.id,
      sourceType: "POST_MATCH_DEBRIEF_OTHER",
      sourceId: "debrief-2",
      fingerprintPayload: { note: "Good response after conceding." },
    });
    expect(second).toEqual({ status: "ALREADY_TRACKED", runId: first.runId });

    const runs = await testDb.qualitativeEvidenceExtractionRun.findMany({ where: { organisationId: org.id, sourceId: "debrief-2" } });
    expect(runs).toHaveLength(1);
  });

  it("queues a second, distinct run when the fingerprint changes", async () => {
    const org = await testDb.organisation.create({ data: { name: "AI Distinct Fingerprint", slug: `ai-distinct-${Date.now()}` } });
    await enableAi(org.id);

    const first = await enqueueQualitativeExtraction({
      organisationId: org.id,
      sourceType: "POST_MATCH_DEBRIEF_OTHER",
      sourceId: "debrief-3",
      fingerprintPayload: { note: "First note." },
    });
    const second = await enqueueQualitativeExtraction({
      organisationId: org.id,
      sourceType: "POST_MATCH_DEBRIEF_OTHER",
      sourceId: "debrief-3",
      fingerprintPayload: { note: "Revised note." },
    });

    expect(first.status).toBe("QUEUED");
    expect(second.status).toBe("QUEUED");
    if (first.status !== "QUEUED" || second.status !== "QUEUED") return;
    expect(second.runId).not.toBe(first.runId);
  });
});
