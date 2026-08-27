import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, seedTestFixture, getTestDb, type TestFixtureIds } from "@/test/test-db";

vi.mock("@/lib/db", () => ({
  get db() {
    return getTestDb();
  },
}));

let testDb: PrismaClient;
let fixture: TestFixtureIds;

const orgFilterFor = (organisationId: string) => ({
  type: "org" as const,
  filter: { organisationId },
  filterNullable: { organisationId },
  organisationId,
});

describe("generateEmergencyRepairOptions", () => {
  beforeAll(async () => {
    testDb = await setupTestDb();
    // Matches must be in the future relative to "now" for isMatchPlanningEditable to allow edits.
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);
    fixture = await seedTestFixture(testDb, { matchDates: { Bla: futureDate, Hvit: futureDate, Rod: futureDate } });
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it("finds a viable own-team replacement and leaves the draft unchanged afterward", async () => {
    const { generateEmergencyRepairOptions } = await import("../emergency-repair-options");

    const blaMatchId = fixture.matches["Bla"]!;
    const blaPlayers = fixture.players.filter((p) => p.coreTeamName === "Bla");
    const vacatedPlayer = blaPlayers[0]!;

    await testDb.selection.create({
      data: {
        matchId: blaMatchId,
        matchRoundId: fixture.matchRoundId,
        playerId: vacatedPlayer.id,
        role: "CORE",
        status: "DRAFT",
        organisationId: fixture.organisationId,
        selectionReason: "Test setup",
      },
    });

    const result = await generateEmergencyRepairOptions(blaMatchId, vacatedPlayer.id, orgFilterFor(fixture.organisationId));

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.vacatedPlayerId).toBe(vacatedPlayer.id);
    expect(result.options.length).toBeGreaterThan(0);
    expect(result.options.every((o) => o.playerId !== vacatedPlayer.id)).toBe(true);
    // At least one option should be another available Bla player (own-team, priority 1).
    expect(result.options.some((o) => o.isOwnTeam)).toBe(true);

    const restored = await testDb.selection.findFirst({
      where: { matchId: blaMatchId, playerId: vacatedPlayer.id, status: "DRAFT" },
    });
    expect(restored).not.toBeNull();
    expect(restored!.role).toBe("CORE");

    await testDb.selection.deleteMany({ where: { matchId: blaMatchId } });
  });

  it("excludes players already selected elsewhere in the same round", async () => {
    const { generateEmergencyRepairOptions } = await import("../emergency-repair-options");

    const blaMatchId = fixture.matches["Bla"]!;
    const blaPlayers = fixture.players.filter((p) => p.coreTeamName === "Bla");
    const vacatedPlayer = blaPlayers[0]!;
    const alreadyElsewhere = blaPlayers[1]!;

    await testDb.selection.createMany({
      data: [
        {
          matchId: blaMatchId,
          matchRoundId: fixture.matchRoundId,
          playerId: vacatedPlayer.id,
          role: "CORE",
          status: "DRAFT",
          organisationId: fixture.organisationId,
          selectionReason: "Test setup",
        },
        {
          matchId: fixture.matches["Hvit"]!,
          matchRoundId: fixture.matchRoundId,
          playerId: alreadyElsewhere.id,
          role: "SUPPORT",
          status: "DRAFT",
          organisationId: fixture.organisationId,
          selectionReason: "Test setup — already committed elsewhere this round",
        },
      ],
    });

    const result = await generateEmergencyRepairOptions(blaMatchId, vacatedPlayer.id, orgFilterFor(fixture.organisationId));

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.options.some((o) => o.playerId === alreadyElsewhere.id)).toBe(false);

    await testDb.selection.deleteMany({ where: { matchRoundId: fixture.matchRoundId } });
  });

  it("returns an error when the player is not currently in the match draft", async () => {
    const { generateEmergencyRepairOptions } = await import("../emergency-repair-options");

    const blaMatchId = fixture.matches["Bla"]!;
    const notSelected = fixture.players.find((p) => p.coreTeamName === "Bla")!;

    const result = await generateEmergencyRepairOptions(blaMatchId, notSelected.id, orgFilterFor(fixture.organisationId));

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toContain("not currently in this match's draft squad");
  });
});
