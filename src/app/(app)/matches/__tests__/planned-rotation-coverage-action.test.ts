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

import { checkPlannedRotationCoverageAction } from "../planned-rotation-actions";

describe("checkPlannedRotationCoverageAction (Phase 5)", () => {
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixture = await seedTestFixture(testDb, { playersPerTeam: 3 });
    auth.updateOrganisationId(fixture.organisationId);
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    auth.updateOrganisationId(fixture.organisationId);
    await testDb.matchLineupAssignment.deleteMany({});
    await testDb.matchLineup.deleteMany({});
    await testDb.formationSlot.deleteMany({});
    await testDb.formation.deleteMany({});
    await testDb.selection.deleteMany({});
    await testDb.combinationEvidence.deleteMany({});
  });

  it("reports hasLineup: false when the team has not set a match line-up yet", async () => {
    const matchId = fixture.matches.Bla!;
    const teamId = fixture.teams.Bla!;

    const result = await checkPlannedRotationCoverageAction(matchId, teamId, []);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.hasLineup).toBe(false);
    expect(result.issues).toEqual([]);
    expect(result.partnershipEvidence).toEqual([]);
  });

  it("reports a no_goalkeeper issue when the line-up has no goalkeeper slot assigned", async () => {
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
    const slots = await Promise.all(
      teamPlayers.map((_, i) =>
        testDb.formationSlot.create({
          data: {
            organisationId: fixture.organisationId,
            formationId: formation.id,
            gridX: i,
            gridY: 0,
            label: `Slot ${i}`,
            shortLabel: `S${i}`,
            roleType: "MIDFIELDER",
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
          data: { organisationId: fixture.organisationId, matchLineupId: lineup.id, slotId: slot.id, playerId: teamPlayers[i]!.id },
        }),
      ),
    );

    const result = await checkPlannedRotationCoverageAction(matchId, teamId, []);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.hasLineup).toBe(true);
    expect(result.issues.some((issue) => issue.type === "no_goalkeeper")).toBe(true);
  });

  it("does not report a no_goalkeeper issue when a goalkeeper slot is assigned", async () => {
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
    const gkSlot = await testDb.formationSlot.create({
      data: {
        organisationId: fixture.organisationId,
        formationId: formation.id,
        gridX: 0,
        gridY: 0,
        label: "Goalkeeper",
        shortLabel: "GK",
        roleType: "GOALKEEPER",
        acceptedPositionIds: [],
        sortOrder: 0,
      },
    });

    const lineup = await testDb.matchLineup.create({
      data: { organisationId: fixture.organisationId, matchId, teamId, formationId: formation.id, status: "DRAFT" },
    });
    await testDb.matchLineupAssignment.create({
      data: { organisationId: fixture.organisationId, matchLineupId: lineup.id, slotId: gkSlot.id, playerId: teamPlayers[0]!.id },
    });

    const result = await checkPlannedRotationCoverageAction(matchId, teamId, []);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.hasLineup).toBe(true);
    expect(result.issues.some((issue) => issue.type === "no_goalkeeper")).toBe(false);
  });

  it("reports an untimed_change issue for a change with no approximate timing", async () => {
    const matchId = fixture.matches.Bla!;
    const teamId = fixture.teams.Bla!;
    const teamPlayers = fixture.players.filter((p) => p.coreTeamName === "Bla");

    const formation = await testDb.formation.create({
      data: { organisationId: fixture.organisationId, name: "Test formation", gameFormat: "ELEVEN_A_SIDE", source: "SYSTEM" },
    });
    const gkSlot = await testDb.formationSlot.create({
      data: {
        organisationId: fixture.organisationId,
        formationId: formation.id,
        gridX: 0,
        gridY: 0,
        label: "Goalkeeper",
        shortLabel: "GK",
        roleType: "GOALKEEPER",
        acceptedPositionIds: [],
        sortOrder: 0,
      },
    });
    const lineup = await testDb.matchLineup.create({
      data: { organisationId: fixture.organisationId, matchId, teamId, formationId: formation.id, status: "DRAFT" },
    });
    await testDb.matchLineupAssignment.create({
      data: { organisationId: fixture.organisationId, matchLineupId: lineup.id, slotId: gkSlot.id, playerId: teamPlayers[0]!.id },
    });

    const result = await checkPlannedRotationCoverageAction(matchId, teamId, [
      {
        outPlayerId: teamPlayers[0]!.id,
        inPlayerId: teamPlayers[1]!.id,
        outPosition: null,
        inPosition: null,
        positionOnly: false,
        approximateMatchSeconds: null,
        notes: null,
      },
    ]);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.hasLineup).toBe(true);
    expect(result.issues.some((issue) => issue.type === "untimed_change")).toBe(true);
  });

  it("returns partnership evidence for starters with recorded season combination evidence (Phase 7)", async () => {
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
    const slots = await Promise.all(
      teamPlayers.map((_, i) =>
        testDb.formationSlot.create({
          data: {
            organisationId: fixture.organisationId,
            formationId: formation.id,
            gridX: i,
            gridY: 0,
            label: `Slot ${i}`,
            shortLabel: `S${i}`,
            roleType: i === 0 ? "GOALKEEPER" : "MIDFIELDER",
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
          data: { organisationId: fixture.organisationId, matchLineupId: lineup.id, slotId: slot.id, playerId: teamPlayers[i]!.id },
        }),
      ),
    );

    await testDb.combinationEvidence.create({
      data: {
        organisationId: fixture.organisationId,
        matchId,
        family: "PARTNERSHIP",
        subtype: "HORIZONTAL",
        playerIds: [teamPlayers[0]!.id, teamPlayers[1]!.id],
        positions: ["MIDFIELDER", "MIDFIELDER"],
        minutesTogether: 60,
        confidence: "EMERGING",
        leagueSeasonId: fixture.leagueSeasonId,
      },
    });

    const result = await checkPlannedRotationCoverageAction(matchId, teamId, []);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.hasLineup).toBe(true);
    expect(result.partnershipEvidence).toHaveLength(1);
    expect(result.partnershipEvidence[0]!.playerIds.sort()).toEqual(
      [teamPlayers[0]!.id, teamPlayers[1]!.id].sort(),
    );
  });

  it("excludes partnership evidence for pairs not both in the starting line-up", async () => {
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
    const gkSlot = await testDb.formationSlot.create({
      data: {
        organisationId: fixture.organisationId,
        formationId: formation.id,
        gridX: 0,
        gridY: 0,
        label: "Goalkeeper",
        shortLabel: "GK",
        roleType: "GOALKEEPER",
        acceptedPositionIds: [],
        sortOrder: 0,
      },
    });
    const lineup = await testDb.matchLineup.create({
      data: { organisationId: fixture.organisationId, matchId, teamId, formationId: formation.id, status: "DRAFT" },
    });
    // Only one starter assigned — the second player in the evidence pair is not on the pitch.
    await testDb.matchLineupAssignment.create({
      data: { organisationId: fixture.organisationId, matchLineupId: lineup.id, slotId: gkSlot.id, playerId: teamPlayers[0]!.id },
    });

    await testDb.combinationEvidence.create({
      data: {
        organisationId: fixture.organisationId,
        matchId,
        family: "PARTNERSHIP",
        subtype: "HORIZONTAL",
        playerIds: [teamPlayers[0]!.id, teamPlayers[1]!.id],
        positions: ["GOALKEEPER", "MIDFIELDER"],
        minutesTogether: 60,
        confidence: "EMERGING",
        leagueSeasonId: fixture.leagueSeasonId,
      },
    });

    const result = await checkPlannedRotationCoverageAction(matchId, teamId, []);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.partnershipEvidence).toEqual([]);
  });
});
