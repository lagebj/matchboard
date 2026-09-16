import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, getTestDb, seedTestFixture, type TestFixtureIds } from "@/test/test-db";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";
import { getPlayerActualPositionHistory, getPlayersActualPositionHistory } from "../position-usage-history";

let db: PrismaClient;
let fixture: TestFixtureIds;
let orgFilter: OrgFilterMode;

vi.mock("@/lib/db", () => ({
  get db() {
    return getTestDb();
  },
}));

/**
 * Matchboard Players Operating Surface bundle, `04_DATA_AND_BATCH_LOADING_CONTRACT.md §2`:
 * batched actual-position history, with position-code normalization applied before minutes are
 * aggregated, and one grouping implementation shared by the single-player entry point.
 */
describe("getPlayersActualPositionHistory", () => {
  beforeAll(async () => {
    db = await setupTestDb();
    fixture = await seedTestFixture(db);
    orgFilter = {
      type: "org",
      filter: { organisationId: fixture.organisationId },
      filterNullable: { organisationId: fixture.organisationId },
      organisationId: fixture.organisationId,
    };
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it("returns an empty map for an empty player list", async () => {
    const result = await getPlayersActualPositionHistory([], orgFilter);
    expect(result.size).toBe(0);
  });

  it("groups a legacy alias and its normalized exact code into one minutes bucket, not two", async () => {
    const player = fixture.players[4];
    const matchId = Object.values(fixture.matches)[0];

    await db.actualPositionInterval.create({
      data: {
        organisationId: fixture.organisationId,
        matchId,
        playerId: player.id,
        position: "DEFENSIVE_MIDFIELDER",
        startedAtMs: 0,
        endedAtMs: 20 * 60 * 1000,
        source: "STARTING_LINEUP",
      },
    });
    await db.actualPositionInterval.create({
      data: {
        organisationId: fixture.organisationId,
        matchId,
        playerId: player.id,
        position: "DM",
        startedAtMs: 20 * 60 * 1000,
        endedAtMs: 40 * 60 * 1000,
        source: "STARTING_LINEUP",
      },
    });

    const result = await getPlayersActualPositionHistory([player.id], orgFilter);
    const usage = result.get(player.id)!.find((u) => u.matchKey === matchId)!;

    expect(Object.keys(usage.minutesByPosition)).toEqual(["DM"]);
    expect(usage.minutesByPosition.DM).toBe(40);
  });

  it("batches multiple players in one map, each keyed by their own playerId", async () => {
    const playerA = fixture.players[5];
    const playerB = fixture.players[6];
    const matchId = Object.values(fixture.matches)[1];

    await db.actualPositionInterval.create({
      data: {
        organisationId: fixture.organisationId,
        matchId,
        playerId: playerA.id,
        position: "ST",
        startedAtMs: 0,
        endedAtMs: 30 * 60 * 1000,
        source: "STARTING_LINEUP",
      },
    });
    await db.actualPositionInterval.create({
      data: {
        organisationId: fixture.organisationId,
        matchId,
        playerId: playerB.id,
        position: "CB",
        startedAtMs: 0,
        endedAtMs: 30 * 60 * 1000,
        source: "STARTING_LINEUP",
      },
    });

    const result = await getPlayersActualPositionHistory([playerA.id, playerB.id], orgFilter);

    expect(result.get(playerA.id)!.some((u) => u.matchKey === matchId && u.minutesByPosition.ST === 30)).toBe(true);
    expect(result.get(playerB.id)!.some((u) => u.matchKey === matchId && u.minutesByPosition.CB === 30)).toBe(true);
  });

  it("the single-player loader delegates to the batch loader and returns identical results", async () => {
    const player = fixture.players[7];
    const matchId = Object.values(fixture.matches)[2];

    await db.actualPositionInterval.create({
      data: {
        organisationId: fixture.organisationId,
        matchId,
        playerId: player.id,
        position: "GOALKEEPER",
        startedAtMs: 0,
        endedAtMs: 45 * 60 * 1000,
        source: "STARTING_LINEUP",
      },
    });

    const single = await getPlayerActualPositionHistory(player.id, orgFilter);
    const batch = await getPlayersActualPositionHistory([player.id], orgFilter);

    expect(single).toEqual(batch.get(player.id));
    expect(single.find((u) => u.matchKey === matchId)!.minutesByPosition.GK).toBe(45);
  });
});
