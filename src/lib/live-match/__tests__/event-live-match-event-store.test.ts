import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, getTestDb, createTestGroup } from "@/test/test-db";
import { LiveMatchDomainError, LiveMatchSequenceIntegrityError } from "../live-match-event-store";

/**
 * ADR-0138 Bundle 8 — `recordEventForActorEvent()` is the Event equivalent of
 * `live-match-integration.test.ts`'s `recordEventForActor` coverage: it is the function the
 * internal HMAC-only persistence endpoint calls for an Event-subject request (closing ARR-0046's
 * "Event has zero coordinator involvement" finding). This file exercises the same
 * highest-value scenarios against real Event/EventMatch/EventLiveMatchSession fixtures rather
 * than reusing League's fixture helpers, which are League-schema-specific.
 */

vi.mock("@/lib/db", () => ({
  get db() {
    return getTestDb();
  },
}));

let db: PrismaClient;
let testOrgId: string;
let testGroupId: string;
let eventMatchId: string;
let sessionId: string;

async function createActiveSession(overrides: Record<string, unknown> = {}) {
  const event = await db.event.create({
    data: {
      name: `Event-${Math.random().toString(36).slice(2, 8)}`,
      eventType: "CUP",
      startsAt: new Date("2028-01-01T09:00:00Z"),
      endsAt: new Date("2028-01-01T17:00:00Z"),
      gameFormat: "SEVEN_A_SIDE",
      organisationId: testOrgId,
      footballGroupId: testGroupId,
    },
  });
  const squad = await db.eventSquad.create({
    data: { name: "Squad 1", intent: "BALANCED", targetSize: 5, eventId: event.id, generationOrder: 0, organisationId: testOrgId },
  });
  const match = await db.eventMatch.create({
    data: {
      eventId: event.id,
      eventSquadId: squad.id,
      category: "CUP",
      organisationId: testOrgId,
      opponentName: "Opponent",
      startsAt: new Date("2028-01-01T10:00:00Z"),
      status: "SCHEDULED",
    },
  });
  const session = await db.eventLiveMatchSession.create({
    data: {
      eventMatchId: match.id,
      organisationId: testOrgId,
      coachId: "test-coach",
      status: "ACTIVE",
      ...overrides,
    },
  });
  return { eventMatchId: match.id, sessionId: session.id };
}

describe("recordEventForActorEvent (ADR-0138 Bundle 8, Event coordinator parity)", () => {
  beforeAll(async () => {
    db = await setupTestDb();
    const org = await db.organisation.upsert({
      where: { slug: "test-org-event-live-match-event-store" },
      update: {},
      create: { name: "Test Org Event Live Match Event Store", slug: "test-org-event-live-match-event-store" },
    });
    testOrgId = org.id;
    testGroupId = await createTestGroup(db, testOrgId);
    ({ eventMatchId, sessionId } = await createActiveSession());
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it("persists an event given an explicit actor, with a coordinator-assigned sequence and acceptance time", async () => {
    const { recordEventForActorEvent } = await import("../event-live-match-event-store");
    const canonical = await recordEventForActorEvent(
      {
        eventMatchId,
        sessionId,
        eventType: "GOAL_FOR",
        clientEventId: `client-${Math.random()}`,
        sequence: 1,
        acceptedAtMs: Date.now(),
      },
      { userId: "test-coach", organisationId: testOrgId },
    );

    expect(canonical.eventType).toBe("GOAL_FOR");
    expect(canonical.sequence).toBe(1);
  });

  it("is idempotent on duplicate clientEventId — returns the existing canonical event, no second row", async () => {
    const { recordEventForActorEvent } = await import("../event-live-match-event-store");
    const clientEventId = `client-${Math.random()}`;
    const first = await recordEventForActorEvent(
      { eventMatchId, sessionId, eventType: "GOAL_FOR", clientEventId, sequence: 2, acceptedAtMs: Date.now() },
      { userId: "test-coach", organisationId: testOrgId },
    );
    const second = await recordEventForActorEvent(
      { eventMatchId, sessionId, eventType: "GOAL_FOR", clientEventId, sequence: 3, acceptedAtMs: Date.now() },
      { userId: "test-coach", organisationId: testOrgId },
    );

    expect(second.id).toBe(first.id);
    // The duplicate retry's own (different) sequence must never overwrite the first insert's.
    expect(second.sequence).toBe(2);
  });

  it("throws LiveMatchSequenceIntegrityError when a different clientEventId reuses an already-assigned sequence", async () => {
    const { recordEventForActorEvent } = await import("../event-live-match-event-store");
    await recordEventForActorEvent(
      { eventMatchId, sessionId, eventType: "GOAL_FOR", clientEventId: `client-${Math.random()}`, sequence: 100, acceptedAtMs: Date.now() },
      { userId: "test-coach", organisationId: testOrgId },
    );

    await expect(
      recordEventForActorEvent(
        { eventMatchId, sessionId, eventType: "GOAL_AGAINST", clientEventId: `client-${Math.random()}`, sequence: 100, acceptedAtMs: Date.now() },
        { userId: "test-coach", organisationId: testOrgId },
      ),
    ).rejects.toThrow(LiveMatchSequenceIntegrityError);
  });

  it("rejects an actor whose organisationId does not match the session's organisation", async () => {
    const { recordEventForActorEvent } = await import("../event-live-match-event-store");
    await expect(
      recordEventForActorEvent(
        { eventMatchId, sessionId, eventType: "GOAL_FOR", clientEventId: `client-${Math.random()}`, sequence: 200, acceptedAtMs: Date.now() },
        { userId: "test-coach", organisationId: "some-other-org" },
      ),
    ).rejects.toThrow(LiveMatchDomainError);
  });

  it("rejects a payload whose eventMatchId does not match the session's actual event match", async () => {
    const { recordEventForActorEvent } = await import("../event-live-match-event-store");
    await expect(
      recordEventForActorEvent(
        { eventMatchId: "wrong-event-match", sessionId, eventType: "GOAL_FOR", clientEventId: `client-${Math.random()}`, sequence: 201, acceptedAtMs: Date.now() },
        { userId: "test-coach", organisationId: testOrgId },
      ),
    ).rejects.toThrow(LiveMatchDomainError);
  });

  it("rejects an inactive session", async () => {
    const { recordEventForActorEvent } = await import("../event-live-match-event-store");
    const inactive = await createActiveSession({ status: "ENDED" });

    await expect(
      recordEventForActorEvent(
        { eventMatchId: inactive.eventMatchId, sessionId: inactive.sessionId, eventType: "GOAL_FOR", clientEventId: `client-${Math.random()}`, sequence: 1, acceptedAtMs: Date.now() },
        { userId: "test-coach", organisationId: testOrgId },
      ),
    ).rejects.toThrow(LiveMatchDomainError);
  });

  it("rejects a nonexistent session", async () => {
    const { recordEventForActorEvent } = await import("../event-live-match-event-store");
    await expect(
      recordEventForActorEvent(
        { eventMatchId, sessionId: "nonexistent-session", eventType: "GOAL_FOR", clientEventId: `client-${Math.random()}`, sequence: 1, acceptedAtMs: Date.now() },
        { userId: "test-coach", organisationId: testOrgId },
      ),
    ).rejects.toThrow(LiveMatchDomainError);
  });
});
