import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, seedTestFixture, getTestDb, type TestFixtureIds } from "@/test/test-db";
import { rebuildActualTimeline, rebuildEventActualTimeline, rebuildActualTimelineForRef } from "@/lib/evidence/actual-timeline";
import { runPostMatchLearning } from "@/lib/evidence/post-match-learning";
import { recordOpponentSportingEvidenceForRef } from "@/lib/opponents/sporting-level-recording";
import { buildLeagueMatchRef } from "@/lib/evidence/adapters/league-evidence-adapter";
import { buildMatchStateTimeline } from "@/lib/evidence/match-state-timeline";
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

  /**
   * ADR-0106 planning-parity completion (Section 14 evidence isolation): a GuestPlayer starting
   * lineup slot (EventMatchLineupAssignment.guestPlayerId) is now a real write path for planning
   * purposes. This proves that presence does NOT leak into the persistent evidence layer --
   * getEventStartingLineup()'s own query stays `playerId: { not: null }`, so the guest is
   * silently excluded from ActualPositionInterval reconstruction (no combination/positional
   * evidence is fabricated for a GuestPlayer), while the co-starting registered Player's own
   * timeline reconstruction is unaffected by the guest's presence in the same lineup.
   */
  it("rebuildEventActualTimeline never creates an ActualPositionInterval for a GuestPlayer starter", async () => {
    const event = await testDb.event.create({
      data: {
        name: "Guest Timeline Isolation Event",
        eventType: "FRIENDLY_DAY",
        startsAt: new Date("2025-05-15"),
        gameFormat: "SEVEN_A_SIDE",
        matchDurationMinutes: 60,
        footballGroupId: fixtureIds.footballGroupId,
        organisationId: fixtureIds.organisationId,
      },
    });
    const squad = await testDb.eventSquad.create({
      data: { eventId: event.id, name: "Squad D", intent: "BALANCED", targetSize: 7, organisationId: fixtureIds.organisationId },
    });
    const eventMatch = await testDb.eventMatch.create({
      data: {
        eventId: event.id,
        eventSquadId: squad.id,
        opponentName: "Guest Isolation Opponent",
        startsAt: new Date("2025-05-15T10:00:00Z"),
        organisationId: fixtureIds.organisationId,
      },
    });

    const lineup = await testDb.eventMatchLineup.create({
      data: { eventMatchId: eventMatch.id, status: "DRAFT", organisationId: fixtureIds.organisationId },
    });
    const player = fixtureIds.players[0]!;
    await testDb.eventMatchLineupAssignment.create({
      data: { lineupId: lineup.id, playerId: player.id, roleType: "DEFENDER", organisationId: fixtureIds.organisationId },
    });

    const guestPlayer = await testDb.guestPlayer.create({
      data: {
        organisationId: fixtureIds.organisationId,
        footballGroupId: fixtureIds.footballGroupId,
        name: "Guest Isolation Tester",
      },
    });
    await testDb.eventMatchLineupAssignment.create({
      data: { lineupId: lineup.id, guestPlayerId: guestPlayer.id, roleType: "FORWARD", organisationId: fixtureIds.organisationId },
    });

    const result = await rebuildEventActualTimeline(eventMatch.id);
    // Only the registered Player produces an interval -- the guest starter is not fabricated one.
    expect(result.intervalsCreated).toBe(1);

    const rows = await testDb.actualPositionInterval.findMany({ where: { eventMatchId: eventMatch.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.playerId).toBe(player.id);
    expect(rows.some((r) => r.guestPlayerId === guestPlayer.id)).toBe(false);
  });

  /**
   * Canonical match-state foundation (Bundle 1, ADR-0113) regression: MatchRotation/LiveMatchEvent
   * timestamps are period-relative (each period's live clock restarts at 0). Before this fix,
   * rebuildActualTimeline ignored MatchRotation.period entirely and ordered purely by the raw
   * per-period matchSeconds value, so a second-half substitution could sort BEFORE a first-half
   * one whenever its period-relative timestamp happened to be smaller.
   */
  it("rebuildActualTimeline orders a second-half substitution after every first-half one (period-offset fix)", async () => {
    const matchId = fixtureIds.matches["Rod"];
    const teamId = fixtureIds.teams["Rod"];
    const players = fixtureIds.players.filter((p) => p.coreTeamId === teamId).slice(0, 3);
    await testDb.match.update({ where: { id: matchId }, data: { matchType: "LEAGUE" } });
    // Only the first two players start -- the third only ever enters via the second-half
    // rotation below, so its single interval unambiguously reflects the sub's own timing.
    await buildLeagueLineup(matchId, teamId, players.slice(0, 2).map((p) => p.id));

    // Second-half substitution 3 minutes into that half (period-relative matchSeconds, LEAGUE
    // period index 3 = SECOND_HALF -- see PERIOD_TO_INT in report-mutations.ts).
    await testDb.matchRotation.create({
      data: {
        matchId,
        outPlayerId: players[1]!.id,
        inPlayerId: players[2]!.id,
        period: 3,
        matchSeconds: 3 * 60 * 1000,
        source: "LIVE",
        organisationId: fixtureIds.organisationId,
      },
    });

    const result = await rebuildActualTimeline(matchId);
    expect(result.intervalsCreated).toBeGreaterThan(0);

    const incoming = await testDb.actualPositionInterval.findFirst({
      where: { matchId, playerId: players[2]!.id },
    });
    // Absolute: 25-minute first half + 3 minutes into the second = 28 minutes since kickoff,
    // not the raw period-relative 3 minutes a pre-fix reconstruction would have stored (which
    // would have sorted this substitution BEFORE kickoff, not after 25 minutes of play).
    expect(incoming!.startedAtMs).toBe(25 * 60 * 1000 + 3 * 60 * 1000);

    const outgoing = await testDb.actualPositionInterval.findFirst({
      where: { matchId, playerId: players[1]!.id, position: { not: "BENCH" } },
    });
    expect(outgoing!.endedAtMs).toBe(25 * 60 * 1000 + 3 * 60 * 1000);
  });

  /**
   * Canonical match-state foundation (Bundle 1, ADR-0113) regression: rebuildEventActualTimeline
   * previously capped the final open-ended interval at the Event's single per-half
   * matchDurationMinutes, silently truncating the timeline (and every downstream evidence
   * computation) at the end of the FIRST half for any two-half Event match.
   */
  it("rebuildEventActualTimeline caps the final interval at the full two-half duration, not one half", async () => {
    const event = await testDb.event.create({
      data: {
        name: "Two-Half Event",
        eventType: "FRIENDLY_DAY",
        startsAt: new Date("2025-05-20"),
        gameFormat: "SEVEN_A_SIDE",
        matchDurationMinutes: 20,
        numberOfHalves: 2,
        footballGroupId: fixtureIds.footballGroupId,
        organisationId: fixtureIds.organisationId,
      },
    });
    const squad = await testDb.eventSquad.create({
      data: { eventId: event.id, name: "Squad D", intent: "BALANCED", targetSize: 7, organisationId: fixtureIds.organisationId },
    });
    const eventMatch = await testDb.eventMatch.create({
      data: {
        eventId: event.id,
        eventSquadId: squad.id,
        opponentName: "Two-Half Opponent",
        startsAt: new Date("2025-05-20T10:00:00Z"),
        organisationId: fixtureIds.organisationId,
      },
    });

    const lineup = await testDb.eventMatchLineup.create({
      data: { eventMatchId: eventMatch.id, status: "CONFIRMED", organisationId: fixtureIds.organisationId },
    });
    const player = fixtureIds.players[0]!;
    await testDb.eventMatchLineupAssignment.create({
      data: { lineupId: lineup.id, playerId: player.id, roleType: "DEFENDER", organisationId: fixtureIds.organisationId },
    });

    await rebuildEventActualTimeline(eventMatch.id);

    const row = await testDb.actualPositionInterval.findFirst({ where: { eventMatchId: eventMatch.id } });
    expect(row!.endedAtMs).toBe(40 * 60 * 1000);
  });

  it("buildMatchStateTimeline reconstructs canonical intervals/transitions end to end for a League match", async () => {
    const teamId = fixtureIds.teams["Rod"];
    const players = fixtureIds.players.filter((p) => p.coreTeamId === teamId).slice(0, 2);
    const opponentTeam = await testDb.opponentTeam.create({
      data: { displayName: "Canonical Timeline Opponent", normalizedName: "canonical timeline opponent", organisationId: fixtureIds.organisationId },
    });
    const match = await testDb.match.create({
      data: {
        matchRoundId: fixtureIds.matchRoundId,
        teamId,
        opponent: "Canonical Timeline Opponent",
        opponentTeamId: opponentTeam.id,
        startsAt: new Date("2025-05-25T10:00:00Z"),
        homeAway: "HOME",
        matchType: "LEAGUE",
        gameFormat: "ELEVEN_A_SIDE",
        matchDurationMinutes: 50,
        organisationId: fixtureIds.organisationId,
      },
    });
    await buildLeagueLineup(match.id, teamId, players.map((p) => p.id));
    await rebuildActualTimeline(match.id);

    const ref = await buildLeagueMatchRef(match.id);
    const timeline = await buildMatchStateTimeline(ref);

    expect(timeline).not.toBeNull();
    expect(timeline!.intervals.length).toBeGreaterThan(0);
    expect(timeline!.timingQuality).toBe("EXACT");
    expect(timeline!.context.opponent.displayName).toBe("Canonical Timeline Opponent");
    expect(timeline!.phaseWindows.length).toBeGreaterThan(0);
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

  it("runPostMatchLearning distinguishes NO_FOOTBALL_OBSERVATIONS from INSUFFICIENT_DISTINCT_MATCHES (found via manual browser verification, Event Evidence Parity programme)", async () => {
    // Case 1: genuinely zero observations recorded for this match.
    const matchNoObs = fixtureIds.matches["Hvit"];
    const refNoObs = await buildLeagueMatchRef(matchNoObs);
    const resultNoObs = await runPostMatchLearning(refNoObs, orgFilter);
    expect(resultNoObs.players).toEqual({ status: "SKIPPED", reason: "NO_FOOTBALL_OBSERVATIONS" });

    // Case 2: one observation exists for this match, but evidence-accumulator.ts's
    // MINIMUM_DISTINCT_MATCHES (2) means it can't produce a proposal yet -- a legitimate,
    // expected "not enough evidence yet" outcome, not "no input at all".
    const matchWithObs = fixtureIds.matches["Rod"];
    const player = fixtureIds.players.find((p) => p.coreTeamId === fixtureIds.teams["Rod"])!;
    await testDb.playerDevelopmentObservation.create({
      data: {
        organisationId: fixtureIds.organisationId,
        playerId: player.id,
        sourceType: "LEAGUE_MATCH",
        matchId: matchWithObs,
        kind: "ATTRIBUTE",
        attributeKey: "PASSING_EFFECTIVE",
        direction: "POSITIVE",
        observedAt: new Date(),
        recordedBy: "test@test-agent.matchboard.football",
      },
    });
    const refWithObs = await buildLeagueMatchRef(matchWithObs);
    const resultWithObs = await runPostMatchLearning(refWithObs, orgFilter);
    expect(resultWithObs.players).toEqual({ status: "SKIPPED", reason: "INSUFFICIENT_DISTINCT_MATCHES" });
  });
});
