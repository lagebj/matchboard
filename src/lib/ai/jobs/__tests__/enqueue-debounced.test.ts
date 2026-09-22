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

import { enqueueDebouncedAiJob } from "@/lib/ai/jobs/enqueue";

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
  capability: "LINEUP_REVIEW" as const,
  scopeType: "MATCH" as const,
  scopeId: "match-1",
  sourceFingerprint: "fingerprint-a",
  debounceMs: 120_000,
});

// No prior test file covered `enqueueDebouncedAiJob` at all — the exact code path behind
// `lineup_review`, this repo's only debounced capability, and the one involved in the production
// incident this file's last test reproduces.
describe("ai/jobs/enqueue: enqueueDebouncedAiJob", () => {
  it("creates a QUEUED job on first enqueue, with nextAttemptAt debounced into the future", async () => {
    const params = { ...baseParams(), scopeId: "match-debounce-1" };
    const result = await enqueueDebouncedAiJob(params);
    expect(result).toEqual({ enqueued: true });

    const job = await testDb.aiAdvisorJob.findFirst({ where: { organisationId, scopeId: params.scopeId } });
    expect(job?.status).toBe("QUEUED");
    expect(job?.attempts).toBe(0);
    expect(job?.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("collapses onto the existing QUEUED job for the same scope, even with a different fingerprint", async () => {
    const scopeId = "match-debounce-2";
    await enqueueDebouncedAiJob({ ...baseParams(), scopeId, sourceFingerprint: "fp-1" });
    await enqueueDebouncedAiJob({ ...baseParams(), scopeId, sourceFingerprint: "fp-2" });

    const jobs = await testDb.aiAdvisorJob.findMany({ where: { organisationId, scopeId } });
    expect(jobs).toHaveLength(1);
    expect(jobs[0].sourceFingerprint).toBe("fp-2");
  });

  it("does not enqueue when a SUCCEEDED review already exists for this exact fingerprint", async () => {
    const params = { ...baseParams(), scopeId: "match-debounce-3", sourceFingerprint: "fingerprint-c" };
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

    const result = await enqueueDebouncedAiJob(params);
    expect(result).toEqual({ enqueued: false, reason: "ALREADY_SUCCEEDED" });

    const jobCount = await testDb.aiAdvisorJob.count({ where: { organisationId, sourceFingerprint: "fingerprint-c" } });
    expect(jobCount).toBe(0);
  });

  it("re-enqueues (revives) a terminally FAILED job when a new trigger reproduces the exact same fingerprint", async () => {
    // Reproduces the exact production incident: `lineup_review`'s job exhausted all retries
    // against PROVIDER_TIMEOUT and was marked FAILED; the coach later fixed the underlying cause
    // (switched to a faster model) and edited the line-up again, reproducing the same
    // fingerprint. Before this fix, this second trigger silently did nothing forever.
    const params = { ...baseParams(), scopeId: "match-debounce-failed-retry", sourceFingerprint: "fingerprint-failed" };
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

    const result = await enqueueDebouncedAiJob(params);
    expect(result).toEqual({ enqueued: true });

    const jobs = await testDb.aiAdvisorJob.findMany({ where: { organisationId, sourceFingerprint: "fingerprint-failed" } });
    expect(jobs).toHaveLength(1);
    expect(jobs[0].status).toBe("QUEUED");
    expect(jobs[0].attempts).toBe(0);
    expect(jobs[0].lastErrorCode).toBeNull();
    expect(jobs[0].nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
  });
});
