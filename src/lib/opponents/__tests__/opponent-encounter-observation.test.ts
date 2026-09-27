import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, seedTestFixture, getTestDb, type TestFixtureIds } from "@/test/test-db";
import { createTestOpponentTeam } from "@/test/support/factories";
import { upsertOpponentEncounterObservation, getOpponentEncounterObservation } from "../opponent-encounter-observation";

/**
 * ADR-0152 §3.6 — the one canonical `OpponentEncounterObservation` writer, shared by the
 * standalone observation form and the guided debrief's submit mapping.
 */

vi.mock("@/lib/db", () => ({
  get db() {
    return getTestDb();
  },
}));

let testDb: PrismaClient;
let fixture: TestFixtureIds;
let matchId: string;
let opponentTeamId: string;

describe("upsertOpponentEncounterObservation", () => {
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixture = await seedTestFixture(testDb);
    matchId = Object.values(fixture.matches)[0];
    const opponent = await createTestOpponentTeam(testDb, fixture.organisationId);
    opponentTeamId = opponent.id;
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it("creates a new observation when none exists yet", async () => {
    const created = await upsertOpponentEncounterObservation({
      organisationId: fixture.organisationId,
      matchId,
      opponentTeamId,
      overallEnvironment: "ACCEPTABLE",
      opponentPlayersContext: "NOT_ASSESSED",
      opponentStaffContext: "NOT_ASSESSED",
      spectatorSidelineContext: "NOT_ASSESSED",
      concernCategories: [],
      playingStyleTags: ["HIGH_PRESSING"],
      factualSummary: "Pressed high on goal kicks.",
      followUp: "NONE",
      recordedBy: "coach@test.com",
    });
    expect(created.matchId).toBe(matchId);
    expect(created.opponentTeamId).toBe(opponentTeamId);
    expect(created.factualSummary).toBe("Pressed high on goal kicks.");

    const fetched = await getOpponentEncounterObservation(matchId, fixture.organisationId);
    expect(fetched?.id).toBe(created.id);
  });

  it("updates the existing row on a second call rather than creating a duplicate", async () => {
    await upsertOpponentEncounterObservation({
      organisationId: fixture.organisationId,
      matchId,
      opponentTeamId,
      overallEnvironment: "CONCERN",
      opponentPlayersContext: "NOT_ASSESSED",
      opponentStaffContext: "NOT_ASSESSED",
      spectatorSidelineContext: "NOT_ASSESSED",
      concernCategories: ["OTHER_OBSERVABLE_CONCERN"],
      playingStyleTags: ["LOW_BLOCK"],
      factualSummary: "Updated summary.",
      followUp: "DISCUSSED_AFTER_MATCH",
      recordedBy: "coach2@test.com",
    });

    const rows = await testDb.opponentEncounterObservation.findMany({ where: { matchId, organisationId: fixture.organisationId } });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.overallEnvironment).toBe("CONCERN");
    expect(rows[0]?.factualSummary).toBe("Updated summary.");
    expect(rows[0]?.recordedBy).toBe("coach2@test.com");
  });
});
