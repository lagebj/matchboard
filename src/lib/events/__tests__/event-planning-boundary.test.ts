import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, getTestDb, seedTestFixture, type TestFixtureIds } from "@/test/test-db";
import { isPlanningBoundaryClosed } from "@/lib/selection/planning-boundary";
import { isEventMatchLineupEditable } from "@/lib/events/event-planning-boundary";

vi.mock("@/lib/db", () => ({
  get db() {
    return getTestDb();
  },
}));

const FUTURE = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
const PAST = new Date(Date.now() - 24 * 60 * 60 * 1000);

/**
 * ARR-0038 / Consolidation Programme C2: League and Event match line-up editability share one
 * planning-boundary definition (`isPlanningBoundaryClosed`), with only intentional differences
 * kept in the per-container adapters.
 */
describe("shared planning-boundary predicate (isPlanningBoundaryClosed)", () => {
  it("open while scheduled and in the future", () => {
    expect(isPlanningBoundaryClosed({ matchStatus: "SCHEDULED", startsAt: FUTURE }).editable).toBe(true);
  });

  it("closed once kickoff has passed", () => {
    const r = isPlanningBoundaryClosed({ matchStatus: "SCHEDULED", startsAt: PAST });
    expect(r.editable).toBe(false);
    expect(r.reason).toMatch(/kickoff has passed/i);
  });

  it("closed while a live session is ACTIVE", () => {
    expect(
      isPlanningBoundaryClosed({ matchStatus: "SCHEDULED", startsAt: FUTURE, liveSessionStatus: "ACTIVE" }).editable,
    ).toBe(false);
  });

  it("closed for a cancelled match", () => {
    expect(isPlanningBoundaryClosed({ matchStatus: "CANCELLED", startsAt: FUTURE }).editable).toBe(false);
  });

  it("Event-only: closed once a post-match report exists (any status)", () => {
    for (const reportStatus of ["DRAFT", "REPORTED", "LOCKED"] as const) {
      expect(
        isPlanningBoundaryClosed({ matchStatus: "SCHEDULED", startsAt: FUTURE, reportStatus }).editable,
      ).toBe(false);
    }
    expect(
      isPlanningBoundaryClosed({ matchStatus: "SCHEDULED", startsAt: FUTURE, reportStatus: "NONE" }).editable,
    ).toBe(true);
  });

  it("League and Event produce the same decision for the same football facts", () => {
    const facts = { matchStatus: "SCHEDULED", startsAt: PAST } as const;
    // League adapter passes its planningClosedAt marker; Event passes null. Same core decision.
    const league = isPlanningBoundaryClosed({ ...facts, planningClosedAt: null });
    const event = isPlanningBoundaryClosed({ ...facts, planningClosedAt: null, reportStatus: "NONE" });
    expect(league.editable).toBe(event.editable);
    expect(league.reason).toBe(event.reason);
  });
});

describe("isEventMatchLineupEditable (Event adapter)", () => {
  let testDb: PrismaClient;
  let fixture: TestFixtureIds;
  let eventId: string;
  let squadId: string;

  beforeAll(async () => {
    testDb = await setupTestDb();
    fixture = await seedTestFixture(testDb);
    const event = await testDb.event.create({
      data: {
        name: "C2 boundary event",
        eventType: "CUP",
        startsAt: FUTURE,
        gameFormat: "ELEVEN_A_SIDE",
        organisationId: fixture.organisationId,
        footballGroupId: fixture.footballGroupId,
      },
    });
    eventId = event.id;
    const squad = await testDb.eventSquad.create({
      data: { eventId, name: "Squad A", intent: "COMPETITIVE", targetSize: 11, generationOrder: 0, organisationId: fixture.organisationId },
    });
    squadId = squad.id;
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  async function makeMatch(startsAt: Date) {
    return testDb.eventMatch.create({
      data: {
        eventId,
        eventSquadId: squadId,
        opponentName: "Opp",
        startsAt,
        organisationId: fixture.organisationId,
      },
    });
  }

  it("editable for a future event match with no report or live session", async () => {
    const m = await makeMatch(FUTURE);
    expect((await isEventMatchLineupEditable(m.id)).editable).toBe(true);
  });

  it("not editable once the event match kickoff has passed", async () => {
    const m = await makeMatch(PAST);
    const r = await isEventMatchLineupEditable(m.id);
    expect(r.editable).toBe(false);
    expect(r.reason).toMatch(/kickoff has passed/i);
  });

  it("not editable once a post-match report exists", async () => {
    const m = await makeMatch(FUTURE);
    await testDb.eventPostMatchReport.create({
      data: { eventMatchId: m.id, status: "DRAFT", organisationId: fixture.organisationId },
    });
    expect((await isEventMatchLineupEditable(m.id)).editable).toBe(false);
  });

  it("not editable for a missing event match", async () => {
    expect((await isEventMatchLineupEditable("does-not-exist")).editable).toBe(false);
  });
});
