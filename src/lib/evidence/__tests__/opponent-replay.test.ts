import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, seedTestFixture, getTestDb, type TestFixtureIds } from "@/test/test-db";
import { dryRunOpponentEvidence, applyOpponentEvidenceHistory } from "@/lib/evidence/opponent-replay";

vi.mock("@/lib/db", () => ({
  get db() {
    return getTestDb();
  },
}));

let testDb: PrismaClient;

/**
 * ADR-0104 / ARR-0031: the "Populate opponent levels" transient catch-up tool covers both
 * historical League and Event matches through the same canonical opponent-learning pipeline
 * (recordOpponentSportingEvidenceForRef), not a second historical-only algorithm.
 */
describe("Populate opponent levels -- League + Event history (ARR-0031)", () => {
  let fixtureIds: TestFixtureIds;
  let otherOrgId: string;

  async function ratePlayers(playerIds: string[]) {
    for (const id of playerIds) {
      await testDb.player.update({ where: { id }, data: { ballControl: 7, passing: 6 } });
    }
  }

  async function buildLeagueHistoricalMatch(opponentTeamId: string, present = true) {
    const matchId = fixtureIds.matches["Bla"];
    // Reuse the fixture's own "Bla" match once per suite run would collide across tests,
    // so create a fresh Match row per call instead.
    const match = await testDb.match.create({
      data: {
        matchRoundId: fixtureIds.matchRoundId,
        teamId: fixtureIds.teams["Bla"],
        opponent: "Historical League Opponent",
        opponentTeamId,
        startsAt: new Date("2025-04-01T10:00:00Z"),
        homeAway: "HOME",
        gameFormat: "ELEVEN_A_SIDE",
        organisationId: fixtureIds.organisationId,
      },
    });
    void matchId;
    const players = fixtureIds.players.filter((p) => p.coreTeamId === fixtureIds.teams["Bla"]).slice(0, 3);
    await ratePlayers(players.map((p) => p.id));
    const report = await testDb.postMatchReport.create({
      data: {
        matchId: match.id,
        status: "LOCKED",
        homeGoals: 2,
        awayGoals: 1,
        organisationId: fixtureIds.organisationId,
      },
    });
    for (const p of players) {
      await testDb.postMatchPlayerActual.create({
        data: {
          reportId: report.id,
          matchId: match.id,
          playerId: p.id,
          attendanceStatus: present ? "PRESENT" : "UNKNOWN",
          organisationId: fixtureIds.organisationId,
        },
      });
    }
    return match.id;
  }

  async function buildEventHistoricalMatch(orgId: string, footballGroupId: string, opponentTeamId: string, playerIds: string[]) {
    const event = await testDb.event.create({
      data: {
        name: `Historical Event ${Math.random().toString(36).slice(2, 8)}`,
        eventType: "CUP",
        startsAt: new Date("2025-04-02"),
        gameFormat: "SEVEN_A_SIDE",
        footballGroupId,
        organisationId: orgId,
      },
    });
    const squad = await testDb.eventSquad.create({
      data: { eventId: event.id, name: "Squad", intent: "BALANCED", targetSize: 7, organisationId: orgId },
    });
    const eventMatch = await testDb.eventMatch.create({
      data: {
        eventId: event.id,
        eventSquadId: squad.id,
        opponentName: "Historical Event Opponent",
        opponentTeamId,
        startsAt: new Date("2025-04-02T10:00:00Z"),
        organisationId: orgId,
      },
    });
    await ratePlayers(playerIds);
    const report = await testDb.eventPostMatchReport.create({
      data: {
        eventMatchId: eventMatch.id,
        status: "LOCKED",
        ourScore: 3,
        opponentScore: 2,
        organisationId: orgId,
      },
    });
    for (const id of playerIds) {
      await testDb.eventPostMatchPlayer.create({
        data: { reportId: report.id, playerId: id, attendanceStatus: "PRESENT", organisationId: orgId },
      });
    }
    return eventMatch.id;
  }

  beforeAll(async () => {
    testDb = await setupTestDb();
    fixtureIds = await seedTestFixture(testDb, { playersPerTeam: 4 });

    const otherOrg = await testDb.organisation.create({ data: { name: "Other Org", slug: `other-org-${Date.now()}` } });
    otherOrgId = otherOrg.id;
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it("dry run counts and applies League-only history", async () => {
    const opponentTeam = await testDb.opponentTeam.create({
      data: { displayName: "League Only Opponent", normalizedName: `league-only-${Date.now()}`, organisationId: fixtureIds.organisationId },
    });
    const matchId = await buildLeagueHistoricalMatch(opponentTeam.id);

    const dryRun = await dryRunOpponentEvidence(fixtureIds.organisationId);
    expect(dryRun.bySource.league.inspected).toBeGreaterThanOrEqual(1);
    expect(dryRun.details.some((d) => d.matchId === matchId)).toBe(true);

    const applied = await applyOpponentEvidenceHistory(fixtureIds.organisationId);
    expect(applied.bySource.league.recorded).toBeGreaterThanOrEqual(1);

    const evidence = await testDb.opponentSportingEvidence.findFirst({ where: { matchId } });
    expect(evidence).not.toBeNull();
    expect(evidence!.eventMatchId).toBeNull();
  });

  /**
   * Regression: `from`/`to` were previously built as two separate conditional spreads onto the
   * same `startsAt`/`occurredAt` key, so the second spread silently clobbered the first instead
   * of merging both bounds into one range (found while building the Evidence-Informed Match
   * Planning programme's Bundle 2 historical catch-up tool, which shares this same bug pattern).
   */
  it("combining from and to narrows the range instead of one bound silently overriding the other", async () => {
    const opponentTeam = await testDb.opponentTeam.create({
      data: { displayName: "Date Range Opponent", normalizedName: `date-range-${Date.now()}`, organisationId: fixtureIds.organisationId },
    });
    // buildLeagueHistoricalMatch always uses startsAt 2025-04-01T10:00:00Z.
    const matchId = await buildLeagueHistoricalMatch(opponentTeam.id);

    const outsideRange = await dryRunOpponentEvidence(fixtureIds.organisationId, {
      from: new Date("2025-04-02T00:00:00Z"),
      to: new Date("2025-04-05T00:00:00Z"),
    });
    expect(outsideRange.details.some((d) => d.matchId === matchId)).toBe(false);

    const insideRange = await dryRunOpponentEvidence(fixtureIds.organisationId, {
      from: new Date("2025-03-30T00:00:00Z"),
      to: new Date("2025-04-05T00:00:00Z"),
    });
    expect(insideRange.details.some((d) => d.matchId === matchId)).toBe(true);
  });

  it("dry run counts and applies Event-only history", async () => {
    const opponentTeam = await testDb.opponentTeam.create({
      data: { displayName: "Event Only Opponent", normalizedName: `event-only-${Date.now()}`, organisationId: fixtureIds.organisationId },
    });
    const playerIds = fixtureIds.players.slice(0, 2).map((p) => p.id);
    const eventMatchId = await buildEventHistoricalMatch(fixtureIds.organisationId, fixtureIds.footballGroupId, opponentTeam.id, playerIds);

    const dryRun = await dryRunOpponentEvidence(fixtureIds.organisationId);
    expect(dryRun.bySource.event.inspected).toBeGreaterThanOrEqual(1);
    expect(dryRun.details.some((d) => d.matchId === eventMatchId)).toBe(true);

    const applied = await applyOpponentEvidenceHistory(fixtureIds.organisationId);
    expect(applied.bySource.event.recorded).toBeGreaterThanOrEqual(1);

    const evidence = await testDb.opponentSportingEvidence.findFirst({ where: { eventMatchId } });
    expect(evidence).not.toBeNull();
    expect(evidence!.matchId).toBeNull();
  });

  it("mixed League + Event history against the same opponent both contribute evidence", async () => {
    const opponentTeam = await testDb.opponentTeam.create({
      data: { displayName: "Mixed Opponent", normalizedName: `mixed-${Date.now()}`, organisationId: fixtureIds.organisationId },
    });
    const leagueMatchId = await buildLeagueHistoricalMatch(opponentTeam.id);
    const playerIds = fixtureIds.players.slice(0, 2).map((p) => p.id);
    const eventMatchId = await buildEventHistoricalMatch(fixtureIds.organisationId, fixtureIds.footballGroupId, opponentTeam.id, playerIds);

    await applyOpponentEvidenceHistory(fixtureIds.organisationId);

    const leagueEvidence = await testDb.opponentSportingEvidence.findFirst({ where: { matchId: leagueMatchId } });
    const eventEvidence = await testDb.opponentSportingEvidence.findFirst({ where: { eventMatchId } });
    expect(leagueEvidence).not.toBeNull();
    expect(eventEvidence).not.toBeNull();
    expect(leagueEvidence!.opponentTeamId).toBe(opponentTeam.id);
    expect(eventEvidence!.opponentTeamId).toBe(opponentTeam.id);
  });

  it("repeat runs are idempotent -- no duplicate evidence rows, no rating inflation", async () => {
    const opponentTeam = await testDb.opponentTeam.create({
      data: { displayName: "Repeat Run Opponent", normalizedName: `repeat-${Date.now()}`, organisationId: fixtureIds.organisationId },
    });
    const matchId = await buildLeagueHistoricalMatch(opponentTeam.id);

    const first = await applyOpponentEvidenceHistory(fixtureIds.organisationId);
    const firstEvidence = await testDb.opponentSportingEvidence.findMany({ where: { matchId } });
    expect(firstEvidence).toHaveLength(1);
    const firstEstimate = Number(firstEvidence[0].estimate);

    const second = await applyOpponentEvidenceHistory(fixtureIds.organisationId);
    const secondEvidence = await testDb.opponentSportingEvidence.findMany({ where: { matchId } });
    expect(secondEvidence).toHaveLength(1);
    expect(Number(secondEvidence[0].estimate)).toBe(firstEstimate);
    expect(second.details.find((d) => d.matchId === matchId)?.status).toBe("already_recorded");
    void first;
  });

  it("a match already auto-learned before catch-up is not duplicated by a later run", async () => {
    const opponentTeam = await testDb.opponentTeam.create({
      data: { displayName: "Auto Learned Opponent", normalizedName: `auto-${Date.now()}`, organisationId: fixtureIds.organisationId },
    });
    const matchId = await buildLeagueHistoricalMatch(opponentTeam.id);

    // Simulate automatic learning having already recorded evidence for this match.
    const { recordOpponentSportingEvidenceForRef } = await import("@/lib/opponents/sporting-level-recording");
    const orgFilter = {
      type: "org" as const,
      organisationId: fixtureIds.organisationId,
      filter: { organisationId: fixtureIds.organisationId },
      filterNullable: { organisationId: fixtureIds.organisationId },
    };
    await recordOpponentSportingEvidenceForRef({ kind: "LEAGUE_MATCH", matchId, leagueSeasonId: null }, orgFilter);

    const applied = await applyOpponentEvidenceHistory(fixtureIds.organisationId);
    expect(applied.details.find((d) => d.matchId === matchId)?.status).toBe("already_recorded");

    const evidence = await testDb.opponentSportingEvidence.findMany({ where: { matchId } });
    expect(evidence).toHaveLength(1);
  });

  it("locked historical reports remain unchanged after catch-up", async () => {
    const opponentTeam = await testDb.opponentTeam.create({
      data: { displayName: "Immutable Opponent", normalizedName: `immutable-${Date.now()}`, organisationId: fixtureIds.organisationId },
    });
    const matchId = await buildLeagueHistoricalMatch(opponentTeam.id);
    const before = await testDb.postMatchReport.findFirst({ where: { matchId } });

    await applyOpponentEvidenceHistory(fixtureIds.organisationId);

    const after = await testDb.postMatchReport.findFirst({ where: { matchId } });
    expect(after!.homeGoals).toBe(before!.homeGoals);
    expect(after!.awayGoals).toBe(before!.awayGoals);
    expect(after!.status).toBe(before!.status);
    expect(after!.updatedAt.getTime()).toBe(before!.updatedAt.getTime());
  });

  it("tenant isolation: an organisation's catch-up run never processes another organisation's matches", async () => {
    const org2Group = await testDb.footballGroup.create({
      data: { name: "Other Group", slug: `other-group-${Date.now()}`, type: "AGE_GROUP", organisationId: otherOrgId },
    });
    const org2OpponentTeam = await testDb.opponentTeam.create({
      data: { displayName: "Other Org Opponent", normalizedName: `other-org-opp-${Date.now()}`, organisationId: otherOrgId },
    });
    const org2Player = await testDb.player.create({
      data: {
        playerCode: 99001,
        firstName: "Other",
        lastName: "Org Player",
        active: true,
        primaryPosition: "CM",
        preferredFoot: "RIGHT",
        secondaryFoot: "WEAK",
        bestSide: "CENTER",
        currentAvailability: "AVAILABLE",
        organisationId: otherOrgId,
      },
    });
    const otherEventMatchId = await buildEventHistoricalMatch(otherOrgId, org2Group.id, org2OpponentTeam.id, [org2Player.id]);

    const applied = await applyOpponentEvidenceHistory(fixtureIds.organisationId);

    expect(applied.details.some((d) => d.matchId === otherEventMatchId)).toBe(false);
    const crossOrgEvidence = await testDb.opponentSportingEvidence.findFirst({ where: { eventMatchId: otherEventMatchId } });
    expect(crossOrgEvidence).toBeNull();
  });
});
