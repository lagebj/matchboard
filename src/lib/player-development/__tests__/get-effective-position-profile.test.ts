import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, getTestDb, seedTestFixture, type TestFixtureIds } from "@/test/test-db";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";
import {
  getEffectivePlayerPositionProfileForPlayer,
  getEffectivePlayerPositionProfilesForPlayers,
} from "../get-effective-position-profile";

let db: PrismaClient;
let fixture: TestFixtureIds;
let orgFilter: OrgFilterMode;

vi.mock("@/lib/db", () => ({
  get db() {
    return getTestDb();
  },
}));

/**
 * Matchboard Players Operating Surface bundle, `04_DATA_AND_BATCH_LOADING_CONTRACT.md §4` /
 * `08_TEST_AND_ACCEPTANCE_MATRIX.md` items 15 and 22: the batched effective-profile loader
 * normalizes declared codes before evidence aggregation, and the single-player loader must equal
 * the corresponding batch profile for identical data.
 */
describe("getEffectivePlayerPositionProfilesForPlayers", () => {
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
    const result = await getEffectivePlayerPositionProfilesForPlayers([], orgFilter);
    expect(result.size).toBe(0);
  });

  it("a legacy-declared DEFENSIVE_MIDFIELDER plus actual DM usage produces one DM entry, not two", async () => {
    const player = fixture.players[8];
    const matchId = Object.values(fixture.matches)[0];

    await db.player.update({ where: { id: player.id }, data: { primaryPosition: "DEFENSIVE_MIDFIELDER" } });
    await db.actualPositionInterval.create({
      data: {
        organisationId: fixture.organisationId,
        matchId,
        playerId: player.id,
        position: "DM",
        startedAtMs: 0,
        endedAtMs: 40 * 60 * 1000,
        source: "STARTING_LINEUP",
      },
    });

    const result = await getEffectivePlayerPositionProfilesForPlayers([player.id], orgFilter);
    const profile = result.get(player.id)!;
    const dmEntries = profile.positions.filter((p) => p.positionId === "DM");

    expect(dmEntries).toHaveLength(1);
    expect(profile.primary).toBe("DM");
  });

  it("a broad declared FORWARD produces a legitimate profile entry (broad, not upgraded)", async () => {
    const player = fixture.players[9];
    await db.player.update({ where: { id: player.id }, data: { primaryPosition: "FORWARD" } });

    const result = await getEffectivePlayerPositionProfilesForPlayers([player.id], orgFilter);
    const profile = result.get(player.id)!;

    expect(profile.primary).toBe("FORWARD");
  });

  it("the single-player loader delegates to the batch loader and returns an identical profile", async () => {
    const player = fixture.players[10];
    const matchId = Object.values(fixture.matches)[1];

    await db.player.update({ where: { id: player.id }, data: { primaryPosition: "ST" } });
    await db.actualPositionInterval.create({
      data: {
        organisationId: fixture.organisationId,
        matchId,
        playerId: player.id,
        position: "ST",
        startedAtMs: 0,
        endedAtMs: 30 * 60 * 1000,
        source: "STARTING_LINEUP",
      },
    });

    const single = await getEffectivePlayerPositionProfileForPlayer(player.id, orgFilter);
    const batch = await getEffectivePlayerPositionProfilesForPlayers([player.id], orgFilter);

    expect(single.primary).toBe(batch.get(player.id)!.primary);
    expect(single.positions).toEqual(batch.get(player.id)!.positions);
  });
});
