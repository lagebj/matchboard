import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";

vi.mock("server-only", () => ({}));

import { setupTestDb, teardownTestDb } from "@/test/test-db";

let testDb: PrismaClient;

vi.mock("@/lib/db", () => ({
  get db() {
    return testDb;
  },
}));

import { enqueueAiJob } from "@/lib/ai/jobs/enqueue";

let organisationId: string;

beforeAll(async () => {
  testDb = await setupTestDb();
  const org = await testDb.organisation.create({ data: { name: "Org", slug: `org-${Date.now()}` } });
  organisationId = org.id;
});

afterAll(async () => {
  await teardownTestDb();
});

const baseParams = () => ({
  organisationId,
  capability: "POST_MATCH_REVIEW" as const,
  scopeType: "MATCH" as const,
  scopeId: "match-1",
  sourceFingerprint: "fingerprint-a",
});

describe("ai/jobs/enqueue: enqueueAiJob", () => {
  it("creates a QUEUED job on first enqueue", async () => {
    const result = await enqueueAiJob(baseParams());
    expect(result).toEqual({ enqueued: true });

    const job = await testDb.aiAdvisorJob.findFirst({ where: { organisationId, sourceFingerprint: "fingerprint-a" } });
    expect(job?.status).toBe("QUEUED");
    expect(job?.attempts).toBe(0);
  });

  it("does not enqueue a second job for the exact same fingerprint while one is already queued", async () => {
    const params = { ...baseParams(), scopeId: "match-2", sourceFingerprint: "fingerprint-b" };
    const first = await enqueueAiJob(params);
    const second = await enqueueAiJob(params);

    expect(first).toEqual({ enqueued: true });
    expect(second).toEqual({ enqueued: false, reason: "ALREADY_QUEUED_OR_RUNNING" });

    const count = await testDb.aiAdvisorJob.count({ where: { organisationId, sourceFingerprint: "fingerprint-b" } });
    expect(count).toBe(1);
  });

  it("does not enqueue when a SUCCEEDED review already exists for this exact fingerprint", async () => {
    const params = { ...baseParams(), scopeId: "match-3", sourceFingerprint: "fingerprint-c" };
    await testDb.aiAdvisorReview.create({
      data: {
        organisationId,
        capability: params.capability,
        scopeType: params.scopeType,
        scopeId: params.scopeId,
        sourceFingerprint: params.sourceFingerprint,
        status: "SUCCEEDED",
        contractVersion: "1",
        terminologyVersion: "1",
      },
    });

    const result = await enqueueAiJob(params);
    expect(result).toEqual({ enqueued: false, reason: "ALREADY_SUCCEEDED" });

    const jobCount = await testDb.aiAdvisorJob.count({ where: { organisationId, sourceFingerprint: "fingerprint-c" } });
    expect(jobCount).toBe(0);
  });

  it("enqueues a fresh job when the source fingerprint changes, even for the same scope", async () => {
    const scopeId = "match-4";
    const first = await enqueueAiJob({ ...baseParams(), scopeId, sourceFingerprint: "fp-1" });
    const second = await enqueueAiJob({ ...baseParams(), scopeId, sourceFingerprint: "fp-2" });

    expect(first).toEqual({ enqueued: true });
    expect(second).toEqual({ enqueued: true });
  });

  it("re-enqueues (revives) a terminally FAILED job when a new trigger reproduces the exact same fingerprint", async () => {
    // Reproduces a real production incident: a job exhausts all retries against a transient
    // provider failure (e.g. PROVIDER_TIMEOUT from an overloaded/oversized model) and is marked
    // FAILED. The coach later fixes the underlying cause (switches to a faster model) and makes
    // another domain-triggering edit that happens to compute the exact same fingerprint (the
    // plan content itself hasn't changed). Without this fix, the DB's unique constraint on
    // (organisationId, capability, scopeType, scopeId, sourceFingerprint) makes `enqueueAiJob`'s
    // blind `create()` call throw P2002, which was misreported as "ALREADY_QUEUED_OR_RUNNING" —
    // permanently blocking any future retry for that exact content, forever, even though the
    // prior job is long finished (not actually running or queued at all).
    const params = { ...baseParams(), scopeId: "match-failed-retry", sourceFingerprint: "fingerprint-failed" };
    await testDb.aiAdvisorJob.create({
      data: {
        organisationId: params.organisationId,
        capability: params.capability,
        scopeType: params.scopeType,
        scopeId: params.scopeId,
        sourceFingerprint: params.sourceFingerprint,
        status: "FAILED",
        attempts: 2,
        lastErrorCode: "PROVIDER_TIMEOUT",
      },
    });

    const result = await enqueueAiJob(params);
    expect(result).toEqual({ enqueued: true });

    const job = await testDb.aiAdvisorJob.findFirst({ where: { organisationId, sourceFingerprint: "fingerprint-failed" } });
    expect(job?.status).toBe("QUEUED");
    expect(job?.attempts).toBe(0);
    expect(job?.lastErrorCode).toBeNull();

    const jobCount = await testDb.aiAdvisorJob.count({ where: { organisationId, sourceFingerprint: "fingerprint-failed" } });
    expect(jobCount).toBe(1);
  });
});
