import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, seedTestFixture, getTestDb, type TestFixtureIds } from "@/test/test-db";
import { mockAuthContext } from "@/test/support/auth-mock";

const auth = mockAuthContext({ role: "COACH" });

vi.mock("@/lib/db", () => ({
  get db() { return getTestDb(); },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

let testDb: PrismaClient;
let fixture: TestFixtureIds;

import { generateRotationPlanAction } from "../planned-rotation-actions";

describe("generateRotationPlanAction (Evidence-Informed Match Planning, Bundle 7)", () => {
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixture = await seedTestFixture(testDb, { playersPerTeam: 6 });
    auth.updateOrganisationId(fixture.organisationId);
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    auth.updateOrganisationId(fixture.organisationId);
    await testDb.plannedRotationChange.deleteMany({});
    await testDb.plannedRotation.deleteMany({});
    await testDb.matchLineupAssignment.deleteMany({});
    await testDb.matchLineup.deleteMany({});
    await testDb.formationSlot.deleteMany({});
    await testDb.formation.deleteMany({});
    await testDb.selection.deleteMany({});
  });

  async function setUpLineupAndSquad() {
    const matchId = fixture.matches.Bla!;
    const teamId = fixture.teams.Bla!;
    const teamPlayers = fixture.players.filter((p) => p.coreTeamName === "Bla");
    // First 3 start, the rest are bench (still part of the squad via a DRAFT selection).
    const starterPlayers = teamPlayers.slice(0, 3);
    const benchPlayers = teamPlayers.slice(3);

    for (const p of teamPlayers) {
      await testDb.selection.create({
        data: { matchId, matchRoundId: fixture.matchRoundId, playerId: p.id, role: "CORE", status: "DRAFT", organisationId: fixture.organisationId },
      });
    }

    const formation = await testDb.formation.create({
      data: { organisationId: fixture.organisationId, name: "Test formation", gameFormat: "ELEVEN_A_SIDE", source: "SYSTEM" },
    });
    const roleTypes = ["GOALKEEPER", "DEFENDER", "FORWARD"] as const;
    const slots = await Promise.all(
      starterPlayers.map((_, i) =>
        testDb.formationSlot.create({
          data: {
            organisationId: fixture.organisationId,
            formationId: formation.id,
            gridX: i,
            gridY: 0,
            label: `Slot ${i}`,
            shortLabel: `S${i}`,
            roleType: roleTypes[i]!,
            acceptedPositionIds: [],
            sortOrder: i,
          },
        }),
      ),
    );

    const lineup = await testDb.matchLineup.create({
      data: { organisationId: fixture.organisationId, matchId, teamId, formationId: formation.id, status: "DRAFT" },
    });
    await Promise.all(
      slots.map((slot, i) =>
        testDb.matchLineupAssignment.create({
          data: { organisationId: fixture.organisationId, matchLineupId: lineup.id, slotId: slot.id, playerId: starterPlayers[i]!.id },
        }),
      ),
    );

    return { matchId, teamId, starterPlayers, benchPlayers };
  }

  it("refuses when the team has not set a match line-up yet", async () => {
    const matchId = fixture.matches.Bla!;
    const teamId = fixture.teams.Bla!;

    const result = await generateRotationPlanAction(matchId, teamId);

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toMatch(/line-up/i);
  });

  it("generates and persists a plan with at least one change, given a real squad and lineup", async () => {
    const { matchId, teamId } = await setUpLineupAndSquad();

    const result = await generateRotationPlanAction(matchId, teamId);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.rotation.changes.length).toBeGreaterThan(0);
  });

  it("never generates a change involving the goalkeeper", async () => {
    const { matchId, teamId, starterPlayers } = await setUpLineupAndSquad();
    const goalkeeperId = starterPlayers[0]!.id; // slot 0 is GOALKEEPER above

    const result = await generateRotationPlanAction(matchId, teamId);

    expect(result.success).toBe(true);
    if (!result.success) return;
    for (const change of result.rotation.changes) {
      expect(change.outPlayerId).not.toBe(goalkeeperId);
      expect(change.inPlayerId).not.toBe(goalkeeperId);
    }
  });

  it("refuses to generate a second plan when one already exists for this match and team", async () => {
    const { matchId, teamId } = await setUpLineupAndSquad();

    const first = await generateRotationPlanAction(matchId, teamId);
    expect(first.success).toBe(true);

    const second = await generateRotationPlanAction(matchId, teamId);
    expect(second.success).toBe(false);
    if (second.success) return;
    expect(second.error).toMatch(/already exists/i);
  });
});
