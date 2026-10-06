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
import { registerAiCapabilityHandler, resetAiCapabilityHandlers, type AiCapabilityContext } from "@/lib/ai/jobs/capability-handler";
import { enqueueAiJob } from "@/lib/ai/jobs/enqueue";
import { processAiJobsBatch } from "@/lib/ai/jobs/runner";
import { generateAiProviderConnectionId } from "@/lib/ai/connection-id";
import { ASSISTANT_COACH_CONTRACT_VERSION } from "@/lib/ai/contracts";

/**
 * ADR-0155 step B7: the Assistant Coach runner branch, using the same fake-adapter/fake-transport
 * integration pattern runner.test.ts already uses for every other capability -- a registered
 * fake handler (not the real context builder, which has its own test) exercises only the
 * runner's own claim/provider-call/validate/persist branch.
 */

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
  normalizedContext: { schemaVersion: "1.0", player: { id: "P01", displayName: "Test Player" } },
  instructions: "Build hypotheses about this player.",
  refMap: new Map([["P01", { subjectType: "PLAYER", entityId: "real-player-id-1" }]]),
  evidenceRefs: new Set(["DERIVED_MEASUREMENT\u0000meas-1"]),
};

function validHypothesesRaw() {
  return {
    schemaVersion: ASSISTANT_COACH_CONTRACT_VERSION,
    hypotheses: [
      {
        statement: "Role-adjusted actions increased across the latest eligible window.",
        uncertainty: "MEDIUM",
        supportingRefs: [{ kind: "DERIVED_MEASUREMENT", id: "meas-1" }],
        contradictingRefs: [],
        missingEvidence: ["More recent matches would reduce uncertainty."],
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
    data: { organisationId, enabled: true, activeConnectionId: connectionId, assistantCoachEnabled: true },
  });

  fakeAdapter = new FakeProviderAdapter({ id: "openai", label: "OpenAI" });
  fakeAdapter.setNextExecuteResponse(validHypothesesRaw());

  fakeTransport = new FakeMatchboardSecurityTransport();
  fakeTransport.seedCredential(connectionId, "sk-test-credential");
  setMatchboardSecurityTransport(fakeTransport);

  resetAiCapabilityHandlers();
  registerAiCapabilityHandler({ capability: "ASSISTANT_COACH", buildContext: async () => CONTEXT });
});

afterEach(() => {
  resetMatchboardSecurityTransport();
  resetAiCapabilityHandlers();
});

async function enqueueAndClaim(scopeId = "player-1", fingerprint = "fp-1") {
  await enqueueAiJob({ organisationId, capability: "ASSISTANT_COACH", scopeType: "PLAYER", scopeId, sourceFingerprint: fingerprint });
}

describe("ai/jobs/runner: Assistant Coach branch", () => {
  it("processes a claimed job end to end: calls the provider with the hypothesis schema, validates, persists the run and hypothesis, marks the job SUCCEEDED", async () => {
    await enqueueAndClaim();

    const summary = await processAiJobsBatch();
    expect(summary).toMatchObject({ claimed: 1, succeeded: 1, failed: 0, retried: 0 });

    const job = await testDb.aiAdvisorJob.findFirst({ where: { organisationId } });
    expect(job?.status).toBe("SUCCEEDED");

    expect(fakeAdapter.executeReviewCalls).toHaveLength(1);
    expect(fakeAdapter.executeReviewCalls[0].responseSchema).toBeDefined();
    expect(fakeAdapter.executeReviewCalls[0].responseSchema).not.toBe(undefined);

    const run = await testDb.assistantCoachRun.findFirst({ where: { organisationId } });
    expect(run).toMatchObject({
      status: "SUCCEEDED",
      playerId: "player-1",
      provider: "OPENAI",
      model: "gpt-5",
      schemaVersion: ASSISTANT_COACH_CONTRACT_VERSION,
      providerConnectionId: connectionId,
    });

    const hypothesis = await testDb.assistantCoachHypothesis.findFirst({ where: { organisationId } });
    expect(hypothesis).toMatchObject({
      statement: "Role-adjusted actions increased across the latest eligible window.",
      uncertainty: "MEDIUM",
      state: "ACTIVE",
    });
    expect(hypothesis?.supportingRefs).toEqual([{ kind: "DERIVED_MEASUREMENT", id: "meas-1" }]);
  });

  it("supersedes the previous run rather than duplicating it on a later successful re-run", async () => {
    await enqueueAndClaim("player-1", "fp-1");
    await processAiJobsBatch();
    const firstRun = await testDb.assistantCoachRun.findFirst({ where: { organisationId } });

    // The runner always recomputes the fingerprint from the context it builds right now (never
    // the job's own stored fingerprint) -- so a genuinely different re-run needs the underlying
    // context to actually differ, exactly like new match data changing between runs would.
    resetAiCapabilityHandlers();
    registerAiCapabilityHandler({
      capability: "ASSISTANT_COACH",
      buildContext: async () => ({ ...CONTEXT, normalizedContext: { ...(CONTEXT.normalizedContext as object), changed: true } }),
    });
    fakeAdapter.setNextExecuteResponse(validHypothesesRaw());
    await enqueueAndClaim("player-1", "fp-2");
    await processAiJobsBatch();

    const runs = await testDb.assistantCoachRun.findMany({ where: { organisationId }, orderBy: { createdAt: "asc" } });
    expect(runs).toHaveLength(2);
    expect(runs[0]!.id).toBe(firstRun!.id);
    expect(runs[0]!.status).toBe("SUPERSEDED");
    expect(runs[1]!.status).toBe("SUCCEEDED");
  });

  it("fails the job (never retries) when the response cites an evidence ref the context never produced", async () => {
    fakeAdapter.setNextExecuteResponse({
      schemaVersion: ASSISTANT_COACH_CONTRACT_VERSION,
      hypotheses: [
        {
          statement: "Invented claim.",
          uncertainty: "HIGH",
          supportingRefs: [{ kind: "DERIVED_MEASUREMENT", id: "never-issued" }],
          contradictingRefs: [],
          missingEvidence: [],
        },
      ],
    });
    await enqueueAndClaim();

    const summary = await processAiJobsBatch();
    expect(summary).toMatchObject({ claimed: 1, succeeded: 0, failed: 1, retried: 0 });

    const job = await testDb.aiAdvisorJob.findFirst({ where: { organisationId } });
    expect(job).toMatchObject({ status: "FAILED", lastErrorCode: "PROVIDER_OUTPUT_INVALID" });
    expect(await testDb.assistantCoachRun.findFirst({ where: { organisationId } })).toBeNull();
  });

  it("fails the job when the response fails schema validation (e.g. an unknown uncertainty value)", async () => {
    fakeAdapter.setNextExecuteResponse({ schemaVersion: ASSISTANT_COACH_CONTRACT_VERSION, hypotheses: [{ statement: "x", uncertainty: "VERY_HIGH" }] });
    await enqueueAndClaim();

    const summary = await processAiJobsBatch();
    expect(summary).toMatchObject({ failed: 1 });
    const job = await testDb.aiAdvisorJob.findFirst({ where: { organisationId } });
    expect(job?.lastErrorCode).toBe("PROVIDER_OUTPUT_INVALID");
  });

  it("never persists into AiAdvisorReview/AiAdvisorInsight -- the shared contract stays untouched by this capability", async () => {
    await enqueueAndClaim();
    await processAiJobsBatch();

    expect(await testDb.aiAdvisorReview.findFirst({ where: { organisationId } })).toBeNull();
    expect(await testDb.aiAdvisorInsight.findFirst({ where: { organisationId } })).toBeNull();
  });
});
