import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { generateKeyPair, exportPKCS8 } from "jose";

vi.mock("server-only", () => ({}));

import { setupTestDb, teardownTestDb } from "@/test/test-db";

let testDb: PrismaClient;

vi.mock("@/lib/db", () => ({
  get db() {
    return testDb;
  },
}));

import { FakeProviderAdapter } from "@/lib/ai/providers/fake-provider-adapter";

let fakeAdapter: FakeProviderAdapter;

vi.mock("@/lib/ai/providers/provider-adapter-registry", () => ({
  getProviderAdapter: () => fakeAdapter,
}));

import { FakeMatchboardSecurityTransport } from "@/lib/ai/security-client/fake-transport";
import { setMatchboardSecurityTransport, resetMatchboardSecurityTransport } from "@/lib/ai/security-client/transport-factory";
import {
  registerAiCapabilityHandler,
  resetAiCapabilityHandlers,
  type AiCapabilityHandler,
  type AiCapabilityContext,
} from "@/lib/ai/jobs/capability-handler";
import { enqueueAiJob } from "@/lib/ai/jobs/enqueue";
import { processAiJobsBatch } from "@/lib/ai/jobs/runner";
import { generateAiProviderConnectionId } from "@/lib/ai/connection-id";

const AI_ENV_KEYS = ["AI_CREDENTIAL_ACCESS_SIGNING_PRIVATE_KEY_B64"] as const;
const originalEnv: Record<string, string | undefined> = {};

beforeAll(async () => {
  testDb = await setupTestDb();

  const { privateKey } = await generateKeyPair("EdDSA", { crv: "Ed25519", extractable: true });
  const keyB64 = Buffer.from(await exportPKCS8(privateKey), "utf8").toString("base64");
  for (const key of AI_ENV_KEYS) originalEnv[key] = process.env[key];
  process.env.AI_CREDENTIAL_ACCESS_SIGNING_PRIVATE_KEY_B64 = keyB64;
});

afterAll(async () => {
  for (const key of AI_ENV_KEYS) {
    if (originalEnv[key] !== undefined) process.env[key] = originalEnv[key];
    else delete process.env[key];
  }
  await teardownTestDb();
});

let organisationId: string;
let connectionId: string;
let fakeTransport: FakeMatchboardSecurityTransport;

const CONTEXT: AiCapabilityContext = {
  normalizedContext: { players: [{ ref: "P01", minutes: 60 }] },
  instructions: "Review the post-match report.",
  refMap: new Map([["P01", { subjectType: "PLAYER", entityId: "real-player-id-1" }]]),
  evidenceRefs: new Set(["fact:minutes:P01"]),
};

function validAdvisorRaw() {
  return {
    contractVersion: "1",
    summary: "Solid performance overall.",
    insights: [
      {
        kind: "observation",
        subjectRef: "P01",
        secondarySubjectRef: null,
        title: "Minutes",
        body: "Played the full match.",
        evidenceRefs: ["fact:minutes:P01"],
        suggestedAction: null,
      },
    ],
  };
}

beforeEach(async () => {
  const org = await testDb.organisation.create({ data: { name: "Org", slug: `org-${Date.now()}-${Math.random()}` } });
  organisationId = org.id;

  connectionId = generateAiProviderConnectionId();
  await testDb.aiProviderConnection.create({
    data: { id: connectionId, organisationId, provider: "OPENAI", status: "READY", model: "gpt-5" },
  });
  await testDb.organisationAiSettings.create({
    data: { organisationId, enabled: true, activeConnectionId: connectionId, postMatchReviewEnabled: true },
  });

  fakeAdapter = new FakeProviderAdapter({ id: "openai", label: "OpenAI" });
  fakeAdapter.setNextExecuteResponse(validAdvisorRaw());

  fakeTransport = new FakeMatchboardSecurityTransport();
  fakeTransport.seedCredential(connectionId, "sk-test-credential");
  setMatchboardSecurityTransport(fakeTransport);

  resetAiCapabilityHandlers();
});

afterEach(() => {
  resetMatchboardSecurityTransport();
  resetAiCapabilityHandlers();
});

function registerFakeHandler(overrides: Partial<AiCapabilityHandler> = {}) {
  registerAiCapabilityHandler({
    capability: "POST_MATCH_REVIEW",
    buildContext: async () => CONTEXT,
    ...overrides,
  });
}

async function enqueueAndClaim(scopeId = "match-1", fingerprint = "fp-1") {
  await enqueueAiJob({ organisationId, capability: "POST_MATCH_REVIEW", scopeType: "MATCH", scopeId, sourceFingerprint: fingerprint });
}

describe("ai/jobs/runner: happy path", () => {
  it("processes a claimed job end to end: calls the provider, validates, persists the review and insight, marks the job SUCCEEDED", async () => {
    registerFakeHandler();
    await enqueueAndClaim();

    const summary = await processAiJobsBatch();
    expect(summary).toMatchObject({ claimed: 1, succeeded: 1, failed: 0, retried: 0 });

    const job = await testDb.aiAdvisorJob.findFirst({ where: { organisationId } });
    expect(job?.status).toBe("SUCCEEDED");

    const review = await testDb.aiAdvisorReview.findFirst({ where: { organisationId } });
    expect(review).toMatchObject({
      status: "SUCCEEDED",
      capability: "POST_MATCH_REVIEW",
      scopeType: "MATCH",
      scopeId: "match-1",
      provider: "OPENAI",
      model: "gpt-5",
      contractVersion: "1",
      terminologyVersion: "1",
      summary: "Solid performance overall.",
      providerConnectionId: connectionId,
    });

    const insight = await testDb.aiAdvisorInsight.findFirst({ where: { organisationId } });
    expect(insight).toMatchObject({
      kind: "OBSERVATION",
      subjectType: "PLAYER",
      subjectId: "real-player-id-1",
      secondarySubjectId: null,
      title: "Minutes",
      actionType: "NONE",
      actionPayload: null,
      state: "ACTIVE",
    });
    expect(insight?.evidenceRefs).toEqual(["fact:minutes:P01"]);
  });

  it("sends the shared stable doctrine plus the capability's own instructions to the provider", async () => {
    registerFakeHandler();
    await enqueueAndClaim();
    await processAiJobsBatch();

    expect(fakeAdapter.executeReviewCalls).toHaveLength(1);
    const call = fakeAdapter.executeReviewCalls[0];
    expect(call.instructions).toContain("evidence-bound");
    expect(call.instructions).toContain("Review the post-match report.");
    expect(call.credential).toBe("sk-test-credential");
    expect(call.model).toBe("gpt-5");
    expect(call.input).toEqual(CONTEXT.normalizedContext);
  });

  it("persists a resolved development-suggestion action payload", async () => {
    registerFakeHandler();
    fakeAdapter.setNextExecuteResponse({
      contractVersion: "1",
      summary: "x",
      insights: [
        {
          kind: "development_suggestion",
          subjectRef: "P01",
          secondarySubjectRef: null,
          title: "Development",
          body: "x",
          evidenceRefs: ["fact:minutes:P01"],
          suggestedAction: { type: "confirm_development_observation", playerRef: "P01", category: "technical", observation: "Great first touch." },
        },
      ],
    });
    await enqueueAndClaim();
    await processAiJobsBatch();

    const insight = await testDb.aiAdvisorInsight.findFirst({ where: { organisationId } });
    expect(insight?.actionType).toBe("CONFIRM_DEVELOPMENT_OBSERVATION");
    expect(insight?.actionPayload).toEqual({ playerId: "real-player-id-1", category: "technical", observation: "Great first touch." });
  });

  it("marks a job SUCCEEDED without calling the provider again if a SUCCEEDED review already exists for the freshly computed fingerprint", async () => {
    registerFakeHandler();
    await enqueueAndClaim("match-dup", "stale-fp");

    // Seed a SUCCEEDED review at whatever fingerprint the fixed CONTEXT actually normalizes to.
    const { computeSourceFingerprint } = await import("@/lib/ai/fingerprints");
    const currentFingerprint = computeSourceFingerprint(CONTEXT.normalizedContext);
    await testDb.aiAdvisorReview.create({
      data: {
        organisationId,
        capability: "POST_MATCH_REVIEW",
        scopeType: "MATCH",
        scopeId: "match-dup",
        sourceFingerprint: currentFingerprint,
        status: "SUCCEEDED",
        contractVersion: "1",
        terminologyVersion: "1",
      },
    });

    const summary = await processAiJobsBatch();
    expect(summary.succeeded).toBe(1);
    expect(fakeAdapter.executeReviewCalls).toHaveLength(0);
  });

  it("supersedes the prior SUCCEEDED review for the same scope when a new one succeeds", async () => {
    registerFakeHandler();
    const scopeId = "match-supersede";

    await enqueueAndClaim(scopeId, "fp-first-run");
    await processAiJobsBatch();
    const firstReview = await testDb.aiAdvisorReview.findFirst({ where: { organisationId, scopeId } });
    expect(firstReview?.status).toBe("SUCCEEDED");

    // A different underlying context (different fingerprint) triggers a genuinely new review.
    registerFakeHandler({
      buildContext: async () => ({ ...CONTEXT, normalizedContext: { players: [{ ref: "P01", minutes: 90 }] } }),
    });
    fakeAdapter.setNextExecuteResponse(validAdvisorRaw());
    await enqueueAndClaim(scopeId, "fp-second-run");
    await processAiJobsBatch();

    const reviews = await testDb.aiAdvisorReview.findMany({ where: { organisationId, scopeId }, orderBy: { createdAt: "asc" } });
    expect(reviews).toHaveLength(2);
    expect(reviews[0].status).toBe("SUPERSEDED");
    expect(reviews[1].status).toBe("SUCCEEDED");
  });
});

describe("ai/jobs/runner: eligibility gating (gates #28, #29, #30)", () => {
  it("fails the job without calling the provider when the master AI switch is off", async () => {
    await testDb.organisationAiSettings.update({ where: { organisationId }, data: { enabled: false } });
    registerFakeHandler();
    await enqueueAndClaim();

    const summary = await processAiJobsBatch();
    expect(summary.skippedNotEligible).toBe(1);
    expect(fakeAdapter.executeReviewCalls).toHaveLength(0);

    const job = await testDb.aiAdvisorJob.findFirst({ where: { organisationId } });
    expect(job).toMatchObject({ status: "FAILED", lastErrorCode: "NOT_ELIGIBLE" });
  });

  it("fails the job without calling the provider when this specific capability is disabled", async () => {
    await testDb.organisationAiSettings.update({ where: { organisationId }, data: { postMatchReviewEnabled: false } });
    registerFakeHandler();
    await enqueueAndClaim();

    const summary = await processAiJobsBatch();
    expect(summary.skippedNotEligible).toBe(1);
    expect(fakeAdapter.executeReviewCalls).toHaveLength(0);
  });

  it("fails the job without calling the provider when the connection is not READY", async () => {
    await testDb.aiProviderConnection.update({ where: { id: connectionId }, data: { status: "CONNECTED_NO_MODEL", model: null } });
    registerFakeHandler();
    await enqueueAndClaim();

    const summary = await processAiJobsBatch();
    expect(summary.skippedNotEligible).toBe(1);
    expect(fakeAdapter.executeReviewCalls).toHaveLength(0);
  });

  it("fails the job when no capability handler is registered for it at all", async () => {
    // Deliberately do not call registerFakeHandler().
    await enqueueAndClaim();
    const summary = await processAiJobsBatch();
    expect(summary.failed).toBe(1);

    const job = await testDb.aiAdvisorJob.findFirst({ where: { organisationId } });
    expect(job).toMatchObject({ status: "FAILED", lastErrorCode: "NO_CAPABILITY_HANDLER" });
  });

  it("fails the job when the scope is no longer eligible (buildContext returns null)", async () => {
    registerFakeHandler({ buildContext: async () => null });
    await enqueueAndClaim();

    const summary = await processAiJobsBatch();
    expect(summary.failed).toBe(1);
    const job = await testDb.aiAdvisorJob.findFirst({ where: { organisationId } });
    expect(job).toMatchObject({ status: "FAILED", lastErrorCode: "SCOPE_NO_LONGER_ELIGIBLE" });
  });
});

describe("ai/jobs/runner: retry policy", () => {
  it("requeues a transient failure (PROVIDER_RATE_LIMITED) with attempts incremented and nextAttemptAt in the future", async () => {
    registerFakeHandler();
    fakeAdapter.forceNextExecuteFailure("PROVIDER_RATE_LIMITED");
    await enqueueAndClaim();

    const before = Date.now();
    const summary = await processAiJobsBatch();
    expect(summary.retried).toBe(1);

    const job = await testDb.aiAdvisorJob.findFirst({ where: { organisationId } });
    expect(job?.status).toBe("QUEUED");
    expect(job?.attempts).toBe(1);
    expect(job?.lastErrorCode).toBe("PROVIDER_RATE_LIMITED");
    expect(job!.nextAttemptAt.getTime()).toBeGreaterThan(before);
  });

  it("fails permanently, never retrying, on a non-transient failure (PROVIDER_AUTH_FAILED)", async () => {
    registerFakeHandler();
    fakeAdapter.forceNextExecuteFailure("PROVIDER_AUTH_FAILED");
    await enqueueAndClaim();

    const summary = await processAiJobsBatch();
    expect(summary.failed).toBe(1);
    expect(summary.retried).toBe(0);

    const job = await testDb.aiAdvisorJob.findFirst({ where: { organisationId } });
    expect(job).toMatchObject({ status: "FAILED", lastErrorCode: "PROVIDER_AUTH_FAILED" });
  });

  it("stops retrying once the max attempt count is reached, even for a retryable error class", async () => {
    registerFakeHandler();
    await testDb.aiAdvisorJob.create({
      data: {
        organisationId,
        capability: "POST_MATCH_REVIEW",
        scopeType: "MATCH",
        scopeId: "match-exhausted",
        sourceFingerprint: "fp-exhausted",
        status: "QUEUED",
        attempts: 2, // one more retryable failure would be the 3rd attempt = MAX_ATTEMPTS
      },
    });
    fakeAdapter.forceNextExecuteFailure("PROVIDER_UNAVAILABLE");

    const summary = await processAiJobsBatch();
    expect(summary.failed).toBe(1);
    expect(summary.retried).toBe(0);

    const job = await testDb.aiAdvisorJob.findFirst({ where: { organisationId, scopeId: "match-exhausted" } });
    expect(job).toMatchObject({ status: "FAILED", lastErrorCode: "PROVIDER_UNAVAILABLE" });
  });

  it("fails without retry, and persists no review, when the provider response fails local validation", async () => {
    registerFakeHandler();
    fakeAdapter.setNextExecuteResponse({
      contractVersion: "1",
      summary: "x",
      insights: [
        {
          kind: "observation",
          subjectRef: "P99", // not in refMap — an unknown ref the provider invented
          secondarySubjectRef: null,
          title: "x",
          body: "x",
          evidenceRefs: ["fact:minutes:P01"],
          suggestedAction: null,
        },
      ],
    });
    await enqueueAndClaim();

    const summary = await processAiJobsBatch();
    expect(summary.failed).toBe(1);

    const job = await testDb.aiAdvisorJob.findFirst({ where: { organisationId } });
    expect(job).toMatchObject({ status: "FAILED", lastErrorCode: "PROVIDER_OUTPUT_INVALID" });

    const reviewCount = await testDb.aiAdvisorReview.count({ where: { organisationId } });
    expect(reviewCount).toBe(0);
  });
});

describe("ai/jobs/runner: atomic claim", () => {
  it("never processes the same job twice across two concurrent batch calls", async () => {
    registerFakeHandler();
    for (let i = 0; i < 5; i++) {
      await enqueueAndClaim(`match-concurrent-${i}`, `fp-concurrent-${i}`);
    }

    const [a, b] = await Promise.all([processAiJobsBatch(), processAiJobsBatch()]);

    expect(a.claimed + b.claimed).toBe(5);
    expect(a.succeeded + b.succeeded).toBe(5);
    expect(fakeAdapter.executeReviewCalls).toHaveLength(5);

    const succeededCount = await testDb.aiAdvisorJob.count({ where: { organisationId, status: "SUCCEEDED" } });
    expect(succeededCount).toBe(5);
  });
});
