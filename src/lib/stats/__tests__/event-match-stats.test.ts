import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, seedTestFixture, getTestDb, type TestFixtureIds } from "@/test/test-db";
import { createTestEvent, createTestEventSquad } from "@/test/support/factories";

vi.mock("@/lib/db", () => ({
  get db() {
    return getTestDb();
  },
}));

import { getEventMatchesForEvent } from "../event-match-stats";

let testDb: PrismaClient;

/**
 * ADR-0152 §2 / issue #686 — Event's own match list must derive `isLive`/`livePrimaryAction`
 * from the same canonical `resolveLiveReportingPrimaryAction` resolver League Live
 * Reporting/Today/Match Details already consume, never a bare `liveSession != null` boolean.
 */
describe("getEventMatchesForEvent: live-session lifecycle parity (issue #686)", () => {
  let fixture: TestFixtureIds;
  let eventId: string;
  let eventSquadId: string;

  beforeAll(async () => {
    testDb = await setupTestDb();
    fixture = await seedTestFixture(testDb);
    const event = await createTestEvent(testDb, fixture.organisationId, fixture.footballGroupId);
    const squad = await createTestEventSquad(testDb, fixture.organisationId, event.id);
    eventId = event.id;
    eventSquadId = squad.id;
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  async function createMatch(overrides: Partial<{ opponentName: string }> = {}) {
    return testDb.eventMatch.create({
      data: {
        eventId,
        eventSquadId,
        category: "CUP",
        organisationId: fixture.organisationId,
        opponentName: overrides.opponentName ?? "Opponent",
        startsAt: new Date("2028-02-01T10:00:00Z"),
        status: "SCHEDULED",
      },
    });
  }

  it("reports isLive: false and livePrimaryAction: null when no live session exists", async () => {
    const match = await createMatch({ opponentName: "No Session FC" });

    const [result] = (await getEventMatchesForEvent(eventId)).filter((m) => m.id === match.id);

    expect(result.isLive).toBe(false);
    expect(result.livePrimaryAction).toBeNull();
  });

  it("resolves a non-null livePrimaryAction from a frozen format snapshot when ACTIVE", async () => {
    const match = await createMatch({ opponentName: "Live With Snapshot FC" });
    await testDb.eventLiveMatchSession.create({
      data: {
        eventMatchId: match.id,
        coachId: "test-user-id",
        organisationId: fixture.organisationId,
        status: "ACTIVE",
        clockPeriod: "FIRST_HALF",
        clockRunning: true,
        clockPeriodStartedAt: new Date(Date.now() - 5 * 60 * 1000),
        clockElapsedBeforeMs: 0,
        formatNumberOfPeriods: 2,
        formatPeriodDurationMinutes: 25,
        formatBreakDurationMinutes: 5,
      },
    });

    const [result] = (await getEventMatchesForEvent(eventId)).filter((m) => m.id === match.id);

    expect(result.isLive).toBe(true);
    expect(result.livePrimaryAction).toEqual({ kind: "END_PERIOD", period: "FIRST_HALF", label: "End first half" });
  });

  it("falls back to a generic 2-half config (never throws) when ACTIVE with no frozen snapshot", async () => {
    const match = await createMatch({ opponentName: "Live No Snapshot FC" });
    await testDb.eventLiveMatchSession.create({
      data: {
        eventMatchId: match.id,
        coachId: "test-user-id",
        organisationId: fixture.organisationId,
        status: "ACTIVE",
        clockPeriod: "FIRST_HALF",
        clockRunning: false,
      },
    });

    const [result] = (await getEventMatchesForEvent(eventId)).filter((m) => m.id === match.id);

    expect(result.isLive).toBe(true);
    expect(result.livePrimaryAction).not.toBeNull();
    expect(result.livePrimaryAction!.kind).toBe("RESUME_PERIOD");
  });

  it("reports isLive: false for an ENDED session", async () => {
    const match = await createMatch({ opponentName: "Ended Session FC" });
    await testDb.eventLiveMatchSession.create({
      data: {
        eventMatchId: match.id,
        coachId: "test-user-id",
        organisationId: fixture.organisationId,
        status: "ENDED",
        clockPeriod: "FULL_TIME",
        clockRunning: false,
      },
    });

    const [result] = (await getEventMatchesForEvent(eventId)).filter((m) => m.id === match.id);

    expect(result.isLive).toBe(false);
    expect(result.livePrimaryAction).toBeNull();
  });
});
