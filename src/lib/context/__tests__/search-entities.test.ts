import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, getTestDb, seedTestFixture } from "@/test/test-db";
import type { TestFixtureIds } from "@/test/test-db";

vi.mock("@/lib/db", () => ({
  get db() { return getTestDb(); },
}));

let testDb: PrismaClient;
let fixture: TestFixtureIds;

import { searchEntities } from "../get-operational-context";

// Cross-domain command-palette search (platform-integrity-programme Phase 16, A-016): events and
// opponents extend the same name-contains pattern already used for players/teams.
describe("searchEntities", () => {
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixture = await seedTestFixture(testDb, { rotationPaths: [] });

    await testDb.event.create({
      data: {
        name: "Summer Cup Finale",
        eventType: "CUP",
        startsAt: new Date("2026-07-01T10:00:00Z"),
        gameFormat: "SEVEN_A_SIDE",
        organisationId: fixture.organisationId,
        footballGroupId: fixture.footballGroupId,
      },
    });

    await testDb.opponentTeam.create({
      data: {
        displayName: "Riverside Rovers",
        normalizedName: "riverside rovers",
        organisationId: fixture.organisationId,
      },
    });
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it("returns empty arrays for a query shorter than 2 characters", async () => {
    const result = await searchEntities("a", { type: "org", filter: { organisationId: fixture.organisationId }, filterNullable: { organisationId: fixture.organisationId }, organisationId: fixture.organisationId });
    expect(result).toEqual({ players: [], teams: [], events: [], opponents: [] });
  });

  it("finds an event by partial name match", async () => {
    const result = await searchEntities("Summer", { type: "org", filter: { organisationId: fixture.organisationId }, filterNullable: { organisationId: fixture.organisationId }, organisationId: fixture.organisationId });
    expect(result.events).toHaveLength(1);
    expect(result.events[0]!.name).toBe("Summer Cup Finale");
  });

  it("finds an opponent by partial display name match", async () => {
    const result = await searchEntities("Riverside", { type: "org", filter: { organisationId: fixture.organisationId }, filterNullable: { organisationId: fixture.organisationId }, organisationId: fixture.organisationId });
    expect(result.opponents).toHaveLength(1);
    expect(result.opponents[0]!.name).toBe("Riverside Rovers");
  });

  it("does not return events or opponents from another organisation", async () => {
    const otherFixture = await seedTestFixture(testDb, {
      teams: [
        { name: "Other Org Team A", targetSquadSize: 8, minCorePlayers: 5, targetSupportCount: 0, maxSupportCount: 3, minSupportPlayers: 0, supportPriority: 1, developmentSlots: 0, minAcceptedSquadSize: 6, maxSquadSize: 12 },
      ],
      rotationPaths: [],
    });
    const result = await searchEntities("Summer", { type: "org", filter: { organisationId: otherFixture.organisationId }, filterNullable: { organisationId: otherFixture.organisationId }, organisationId: otherFixture.organisationId });
    expect(result.events).toHaveLength(0);
  });
});
