import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, seedTestFixture, getTestDb, type TestFixtureIds } from "@/test/test-db";
import { createTestMatch, createTestEvent, createTestEventSquad } from "@/test/support/factories";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({
  get db() {
    return getTestDb();
  },
}));

import { selectPreMatchExpectations } from "../pre-match-expectations";

/**
 * ADR-0152 §5 "Select the actual pre-match expectation" (bundle
 * `05_ASSISTANT_COACH_LEARNING_PIPELINE.md`).
 */

let testDb: PrismaClient;
let fixture: TestFixtureIds;

beforeAll(async () => {
  testDb = await setupTestDb();
  fixture = await seedTestFixture(testDb);
});

afterAll(async () => {
  await teardownTestDb();
});

async function createReview(params: { matchId: string; capability: "MATCH_PREP" | "LINEUP_REVIEW"; completedAt: Date; status?: "SUCCEEDED" | "FAILED"; fingerprint?: string }) {
  return testDb.aiAdvisorReview.create({
    data: {
      organisationId: fixture.organisationId,
      capability: params.capability,
      scopeType: "MATCH",
      scopeId: params.matchId,
      sourceFingerprint: params.fingerprint ?? `fp-${Math.random()}`,
      status: params.status ?? "SUCCEEDED",
      contractVersion: "2",
      terminologyVersion: "1",
      completedAt: params.completedAt,
    },
  });
}

async function createInsight(params: { reviewId: string; title: string; body: string; subjectId?: string; state?: "ACTIVE" | "DISMISSED" }) {
  return testDb.aiAdvisorInsight.create({
    data: {
      organisationId: fixture.organisationId,
      reviewId: params.reviewId,
      kind: "OBSERVATION",
      subjectType: params.subjectId ? "PLAYER" : "NONE",
      subjectId: params.subjectId ?? null,
      title: params.title,
      body: params.body,
      evidenceRefs: [],
      state: params.state ?? "ACTIVE",
    },
  });
}

describe("selectPreMatchExpectations — League", () => {
  beforeEach(async () => {
    await testDb.aiAdvisorInsight.deleteMany({});
    await testDb.aiAdvisorReview.deleteMany({});
    await testDb.liveMatchSession.deleteMany({});
    await testDb.postMatchReport.deleteMany({});
  });

  it("returns empty when neither a live session nor a report exists — never generates a retrospective review", async () => {
    const match = await createTestMatch(testDb, fixture.organisationId, fixture.matchRoundId, Object.values(fixture.teams)[0]!, null);
    const result = await selectPreMatchExpectations({ kind: "LEAGUE_MATCH", matchId: match.id, leagueSeasonId: null }, fixture.organisationId);
    expect(result).toEqual({ matchPrep: null, lineupReview: null });
  });

  it("uses the live session's startedAt as the cutoff, excluding a review completed after it", async () => {
    const match = await createTestMatch(testDb, fixture.organisationId, fixture.matchRoundId, Object.values(fixture.teams)[0]!, null);
    const sessionStart = new Date("2026-05-01T18:00:00Z");
    await testDb.liveMatchSession.create({ data: { matchId: match.id, organisationId: fixture.organisationId, coachId: "coach-1", startedAt: sessionStart } });

    await createReview({ matchId: match.id, capability: "MATCH_PREP", completedAt: new Date("2026-05-01T17:00:00Z") });
    await createReview({ matchId: match.id, capability: "MATCH_PREP", completedAt: new Date("2026-05-01T19:00:00Z") });

    const result = await selectPreMatchExpectations({ kind: "LEAGUE_MATCH", matchId: match.id, leagueSeasonId: null }, fixture.organisationId);
    expect(result.matchPrep?.completedAt).toEqual(new Date("2026-05-01T17:00:00Z"));
  });

  it("falls back to the report's createdAt when there is no live session", async () => {
    const match = await createTestMatch(testDb, fixture.organisationId, fixture.matchRoundId, Object.values(fixture.teams)[0]!, null);
    await testDb.postMatchReport.create({ data: { organisationId: fixture.organisationId, matchId: match.id, createdAt: new Date("2026-05-01T20:00:00Z") } });

    await createReview({ matchId: match.id, capability: "LINEUP_REVIEW", completedAt: new Date("2026-05-01T19:59:00Z") });
    await createReview({ matchId: match.id, capability: "LINEUP_REVIEW", completedAt: new Date("2026-05-01T20:01:00Z") });

    const result = await selectPreMatchExpectations({ kind: "LEAGUE_MATCH", matchId: match.id, leagueSeasonId: null }, fixture.organisationId);
    expect(result.lineupReview?.completedAt).toEqual(new Date("2026-05-01T19:59:00Z"));
  });

  it("selects the latest of several eligible reviews, not the earliest", async () => {
    const match = await createTestMatch(testDb, fixture.organisationId, fixture.matchRoundId, Object.values(fixture.teams)[0]!, null);
    await testDb.liveMatchSession.create({ data: { matchId: match.id, organisationId: fixture.organisationId, coachId: "coach-1", startedAt: new Date("2026-05-01T18:00:00Z") } });

    await createReview({ matchId: match.id, capability: "MATCH_PREP", completedAt: new Date("2026-04-28T10:00:00Z") });
    const latest = await createReview({ matchId: match.id, capability: "MATCH_PREP", completedAt: new Date("2026-04-30T10:00:00Z") });

    const result = await selectPreMatchExpectations({ kind: "LEAGUE_MATCH", matchId: match.id, leagueSeasonId: null }, fixture.organisationId);
    expect(result.matchPrep?.reviewId).toBe(latest.id);
  });

  it("ignores a non-SUCCEEDED review", async () => {
    const match = await createTestMatch(testDb, fixture.organisationId, fixture.matchRoundId, Object.values(fixture.teams)[0]!, null);
    await testDb.liveMatchSession.create({ data: { matchId: match.id, organisationId: fixture.organisationId, coachId: "coach-1", startedAt: new Date("2026-05-01T18:00:00Z") } });
    await createReview({ matchId: match.id, capability: "MATCH_PREP", completedAt: new Date("2026-04-30T10:00:00Z"), status: "FAILED" });

    const result = await selectPreMatchExpectations({ kind: "LEAGUE_MATCH", matchId: match.id, leagueSeasonId: null }, fixture.organisationId);
    expect(result.matchPrep).toBeNull();
  });

  it("resolves an insight's subjectId to a real player name, and excludes DISMISSED insights", async () => {
    const match = await createTestMatch(testDb, fixture.organisationId, fixture.matchRoundId, Object.values(fixture.teams)[0]!, null);
    await testDb.liveMatchSession.create({ data: { matchId: match.id, organisationId: fixture.organisationId, coachId: "coach-1", startedAt: new Date("2026-05-01T18:00:00Z") } });
    const review = await createReview({ matchId: match.id, capability: "MATCH_PREP", completedAt: new Date("2026-04-30T10:00:00Z") });

    const player = fixture.players[0]!;
    await createInsight({ reviewId: review.id, title: "Rotation plan", body: "P01 is expected to start on the right.", subjectId: player.id });
    await createInsight({ reviewId: review.id, title: "Dismissed note", body: "Should not appear.", state: "DISMISSED" });

    const result = await selectPreMatchExpectations({ kind: "LEAGUE_MATCH", matchId: match.id, leagueSeasonId: null }, fixture.organisationId);
    expect(result.matchPrep?.insights).toHaveLength(1);
    expect(result.matchPrep?.insights[0]).toMatchObject({ title: "Rotation plan", subjectName: `${player.firstName} ${player.lastName ?? ""}`.trim() });
  });
});

describe("selectPreMatchExpectations — Event parity", () => {
  it("resolves the cutoff via EventLiveMatchSession/EventPostMatchReport", async () => {
    const event = await createTestEvent(testDb, fixture.organisationId, fixture.footballGroupId);
    const squad = await createTestEventSquad(testDb, fixture.organisationId, event.id);
    const eventMatch = await testDb.eventMatch.create({
      data: { eventId: event.id, eventSquadId: squad.id, category: "CUP", organisationId: fixture.organisationId, opponentName: "Event Opponent", startsAt: new Date("2028-01-01T10:00:00Z"), status: "SCHEDULED" },
    });
    await testDb.eventLiveMatchSession.create({ data: { eventMatchId: eventMatch.id, organisationId: fixture.organisationId, coachId: "coach-1", startedAt: new Date("2028-01-01T10:00:00Z") } });

    await createReview({ matchId: eventMatch.id, capability: "MATCH_PREP", completedAt: new Date("2028-01-01T09:00:00Z") });
    await createReview({ matchId: eventMatch.id, capability: "MATCH_PREP", completedAt: new Date("2028-01-01T11:00:00Z") });

    const result = await selectPreMatchExpectations({ kind: "EVENT_MATCH", eventMatchId: eventMatch.id, eventId: event.id, evidenceLeagueSeasonId: null }, fixture.organisationId);
    expect(result.matchPrep?.completedAt).toEqual(new Date("2028-01-01T09:00:00Z"));
  });
});
