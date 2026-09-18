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

    it("TEST-PLAN §2: changing a Team override after Live Reporting start does not alter the already-frozen snapshot", async () => {
      const { startLiveSession } = await import("../live-match-session");
      const matchId = fixture.matches["Rod"];
      const teamId = fixture.teams["Rod"];

      // "Rod" was already started above with the Team override snapshotted as 1x40/0.
      await testDb.team.update({
        where: { id: teamId },
        data: { periodDurationMinutesOverride: 90 },
      });

      await startLiveSession(matchId); // idempotent — session is already ACTIVE

      const session = await testDb.liveMatchSession.findUnique({ where: { matchId } });
      expect(session?.formatPeriodDurationMinutes).toBe(40); // unchanged — frozen at first start
      expect(session?.formatSource).toBe("TEAM");
    });

    it("TEST-PLAN §2: a pre-live Match override is what actually snapshots, with source MATCH", async () => {
      // A fresh, never-started match — the existing three fixture matches are already ACTIVE
      // from the tests above.
      const match = await testDb.match.create({
        data: {
          matchRoundId: fixture.matchRoundId,
          teamId: fixture.teams["Bla"],
          opponent: "Match-override opponent",
          startsAt: new Date("2025-05-05T10:00:00Z"),
          homeAway: "HOME",
          squadSize: 11,
          matchType: "FRIENDLY",
          gameFormat: "ELEVEN_A_SIDE",
          organisationId: fixture.organisationId,
          // Complete Match-level override (ADR-0146 precedence: Match > Team > Season) — the
          // Season default is already 2x35/10 (mutated by an earlier test in this file) and the
          // "Bla" team has no override, so a resolvable Match override is the only way to prove
          // MATCH wins at the top of precedence in an integration (not unit) test.
          numberOfPeriodsOverride: 2,
          periodDurationMinutesOverride: 15,
          breakDurationMinutesOverride: 3,
        },
      });

      const { startLiveSession } = await import("../live-match-session");
      await startLiveSession(match.id);

      const session = await testDb.liveMatchSession.findUnique({ where: { matchId: match.id } });
      expect(session?.formatNumberOfPeriods).toBe(2);
      expect(session?.formatPeriodDurationMinutes).toBe(15);
      expect(session?.formatBreakDurationMinutes).toBe(3);
      expect(session?.formatSource).toBe("MATCH");
    });

    it("TEST-PLAN §5: a repeated start leaves the session's actual startedAt (the TTL anchor) untouched, not just the format snapshot", async () => {
      const { startLiveSession } = await import("../live-match-session");
      const matchId = fixture.matches["Hvit"];

      const before = await testDb.liveMatchSession.findUniqueOrThrow({ where: { matchId }, select: { startedAt: true } });

      await startLiveSession(matchId); // idempotent — session is already ACTIVE
      await startLiveSession(matchId); // and again, for good measure

      const after = await testDb.liveMatchSession.findUniqueOrThrow({ where: { matchId }, select: { startedAt: true } });
      expect(after.startedAt.getTime()).toBe(before.startedAt.getTime());
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
