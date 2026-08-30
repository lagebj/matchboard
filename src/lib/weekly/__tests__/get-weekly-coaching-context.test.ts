import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, seedTestFixture, getTestDb, type TestFixtureIds } from "@/test/test-db";
import { createTestEvent, createTestEventSquad } from "@/test/support/factories";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";
import { formatIsoWeekKey } from "@/lib/date-utils";

vi.mock("@/lib/db", () => ({
  get db() { return getTestDb(); },
}));

import { getWeeklyCoachingContext } from "../get-weekly-coaching-context";

let testDb: PrismaClient;
let fixture: TestFixtureIds;

const FIXTURE_MATCH_DATE = new Date("2025-04-28T10:00:00Z");
const WEEK_KEY = formatIsoWeekKey(FIXTURE_MATCH_DATE);

function orgFilterFor(organisationId: string): OrgFilterMode {
  return {
    type: "org",
    filter: { organisationId },
    filterNullable: { organisationId },
    organisationId,
  };
}

describe("getWeeklyCoachingContext", () => {
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixture = await seedTestFixture(testDb, { playersPerTeam: 3 });
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await testDb.eventPostMatchPlayer.deleteMany({});
    await testDb.eventPostMatchReport.deleteMany({});
    await testDb.eventMatch.deleteMany({});
    await testDb.eventSquadPlayer.deleteMany({});
    await testDb.eventSquad.deleteMany({});
    await testDb.event.deleteMany({});
    await testDb.postMatchPlayerActual.deleteMany({});
    await testDb.postMatchReport.deleteMany({});
    await testDb.movementLedger.deleteMany({});
    await testDb.selection.deleteMany({});
  });

  it("returns an empty context when the league season has no matches that week", async () => {
    const result = await getWeeklyCoachingContext(orgFilterFor(fixture.organisationId), {
      leagueSeasonId: fixture.leagueSeasonId,
      weekKey: "2099-W01",
    });
    expect(result.context.activity.leagueMatches).toHaveLength(0);
    expect(result.context.activity.eventMatches).toHaveLength(0);
    expect(result.context.status).toBe("IN_PROGRESS");
  });

  it("returns an empty context with leagueSeasonId null when no league season exists yet", async () => {
    const result = await getWeeklyCoachingContext(orgFilterFor(fixture.organisationId), {
      leagueSeasonId: null,
      weekKey: WEEK_KEY,
    });
    expect(result.context.leagueSeasonId).toBeNull();
    expect(result.context.activity.leagueMatches).toHaveLength(0);
  });

  it("records league match activity and flags an incomplete report", async () => {
    const result = await getWeeklyCoachingContext(orgFilterFor(fixture.organisationId), {
      leagueSeasonId: fixture.leagueSeasonId,
      weekKey: WEEK_KEY,
    });
    const matchIds = Object.values(fixture.matches);
    expect(result.context.activity.leagueMatches.map((m) => m.matchId).sort()).toEqual([...matchIds].sort());
    for (const ref of result.context.activity.leagueMatches) {
      expect(ref.hasReport).toBe(false);
      expect(ref.isReportComplete).toBe(false);
    }
    expect(result.context.reporting.incompleteLeagueMatchIds.sort()).toEqual([...matchIds].sort());
  });

  it("flags a finalized selection with no PRESENT actual as plannedButAbsent", async () => {
    const blaMatchId = fixture.matches.Bla!;
    const player = fixture.players.find((p) => p.coreTeamId === fixture.teams.Bla)!;

    await testDb.selection.create({
      data: {
        organisationId: fixture.organisationId,
        matchId: blaMatchId,
        matchRoundId: fixture.matchRoundId,
        playerId: player.id,
        role: "CORE",
        status: "FINALIZED",
      },
    });

    const result = await getWeeklyCoachingContext(orgFilterFor(fixture.organisationId), {
      leagueSeasonId: fixture.leagueSeasonId,
      weekKey: WEEK_KEY,
    });

    expect(result.context.planActual.plannedButAbsent).toEqual([{ playerId: player.id, matchId: blaMatchId }]);
    expect(result.context.planActual.unplannedAppearances).toHaveLength(0);
    expect(result.playerDisplayById[player.id]).toBeDefined();
    expect(result.playerDisplayById[player.id]!.href).toBe(`/players/${player.id}`);
  });

  it("does not flag a finalized selection as plannedButAbsent once a PRESENT actual exists", async () => {
    const blaMatchId = fixture.matches.Bla!;
    const player = fixture.players.find((p) => p.coreTeamId === fixture.teams.Bla)!;

    await testDb.selection.create({
      data: {
        organisationId: fixture.organisationId,
        matchId: blaMatchId,
        matchRoundId: fixture.matchRoundId,
        playerId: player.id,
        role: "CORE",
        status: "FINALIZED",
      },
    });
    const report = await testDb.postMatchReport.create({
      data: { organisationId: fixture.organisationId, matchId: blaMatchId, status: "LOCKED" },
    });
    await testDb.postMatchPlayerActual.create({
      data: {
        organisationId: fixture.organisationId,
        matchId: blaMatchId,
        playerId: player.id,
        reportId: report.id,
        attendanceStatus: "PRESENT",
        source: "PLANNED",
      },
    });

    const result = await getWeeklyCoachingContext(orgFilterFor(fixture.organisationId), {
      leagueSeasonId: fixture.leagueSeasonId,
      weekKey: WEEK_KEY,
    });

    expect(result.context.planActual.plannedButAbsent).toHaveLength(0);
  });

  it("flags a PRESENT actual with no finalized selection as an unplanned appearance", async () => {
    const blaMatchId = fixture.matches.Bla!;
    const player = fixture.players.find((p) => p.coreTeamId === fixture.teams.Bla)!;

    const report = await testDb.postMatchReport.create({
      data: { organisationId: fixture.organisationId, matchId: blaMatchId, status: "REPORTED" },
    });
    await testDb.postMatchPlayerActual.create({
      data: {
        organisationId: fixture.organisationId,
        matchId: blaMatchId,
        playerId: player.id,
        reportId: report.id,
        attendanceStatus: "PRESENT",
        source: "UNPLANNED",
      },
    });

    const result = await getWeeklyCoachingContext(orgFilterFor(fixture.organisationId), {
      leagueSeasonId: fixture.leagueSeasonId,
      weekKey: WEEK_KEY,
    });

    expect(result.context.planActual.unplannedAppearances).toEqual([
      { playerId: player.id, matchId: blaMatchId, source: "LEAGUE" },
    ]);
  });

  it("includes a finalized SUPPORT movement ledger entry as a support appearance", async () => {
    const blaMatchId = fixture.matches.Bla!;
    const player = fixture.players.find((p) => p.coreTeamId === fixture.teams.Hvit)!;

    await testDb.movementLedger.create({
      data: {
        organisationId: fixture.organisationId,
        matchRoundId: fixture.matchRoundId,
        matchId: blaMatchId,
        playerId: player.id,
        fromTeamId: fixture.teams.Hvit!,
        toTeamId: fixture.teams.Bla!,
        role: "SUPPORT",
        isDraft: false,
      },
    });

    const result = await getWeeklyCoachingContext(orgFilterFor(fixture.organisationId), {
      leagueSeasonId: fixture.leagueSeasonId,
      weekKey: WEEK_KEY,
    });

    expect(result.context.movement.supportAppearances).toEqual([
      { playerId: player.id, matchId: blaMatchId, fromTeamId: fixture.teams.Hvit, toTeamId: fixture.teams.Bla },
    ]);
  });

  it("reaches COMPLETE status only once every match that week has a REPORTED/LOCKED report", async () => {
    const matchIds = Object.values(fixture.matches);
    for (const matchId of matchIds.slice(0, matchIds.length - 1)) {
      await testDb.postMatchReport.create({
        data: { organisationId: fixture.organisationId, matchId, status: "LOCKED" },
      });
    }

    const partial = await getWeeklyCoachingContext(orgFilterFor(fixture.organisationId), {
      leagueSeasonId: fixture.leagueSeasonId,
      weekKey: WEEK_KEY,
    });
    expect(partial.context.status).toBe("PROVISIONAL");
    expect(partial.context.noRecordedAppearance).toBeNull();

    await testDb.postMatchReport.create({
      data: { organisationId: fixture.organisationId, matchId: matchIds[matchIds.length - 1]!, status: "LOCKED" },
    });

    const complete = await getWeeklyCoachingContext(orgFilterFor(fixture.organisationId), {
      leagueSeasonId: fixture.leagueSeasonId,
      weekKey: WEEK_KEY,
    });
    expect(complete.context.status).toBe("COMPLETE");
    expect(complete.context.noRecordedAppearance).not.toBeNull();
  });

  it("flags noRecordedAppearance for a finalized selection with no actual row at all, once COMPLETE", async () => {
    const blaMatchId = fixture.matches.Bla!;
    const player = fixture.players.find((p) => p.coreTeamId === fixture.teams.Bla)!;

    await testDb.selection.create({
      data: {
        organisationId: fixture.organisationId,
        matchId: blaMatchId,
        matchRoundId: fixture.matchRoundId,
        playerId: player.id,
        role: "CORE",
        status: "FINALIZED",
      },
    });
    for (const matchId of Object.values(fixture.matches)) {
      await testDb.postMatchReport.create({
        data: { organisationId: fixture.organisationId, matchId, status: "LOCKED" },
      });
    }

    const result = await getWeeklyCoachingContext(orgFilterFor(fixture.organisationId), {
      leagueSeasonId: fixture.leagueSeasonId,
      weekKey: WEEK_KEY,
    });

    expect(result.context.status).toBe("COMPLETE");
    expect(result.context.noRecordedAppearance?.playerIds).toContain(player.id);
    // Also present in plannedButAbsent -- a data-quality gap is always a subset of "did not play".
    expect(result.context.planActual.plannedButAbsent.map((p) => p.playerId)).toContain(player.id);
  });

  it("CRITICAL: an Event appearance never satisfies a League noRecordedAppearance gap", async () => {
    const blaMatchId = fixture.matches.Bla!;
    const player = fixture.players.find((p) => p.coreTeamId === fixture.teams.Bla)!;

    await testDb.selection.create({
      data: {
        organisationId: fixture.organisationId,
        matchId: blaMatchId,
        matchRoundId: fixture.matchRoundId,
        playerId: player.id,
        role: "CORE",
        status: "FINALIZED",
      },
    });
    for (const matchId of Object.values(fixture.matches)) {
      await testDb.postMatchReport.create({
        data: { organisationId: fixture.organisationId, matchId, status: "LOCKED" },
      });
    }

    // The same player also has a PRESENT Event appearance in the same week -- this must never
    // "rescue" the League noRecordedAppearance/plannedButAbsent facts for that player.
    const event = await createTestEvent(testDb, fixture.organisationId, fixture.footballGroupId, {
      startDate: FIXTURE_MATCH_DATE,
    });
    const squad = await createTestEventSquad(testDb, fixture.organisationId, event.id);
    await testDb.eventSquadPlayer.create({
      data: {
        organisationId: fixture.organisationId,
        eventId: event.id,
        eventSquadId: squad.id,
        playerId: player.id,
      },
    });
    const eventMatch = await testDb.eventMatch.create({
      data: {
        organisationId: fixture.organisationId,
        eventId: event.id,
        eventSquadId: squad.id,
        opponentName: "Some Cup Opponent",
        startsAt: FIXTURE_MATCH_DATE,
      },
    });
    const eventReport = await testDb.eventPostMatchReport.create({
      data: { organisationId: fixture.organisationId, eventMatchId: eventMatch.id, status: "LOCKED" },
    });
    await testDb.eventPostMatchPlayer.create({
      data: {
        organisationId: fixture.organisationId,
        reportId: eventReport.id,
        playerId: player.id,
        attendanceStatus: "PRESENT",
      },
    });

    const result = await getWeeklyCoachingContext(orgFilterFor(fixture.organisationId), {
      leagueSeasonId: fixture.leagueSeasonId,
      weekKey: WEEK_KEY,
    });

    expect(result.context.status).toBe("COMPLETE");
    // Still flagged on the League side despite the Event appearance.
    expect(result.context.noRecordedAppearance?.playerIds).toContain(player.id);
    expect(result.context.planActual.plannedButAbsent.map((p) => p.playerId)).toContain(player.id);
  });

  it("scopes strictly by organisation -- another organisation's matches never appear", async () => {
    const otherOrgFixture = await seedTestFixture(testDb, {
      playersPerTeam: 1,
      createOrganisation: true,
      teams: [{ name: "Other Org Team" }],
      rotationPaths: [],
    });

    const result = await getWeeklyCoachingContext(orgFilterFor(fixture.organisationId), {
      leagueSeasonId: otherOrgFixture.leagueSeasonId,
      weekKey: WEEK_KEY,
    });

    expect(result.context.activity.leagueMatches).toHaveLength(0);
  });
});
