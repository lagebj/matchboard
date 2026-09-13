import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, getTestDb, seedTestFixture } from "@/test/test-db";
import type { TestFixtureIds } from "@/test/test-db";
import { findReversedEventIds } from "../reversal-resolution";

describe("findReversedEventIds (pure)", () => {
  it("returns an empty set when there are no reversals", () => {
    const events = [
      { id: "a", correctionType: null, correctsEventId: null },
      { id: "b", correctionType: null, correctsEventId: null },
    ];
    expect(findReversedEventIds(events)).toEqual(new Set());
  });

  it("returns the target id of a REVERSAL row, not the reversal's own id", () => {
    const events = [
      { id: "goal-1", correctionType: null, correctsEventId: null },
      { id: "reversal-1", correctionType: "REVERSAL", correctsEventId: "goal-1" },
    ];
    expect(findReversedEventIds(events)).toEqual(new Set(["goal-1"]));
  });

  it("ignores a CORRECTION row (amends, does not reverse)", () => {
    const events = [
      { id: "goal-1", correctionType: null, correctsEventId: null },
      { id: "correction-1", correctionType: "CORRECTION", correctsEventId: "goal-1" },
    ];
    expect(findReversedEventIds(events)).toEqual(new Set());
  });

  it("collects multiple reversal targets", () => {
    const events = [
      { id: "a", correctionType: null, correctsEventId: null },
      { id: "b", correctionType: null, correctsEventId: null },
      { id: "rev-a", correctionType: "REVERSAL", correctsEventId: "a" },
      { id: "rev-b", correctionType: "REVERSAL", correctsEventId: "b" },
    ];
    expect(findReversedEventIds(events)).toEqual(new Set(["a", "b"]));
  });
});

vi.mock("@/lib/db", () => ({
  get db() {
    return getTestDb();
  },
}));

let db: PrismaClient;
let fixture: TestFixtureIds;

describe("getLeagueReversedEventIds / getEventReversedEventIds (DB-bound)", () => {
  beforeAll(async () => {
    db = await setupTestDb();
    fixture = await seedTestFixture(db);
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it("finds a League reversal target and ignores an unrelated goal", async () => {
    const matchId = Object.values(fixture.matches)[0];
    const session = await db.liveMatchSession.create({
      data: { matchId, organisationId: fixture.organisationId, coachId: "test-coach", status: "ACTIVE" },
    });
    const goal = await db.liveMatchEvent.create({
      data: {
        matchId,
        sessionId: session.id,
        eventType: "GOAL_FOR",
        organisationId: fixture.organisationId,
        clientEventId: `client-${Math.random()}`,
      },
    });
    await db.liveMatchEvent.create({
      data: {
        matchId,
        sessionId: session.id,
        eventType: "EVENT_REVERSED",
        correctionType: "REVERSAL",
        correctsEventId: goal.id,
        organisationId: fixture.organisationId,
        clientEventId: `client-${Math.random()}`,
      },
    });
    const unrelatedGoal = await db.liveMatchEvent.create({
      data: {
        matchId,
        sessionId: session.id,
        eventType: "GOAL_AGAINST",
        organisationId: fixture.organisationId,
        clientEventId: `client-${Math.random()}`,
      },
    });

    const { getLeagueReversedEventIds } = await import("../reversal-resolution");
    const result = await getLeagueReversedEventIds(matchId, fixture.organisationId);

    expect(result.has(goal.id)).toBe(true);
    expect(result.has(unrelatedGoal.id)).toBe(false);
  });

  it("finds an Event reversal target and ignores an unrelated goal", async () => {
    const org = await db.organisation.upsert({
      where: { slug: "test-org-reversal-resolution" },
      update: {},
      create: { name: "Test Org Reversal Resolution", slug: "test-org-reversal-resolution" },
    });
    const group = await db.footballGroup.create({
      data: { name: "Test Group", slug: `test-group-${Date.now()}`, type: "AGE_GROUP", organisationId: org.id },
    });
    const event = await db.event.create({
      data: {
        name: "Reversal Helper Event",
        eventType: "CUP",
        startsAt: new Date("2028-01-01T09:00:00Z"),
        gameFormat: "SEVEN_A_SIDE",
        organisationId: org.id,
        footballGroupId: group.id,
      },
    });
    const squad = await db.eventSquad.create({
      data: { name: "Squad 1", intent: "BALANCED", targetSize: 5, eventId: event.id, generationOrder: 0, organisationId: org.id },
    });
    const match = await db.eventMatch.create({
      data: {
        eventId: event.id,
        eventSquadId: squad.id,
        category: "CUP",
        organisationId: org.id,
        opponentName: "Opponent",
        startsAt: new Date("2028-01-01T10:00:00Z"),
        status: "SCHEDULED",
      },
    });
    const session = await db.eventLiveMatchSession.create({
      data: { eventMatchId: match.id, organisationId: org.id, coachId: "test-coach", status: "ACTIVE" },
    });
    const goal = await db.eventLiveMatchEvent.create({
      data: { eventMatchId: match.id, sessionId: session.id, eventType: "GOAL_FOR", organisationId: org.id, clientEventId: `client-${Math.random()}` },
    });
    await db.eventLiveMatchEvent.create({
      data: {
        eventMatchId: match.id,
        sessionId: session.id,
        eventType: "EVENT_REVERSED",
        correctionType: "REVERSAL",
        correctsEventId: goal.id,
        organisationId: org.id,
        clientEventId: `client-${Math.random()}`,
      },
    });
    const unrelatedGoal = await db.eventLiveMatchEvent.create({
      data: { eventMatchId: match.id, sessionId: session.id, eventType: "GOAL_AGAINST", organisationId: org.id, clientEventId: `client-${Math.random()}` },
    });

    const { getEventReversedEventIds } = await import("../reversal-resolution");
    const result = await getEventReversedEventIds(match.id, org.id);

    expect(result.has(goal.id)).toBe(true);
    expect(result.has(unrelatedGoal.id)).toBe(false);
  });
});
