import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, getTestDb, seedTestFixture, type TestFixtureIds } from "@/test/test-db";
import { mockAuthContext } from "@/test/support/auth-mock";

const auth = mockAuthContext({ userId: "test-coach", email: "coach@test.com" });

vi.mock("@/lib/db", () => ({
  get db() { return getTestDb(); },
}));

let testDb: PrismaClient;
let fixture: TestFixtureIds;

// ADR-0146 §1/§2: the effective match format resolves and freezes exactly once, at the same
// transition that creates the LiveMatchSession/EventLiveMatchSession row.
describe("Live Reporting start — match-format freeze", () => {
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixture = await seedTestFixture(testDb);
    auth.updateOrganisationId(fixture.organisationId);
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  describe("League", () => {
    it("snapshots nothing when no Season/Team/Match format is configured", async () => {
      const { startLiveSession } = await import("../live-match-session");
      const matchId = fixture.matches["Bla"];
      await startLiveSession(matchId);

      const session = await testDb.liveMatchSession.findUnique({ where: { matchId } });
      expect(session?.formatNumberOfPeriods).toBeNull();
      expect(session?.formatSource).toBeNull();
      expect(session?.formatSnapshotAt).toBeNull();
    });

    it("snapshots the Season default when configured", async () => {
      await testDb.leagueSeason.update({
        where: { id: fixture.leagueSeasonId },
        data: { defaultNumberOfPeriods: 2, defaultPeriodDurationMinutes: 25, defaultBreakDurationMinutes: 10 },
      });

      const { startLiveSession } = await import("../live-match-session");
      const matchId = fixture.matches["Hvit"];
      await startLiveSession(matchId);

      const session = await testDb.liveMatchSession.findUnique({ where: { matchId } });
      expect(session?.formatNumberOfPeriods).toBe(2);
      expect(session?.formatPeriodDurationMinutes).toBe(25);
      expect(session?.formatBreakDurationMinutes).toBe(10);
      expect(session?.formatSource).toBe("SEASON");
      expect(session?.formatSnapshotAt).not.toBeNull();
    });

    it("snapshots a Team override over the Season default", async () => {
      const teamId = fixture.teams["Rod"];
      await testDb.team.update({
        where: { id: teamId },
        data: { numberOfPeriodsOverride: 1, periodDurationMinutesOverride: 40, breakDurationMinutesOverride: 0 },
      });

      const { startLiveSession } = await import("../live-match-session");
      const matchId = fixture.matches["Rod"];
      await startLiveSession(matchId);

      const session = await testDb.liveMatchSession.findUnique({ where: { matchId } });
      expect(session?.formatNumberOfPeriods).toBe(1);
      expect(session?.formatPeriodDurationMinutes).toBe(40);
      expect(session?.formatSource).toBe("TEAM");
    });

    it("does not re-resolve the snapshot on a repeated idempotent start (freeze invariant)", async () => {
      const { startLiveSession } = await import("../live-match-session");
      const matchId = fixture.matches["Hvit"];

      // Season format already snapshotted as 2x25/10 above. Change the Season default now.
      await testDb.leagueSeason.update({
        where: { id: fixture.leagueSeasonId },
        data: { defaultPeriodDurationMinutes: 35 },
      });

      await startLiveSession(matchId); // idempotent — session is already ACTIVE

      const session = await testDb.liveMatchSession.findUnique({ where: { matchId } });
      expect(session?.formatPeriodDurationMinutes).toBe(25); // unchanged — frozen at first start
    });
  });

  describe("Event", () => {
    async function seedEventMatch(overrides: {
      numberOfHalves?: number;
      matchDurationMinutes?: number | null;
      breakDurationMinutes?: number | null;
    } = {}) {
      const group = await testDb.footballGroup.findFirstOrThrow({ where: { organisationId: fixture.organisationId } });
      const event = await testDb.event.create({
        data: {
          organisationId: fixture.organisationId,
          name: "Test Cup",
          eventType: "CUP",
          startsAt: new Date("2026-06-01"),
          gameFormat: "ELEVEN_A_SIDE",
          footballGroupId: group.id,
          numberOfHalves: overrides.numberOfHalves ?? 1,
          matchDurationMinutes: overrides.matchDurationMinutes === undefined ? null : overrides.matchDurationMinutes,
          breakDurationMinutes: overrides.breakDurationMinutes ?? null,
        },
      });
      const squad = await testDb.eventSquad.create({
        data: {
          organisationId: fixture.organisationId,
          eventId: event.id,
          name: "Squad A",
          intent: "COMPETITIVE",
          targetSize: 11,
        },
      });
      const eventMatch = await testDb.eventMatch.create({
        data: {
          organisationId: fixture.organisationId,
          eventId: event.id,
          eventSquadId: squad.id,
          opponentName: "Opponent",
          startsAt: new Date("2026-06-01"),
        },
      });
      return eventMatch.id;
    }

    it("snapshots nothing when the Event's own duration is unset", async () => {
      const eventMatchId = await seedEventMatch({ matchDurationMinutes: null });
      const { startEventLiveSession } = await import("../event-live-match-session");
      await startEventLiveSession(eventMatchId);

      const session = await testDb.eventLiveMatchSession.findUnique({ where: { eventMatchId } });
      expect(session?.formatNumberOfPeriods).toBeNull();
      expect(session?.formatSource).toBeNull();
    });

    it("snapshots the Event's configured format with source EVENT", async () => {
      const eventMatchId = await seedEventMatch({ numberOfHalves: 2, matchDurationMinutes: 20, breakDurationMinutes: 5 });
      const { startEventLiveSession } = await import("../event-live-match-session");
      await startEventLiveSession(eventMatchId);

      const session = await testDb.eventLiveMatchSession.findUnique({ where: { eventMatchId } });
      expect(session?.formatNumberOfPeriods).toBe(2);
      expect(session?.formatPeriodDurationMinutes).toBe(20);
      expect(session?.formatBreakDurationMinutes).toBe(5);
      expect(session?.formatSource).toBe("EVENT");
    });
  });
});
