import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, seedTestFixture, getTestDb, type TestFixtureIds } from "@/test/test-db";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({
  get db() {
    return getTestDb();
  },
}));

import { getCompletedMatchAdvisorViewModel } from "@/lib/ai/presentation/completed-match-advisor";
import { buildPostMatchReviewContext } from "@/lib/ai/context/post-match-review";
import { computeSourceFingerprint } from "@/lib/ai/fingerprints";
import { generateAiProviderConnectionId } from "@/lib/ai/connection-id";

let testDb: PrismaClient;
let fixtureIds: TestFixtureIds;

async function lockReport(matchId: string) {
  const match = await testDb.match.findUniqueOrThrow({ where: { id: matchId }, select: { homeAway: true } });
  return testDb.postMatchReport.create({
    data: {
      matchId,
      status: "LOCKED",
      organisationId: fixtureIds.organisationId,
      homeGoals: match.homeAway === "HOME" ? 2 : 0,
      awayGoals: match.homeAway === "HOME" ? 0 : 2,
    },
  });
}

async function enableAi(organisationId: string) {
  const connectionId = generateAiProviderConnectionId();
  await testDb.aiProviderConnection.create({
    data: { id: connectionId, organisationId, provider: "OPENAI", status: "READY", model: "gpt-5" },
  });
  await testDb.organisationAiSettings.create({
    data: { organisationId, enabled: true, activeConnectionId: connectionId, postMatchReviewEnabled: true },
  });
}

describe("ai/presentation/completed-match-advisor", () => {
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixtureIds = await seedTestFixture(testDb, { playersPerTeam: 4 });
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await testDb.aiAdvisorInsight.deleteMany({});
    await testDb.aiAdvisorReview.deleteMany({});
    await testDb.aiAdvisorJob.deleteMany({});
    await testDb.organisationAiSettings.deleteMany({});
    await testDb.aiProviderConnection.deleteMany({});
    await testDb.goal.deleteMany({});
    await testDb.assist.deleteMany({});
    await testDb.postMatchPlayerActual.deleteMany({});
    await testDb.postMatchReport.deleteMany({});
  });

  it("returns null when AI is not enabled for the organisation, even with a SUCCEEDED review present", async () => {
    const matchId = fixtureIds.matches["Bla"];
    const report = await lockReport(matchId);
    const context = await buildPostMatchReviewContext({ organisationId: fixtureIds.organisationId, scopeId: matchId });
    const fingerprint = computeSourceFingerprint(context!.normalizedContext);

    const review = await testDb.aiAdvisorReview.create({
      data: {
        organisationId: fixtureIds.organisationId,
        capability: "POST_MATCH_REVIEW",
        scopeType: "MATCH",
        scopeId: matchId,
        sourceFingerprint: fingerprint,
        status: "SUCCEEDED",
        contractVersion: "1",
        terminologyVersion: "1",
        completedAt: new Date(),
      },
    });
    await testDb.aiAdvisorInsight.create({
      data: {
        organisationId: fixtureIds.organisationId,
        reviewId: review.id,
        kind: "OBSERVATION",
        subjectType: "MATCH",
        subjectId: matchId,
        title: "Strong first half",
        body: "The team dominated possession in the first half.",
        evidenceRefs: [],
      },
    });

    const result = await getCompletedMatchAdvisorViewModel({ organisationId: fixtureIds.organisationId, matchId });
    expect(result).toBeNull();
    void report;
  });

  it("returns null when there is no SUCCEEDED review for this match", async () => {
    const matchId = fixtureIds.matches["Bla"];
    await lockReport(matchId);
    await enableAi(fixtureIds.organisationId);

    const result = await getCompletedMatchAdvisorViewModel({ organisationId: fixtureIds.organisationId, matchId });
    expect(result).toBeNull();
  });

  it("returns null when the review has zero ACTIVE insights", async () => {
    const matchId = fixtureIds.matches["Bla"];
    await lockReport(matchId);
    await enableAi(fixtureIds.organisationId);
    const context = await buildPostMatchReviewContext({ organisationId: fixtureIds.organisationId, scopeId: matchId });
    const fingerprint = computeSourceFingerprint(context!.normalizedContext);

    const review = await testDb.aiAdvisorReview.create({
      data: {
        organisationId: fixtureIds.organisationId,
        capability: "POST_MATCH_REVIEW",
        scopeType: "MATCH",
        scopeId: matchId,
        sourceFingerprint: fingerprint,
        status: "SUCCEEDED",
        contractVersion: "1",
        terminologyVersion: "1",
        completedAt: new Date(),
      },
    });
    await testDb.aiAdvisorInsight.create({
      data: {
        organisationId: fixtureIds.organisationId,
        reviewId: review.id,
        kind: "OBSERVATION",
        subjectType: "MATCH",
        subjectId: matchId,
        title: "Dismissed",
        body: "No longer relevant.",
        evidenceRefs: [],
        state: "DISMISSED",
      },
    });

    const result = await getCompletedMatchAdvisorViewModel({ organisationId: fixtureIds.organisationId, matchId });
    expect(result).toBeNull();
  });

  it("returns a stale view model with the old content shown unresolved, not hidden (ADR-0152 §17)", async () => {
    const matchId = fixtureIds.matches["Bla"];
    const [scorer] = fixtureIds.players.filter((p) => p.coreTeamName === "Bla");
    await lockReport(matchId);
    await enableAi(fixtureIds.organisationId);

    const review = await testDb.aiAdvisorReview.create({
      data: {
        organisationId: fixtureIds.organisationId,
        capability: "POST_MATCH_REVIEW",
        scopeType: "MATCH",
        scopeId: matchId,
        sourceFingerprint: "stale-fingerprint-does-not-match-current-report",
        status: "SUCCEEDED",
        contractVersion: "2",
        terminologyVersion: "1",
        summary: "Earlier summary.",
        completedAt: new Date(),
      },
    });
    await testDb.aiAdvisorInsight.create({
      data: {
        organisationId: fixtureIds.organisationId,
        reviewId: review.id,
        kind: "OBSERVATION",
        subjectType: "PLAYER",
        subjectId: scorer.id,
        title: "P01 stood out",
        body: "The team dominated possession in the first half.",
        evidenceRefs: [],
        analysisRole: "SUPPORTED",
      },
    });

    const result = await getCompletedMatchAdvisorViewModel({ organisationId: fixtureIds.organisationId, matchId });
    expect(result?.status).toBe("stale");
    if (result?.status !== "stale") return;
    expect(result.summary).toBe("Earlier summary.");
    // Never resolved for a stale review — the current refMap may not agree with this review's
    // own numbering, so an unresolved ref token is safer than a possibly-wrong name.
    expect(result.insights).toEqual([{ sectionLabel: "Supported", title: "P01 stood out", body: expect.any(String), evidenceSources: [] }]);
  });

  it("resolves ref tokens for a STALE review using the review's own persisted refMap (production regression: raw P01/M01 after the Slice-7 backfill flipped reviews stale)", async () => {
    const matchId = fixtureIds.matches["Bla"];
    const [scorer] = fixtureIds.players.filter((p) => p.coreTeamName === "Bla");
    await lockReport(matchId);
    await enableAi(fixtureIds.organisationId);

    // A stale review: the fingerprint no longer matches (e.g. the backfill landed new evidence
    // after this review ran) — but its own refMap was persisted at save time.
    const review = await testDb.aiAdvisorReview.create({
      data: {
        organisationId: fixtureIds.organisationId,
        capability: "POST_MATCH_REVIEW",
        scopeType: "MATCH",
        scopeId: matchId,
        sourceFingerprint: "stale-fingerprint-persisted-refmap",
        status: "SUCCEEDED",
        contractVersion: "2",
        terminologyVersion: "1",
        summary: "Earlier summary.",
        completedAt: new Date(),
        refMap: { P01: { subjectType: "PLAYER", entityId: scorer.id } },
      },
    });
    await testDb.aiAdvisorInsight.create({
      data: {
        organisationId: fixtureIds.organisationId,
        reviewId: review.id,
        kind: "OBSERVATION",
        subjectType: "PLAYER",
        subjectId: scorer.id,
        title: "P01 stood out",
        body: "P01 showed strong composure in front of goal.",
        evidenceRefs: [],
        analysisRole: "SUPPORTED",
      },
    });

    const result = await getCompletedMatchAdvisorViewModel({ organisationId: fixtureIds.organisationId, matchId });
    expect(result?.status).toBe("stale");
    if (result?.status !== "stale" && result?.status !== "fresh") return;
    // The persisted refMap is the exact map this review's tokens were assigned from — it stays
    // correct regardless of freshness, so the stale review's text resolves to real names.
    expect(result.insights[0].title).toContain(scorer.firstName);
    expect(result.insights[0].title).not.toContain("P01");
    expect(result.insights[0].body).not.toContain("P01");
  });

  it("ignores a malformed persisted refMap and falls back to the pre-column behaviour", async () => {
    const matchId = fixtureIds.matches["Bla"];
    await lockReport(matchId);
    await enableAi(fixtureIds.organisationId);

    const review = await testDb.aiAdvisorReview.create({
      data: {
        organisationId: fixtureIds.organisationId,
        capability: "POST_MATCH_REVIEW",
        scopeType: "MATCH",
        scopeId: matchId,
        sourceFingerprint: "stale-fingerprint-malformed-refmap",
        status: "SUCCEEDED",
        contractVersion: "2",
        terminologyVersion: "1",
        summary: "Earlier summary.",
        completedAt: new Date(),
        refMap: { "not-a-ref": { subjectType: "PLAYER", entityId: "x" }, P01: "not-an-object" },
      },
    });
    await testDb.aiAdvisorInsight.create({
      data: {
        organisationId: fixtureIds.organisationId,
        reviewId: review.id,
        kind: "OBSERVATION",
        subjectType: "NONE",
        title: "P01 stood out",
        body: "Text.",
        evidenceRefs: [],
        analysisRole: "SUPPORTED",
      },
    });

    const result = await getCompletedMatchAdvisorViewModel({ organisationId: fixtureIds.organisationId, matchId });
    expect(result?.status).toBe("stale");
    // Malformed persisted map -> no resolvable entries -> raw tokens, same as a null column.
    expect(result).not.toBeNull();
    if (result === null || (result.status !== "fresh" && result.status !== "stale")) return;
    expect(result.insights[0].title).toBe("P01 stood out");
  });

  it("groups insights by analysisRole in ADR-0152 §16's order, with a fallback bucket for a null/legacy role", async () => {
    const matchId = fixtureIds.matches["Bla"];
    await lockReport(matchId);
    await enableAi(fixtureIds.organisationId);
    const context = await buildPostMatchReviewContext({ organisationId: fixtureIds.organisationId, scopeId: matchId });
    const fingerprint = computeSourceFingerprint(context!.normalizedContext);

    const review = await testDb.aiAdvisorReview.create({
      data: {
        organisationId: fixtureIds.organisationId,
        capability: "POST_MATCH_REVIEW",
        scopeType: "MATCH",
        scopeId: matchId,
        sourceFingerprint: fingerprint,
        status: "SUCCEEDED",
        contractVersion: "2",
        terminologyVersion: "1",
        summary: "Solid overall performance.",
        completedAt: new Date(),
      },
    });
    const makeInsight = (title: string, analysisRole: "SUPPORTED" | "CONTRADICTED" | "UNRESOLVED" | "NEXT_FOCUS" | null, displayOrder: number) =>
      testDb.aiAdvisorInsight.create({
        data: {
          organisationId: fixtureIds.organisationId,
          reviewId: review.id,
          kind: "OBSERVATION",
          subjectType: "MATCH",
          subjectId: matchId,
          title,
          body: "Body text.",
          evidenceRefs: [`fact:score:M01`],
          analysisRole,
          displayOrder,
        },
      });
    await makeInsight("next focus item", "NEXT_FOCUS", 3);
    await makeInsight("supported item", "SUPPORTED", 0);
    await makeInsight("legacy item", null, 4);
    await makeInsight("contradicted item", "CONTRADICTED", 1);
    await makeInsight("unresolved item", "UNRESOLVED", 2);

    const result = await getCompletedMatchAdvisorViewModel({ organisationId: fixtureIds.organisationId, matchId });
    expect(result?.status).toBe("fresh");
    if (result?.status !== "fresh") return;
    expect(result.summary).toBe("Solid overall performance.");
    expect(result.insights.map((i) => [i.sectionLabel, i.title])).toEqual([
      ["Supported", "supported item"],
      ["Contradicted", "contradicted item"],
      ["Still unresolved", "unresolved item"],
      ["Next focus", "next focus item"],
      ["Observations", "legacy item"],
    ]);
    expect(result.insights[0]!.evidenceSources).toEqual(["Match data"]);
  });

  it("separates at most one EVIDENCE_GAP insight into its own clarification field", async () => {
    const matchId = fixtureIds.matches["Bla"];
    await lockReport(matchId);
    await enableAi(fixtureIds.organisationId);
    const context = await buildPostMatchReviewContext({ organisationId: fixtureIds.organisationId, scopeId: matchId });
    const fingerprint = computeSourceFingerprint(context!.normalizedContext);

    const review = await testDb.aiAdvisorReview.create({
      data: {
        organisationId: fixtureIds.organisationId,
        capability: "POST_MATCH_REVIEW",
        scopeType: "MATCH",
        scopeId: matchId,
        sourceFingerprint: fingerprint,
        status: "SUCCEEDED",
        contractVersion: "2",
        terminologyVersion: "1",
        summary: "Summary.",
        completedAt: new Date(),
      },
    });
    await testDb.aiAdvisorInsight.create({
      data: {
        organisationId: fixtureIds.organisationId,
        reviewId: review.id,
        kind: "OBSERVATION",
        subjectType: "MATCH",
        subjectId: matchId,
        title: "Unclear cause",
        body: "Difficulty progressing from defence.",
        evidenceRefs: [],
        analysisRole: "EVIDENCE_GAP",
        clarificationQuestion: "What was the main problem?",
        clarificationOptions: ["Passing options were not available", "Opponent pressure closed the first pass"],
      },
    });

    const result = await getCompletedMatchAdvisorViewModel({ organisationId: fixtureIds.organisationId, matchId });
    expect(result?.status).toBe("fresh");
    if (result?.status !== "fresh") return;
    expect(result.insights).toEqual([]);
    expect(result.clarification).toMatchObject({
      question: "What was the main problem?",
      options: ["Passing options were not available", "Opponent pressure closed the first pass"],
    });
  });

  it("shows only the first VISIBLE_INSIGHT_COUNT insights when there are more, ordered across sections", async () => {
    const matchId = fixtureIds.matches["Bla"];
    await lockReport(matchId);
    await enableAi(fixtureIds.organisationId);
    const context = await buildPostMatchReviewContext({ organisationId: fixtureIds.organisationId, scopeId: matchId });
    const fingerprint = computeSourceFingerprint(context!.normalizedContext);

    const review = await testDb.aiAdvisorReview.create({
      data: {
        organisationId: fixtureIds.organisationId,
        capability: "POST_MATCH_REVIEW",
        scopeType: "MATCH",
        scopeId: matchId,
        sourceFingerprint: fingerprint,
        status: "SUCCEEDED",
        contractVersion: "2",
        terminologyVersion: "1",
        summary: "Summary.",
        completedAt: new Date(),
      },
    });
    await testDb.aiAdvisorInsight.createMany({
      data: Array.from({ length: 7 }, (_, i) => ({
        organisationId: fixtureIds.organisationId,
        reviewId: review.id,
        kind: "OBSERVATION" as const,
        subjectType: "MATCH" as const,
        subjectId: matchId,
        title: `item ${i}`,
        body: "Body text.",
        evidenceRefs: [],
        analysisRole: "SUPPORTED" as const,
        displayOrder: i,
      })),
    });

    const result = await getCompletedMatchAdvisorViewModel({ organisationId: fixtureIds.organisationId, matchId });
    expect(result?.status).toBe("fresh");
    if (result?.status !== "fresh") return;
    expect(result.insights).toHaveLength(7);
  });

  it("returns fresh plain insights, resolving ephemeral refs back to real player names", async () => {
    const matchId = fixtureIds.matches["Bla"];
    const [scorer] = fixtureIds.players.filter((p) => p.coreTeamName === "Bla");
    const report = await lockReport(matchId);
    await testDb.postMatchPlayerActual.create({
      data: { reportId: report.id, matchId, playerId: scorer.id, attendanceStatus: "PRESENT", organisationId: fixtureIds.organisationId },
    });
    await enableAi(fixtureIds.organisationId);
    const context = await buildPostMatchReviewContext({ organisationId: fixtureIds.organisationId, scopeId: matchId });
    expect(context).not.toBeNull();
    const fingerprint = computeSourceFingerprint(context!.normalizedContext);

    const [scorerRef] = [...context!.refMap.entries()].find(([, target]) => target.entityId === scorer.id)!;

    const review = await testDb.aiAdvisorReview.create({
      data: {
        organisationId: fixtureIds.organisationId,
        capability: "POST_MATCH_REVIEW",
        scopeType: "MATCH",
        scopeId: matchId,
        sourceFingerprint: fingerprint,
        status: "SUCCEEDED",
        contractVersion: "1",
        terminologyVersion: "1",
        completedAt: new Date(),
      },
    });
    await testDb.aiAdvisorInsight.create({
      data: {
        organisationId: fixtureIds.organisationId,
        reviewId: review.id,
        kind: "OBSERVATION",
        subjectType: "PLAYER",
        subjectId: scorer.id,
        title: `${scorerRef} stood out`,
        body: `${scorerRef} showed strong composure in front of goal.`,
        evidenceRefs: [],
      },
    });

    const result = await getCompletedMatchAdvisorViewModel({ organisationId: fixtureIds.organisationId, matchId });
    expect(result?.status).toBe("fresh");
    if (result?.status !== "fresh") return;
    expect(result.insights).toHaveLength(1);
    expect(result.insights[0].title).toContain(scorer.firstName);
    expect(result.insights[0].title).not.toContain(scorerRef);
    expect(result.suggestions).toHaveLength(0);
  });

  it("separates a development-suggestion insight, resolving the player's real name into the title", async () => {
    const matchId = fixtureIds.matches["Bla"];
    const [player] = fixtureIds.players.filter((p) => p.coreTeamName === "Bla");
    await lockReport(matchId);
    await enableAi(fixtureIds.organisationId);
    const context = await buildPostMatchReviewContext({ organisationId: fixtureIds.organisationId, scopeId: matchId });
    const fingerprint = computeSourceFingerprint(context!.normalizedContext);

    const review = await testDb.aiAdvisorReview.create({
      data: {
        organisationId: fixtureIds.organisationId,
        capability: "POST_MATCH_REVIEW",
        scopeType: "MATCH",
        scopeId: matchId,
        sourceFingerprint: fingerprint,
        status: "SUCCEEDED",
        contractVersion: "1",
        terminologyVersion: "1",
        completedAt: new Date(),
      },
    });
    await testDb.aiAdvisorInsight.create({
      data: {
        organisationId: fixtureIds.organisationId,
        reviewId: review.id,
        kind: "DEVELOPMENT_SUGGESTION",
        subjectType: "PLAYER",
        subjectId: player.id,
        title: "Development suggestion",
        body: "Struggled to track back after losing possession in wide areas.",
        evidenceRefs: [],
        actionType: "CONFIRM_DEVELOPMENT_OBSERVATION",
        actionPayload: {
          playerId: player.id,
          category: "positional understanding",
          observation: "Struggled to track back after losing possession in wide areas.",
        },
      },
    });

    const result = await getCompletedMatchAdvisorViewModel({ organisationId: fixtureIds.organisationId, matchId });
    expect(result?.status).toBe("fresh");
    if (result?.status !== "fresh") return;
    expect(result.insights).toHaveLength(0);
    expect(result.suggestions).toHaveLength(1);
    expect(result.suggestions[0].title).toBe(`${player.firstName} ${player.lastName ?? ""}`.trim() + " · positional understanding");
  });

  it("returns status 'reviewing' when a job for the current fingerprint is QUEUED or RUNNING and no review exists yet", async () => {
    const matchId = fixtureIds.matches["Bla"];
    await lockReport(matchId);
    await enableAi(fixtureIds.organisationId);
    const context = await buildPostMatchReviewContext({ organisationId: fixtureIds.organisationId, scopeId: matchId });
    const fingerprint = computeSourceFingerprint(context!.normalizedContext);

    await testDb.aiAdvisorJob.create({
      data: { organisationId: fixtureIds.organisationId, capability: "POST_MATCH_REVIEW", scopeType: "MATCH", scopeId: matchId, sourceFingerprint: fingerprint, status: "QUEUED" },
    });

    const result = await getCompletedMatchAdvisorViewModel({ organisationId: fixtureIds.organisationId, matchId });
    expect(result).toEqual({ status: "reviewing" });
  });

  it("returns status 'unavailable' when the job for the current fingerprint has FAILED and no review exists yet", async () => {
    const matchId = fixtureIds.matches["Bla"];
    await lockReport(matchId);
    await enableAi(fixtureIds.organisationId);
    const context = await buildPostMatchReviewContext({ organisationId: fixtureIds.organisationId, scopeId: matchId });
    const fingerprint = computeSourceFingerprint(context!.normalizedContext);

    await testDb.aiAdvisorJob.create({
      data: {
        organisationId: fixtureIds.organisationId,
        capability: "POST_MATCH_REVIEW",
        scopeType: "MATCH",
        scopeId: matchId,
        sourceFingerprint: fingerprint,
        status: "FAILED",
        lastErrorCode: "PROVIDER_OUTPUT_INVALID",
      },
    });

    const result = await getCompletedMatchAdvisorViewModel({ organisationId: fixtureIds.organisationId, matchId });
    expect(result).toEqual({ status: "unavailable" });
  });

  it("prefers a stale-but-successful review's content over a reviewing/failed job for a newer fingerprint", async () => {
    const matchId = fixtureIds.matches["Bla"];
    await lockReport(matchId);
    await enableAi(fixtureIds.organisationId);
    const context = await buildPostMatchReviewContext({ organisationId: fixtureIds.organisationId, scopeId: matchId });
    const currentFingerprint = computeSourceFingerprint(context!.normalizedContext);

    await testDb.aiAdvisorJob.create({
      data: { organisationId: fixtureIds.organisationId, capability: "POST_MATCH_REVIEW", scopeType: "MATCH", scopeId: matchId, sourceFingerprint: currentFingerprint, status: "RUNNING" },
    });
    const review = await testDb.aiAdvisorReview.create({
      data: {
        organisationId: fixtureIds.organisationId,
        capability: "POST_MATCH_REVIEW",
        scopeType: "MATCH",
        scopeId: matchId,
        sourceFingerprint: "an-older-fingerprint",
        status: "SUCCEEDED",
        contractVersion: "2",
        terminologyVersion: "1",
        summary: "Old summary.",
        completedAt: new Date(),
      },
    });
    await testDb.aiAdvisorInsight.create({
      data: { organisationId: fixtureIds.organisationId, reviewId: review.id, kind: "OBSERVATION", subjectType: "MATCH", subjectId: matchId, title: "Old title", body: "Old body.", evidenceRefs: [] },
    });

    const result = await getCompletedMatchAdvisorViewModel({ organisationId: fixtureIds.organisationId, matchId });
    expect(result?.status).toBe("stale");
  });
});
