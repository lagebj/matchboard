import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";

vi.mock("server-only", () => ({}));

let testDb: PrismaClient;

vi.mock("@/lib/db", () => ({
  get db() {
    return testDb;
  },
}));

// Same isolation choice as jobs/__tests__/triggers.test.ts — this file tests the clarification
// service's own logic (validation, AiInsightClarification write, deterministic evidence
// conversion, retrigger call), not the real post_match_review context builder.
vi.mock("@/lib/ai/register-capabilities", () => ({}));

import { setupTestDb, teardownTestDb, seedTestFixture, type TestFixtureIds } from "@/test/test-db";
import { createTestMatch } from "@/test/support/factories";
import { registerAiCapabilityHandler, resetAiCapabilityHandlers, type AiCapabilityHandler } from "@/lib/ai/jobs/capability-handler";
import { answerAiInsightClarification } from "@/lib/ai/insight-clarification";

let fixture: TestFixtureIds;

beforeAll(async () => {
  testDb = await setupTestDb();
  fixture = await seedTestFixture(testDb);
});

afterAll(async () => {
  await teardownTestDb();
});

afterEach(() => {
  resetAiCapabilityHandlers();
});

const fakeContext = { normalizedContext: { x: 1 }, instructions: "x", refMap: new Map(), evidenceRefs: new Set<string>() };
function registerFakeHandler(capability: AiCapabilityHandler["capability"] = "POST_MATCH_REVIEW") {
  registerAiCapabilityHandler({ capability, buildContext: async () => fakeContext });
}

async function createEvidenceGapInsight(opts: {
  organisationId: string;
  scopeId: string;
  scopeType?: "MATCH" | "TEAM_WEEK" | "MATCH_ROUND" | "TEAM_WINDOW";
  subjectType?: "PLAYER" | "PLAYER_PAIR" | "TEAM" | "NONE";
  subjectId?: string | null;
  secondarySubjectId?: string | null;
  clarificationOptions?: string[];
  state?: "ACTIVE" | "DISMISSED";
  analysisRole?: "EVIDENCE_GAP" | "SUPPORTED" | null;
}) {
  const review = await testDb.aiAdvisorReview.create({
    data: {
      organisationId: opts.organisationId,
      capability: "POST_MATCH_REVIEW",
      scopeType: opts.scopeType ?? "MATCH",
      scopeId: opts.scopeId,
      sourceFingerprint: `fp-${Math.random()}`,
      status: "SUCCEEDED",
      contractVersion: "2",
      terminologyVersion: "1",
      completedAt: new Date(),
    },
  });
  return testDb.aiAdvisorInsight.create({
    data: {
      organisationId: opts.organisationId,
      reviewId: review.id,
      kind: "OBSERVATION",
      subjectType: opts.subjectType ?? "NONE",
      subjectId: opts.subjectId ?? null,
      secondarySubjectId: opts.secondarySubjectId ?? null,
      title: "Unclear cause",
      body: "Difficulty progressing from defence.",
      evidenceRefs: [],
      state: opts.state ?? "ACTIVE",
      analysisRole: opts.analysisRole === undefined ? "EVIDENCE_GAP" : opts.analysisRole,
      clarificationQuestion: "What was the main problem?",
      clarificationOptions: opts.clarificationOptions ?? ["Passing options were not available", "Opponent pressure closed the first pass"],
    },
  });
}

async function lockedLeagueMatch(organisationId: string) {
  const teamId = Object.values(fixture.teams)[0]!;
  const match = await createTestMatch(testDb, organisationId, fixture.matchRoundId, teamId, null);
  await testDb.postMatchReport.create({ data: { matchId: match.id, status: "LOCKED", organisationId } });
  return match;
}

describe("ai/insight-clarification: answerAiInsightClarification", () => {
  it("rejects an empty answer", async () => {
    const insight = await createEvidenceGapInsight({ organisationId: fixture.organisationId, scopeId: "match-x" });
    const result = await answerAiInsightClarification({ organisationId: fixture.organisationId, insightId: insight.id, answeredBy: "coach@test.dev" });
    expect(result).toEqual({ success: false, error: expect.any(String) });
  });

  it("rejects when the insight does not exist, is not ACTIVE, or has no clarification prompt", async () => {
    const dismissed = await createEvidenceGapInsight({ organisationId: fixture.organisationId, scopeId: "match-x", state: "DISMISSED" });
    const notAGap = await createEvidenceGapInsight({ organisationId: fixture.organisationId, scopeId: "match-x", analysisRole: "SUPPORTED" });

    const r1 = await answerAiInsightClarification({ organisationId: fixture.organisationId, insightId: "does-not-exist", selectedOption: "x", answeredBy: "c" });
    const r2 = await answerAiInsightClarification({ organisationId: fixture.organisationId, insightId: dismissed.id, selectedOption: "x", answeredBy: "c" });
    const r3 = await answerAiInsightClarification({ organisationId: fixture.organisationId, insightId: notAGap.id, selectedOption: "x", answeredBy: "c" });

    expect(r1.success).toBe(false);
    expect(r2.success).toBe(false);
    expect(r3.success).toBe(false);
  });

  it("rejects a selectedOption that isn't one of the persisted clarificationOptions", async () => {
    const insight = await createEvidenceGapInsight({ organisationId: fixture.organisationId, scopeId: "match-x" });
    const result = await answerAiInsightClarification({
      organisationId: fixture.organisationId,
      insightId: insight.id,
      selectedOption: "Something I made up",
      answeredBy: "coach@test.dev",
    });
    expect(result).toEqual({ success: false, error: expect.any(String) });
  });

  it("persists the answer in AiInsightClarification and allows re-answering (upsert)", async () => {
    registerFakeHandler();
    const insight = await createEvidenceGapInsight({ organisationId: fixture.organisationId, scopeId: "match-x" });

    const first = await answerAiInsightClarification({
      organisationId: fixture.organisationId,
      insightId: insight.id,
      selectedOption: "Passing options were not available",
      answeredBy: "coach@test.dev",
    });
    expect(first).toEqual({ success: true });

    const stored1 = await testDb.aiInsightClarification.findUnique({ where: { insightId: insight.id } });
    expect(stored1).toMatchObject({ selectedOption: "Passing options were not available", answeredBy: "coach@test.dev" });

    const second = await answerAiInsightClarification({
      organisationId: fixture.organisationId,
      insightId: insight.id,
      answerText: "Actually it was opponent pressure.",
      answeredBy: "coach2@test.dev",
    });
    expect(second).toEqual({ success: true });

    const stored2 = await testDb.aiInsightClarification.findUnique({ where: { insightId: insight.id } });
    expect(stored2).toMatchObject({ selectedOption: null, answerText: "Actually it was opponent pressure.", answeredBy: "coach2@test.dev" });
  });

  it("converts the answer into a deterministic AI_CLARIFICATION qualitative-evidence observation for a League match, scoped to the insight's player subject", async () => {
    registerFakeHandler();
    const match = await lockedLeagueMatch(fixture.organisationId);
    const [player] = fixture.players.filter((p) => p.coreTeamName === "Bla");
    const insight = await createEvidenceGapInsight({ organisationId: fixture.organisationId, scopeId: match.id, subjectType: "PLAYER", subjectId: player.id });

    const result = await answerAiInsightClarification({
      organisationId: fixture.organisationId,
      insightId: insight.id,
      selectedOption: "Opponent pressure closed the first pass",
      answeredBy: "coach@test.dev",
    });
    expect(result).toEqual({ success: true });

    const observations = await testDb.qualitativeEvidenceObservation.findMany({ where: { organisationId: fixture.organisationId, matchId: match.id } });
    expect(observations).toHaveLength(1);
    expect(observations[0]).toMatchObject({
      scope: "PLAYER",
      phase: "GENERAL",
      polarity: "UNCERTAIN",
      explicitness: "EXPLICIT",
      playerId: player.id,
      statement: expect.stringContaining("Opponent pressure closed the first pass"),
    });

    const run = await testDb.qualitativeEvidenceExtractionRun.findFirst({ where: { organisationId: fixture.organisationId, sourceType: "AI_CLARIFICATION", sourceId: insight.id } });
    expect(run).toMatchObject({ status: "SUCCEEDED", derivationMethod: "DETERMINISTIC" });
  });

  it("supersedes the prior AI_CLARIFICATION run when the coach changes their answer", async () => {
    registerFakeHandler();
    const match = await lockedLeagueMatch(fixture.organisationId);
    const insight = await createEvidenceGapInsight({ organisationId: fixture.organisationId, scopeId: match.id });

    await answerAiInsightClarification({ organisationId: fixture.organisationId, insightId: insight.id, selectedOption: "Passing options were not available", answeredBy: "coach@test.dev" });
    await answerAiInsightClarification({ organisationId: fixture.organisationId, insightId: insight.id, selectedOption: "Opponent pressure closed the first pass", answeredBy: "coach@test.dev" });

    const runs = await testDb.qualitativeEvidenceExtractionRun.findMany({ where: { organisationId: fixture.organisationId, sourceType: "AI_CLARIFICATION", sourceId: insight.id } });
    expect(runs).toHaveLength(2);
    expect(runs.filter((r) => r.status === "SUCCEEDED" && r.supersededAt === null)).toHaveLength(1);

    const activeObservations = await testDb.qualitativeEvidenceObservation.findMany({
      where: { organisationId: fixture.organisationId, matchId: match.id, extractionRun: { supersededAt: null } },
    });
    expect(activeObservations).toHaveLength(1);
    expect(activeObservations[0]!.statement).toContain("Opponent pressure closed the first pass");
  });

  it("skips qualitative-evidence conversion for a non-MATCH-scoped review but still succeeds and retriggers", async () => {
    registerFakeHandler();
    const insight = await createEvidenceGapInsight({ organisationId: fixture.organisationId, scopeId: "team-1:2026-W10", scopeType: "TEAM_WEEK" });

    const jobsBefore = await testDb.aiAdvisorJob.count({ where: { organisationId: fixture.organisationId } });
    await testDb.organisationAiSettings.upsert({
      where: { organisationId: fixture.organisationId },
      create: { organisationId: fixture.organisationId, enabled: true, postMatchReviewEnabled: true },
      update: { enabled: true, postMatchReviewEnabled: true },
    });

    const result = await answerAiInsightClarification({
      organisationId: fixture.organisationId,
      insightId: insight.id,
      selectedOption: "Passing options were not available",
      answeredBy: "coach@test.dev",
    });
    expect(result).toEqual({ success: true });

    const run = await testDb.qualitativeEvidenceExtractionRun.findFirst({ where: { organisationId: fixture.organisationId, sourceType: "AI_CLARIFICATION", sourceId: insight.id } });
    expect(run).toBeNull();

    const jobsAfter = await testDb.aiAdvisorJob.count({ where: { organisationId: fixture.organisationId } });
    expect(jobsAfter).toBeGreaterThan(jobsBefore);
  });

  it("retriggers the originating capability/scope after a successful answer", async () => {
    registerFakeHandler();
    const match = await lockedLeagueMatch(fixture.organisationId);
    const insight = await createEvidenceGapInsight({ organisationId: fixture.organisationId, scopeId: match.id });

    await testDb.organisationAiSettings.upsert({
      where: { organisationId: fixture.organisationId },
      create: { organisationId: fixture.organisationId, enabled: true, postMatchReviewEnabled: true },
      update: { enabled: true, postMatchReviewEnabled: true },
    });

    await answerAiInsightClarification({ organisationId: fixture.organisationId, insightId: insight.id, selectedOption: "Passing options were not available", answeredBy: "coach@test.dev" });

    const job = await testDb.aiAdvisorJob.findFirst({ where: { organisationId: fixture.organisationId, capability: "POST_MATCH_REVIEW", scopeType: "MATCH", scopeId: match.id } });
    expect(job).not.toBeNull();
  });
});
