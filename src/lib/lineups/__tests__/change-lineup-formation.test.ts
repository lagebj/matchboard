import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import type { PrismaClient, FormationSlotRoleType } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, seedTestFixture, getTestDb, type TestFixtureIds } from "@/test/test-db";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";

vi.mock("@/lib/db", () => ({
  get db() { return getTestDb(); },
}));

let testDb: PrismaClient;
let fixture: TestFixtureIds;

import { createLineupFromFormation, changeLineupFormation } from "../lineup-domain";

function orgFilter(organisationId: string): OrgFilterMode {
  return {
    type: "org",
    filter: { organisationId },
    filterNullable: { organisationId },
    organisationId,
  };
}

async function makeFormation(name: string, slots: Array<{ gridX: number; gridY: number; roleType: FormationSlotRoleType }>) {
  return testDb.formation.create({
    data: {
      organisationId: fixture.organisationId,
      name,
      gameFormat: "SEVEN_A_SIDE",
      source: "SYSTEM",
      slots: {
        create: slots.map((s, i) => ({
          organisationId: fixture.organisationId,
          gridX: s.gridX,
          gridY: s.gridY,
          label: `Slot ${i}`,
          shortLabel: `S${i}`,
          roleType: s.roleType,
          acceptedPositionIds: [],
          sortOrder: i,
        })),
      },
    },
    include: { slots: true },
  });
}

describe("changeLineupFormation (formation switching, regression)", () => {
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixture = await seedTestFixture(testDb, { playersPerTeam: 4 });
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await testDb.matchLineupAssignment.deleteMany({});
    await testDb.matchLineup.deleteMany({});
    await testDb.formationSlot.deleteMany({});
    await testDb.formation.deleteMany({});
  });

  it("does not throw 'lineup already exists' when switching formation on an existing lineup", async () => {
    const matchId = fixture.matches.Bla!;
    const teamId = fixture.teams.Bla!;
    const filter = orgFilter(fixture.organisationId);

    const formationA = await makeFormation("4-2-1 A", [
      { gridX: 0, gridY: 0, roleType: "GOALKEEPER" },
      { gridX: 1, gridY: 1, roleType: "DEFENDER" },
      { gridX: 2, gridY: 2, roleType: "MIDFIELDER" },
      { gridX: 3, gridY: 3, roleType: "FORWARD" },
    ]);
    const formationB = await makeFormation("3-2-1 B", [
      { gridX: 0, gridY: 0, roleType: "GOALKEEPER" },
      { gridX: 1, gridY: 1, roleType: "DEFENDER" },
      { gridX: 4, gridY: 4, roleType: "MIDFIELDER" },
    ]);

    const lineup = await createLineupFromFormation({ matchId, teamId, formationId: formationA.id, orgFilter: filter });
    expect(lineup.formationId).toBe(formationA.id);

    await expect(
      changeLineupFormation({ lineupId: lineup.id, newFormationId: formationB.id, orgFilter: filter }),
    ).resolves.toBeTruthy();

    // Exactly one MatchLineup row remains for this match/team.
    const lineups = await testDb.matchLineup.findMany({ where: { matchId, teamId } });
    expect(lineups).toHaveLength(1);
    expect(lineups[0]!.formationId).toBe(formationB.id);
  });

  it("is safe to call repeatedly, including switching back and forth", async () => {
    const matchId = fixture.matches.Hvit!;
    const teamId = fixture.teams.Hvit!;
    const filter = orgFilter(fixture.organisationId);

    const formationA = await makeFormation("Repeat A", [
      { gridX: 0, gridY: 0, roleType: "GOALKEEPER" },
      { gridX: 1, gridY: 1, roleType: "DEFENDER" },
    ]);
    const formationB = await makeFormation("Repeat B", [
      { gridX: 0, gridY: 0, roleType: "GOALKEEPER" },
      { gridX: 2, gridY: 2, roleType: "MIDFIELDER" },
    ]);

    const lineup = await createLineupFromFormation({ matchId, teamId, formationId: formationA.id, orgFilter: filter });

    await changeLineupFormation({ lineupId: lineup.id, newFormationId: formationB.id, orgFilter: filter });
    await changeLineupFormation({ lineupId: lineup.id, newFormationId: formationA.id, orgFilter: filter });
    await changeLineupFormation({ lineupId: lineup.id, newFormationId: formationB.id, orgFilter: filter });

    const lineups = await testDb.matchLineup.findMany({ where: { matchId, teamId } });
    expect(lineups).toHaveLength(1);
    expect(lineups[0]!.formationId).toBe(formationB.id);

    const assignments = await testDb.matchLineupAssignment.findMany({ where: { matchLineupId: lineup.id } });
    expect(assignments).toHaveLength(2);
  });

  it("is a no-op when switching to the currently-assigned formation", async () => {
    const matchId = fixture.matches.Rod!;
    const teamId = fixture.teams.Rod!;
    const filter = orgFilter(fixture.organisationId);

    const formationA = await makeFormation("NoOp A", [
      { gridX: 0, gridY: 0, roleType: "GOALKEEPER" },
    ]);

    const lineup = await createLineupFromFormation({ matchId, teamId, formationId: formationA.id, orgFilter: filter });
    const player = fixture.players.find((p) => p.coreTeamName === "Rod")!;
    await testDb.matchLineupAssignment.updateMany({
      where: { matchLineupId: lineup.id },
      data: { playerId: player.id },
    });

    await changeLineupFormation({ lineupId: lineup.id, newFormationId: formationA.id, orgFilter: filter });

    const lineups = await testDb.matchLineup.findMany({ where: { matchId, teamId } });
    expect(lineups).toHaveLength(1);
    const assignments = await testDb.matchLineupAssignment.findMany({ where: { matchLineupId: lineup.id } });
    expect(assignments.find((a) => a.playerId === player.id)).toBeTruthy();
  });

  it("preserves a player onto a matching slot in the new formation", async () => {
    const matchId = fixture.matches.Bla!;
    const teamId = fixture.teams.Bla!;
    const filter = orgFilter(fixture.organisationId);
    const player = fixture.players.find((p) => p.coreTeamName === "Bla")!;

    const formationA = await makeFormation("Preserve A", [
      { gridX: 0, gridY: 0, roleType: "GOALKEEPER" },
    ]);
    const formationB = await makeFormation("Preserve B", [
      { gridX: 5, gridY: 5, roleType: "GOALKEEPER" },
      { gridX: 1, gridY: 1, roleType: "DEFENDER" },
    ]);

    const lineup = await createLineupFromFormation({ matchId, teamId, formationId: formationA.id, orgFilter: filter });
    await testDb.matchLineupAssignment.updateMany({
      where: { matchLineupId: lineup.id },
      data: { playerId: player.id },
    });

    await changeLineupFormation({ lineupId: lineup.id, newFormationId: formationB.id, orgFilter: filter });

    const assignments = await testDb.matchLineupAssignment.findMany({ where: { matchLineupId: lineup.id } });
    expect(assignments).toHaveLength(2);
    // Preserved via role-type match onto the new formation's GOALKEEPER slot.
    const gkSlotId = formationB.slots.find((s) => s.roleType === "GOALKEEPER")!.id;
    expect(assignments.find((a) => a.slotId === gkSlotId)?.playerId).toBe(player.id);

    const updatedLineup = await testDb.matchLineup.findUniqueOrThrow({ where: { id: lineup.id } });
    expect((updatedLineup.benchPlayerIds as string[]).includes(player.id)).toBe(false);
  });

  it("moves a player to the bench when no compatible slot exists in the new formation", async () => {
    const matchId = fixture.matches.Hvit!;
    const teamId = fixture.teams.Hvit!;
    const filter = orgFilter(fixture.organisationId);
    const player = fixture.players.find((p) => p.coreTeamName === "Hvit")!;

    const formationA = await makeFormation("Bench A", [
      { gridX: 0, gridY: 0, roleType: "FORWARD" },
    ]);
    const formationB = await makeFormation("Bench B", [
      { gridX: 0, gridY: 0, roleType: "GOALKEEPER" },
    ]);

    const lineup = await createLineupFromFormation({ matchId, teamId, formationId: formationA.id, orgFilter: filter });
    await testDb.matchLineupAssignment.updateMany({
      where: { matchLineupId: lineup.id },
      data: { playerId: player.id },
    });

    await changeLineupFormation({ lineupId: lineup.id, newFormationId: formationB.id, orgFilter: filter });

    const assignments = await testDb.matchLineupAssignment.findMany({ where: { matchLineupId: lineup.id } });
    // Never left pointing at a slot that doesn't exist in the new formation.
    expect(assignments.every((a) => a.slotId === formationB.slots[0]!.id)).toBe(true);
    expect(assignments.find((a) => a.playerId === player.id)).toBeUndefined();

    const updatedLineup = await testDb.matchLineup.findUniqueOrThrow({ where: { id: lineup.id } });
    expect((updatedLineup.benchPlayerIds as string[])).toContain(player.id);
  });
});
