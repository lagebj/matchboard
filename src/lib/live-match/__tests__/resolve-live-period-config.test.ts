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

// ADR-0146: the live clock consumes the frozen Live Reporting snapshot when one exists, and
// otherwise falls back to the existing pre-ADR-0146 config unchanged.
describe("resolveLeagueMatchPeriodConfig", () => {
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixture = await seedTestFixture(testDb);
    auth.updateOrganisationId(fixture.organisationId);
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it("falls back to the legacy hardcoded config when Live Reporting has not started", async () => {
    const { resolveLeagueMatchPeriodConfig } = await import("../resolve-live-period-config");
    const { getLeaguePeriodConfig } = await import("../period-config");
    const matchId = fixture.matches["Bla"];

    const config = await resolveLeagueMatchPeriodConfig(matchId, "LEAGUE");
    expect(config).toEqual(getLeaguePeriodConfig("LEAGUE"));
  });

  it("uses the frozen snapshot once Live Reporting has started with a configured format", async () => {
    await testDb.leagueSeason.update({
      where: { id: fixture.leagueSeasonId },
      data: { defaultNumberOfPeriods: 2, defaultPeriodDurationMinutes: 30, defaultBreakDurationMinutes: 12 },
    });

    const { startLiveSession } = await import("../live-match-session");
    const matchId = fixture.matches["Hvit"];
    await startLiveSession(matchId);

    const { resolveLeagueMatchPeriodConfig } = await import("../resolve-live-period-config");
    const config = await resolveLeagueMatchPeriodConfig(matchId, "LEAGUE");
    expect(config.find((p) => p.key === "FIRST_HALF")?.durationMs).toBe(30 * 60 * 1000);
    expect(config.find((p) => p.key === "HALF_TIME")?.durationMs).toBe(12 * 60 * 1000);
  });

  it("a later Season format change does not change an already-started match's resolved config (freeze)", async () => {
    await testDb.leagueSeason.update({
      where: { id: fixture.leagueSeasonId },
      data: { defaultPeriodDurationMinutes: 99 },
    });

    const { resolveLeagueMatchPeriodConfig } = await import("../resolve-live-period-config");
    const matchId = fixture.matches["Hvit"];
    const config = await resolveLeagueMatchPeriodConfig(matchId, "LEAGUE");
    expect(config.find((p) => p.key === "FIRST_HALF")?.durationMs).toBe(30 * 60 * 1000);
  });
});

describe("resolveEventMatchPeriodConfig", () => {
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixture = await seedTestFixture(testDb);
    auth.updateOrganisationId(fixture.organisationId);
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  async function seedEventMatch(overrides: { numberOfHalves?: number; matchDurationMinutes?: number | null; breakDurationMinutes?: number | null } = {}) {
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
        matchDurationMinutes: overrides.matchDurationMinutes === undefined ? 20 : overrides.matchDurationMinutes,
        breakDurationMinutes: overrides.breakDurationMinutes ?? null,
      },
    });
    const squad = await testDb.eventSquad.create({
      data: { organisationId: fixture.organisationId, eventId: event.id, name: "Squad A", intent: "COMPETITIVE", targetSize: 11 },
    });
    const eventMatch = await testDb.eventMatch.create({
      data: { organisationId: fixture.organisationId, eventId: event.id, eventSquadId: squad.id, opponentName: "Opponent", startsAt: new Date("2026-06-01") },
    });
    return eventMatch.id;
  }

  it("falls back to the pre-live effective timing when no session exists", async () => {
    const eventMatchId = await seedEventMatch({ numberOfHalves: 1, matchDurationMinutes: 20 });
    const { resolveEventMatchPeriodConfig } = await import("../resolve-live-period-config");

    const config = await resolveEventMatchPeriodConfig({
      eventMatchId,
      fallbackMatchDurationMinutes: 20,
      fallbackNumberOfHalves: 1,
      fallbackBreakDurationMinutes: null,
    });
    expect(config.find((p) => p.key === "FIRST_HALF")?.durationMs).toBe(20 * 60 * 1000);
  });

  it("uses the frozen snapshot once Live Reporting has started", async () => {
    const eventMatchId = await seedEventMatch({ numberOfHalves: 2, matchDurationMinutes: 25, breakDurationMinutes: 5 });
    const { startEventLiveSession } = await import("../event-live-match-session");
    await startEventLiveSession(eventMatchId);

    // Change the Event's configured duration AFTER Live Reporting started.
    await testDb.event.update({
      where: { id: (await testDb.eventMatch.findUniqueOrThrow({ where: { id: eventMatchId } })).eventId },
      data: { matchDurationMinutes: 99 },
    });

    const { resolveEventMatchPeriodConfig } = await import("../resolve-live-period-config");
    const config = await resolveEventMatchPeriodConfig({
      eventMatchId,
      fallbackMatchDurationMinutes: 99,
      fallbackNumberOfHalves: 2,
      fallbackBreakDurationMinutes: 5,
    });
    // Frozen at 25, not the post-start change to 99.
    expect(config.find((p) => p.key === "FIRST_HALF")?.durationMs).toBe(25 * 60 * 1000);
  });
});
