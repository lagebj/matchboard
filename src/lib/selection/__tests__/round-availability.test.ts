import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, seedTestFixture, getTestDb, type TestFixtureIds } from "@/test/test-db";
import { getRoundAvailabilityResolver } from "@/lib/selection/round-availability";

let testDb: PrismaClient;

vi.mock("@/lib/db", () => ({
  get db() { return getTestDb(); },
}));

describe("getRoundAvailabilityResolver (ADR-0121)", () => {
  let fixture: TestFixtureIds;

  beforeAll(async () => {
    testDb = await setupTestDb();
    fixture = await seedTestFixture(testDb, { playersPerTeam: 3 });
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await testDb.availability.deleteMany({});
    await testDb.matchRound.update({ where: { id: fixture.matchRoundId }, data: { status: "DRAFT" } });
  });

  it("reads live Player.currentAvailability while the round is open (LIVE)", async () => {
    const p = fixture.players[0]!;
    const live = new Map<string, string>([[p.id, "INJURED"]]);

    const resolver = await getRoundAvailabilityResolver(fixture.matchRoundId, "DRAFT", live);

    expect(resolver.source).toBe("LIVE");
    expect(resolver.isCaptured).toBe(false);
    expect(resolver.resolve(p.id)).toEqual({ status: "INJURED", source: "LIVE" });
    // A player the caller has no live value for resolves UNKNOWN, not undefined.
    expect(resolver.resolve("no-such-player")).toEqual({ status: "UNKNOWN", source: "LIVE" });
  });

  it("reads the frozen snapshot for a FINALIZED round with captured rows (CAPTURED)", async () => {
    const [captured, absent] = fixture.players;
    await testDb.availability.create({
      data: {
        playerId: captured!.id,
        matchRoundId: fixture.matchRoundId,
        status: "AWAY",
        organisationId: fixture.organisationId,
      },
    });
    await testDb.matchRound.update({ where: { id: fixture.matchRoundId }, data: { status: "FINALIZED" } });

    // The live map deliberately disagrees — it must be ignored for a captured round.
    const live = new Map<string, string>([[captured!.id, "AVAILABLE"]]);
    const resolver = await getRoundAvailabilityResolver(fixture.matchRoundId, "FINALIZED", live);

    expect(resolver.source).toBe("CAPTURED");
    expect(resolver.isCaptured).toBe(true);
    expect(resolver.resolve(captured!.id)).toEqual({ status: "AWAY", source: "CAPTURED" });
    // A player not in the snapshot (out of scope at capture time) is UNKNOWN, never "available".
    expect(resolver.resolve(absent!.id)).toEqual({ status: "UNKNOWN", source: "NO_HISTORICAL_DATA" });
  });

  it("returns NO_HISTORICAL_DATA for a FINALIZED round closed before ADR-0121 (no snapshot)", async () => {
    await testDb.matchRound.update({ where: { id: fixture.matchRoundId }, data: { status: "FINALIZED" } });

    const live = new Map<string, string>([[fixture.players[0]!.id, "AVAILABLE"]]);
    const resolver = await getRoundAvailabilityResolver(fixture.matchRoundId, "FINALIZED", live);

    expect(resolver.source).toBe("NO_HISTORICAL_DATA");
    expect(resolver.isCaptured).toBe(false);
    expect(resolver.resolve(fixture.players[0]!.id)).toEqual({
      status: "UNKNOWN",
      source: "NO_HISTORICAL_DATA",
    });
  });
});
