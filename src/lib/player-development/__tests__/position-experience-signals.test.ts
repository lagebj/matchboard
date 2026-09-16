import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, getTestDb, seedTestFixture, type TestFixtureIds } from "@/test/test-db";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";
import { getObservationSignals, getObservationSignalsForPlayers } from "../position-experience-signals";

let db: PrismaClient;
let fixture: TestFixtureIds;
let orgFilter: OrgFilterMode;

vi.mock("@/lib/db", () => ({
  get db() {
    return getTestDb();
  },
}));

/**
 * Matchboard Players Operating Surface bundle, `04_DATA_AND_BATCH_LOADING_CONTRACT.md §3`:
 * batched POSITION-observation signal loading, with position-code normalization applied before
 * grouping, and one grouping implementation shared by the single-player entry point.
 */
describe("getObservationSignalsForPlayers", () => {
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

  it("returns an empty array (never a fabricated signal) for a player with no observations", async () => {
    const result = await getObservationSignalsForPlayers([fixture.players[0].id], orgFilter);
    expect(result.get(fixture.players[0].id)).toEqual([]);
  });

  it("groups a legacy alias and its normalized exact code under one position signal", async () => {
    const player = fixture.players[1];
    const matchIds = Object.values(fixture.matches);

    for (const [i, matchId] of matchIds.slice(0, 3).entries()) {
      await db.playerDevelopmentObservation.create({
        data: {
          organisationId: fixture.organisationId,
          playerId: player.id,
          matchId,
          kind: "POSITION",
          positionId: i % 2 === 0 ? "STRIKER" : "ST",
          direction: "POSITIVE",
          observedAt: new Date(2026, 0, i + 1),
          recordedBy: "test-harness",
        },
      });
    }

    const result = await getObservationSignalsForPlayers([player.id], orgFilter);
    const signals = result.get(player.id)!;
    const positionCodes = signals.map((s) => s.positionCode);

    expect(positionCodes).toEqual(["ST"]);
    expect(positionCodes).not.toContain("STRIKER");
  });

  it("batches multiple players in one map", async () => {
    const playerA = fixture.players[2];
    const playerB = fixture.players[3];
    const matchIds = Object.values(fixture.matches);

    for (const [i, matchId] of matchIds.slice(0, 3).entries()) {
      await db.playerDevelopmentObservation.create({
        data: {
          organisationId: fixture.organisationId,
          playerId: playerA.id,
          matchId,
          kind: "POSITION",
          positionId: "CM",
          direction: "POSITIVE",
          observedAt: new Date(2026, 1, i + 1),
          recordedBy: "test-harness",
        },
      });
      await db.playerDevelopmentObservation.create({
        data: {
          organisationId: fixture.organisationId,
          playerId: playerB.id,
          matchId,
          kind: "POSITION",
          positionId: "CB",
          direction: "POSITIVE",
          observedAt: new Date(2026, 1, i + 1),
          recordedBy: "test-harness",
        },
      });
    }

    const result = await getObservationSignalsForPlayers([playerA.id, playerB.id], orgFilter);

    expect(result.get(playerA.id)!.map((s) => s.positionCode)).toEqual(["CM"]);
    expect(result.get(playerB.id)!.map((s) => s.positionCode)).toEqual(["CB"]);
  });

  it("the single-player loader delegates to the batch loader and returns identical results", async () => {
    const player = fixture.players[4];
    const matchIds = Object.values(fixture.matches);

    for (const [i, matchId] of matchIds.slice(0, 3).entries()) {
      await db.playerDevelopmentObservation.create({
        data: {
          organisationId: fixture.organisationId,
          playerId: player.id,
          matchId,
          kind: "POSITION",
          positionId: "DEFENSIVE_MIDFIELDER",
          direction: "POSITIVE",
          observedAt: new Date(2026, 2, i + 1),
          recordedBy: "test-harness",
        },
      });
    }

    const single = await getObservationSignals(player.id, orgFilter);
    const batch = await getObservationSignalsForPlayers([player.id], orgFilter);

    expect(single).toEqual(batch.get(player.id));
    expect(single.map((s) => s.positionCode)).toEqual(["DM"]);
  });
});
