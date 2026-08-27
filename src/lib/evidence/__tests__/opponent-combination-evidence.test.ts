import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, seedTestFixture, getTestDb, type TestFixtureIds } from "@/test/test-db";

vi.mock("@/lib/db", () => ({
  get db() { return getTestDb(); },
}));

let testDb: PrismaClient;
let fixture: TestFixtureIds;

import { getOpponentCombinationEvidence } from "../combination-aggregation";

describe("getOpponentCombinationEvidence", () => {
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixture = await seedTestFixture(testDb, { playersPerTeam: 3 });
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await testDb.combinationEvidence.deleteMany({});
  });

  it("returns [] for an opponent with no matches", async () => {
    const otherOpponent = await testDb.opponentTeam.create({
      data: { displayName: "No matches yet", normalizedName: "no-matches-yet", organisationId: fixture.organisationId },
    });
    const result = await getOpponentCombinationEvidence(otherOpponent.id);
    expect(result).toEqual([]);
  });

  it("aggregates combination evidence across matches against the same opponent", async () => {
    const match = await testDb.match.findUniqueOrThrow({ where: { id: fixture.matches.Bla! } });
    const opponentTeamId = match.opponentTeamId!;
    const teamPlayers = fixture.players.filter((p) => p.coreTeamName === "Bla");

    await testDb.combinationEvidence.create({
      data: {
        organisationId: fixture.organisationId,
        matchId: fixture.matches.Bla!,
        family: "PARTNERSHIP",
        subtype: "HORIZONTAL",
        playerIds: [teamPlayers[0]!.id, teamPlayers[1]!.id],
        positions: ["CB", "CB"],
        minutesTogether: 60,
        confidence: "EMERGING",
        leagueSeasonId: fixture.leagueSeasonId,
      },
    });

    const result = await getOpponentCombinationEvidence(opponentTeamId);
    expect(result).toHaveLength(1);
    expect(result[0]!.playerIds.sort()).toEqual([teamPlayers[0]!.id, teamPlayers[1]!.id].sort());
    expect(result[0]!.totalMinutesTogether).toBe(60);
    expect(result[0]!.matchCount).toBe(1);
  });

  it("does not include evidence from a different opponent's matches", async () => {
    const blaMatch = await testDb.match.findUniqueOrThrow({ where: { id: fixture.matches.Bla! } });
    const teamPlayers = fixture.players.filter((p) => p.coreTeamName === "Hvit");

    await testDb.combinationEvidence.create({
      data: {
        organisationId: fixture.organisationId,
        matchId: fixture.matches.Hvit!,
        family: "PARTNERSHIP",
        subtype: "HORIZONTAL",
        playerIds: [teamPlayers[0]!.id, teamPlayers[1]!.id],
        positions: ["CB", "CB"],
        minutesTogether: 45,
        confidence: "EMERGING",
        leagueSeasonId: fixture.leagueSeasonId,
      },
    });

    const result = await getOpponentCombinationEvidence(blaMatch.opponentTeamId!);
    expect(result).toEqual([]);
  });
});
