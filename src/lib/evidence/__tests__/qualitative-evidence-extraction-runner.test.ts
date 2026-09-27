import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { generateKeyPair, exportPKCS8 } from "jose";

vi.mock("server-only", () => ({}));

import { setupTestDb, teardownTestDb, seedTestFixture, type TestFixtureIds } from "@/test/test-db";

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
import { generateAiProviderConnectionId } from "@/lib/ai/connection-id";
import { logger } from "@/lib/logger";
import { createTestMatch } from "@/test/support/factories";
import { processQualitativeExtractionBatch } from "../qualitative-evidence-extraction-runner";
import { getQualitativeEvidenceForMatch } from "../qualitative-evidence-service";

const AI_ENV_KEYS = ["AI_CREDENTIAL_ACCESS_SIGNING_PRIVATE_KEY_B64"] as const;
const originalEnv: Record<string, string | undefined> = {};

let fixture: TestFixtureIds;
let organisationId: string;
let connectionId: string;
let fakeTransport: FakeMatchboardSecurityTransport;
let teamId: string;

beforeAll(async () => {
  testDb = await setupTestDb();
  fixture = await seedTestFixture(testDb);
  organisationId = fixture.organisationId;
  teamId = Object.values(fixture.teams)[0]!;

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

beforeEach(async () => {
  connectionId = generateAiProviderConnectionId();
  await testDb.aiProviderConnection.create({ data: { id: connectionId, organisationId, provider: "OPENAI", status: "READY", model: "gpt-5" } });
  await testDb.organisationAiSettings.upsert({
    where: { organisationId },
    create: { organisationId, enabled: true, activeConnectionId: connectionId },
    update: { enabled: true, activeConnectionId: connectionId },
  });

  fakeAdapter = new FakeProviderAdapter({ id: "openai", label: "OpenAI" });
  fakeAdapter.setNextExecuteResponse({ version: "1", observations: [] });

  fakeTransport = new FakeMatchboardSecurityTransport();
  fakeTransport.seedCredential(connectionId, "sk-test-credential");
  setMatchboardSecurityTransport(fakeTransport);
});

afterEach(async () => {
  resetMatchboardSecurityTransport();
  await testDb.qualitativeEvidenceObservation.deleteMany({});
  await testDb.qualitativeEvidenceExtractionRun.deleteMany({});
  await testDb.postMatchDebrief.deleteMany({});
  await testDb.postMatchReport.deleteMany({});
  await testDb.aiProviderConnection.deleteMany({ where: { organisationId } });
});

async function seedBothChangedDebrief(description = "Both teams changed shape after the first goal.") {
  const match = await createTestMatch(testDb, organisationId, fixture.matchRoundId, teamId, null);
  const report = await testDb.postMatchReport.create({ data: { organisationId, matchId: match.id } });
  const debrief = await testDb.postMatchDebrief.create({
    data: {
      organisationId,
      postMatchReportId: report.id,
      status: "SUBMITTED",
      answers: { version: 1, answers: { team_execution: {}, worked: { selected: [] }, needs_attention: { selected: [] }, match_changes: { option: "BOTH_CHANGED", description }, opponent_memory: {}, player_observations: [], anything_else: {} } },
    },
  });
  return { match, report, debrief };
}

async function queueRun(sourceType: "POST_MATCH_DEBRIEF_CHANGE" | "POST_MATCH_DEBRIEF_OTHER", sourceId: string, fingerprint = `fp-${Math.random()}`) {
  return testDb.qualitativeEvidenceExtractionRun.create({
    data: { organisationId, sourceType, sourceId, sourceFingerprint: fingerprint, derivationMethod: "AI_STRUCTURED", status: "QUEUED" },
  });
}

describe("processQualitativeExtractionBatch — happy path", () => {
  it("claims a QUEUED run, calls the provider with the current debrief text, persists observations, marks SUCCEEDED", async () => {
    const { match, debrief } = await seedBothChangedDebrief();
    fakeAdapter.setNextExecuteResponse({
      version: "1",
      observations: [{ scope: "TEAM", playerRef: null, secondaryPlayerRef: null, phase: "GENERAL", polarity: "NEUTRAL", period: null, statement: "We changed shape after conceding.", explicitness: "EXPLICIT" }],
    });
    await queueRun("POST_MATCH_DEBRIEF_CHANGE", debrief.id);

    const summary = await processQualitativeExtractionBatch();
    expect(summary).toMatchObject({ claimed: 1, succeeded: 1, failed: 0, retried: 0 });

    expect(fakeAdapter.executeReviewCalls).toHaveLength(1);
    expect(fakeAdapter.executeReviewCalls[0].input).toMatchObject({ text: "Both teams changed shape after the first goal." });
    expect(fakeAdapter.executeReviewCalls[0].instructions).toContain("parsing mechanism");

    const run = await testDb.qualitativeEvidenceExtractionRun.findFirstOrThrow({ where: { sourceId: debrief.id } });
    expect(run.status).toBe("SUCCEEDED");
    expect(run.provider).toBe("OPENAI");
    expect(run.model).toBe("gpt-5");

    const evidence = await getQualitativeEvidenceForMatch({ matchId: match.id }, organisationId);
    expect(evidence).toEqual([expect.objectContaining({ scope: "TEAM", phase: "GENERAL", polarity: "NEUTRAL", statement: "We changed shape after conceding." })]);
  });

  it("succeeds without calling the provider when the source has nothing left to extract (resubmitted away from BOTH_CHANGED)", async () => {
    const { debrief } = await seedBothChangedDebrief();
    await testDb.postMatchDebrief.update({
      where: { id: debrief.id },
      data: { answers: { version: 1, answers: { team_execution: {}, worked: { selected: [] }, needs_attention: { selected: [] }, match_changes: { option: "NO_MEANINGFUL_CHANGE" }, opponent_memory: {}, player_observations: [], anything_else: {} } } },
    });
    await queueRun("POST_MATCH_DEBRIEF_CHANGE", debrief.id);

    const summary = await processQualitativeExtractionBatch();
    expect(summary).toMatchObject({ claimed: 1, succeeded: 1 });
    expect(fakeAdapter.executeReviewCalls).toHaveLength(0);
  });

  it("supersedes the prior successful run for the same source when a later claim succeeds again", async () => {
    const { match, debrief } = await seedBothChangedDebrief();
    fakeAdapter.setNextExecuteResponse({ version: "1", observations: [{ scope: "TEAM", playerRef: null, secondaryPlayerRef: null, phase: "GENERAL", polarity: "NEUTRAL", period: null, statement: "First extraction.", explicitness: "EXPLICIT" }] });
    await queueRun("POST_MATCH_DEBRIEF_CHANGE", debrief.id, "fp-1");
    await processQualitativeExtractionBatch();

    const firstRun = await testDb.qualitativeEvidenceExtractionRun.findFirstOrThrow({ where: { sourceId: debrief.id } });
    expect(firstRun.supersededAt).toBeNull();

    fakeAdapter.setNextExecuteResponse({ version: "1", observations: [{ scope: "TEAM", playerRef: null, secondaryPlayerRef: null, phase: "GENERAL", polarity: "NEUTRAL", period: null, statement: "Revised extraction.", explicitness: "EXPLICIT" }] });
    await queueRun("POST_MATCH_DEBRIEF_CHANGE", debrief.id, "fp-2");
    await processQualitativeExtractionBatch();

    const supersededFirstRun = await testDb.qualitativeEvidenceExtractionRun.findUniqueOrThrow({ where: { id: firstRun.id } });
    expect(supersededFirstRun.supersededAt).not.toBeNull();

    const evidence = await getQualitativeEvidenceForMatch({ matchId: match.id }, organisationId);
    expect(evidence.map((o) => o.statement)).toEqual(["Revised extraction."]);
  });
});

describe("processQualitativeExtractionBatch — failure/eligibility handling", () => {
  it("requeues a transient provider failure with attempts incremented", async () => {
    const { debrief } = await seedBothChangedDebrief();
    fakeAdapter.forceNextExecuteFailure("PROVIDER_RATE_LIMITED");
    await queueRun("POST_MATCH_DEBRIEF_CHANGE", debrief.id);

    const summary = await processQualitativeExtractionBatch();
    expect(summary).toMatchObject({ claimed: 1, retried: 1, failed: 0 });

    const run = await testDb.qualitativeEvidenceExtractionRun.findFirstOrThrow({ where: { sourceId: debrief.id } });
    expect(run.status).toBe("QUEUED");
    expect(run.attempts).toBe(1);
    expect(run.failureCode).toBe("PROVIDER_RATE_LIMITED");
    expect(run.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("fails a non-retryable provider error immediately", async () => {
    const { debrief } = await seedBothChangedDebrief();
    fakeAdapter.forceNextExecuteFailure("PROVIDER_AUTH_FAILED");
    await queueRun("POST_MATCH_DEBRIEF_CHANGE", debrief.id);

    const summary = await processQualitativeExtractionBatch();
    expect(summary).toMatchObject({ claimed: 1, retried: 0, failed: 1 });

    const run = await testDb.qualitativeEvidenceExtractionRun.findFirstOrThrow({ where: { sourceId: debrief.id } });
    expect(run.status).toBe("FAILED");
  });

  it("fails (never retries) a provider response that fails shape validation", async () => {
    const warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => undefined);
    const { debrief } = await seedBothChangedDebrief();
    fakeAdapter.setNextExecuteResponse({ notTheContract: true });
    await queueRun("POST_MATCH_DEBRIEF_CHANGE", debrief.id);

    const summary = await processQualitativeExtractionBatch();
    expect(summary).toMatchObject({ claimed: 1, retried: 0, failed: 1 });

    const run = await testDb.qualitativeEvidenceExtractionRun.findFirstOrThrow({ where: { sourceId: debrief.id } });
    expect(run.status).toBe("FAILED");
    expect(run.failureCode).toBe("PROVIDER_OUTPUT_INVALID");
    warnSpy.mockRestore();
  });

  it("fails a PLAYER-scoped observation since no player refs are ever supplied for this source", async () => {
    const warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => undefined);
    const { debrief } = await seedBothChangedDebrief();
    fakeAdapter.setNextExecuteResponse({ version: "1", observations: [{ scope: "PLAYER", playerRef: "P01", secondaryPlayerRef: null, phase: "GENERAL", polarity: "NEUTRAL", period: null, statement: "Played well.", explicitness: "EXPLICIT" }] });
    await queueRun("POST_MATCH_DEBRIEF_CHANGE", debrief.id);

    const summary = await processQualitativeExtractionBatch();
    expect(summary).toMatchObject({ failed: 1 });
    const run = await testDb.qualitativeEvidenceExtractionRun.findFirstOrThrow({ where: { sourceId: debrief.id } });
    expect(run.failureCode).toBe("PROVIDER_OUTPUT_INVALID");
    warnSpy.mockRestore();
  });

  it("skips as not-eligible when AI is disabled between enqueue and claim", async () => {
    const { debrief } = await seedBothChangedDebrief();
    await queueRun("POST_MATCH_DEBRIEF_CHANGE", debrief.id);
    await testDb.organisationAiSettings.update({ where: { organisationId }, data: { enabled: false } });

    const summary = await processQualitativeExtractionBatch();
    expect(summary).toMatchObject({ claimed: 1, skippedNotEligible: 1 });
    expect(fakeAdapter.executeReviewCalls).toHaveLength(0);
  });

  it("fails as no-longer-eligible when the source debrief no longer exists", async () => {
    await queueRun("POST_MATCH_DEBRIEF_CHANGE", "does-not-exist");

    const summary = await processQualitativeExtractionBatch();
    expect(summary).toMatchObject({ claimed: 1, failed: 1 });
    const run = await testDb.qualitativeEvidenceExtractionRun.findFirstOrThrow({ where: { sourceId: "does-not-exist" } });
    expect(run.failureCode).toBe("SCOPE_NO_LONGER_ELIGIBLE");
  });
});
