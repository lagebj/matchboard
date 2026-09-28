import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, seedTestFixture, getTestDb, type TestFixtureIds } from "@/test/test-db";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({
  get db() {
    return getTestDb();
  },
}));

import { buildRefDisplayNameMap, parsePersistedRefMap, resolveInsightText } from "@/lib/ai/presentation/resolve-insight-text";
import { enqueueAiJob } from "@/lib/ai/jobs/enqueue";
import { Prisma } from "@/generated/prisma/client";

let testDb: PrismaClient;
let fixtureIds: TestFixtureIds;

describe("resolve-insight-text: MATCH and ROUND refs resolve", () => {
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixtureIds = await seedTestFixture(testDb, { playersPerTeam: 4 });
  });

  it("resolves a MATCH ref to 'the match vs <opponent>' — even for the single-match capability where M01 is the viewed match", async () => {
    const matchId = fixtureIds.matches["Bla"];
    const match = await testDb.match.findUnique({ where: { id: matchId }, select: { opponent: true } });

    const refMap = new Map([["M01", { subjectType: "MATCH" as const, entityId: matchId }]] as const);
    const displayNameByRef = await buildRefDisplayNameMap(refMap);

    expect(displayNameByRef.get("M01")).toBe(`the match vs ${match!.opponent}`);
    expect(resolveInsightText("Pressing worked well in M01.", displayNameByRef)).toBe(
      `Pressing worked well in the match vs ${match!.opponent}.`,
    );
  });

  it("resolves a ROUND ref to the round's name", async () => {
    const roundId = fixtureIds.matchRoundId;
    const round = await testDb.matchRound.findUnique({ where: { id: roundId }, select: { name: true } });

    const refMap = new Map([["R01", { subjectType: "ROUND" as const, entityId: roundId }]] as const);
    const displayNameByRef = await buildRefDisplayNameMap(refMap);

    expect(displayNameByRef.get("R01")).toBe(round!.name);
  });

  it("leaves MATCH refs for a deleted match unresolved rather than guessing", async () => {
    const refMap = new Map([["M01", { subjectType: "MATCH" as const, entityId: "does-not-exist" }]] as const);
    const displayNameByRef = await buildRefDisplayNameMap(refMap);
    expect(displayNameByRef.has("M01")).toBe(false);
  });

  it("parsePersistedRefMap round-trips MATCH/ROUND targets and rejects malformed entries", () => {
    const parsed = parsePersistedRefMap({
      M01: { subjectType: "MATCH", entityId: "match-1" },
      R01: { subjectType: "ROUND", entityId: "round-1" },
      P01: { subjectType: "PLAYER", entityId: "player-1" },
      "bad ref": { subjectType: "PLAYER", entityId: "x" },
      P02: { subjectType: "NOT_A_REAL_TYPE", entityId: "y" },
      P03: 42,
    });
    expect(parsed).not.toBeNull();
    expect(parsed!.get("M01")).toEqual({ subjectType: "MATCH", entityId: "match-1" });
    expect(parsed!.get("R01")).toEqual({ subjectType: "ROUND", entityId: "round-1" });
    expect(parsed!.get("P01")).toEqual({ subjectType: "PLAYER", entityId: "player-1" });
    expect(parsed!.has("bad ref")).toBe(false);
    expect(parsed!.has("P02")).toBe(false);
    expect(parsed!.has("P03")).toBe(false);
  });
});

describe("enqueue: pre-refMap-column reviews do not block re-review (repair path)", () => {
  beforeEach(async () => {
    await testDb.aiAdvisorInsight.deleteMany({});
    await testDb.aiAdvisorReview.deleteMany({});
    await testDb.aiAdvisorJob.deleteMany({});
  });

  afterAll(async () => {
    // Single teardown for the whole file (the resolve describe deliberately has none — this
    // file owns one testDb lifecycle).
    await teardownTestDb();
  });

  it("re-enqueues a scope whose same-fingerprint SUCCEEDED review has a null refMap", async () => {
    await testDb.aiAdvisorReview.create({
      data: {
        organisationId: fixtureIds.organisationId,
        capability: "POST_MATCH_REVIEW",
        scopeType: "MATCH",
        scopeId: "match-repair",
        sourceFingerprint: "fp-repair",
        status: "SUCCEEDED",
        contractVersion: "2",
        terminologyVersion: "1",
        completedAt: new Date(),
        refMap: Prisma.DbNull,
      },
    });

    const outcome = await enqueueAiJob({
      organisationId: fixtureIds.organisationId,
      capability: "POST_MATCH_REVIEW",
      scopeType: "MATCH",
      scopeId: "match-repair",
      sourceFingerprint: "fp-repair",
    });
    expect(outcome.enqueued).toBe(true);
  });

  it("still skips a scope whose SUCCEEDED review already carries a persisted refMap (no infinite re-review)", async () => {
    await testDb.aiAdvisorReview.create({
      data: {
        organisationId: fixtureIds.organisationId,
        capability: "POST_MATCH_REVIEW",
        scopeType: "MATCH",
        scopeId: "match-healthy",
        sourceFingerprint: "fp-healthy",
        status: "SUCCEEDED",
        contractVersion: "2",
        terminologyVersion: "1",
        completedAt: new Date(),
        refMap: { P01: { subjectType: "PLAYER", entityId: "p1" } },
      },
    });

    const outcome = await enqueueAiJob({
      organisationId: fixtureIds.organisationId,
      capability: "POST_MATCH_REVIEW",
      scopeType: "MATCH",
      scopeId: "match-healthy",
      sourceFingerprint: "fp-healthy",
    });
    expect(outcome).toEqual({ enqueued: false, reason: "ALREADY_SUCCEEDED" });
  });

  it("the repaired review's runner short-circuit no longer treats the null-refMap review as done", async () => {
    await seedReview("match-repair", "fp-repair", null);
    await seedReview("match-healthy", "fp-healthy", { P01: { subjectType: "PLAYER", entityId: "p1" } });

    // The runner-side already-succeeded check shares REFMAP_PRESENT_FILTER; prove the filter
    // matches the exact row shapes the runner queries: a null-refMap SUCCEEDED row is invisible
    // to it, a refMap-carrying one is found.
    const { db } = await import("@/lib/db");
    const { REFMAP_PRESENT_FILTER } = await import("@/lib/ai/jobs/review-refmap");
    const preColumn = await db.aiAdvisorReview.findFirst({
      where: {
        organisationId: fixtureIds.organisationId,
        capability: "POST_MATCH_REVIEW",
        scopeType: "MATCH",
        scopeId: "match-repair",
        sourceFingerprint: "fp-repair",
        status: "SUCCEEDED",
        ...REFMAP_PRESENT_FILTER,
      },
      select: { id: true },
    });
    expect(preColumn).toBeNull();

    const healthy = await db.aiAdvisorReview.findFirst({
      where: {
        organisationId: fixtureIds.organisationId,
        capability: "POST_MATCH_REVIEW",
        scopeType: "MATCH",
        scopeId: "match-healthy",
        sourceFingerprint: "fp-healthy",
        status: "SUCCEEDED",
        ...REFMAP_PRESENT_FILTER,
      },
      select: { id: true },
    });
    expect(healthy).not.toBeNull();
  });

  async function seedReview(scopeId: string, fingerprint: string, refMap: object | null) {
    await testDb.aiAdvisorReview.create({
      data: {
        organisationId: fixtureIds.organisationId,
        capability: "POST_MATCH_REVIEW",
        scopeType: "MATCH",
        scopeId,
        sourceFingerprint: fingerprint,
        status: "SUCCEEDED",
        contractVersion: "2",
        terminologyVersion: "1",
        completedAt: new Date(),
        refMap: refMap ?? Prisma.DbNull,
      },
    });
  }
});