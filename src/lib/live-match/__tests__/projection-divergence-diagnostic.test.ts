import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, getTestDb, seedTestFixture, createTestGroup } from "@/test/test-db";
import type { TestFixtureIds } from "@/test/test-db";

/**
 * ADR-0138 Bundle 9 — the diagnostic must never write to Neon and must correctly detect
 * divergence between the replayed canonical stream and the materialized post-match report.
 */

vi.mock("@/lib/db", () => ({
  get db() {
    return getTestDb();
  },
}));

let db: PrismaClient;
let fixture: TestFixtureIds;
let matchId: string;

describe("checkLeagueProjectionDivergence (ADR-0138 Bundle 9)", () => {
  beforeAll(async () => {
    db = await setupTestDb();
    fixture = await seedTestFixture(db);
    matchId = Object.values(fixture.matches)[0];
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it("reports no session, no events, no materialized comparison when nothing exists yet", async () => {
    const { checkLeagueProjectionDivergence } = await import("../projection-divergence-diagnostic");
    const result = await checkLeagueProjectionDivergence(matchId);

    expect(result.sessionId).toBeNull();
    expect(result.canonicalEventCount).toBe(0);
    expect(result.materialized).toBeNull();
    expect(result.diverged).toBe(false);
  });

  it("replays canonical events and agrees with a matching LOCKED report", async () => {
    const player = fixture.players[0];
    const session = await db.liveMatchSession.create({
      data: { matchId, organisationId: fixture.organisationId, coachId: "test-coach", status: "ACTIVE" },
    });
    await db.liveMatchEvent.create({
      data: {
        matchId,
        sessionId: session.id,
        eventType: "GOAL_FOR",
        playerId: player.id,
        organisationId: fixture.organisationId,
        clientEventId: `client-${Math.random()}`,
        sequence: 1,
      },
    });
    await db.postMatchReport.create({
      data: { matchId, status: "LOCKED", homeGoals: 1, awayGoals: 0, organisationId: fixture.organisationId },
    });

    const { checkLeagueProjectionDivergence } = await import("../projection-divergence-diagnostic");
    const result = await checkLeagueProjectionDivergence(matchId);

    expect(result.sessionId).toBe(session.id);
    expect(result.canonicalEventCount).toBe(1);
    expect(result.replayed).toEqual({ goalsFor: 1, goalsAgainst: 0, onFieldCount: 0 });
    expect(result.materialized).toEqual({ goalsFor: 1, goalsAgainst: 0, reportStatus: "LOCKED" });
    expect(result.diverged).toBe(false);
  });

  it("flags divergence when the replayed score disagrees with the materialized report", async () => {
    const match2Id = Object.values(fixture.matches)[1];
    const player = fixture.players[1];
    const session = await db.liveMatchSession.create({
      data: { matchId: match2Id, organisationId: fixture.organisationId, coachId: "test-coach", status: "ACTIVE" },
    });
    await db.liveMatchEvent.create({
      data: {
        matchId: match2Id,
        sessionId: session.id,
        eventType: "GOAL_FOR",
        playerId: player.id,
        organisationId: fixture.organisationId,
        clientEventId: `client-${Math.random()}`,
        sequence: 1,
      },
    });
    await db.postMatchReport.create({
      data: { matchId: match2Id, status: "LOCKED", homeGoals: 2, awayGoals: 0, organisationId: fixture.organisationId },
    });

    const { checkLeagueProjectionDivergence } = await import("../projection-divergence-diagnostic");
    const result = await checkLeagueProjectionDivergence(match2Id);

    expect(result.diverged).toBe(true);
    expect(result.notes.some((n) => n.includes("Score divergence"))).toBe(true);
  });

  it("does not compare against a DRAFT report (not yet materialized)", async () => {
    const match3Id = Object.values(fixture.matches)[2];
    await db.postMatchReport.create({
      data: { matchId: match3Id, status: "DRAFT", homeGoals: 5, awayGoals: 5, organisationId: fixture.organisationId },
    });

    const { checkLeagueProjectionDivergence } = await import("../projection-divergence-diagnostic");
    const result = await checkLeagueProjectionDivergence(match3Id);

    expect(result.materialized).toBeNull();
    expect(result.diverged).toBe(false);
    expect(result.notes.some((n) => n.includes("not yet materialized"))).toBe(true);
  });
});

describe("checkEventProjectionDivergence (ADR-0138 Bundle 9)", () => {
  let eventOrgId: string;
  let eventGroupId: string;
  let eventMatchId: string;

  beforeAll(async () => {
    db = await setupTestDb();
    const org = await db.organisation.upsert({
      where: { slug: "test-org-projection-divergence" },
      update: {},
      create: { name: "Test Org Projection Divergence", slug: "test-org-projection-divergence" },
    });
    eventOrgId = org.id;
    eventGroupId = await createTestGroup(db, eventOrgId);

    const event = await db.event.create({
      data: {
        name: "Diagnostic Cup",
        eventType: "CUP",
        startsAt: new Date("2028-01-01T09:00:00Z"),
        endsAt: new Date("2028-01-01T17:00:00Z"),
        gameFormat: "SEVEN_A_SIDE",
        organisationId: eventOrgId,
        footballGroupId: eventGroupId,
      },
    });
    const squad = await db.eventSquad.create({
      data: { name: "Squad 1", intent: "BALANCED", targetSize: 5, eventId: event.id, generationOrder: 0, organisationId: eventOrgId },
    });
    const match = await db.eventMatch.create({
      data: {
        eventId: event.id,
        eventSquadId: squad.id,
        category: "CUP",
        organisationId: eventOrgId,
        opponentName: "Opponent",
        startsAt: new Date("2028-01-01T10:00:00Z"),
        status: "SCHEDULED",
      },
    });
    eventMatchId = match.id;
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it("replays canonical events and agrees with a matching LOCKED Event report", async () => {
    const session = await db.eventLiveMatchSession.create({
      data: { eventMatchId, organisationId: eventOrgId, coachId: "test-coach", status: "ACTIVE" },
    });
    await db.eventLiveMatchEvent.create({
      data: {
        eventMatchId,
        sessionId: session.id,
        eventType: "GOAL_AGAINST",
        organisationId: eventOrgId,
        clientEventId: `client-${Math.random()}`,
        sequence: 1,
      },
    });
    await db.eventPostMatchReport.create({
      data: { eventMatchId, status: "LOCKED", ourScore: 0, opponentScore: 1, organisationId: eventOrgId },
    });

    const { checkEventProjectionDivergence } = await import("../projection-divergence-diagnostic");
    const result = await checkEventProjectionDivergence(eventMatchId);

    expect(result.subjectType).toBe("EVENT");
    expect(result.canonicalEventCount).toBe(1);
    expect(result.replayed).toEqual({ goalsFor: 0, goalsAgainst: 1, onFieldCount: 0 });
    expect(result.materialized).toEqual({ goalsFor: 0, goalsAgainst: 1, reportStatus: "LOCKED" });
    expect(result.diverged).toBe(false);
  });
});
