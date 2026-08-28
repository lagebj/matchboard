import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, seedTestFixture, getTestDb, type TestFixtureIds } from "@/test/test-db";
import { rebuildActualTimeline, rebuildEventActualTimeline, rebuildActualTimelineForRef } from "@/lib/evidence/actual-timeline";
import { runPostMatchLearning } from "@/lib/evidence/post-match-learning";
import { recordOpponentSportingEvidenceForRef } from "@/lib/opponents/sporting-level-recording";
import { buildLeagueMatchRef } from "@/lib/evidence/adapters/league-evidence-adapter";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";

vi.mock("@/lib/db", () => ({
  get db() {
    return getTestDb();
  },
}));

let testDb: PrismaClient;

/**
 * Covers ADR-0104's canonical post-match learning pipeline: the League actual-timeline
 * wiring bug fix (rebuildActualTimeline was never called in production before this
 * programme -- see report-mutations.ts's completeReport), the new Event-source branch of
 * opponent sporting evidence, the dual-FK CHECK constraints added by the
 * 20260831040000_generalize_evidence_for_event_matches migration, and the shared
 * orchestrator end to end for a League match.
 */
describe("Canonical post-match learning pipeline (ADR-0104)", () => {
  let fixtureIds: TestFixtureIds;
  let orgFilter: OrgFilterMode;

  beforeAll(async () => {
    testDb = await setupTestDb();
    fixtureIds = await seedTestFixture(testDb, { playersPerTeam: 4 });
    orgFilter = {
      type: "org",
      filter: { organisationId: fixtureIds.organisationId },
      filterNullable: { organisationId: fixtureIds.organisationId },
      organisationId: fixtureIds.organisationId,
    };
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  async function buildLeagueLineup(matchId: string, teamId: string, playerIds: string[]) {
    const formation = await testDb.formation.create({
      data: { name: "Test 1-2", gameFormat: "ELEVEN_A_SIDE", organisationId: fixtureIds.organisationId },
    });
    const slots = [];
    for (let i = 0; i < playerIds.length; i++) {
      const slot = await testDb.formationSlot.create({
        data: {
          formationId: formation.id,
          gridX: i,
          gridY: 0,
          label: `Slot ${i}`,
          shortLabel: `S${i}`,
          roleType: i === 0 ? "GOALKEEPER" : "DEFENDER",
          organisationId: fixtureIds.organisationId,
        },
      });
      slots.push(slot);
    }

    const lineup = await testDb.matchLineup.create({
      data: {
        matchId,
        teamId,
        formationId: formation.id,
        status: "CONFIRMED",
        organisationId: fixtureIds.organisationId,
      },
    });

    for (let i = 0; i < playerIds.length; i++) {
      await testDb.matchLineupAssignment.create({
        data: {
          matchLineupId: lineup.id,
          slotId: slots[i].id,
          playerId: playerIds[i],
          organisationId: fixtureIds.organisationId,
        },
      });
    }
  }

  it("rebuildActualTimeline creates ActualPositionInterval rows from a starting lineup (production wiring fix)", async () => {
    const matchId = fixtureIds.matches["Bla"];
    const teamId = fixtureIds.teams["Bla"];
    const players = fixtureIds.players.filter((p) => p.coreTeamId === teamId).slice(0, 3);

    await buildLeagueLineup(matchId, teamId, players.map((p) => p.id));

    const result = await rebuildActualTimeline(matchId);
    expect(result.intervalsCreated).toBeGreaterThan(0);

    const rows = await testDb.actualPositionInterval.findMany({ where: { matchId } });
    expect(rows.length).toBe(result.intervalsCreated);
    expect(rows.every((r) => r.matchId === matchId && r.eventMatchId === null)).toBe(true);
    expect(rows.some((r) => r.startedAtMs === 0)).toBe(true);
  });

  it("rebuildActualTimelineForRef dispatches League refs to rebuildActualTimeline", async () => {
    const matchId = fixtureIds.matches["Hvit"];
    const teamId = fixtureIds.teams["Hvit"];
    const players = fixtureIds.players.filter((p) => p.coreTeamId === teamId).slice(0, 2);
    await buildLeagueLineup(matchId, teamId, players.map((p) => p.id));

    const ref = await buildLeagueMatchRef(matchId);
    expect(ref.kind).toBe("LEAGUE_MATCH");

    const result = await rebuildActualTimelineForRef(ref);
    expect(result.intervalsCreated).toBeGreaterThan(0);
  });

  it("the ActualPositionInterval CHECK constraint rejects a row with neither match source set", async () => {
    await expect(
      testDb.$executeRaw`INSERT INTO "ActualPositionInterval" (id, "organisationId", "matchId", "eventMatchId", "playerId", position, "startedAtMs", source, "createdAt", "updatedAt")
         VALUES ('bad-interval-1', ${fixtureIds.organisationId}, NULL, NULL, ${fixtureIds.players[0].id}, 'GK', 0, 'STARTING_LINEUP'::"ActualIntervalSource", now(), now())`,
    ).rejects.toThrow();
  });

  it("the ActualPositionInterval CHECK constraint rejects a row with both match sources set", async () => {
    const matchId = fixtureIds.matches["Rod"];
    const event = await testDb.event.create({
      data: {
        name: "Test Event",
        eventType: "CUP",
        startsAt: new Date("2025-05-01"),
        gameFormat: "SEVEN_A_SIDE",
        footballGroupId: fixtureIds.footballGroupId,
        organisationId: fixtureIds.organisationId,
      },
    });
    const squad = await testDb.eventSquad.create({
      data: { eventId: event.id, name: "Squad A", intent: "BALANCED", targetSize: 7, organisationId: fixtureIds.organisationId },
    });
    const eventMatch = await testDb.eventMatch.create({
      data: {
        eventId: event.id,
        eventSquadId: squad.id,
        opponentName: "Both-source test opponent",
        startsAt: new Date("2025-05-01T10:00:00Z"),
        organisationId: fixtureIds.organisationId,
      },
    });

    await expect(
      testDb.$executeRaw`INSERT INTO "ActualPositionInterval" (id, "organisationId", "matchId", "eventMatchId", "playerId", position, "startedAtMs", source, "createdAt", "updatedAt")
         VALUES ('bad-interval-2', ${fixtureIds.organisationId}, ${matchId}, ${eventMatch.id}, ${fixtureIds.players[0].id}, 'GK', 0, 'STARTING_LINEUP'::"ActualIntervalSource", now(), now())`,
    ).rejects.toThrow();
  });

  it("recordOpponentSportingEvidenceForRef records evidence for an Event match, keyed on eventMatchId not matchId", async () => {
    const event = await testDb.event.create({
      data: {
        name: "Evidence Event",
        eventType: "TOURNAMENT",
        startsAt: new Date("2025-05-10"),
        gameFormat: "SEVEN_A_SIDE",
        footballGroupId: fixtureIds.footballGroupId,
        organisationId: fixtureIds.organisationId,
      },
    });
    const squad = await testDb.eventSquad.create({
      data: { eventId: event.id, name: "Squad B", intent: "BALANCED", targetSize: 7, organisationId: fixtureIds.organisationId },
    });
    const opponentTeam = await testDb.opponentTeam.create({
      data: { displayName: "Event Opponent", normalizedName: "event opponent", organisationId: fixtureIds.organisationId },
    });
    const eventMatch = await testDb.eventMatch.create({
      data: {
        eventId: event.id,
        eventSquadId: squad.id,
        opponentName: "Event Opponent",
        opponentTeamId: opponentTeam.id,
        startsAt: new Date("2025-05-10T10:00:00Z"),
        organisationId: fixtureIds.organisationId,
      },
    });

    const players = fixtureIds.players.slice(0, 3);
    for (const p of players) {
      await testDb.player.update({ where: { id: p.id }, data: { ballControl: 7, passing: 6 } });
    }
    const report = await testDb.eventPostMatchReport.create({
      data: {
        eventMatchId: eventMatch.id,
        status: "LOCKED",
        ourScore: 3,
        opponentScore: 1,
        organisationId: fixtureIds.organisationId,
      },
    });
    for (const p of players) {
      await testDb.eventPostMatchPlayer.create({
        data: {
          reportId: report.id,
          playerId: p.id,
          attendanceStatus: "PRESENT",
          organisationId: fixtureIds.organisationId,
        },
      });
    }

    const result = await recordOpponentSportingEvidenceForRef(
      { kind: "EVENT_MATCH", eventMatchId: eventMatch.id, eventId: event.id, evidenceLeagueSeasonId: null },
      orgFilter,
    );

    expect(result.recorded).toBe(true);

    const evidenceRow = await testDb.opponentSportingEvidence.findFirst({ where: { eventMatchId: eventMatch.id } });
    expect(evidenceRow).not.toBeNull();
    expect(evidenceRow!.matchId).toBeNull();
    expect(evidenceRow!.goalsFor).toBe(3);
    expect(evidenceRow!.goalsAgainst).toBe(1);

    // Idempotent rerun: same eventMatchId upserts the same row, no duplicate.
    await recordOpponentSportingEvidenceForRef(
      { kind: "EVENT_MATCH", eventMatchId: eventMatch.id, eventId: event.id, evidenceLeagueSeasonId: null },
      orgFilter,
    );
    const rows = await testDb.opponentSportingEvidence.findMany({ where: { eventMatchId: eventMatch.id } });
    expect(rows.length).toBe(1);
  });

  it("rebuildEventActualTimeline handles an Event match with a starting lineup and no live events", async () => {
    const event = await testDb.event.create({
      data: {
        name: "Timeline Event",
        eventType: "FRIENDLY_DAY",
        startsAt: new Date("2025-05-15"),
        gameFormat: "SEVEN_A_SIDE",
        matchDurationMinutes: 60,
        footballGroupId: fixtureIds.footballGroupId,
        organisationId: fixtureIds.organisationId,
      },
    });
    const squad = await testDb.eventSquad.create({
      data: { eventId: event.id, name: "Squad C", intent: "BALANCED", targetSize: 7, organisationId: fixtureIds.organisationId },
    });
    const eventMatch = await testDb.eventMatch.create({
      data: {
        eventId: event.id,
        eventSquadId: squad.id,
        opponentName: "Timeline Opponent",
        startsAt: new Date("2025-05-15T10:00:00Z"),
        organisationId: fixtureIds.organisationId,
      },
    });

    const lineup = await testDb.eventMatchLineup.create({
      data: { eventMatchId: eventMatch.id, status: "CONFIRMED", organisationId: fixtureIds.organisationId },
    });
    const players = fixtureIds.players.slice(0, 2);
    for (const p of players) {
      await testDb.eventMatchLineupAssignment.create({
        data: { lineupId: lineup.id, playerId: p.id, roleType: "DEFENDER", organisationId: fixtureIds.organisationId },
      });
    }

    const result = await rebuildEventActualTimeline(eventMatch.id);
    expect(result.intervalsCreated).toBe(players.length);

    const rows = await testDb.actualPositionInterval.findMany({ where: { eventMatchId: eventMatch.id } });
    expect(rows.length).toBe(players.length);
    expect(rows.every((r) => r.matchId === null && r.eventMatchId === eventMatch.id)).toBe(true);
    expect(rows.every((r) => r.endedAtMs === 60 * 60 * 1000)).toBe(true);
  });

  it("runPostMatchLearning orchestrates actual-timeline + opponent evidence for a League match without throwing", async () => {
    const matchId = fixtureIds.matches["Bla"];
    const ref = await buildLeagueMatchRef(matchId);

    const report = await testDb.postMatchReport.findFirst({ where: { matchId } });
    if (!report) {
      await testDb.postMatchReport.create({
        data: {
          matchId,
          status: "LOCKED",
          homeGoals: 2,
          awayGoals: 0,
          organisationId: fixtureIds.organisationId,
        },
      });
    }

    const result = await runPostMatchLearning(ref, orgFilter);

    expect(result.actualTimeline.status).not.toBe("FAILED");
    expect(result.opponent.status).not.toBe("FAILED");
    expect(result.players.status).not.toBe("FAILED");
    expect(result.combinations.status).not.toBe("FAILED");
  });
});
