import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, getTestDb, seedTestFixture } from "@/test/test-db";
import type { TestFixtureIds } from "@/test/test-db";
import { mockAuthContext } from "@/test/support/auth-mock";

const auth = mockAuthContext({ role: "COACH" });

vi.mock("@/lib/db", () => ({
  get db() { return getTestDb(); },
}));

let testDb: PrismaClient;
let fixture: TestFixtureIds;

import { getPlayerOutfieldRoleSuitability } from "./get-player-outfield-role-suitability";

describe("getPlayerOutfieldRoleSuitability (Evidence-Informed Match Planning, Bundle 5)", () => {
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixture = await seedTestFixture(testDb, { rotationPaths: [] });
    auth.updateOrganisationId(fixture.organisationId);
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it("returns NATURAL for the declared primary broad position and UNSUPPORTED for others with no exposure", async () => {
    const striker = fixture.players.find((p) => p.primaryPosition === "ST")!;
    const summary = await getPlayerOutfieldRoleSuitability(striker.id);
    expect(summary).not.toBeNull();
    expect(summary!.outfieldRoles.map((r) => r.role).sort()).toEqual(["ATTACK", "DEFENCE", "FLEXIBLE", "MIDFIELD"]);

    const attack = summary!.outfieldRoles.find((r) => r.role === "ATTACK")!;
    expect(attack.tier).toBe("NATURAL");

    const defence = summary!.outfieldRoles.find((r) => r.role === "DEFENCE")!;
    expect(defence.tier).toBe("UNSUPPORTED");
  });

  it("never returns a goalkeeper role entry, even for a player with a GK-primary position", async () => {
    const goalkeeper = fixture.players.find((p) => p.primaryPosition === "GK")!;
    const summary = await getPlayerOutfieldRoleSuitability(goalkeeper.id);
    expect(summary!.outfieldRoles.some((r) => (r.role as string) === "GOALKEEPER")).toBe(false);
  });

  it("resolves the football group's league season for the exposure evidence label", async () => {
    const striker = fixture.players.find((p) => p.primaryPosition === "ST")!;
    const summary = await getPlayerOutfieldRoleSuitability(striker.id);
    expect(summary!.leagueSeasonId).toBe(fixture.leagueSeasonId);
    expect(summary!.leagueSeasonLabel).not.toBeNull();
  });

  it("classifies demonstrated realised-position exposure in a non-declared role as DEVELOPMENTAL", async () => {
    const striker = fixture.players.find((p) => p.primaryPosition === "ST")!;
    const teamId = striker.coreTeamId;
    const match = await testDb.match.findFirst({ where: { teamId, matchRoundId: fixture.matchRoundId } });
    expect(match).not.toBeNull();

    await testDb.selection.create({
      data: {
        organisationId: fixture.organisationId,
        matchId: match!.id,
        matchRoundId: fixture.matchRoundId,
        playerId: striker.id,
        role: "CORE",
        status: "FINALIZED",
      },
    });

    const report = await testDb.postMatchReport.create({
      data: { organisationId: fixture.organisationId, matchId: match!.id, status: "REPORTED" },
    });

    await testDb.postMatchPlayerActual.create({
      data: {
        organisationId: fixture.organisationId,
        reportId: report.id,
        matchId: match!.id,
        playerId: striker.id,
        attendanceStatus: "PRESENT",
        actualPositions: ["CM", "CM", "CM", "CM", "CM", "CM"],
      },
    });

    const summary = await getPlayerOutfieldRoleSuitability(striker.id);
    const midfield = summary!.outfieldRoles.find((r) => r.role === "MIDFIELD")!;
    expect(midfield.tier).toBe("DEVELOPMENTAL");
    expect(midfield.exposureConfidence).toBe("ESTABLISHED");
  });

  it("computes tactical function fits alongside outfield roles", async () => {
    const striker = fixture.players.find((p) => p.primaryPosition === "ST")!;
    await testDb.player.update({
      where: { id: striker.id },
      data: { speed: 9, oneVOneAttacking: 8, decisionMaking: 8 },
    });

    const summary = await getPlayerOutfieldRoleSuitability(striker.id);
    const paceInBehind = summary!.tacticalFunctions.find((f) => f.function === "PACE_IN_BEHIND")!;
    expect(paceInBehind.tier).toBe("STRONG_FIT");
  });
});
