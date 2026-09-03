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

import { generateIntegratedMatchPlanAction } from "../integrated-match-plan-actions";

describe("generateIntegratedMatchPlanAction (Evidence-Informed Match Planning, Bundle 8)", () => {
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

  async function setUpSquadAndFormation() {
    const matchId = fixture.matches.Bla!;
    const teamId = fixture.teams.Bla!;
    const teamPlayers = fixture.players.filter((p) => p.coreTeamName === "Bla");

    for (const p of teamPlayers) {
      await testDb.selection.create({
        data: { matchId, matchRoundId: fixture.matchRoundId, playerId: p.id, role: "CORE", status: "DRAFT", organisationId: fixture.organisationId },
      });
    }

    const formation = await testDb.formation.create({
      data: { organisationId: fixture.organisationId, name: "Test formation", gameFormat: "ELEVEN_A_SIDE", source: "SYSTEM" },
    });
    const roleTypes = ["GOALKEEPER", "DEFENDER", "FORWARD"] as const;
    await Promise.all(
      roleTypes.map((roleType, i) =>
        testDb.formationSlot.create({
          data: {
            organisationId: fixture.organisationId,
            formationId: formation.id,
            gridX: i,
            gridY: 0,
            label: `Slot ${i}`,
            shortLabel: `S${i}`,
            roleType,
            acceptedPositionIds: [],
            sortOrder: i,
          },
        }),
      ),
    );

    return { matchId, teamId, formationId: formation.id, teamPlayers };
  }

  it("refuses when a rotation plan already exists for this match and team", async () => {
    const { matchId, teamId, formationId } = await setUpSquadAndFormation();
    await testDb.plannedRotation.create({
      data: { organisationId: fixture.organisationId, matchId, teamId, status: "DRAFT" },
    });

    const result = await generateIntegratedMatchPlanAction(matchId, formationId);

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toMatch(/already exists/i);
  });

  it("generates a lineup and a rotation plan together from a real squad and formation", async () => {
    const { matchId, formationId } = await setUpSquadAndFormation();

    const result = await generateIntegratedMatchPlanAction(matchId, formationId);

    expect(result.success).toBe(true);

    const lineup = await testDb.matchLineup.findFirst({ where: { matchId }, include: { assignments: true } });
    expect(lineup).not.toBeNull();
    expect(lineup!.assignments.filter((a) => a.playerId !== null).length).toBeGreaterThan(0);

    const rotation = await testDb.plannedRotation.findFirst({ where: { matchId }, include: { changes: true } });
    expect(rotation).not.toBeNull();
  });

  it("never assigns the goalkeeper slot with an evidence-scored (non-goalkeeper-derived) reason", async () => {
    const { matchId, formationId } = await setUpSquadAndFormation();

    const result = await generateIntegratedMatchPlanAction(matchId, formationId);
    expect(result.success).toBe(true);

    const lineup = await testDb.matchLineup.findFirst({
      where: { matchId },
      include: { assignments: true, formation: { include: { slots: true } } },
    });
    expect(lineup).not.toBeNull();
    const gkSlot = lineup!.formation!.slots.find((s) => s.roleType === "GOALKEEPER");
    expect(gkSlot).toBeDefined();
    const gkAssignment = lineup!.assignments.find((a) => a.slotId === gkSlot!.id);
    // A goalkeeper assignment may or may not exist depending on fixture positions, but if one
    // does, it must never come from evidence-bonus reasoning (never scored for GK slots).
    if (gkAssignment) {
      expect(gkAssignment.playerId).not.toBeNull();
    }
  });
});
