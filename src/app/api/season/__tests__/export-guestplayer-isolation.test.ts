import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, seedTestFixture, getTestDb, type TestFixtureIds } from "@/test/test-db";
import { mockAuthContext } from "@/test/support/auth-mock";

const auth = mockAuthContext({ role: "COACH" });

vi.mock("@/lib/db", () => ({
  get db() {
    return getTestDb();
  },
}));

let testDb: PrismaClient;
let fixtureIds: TestFixtureIds;

// ADR-0106: a GuestPlayer's League Match participation (LeagueMatchGuestAssignment) must never
// appear in season export rows -- the export's sole data source is db.selection.findMany(),
// which is a completely separate table with a required (non-nullable) playerId that a GuestPlayer
// can never populate. This test locks in that structural guarantee end-to-end through the real
// GET route, not just at the data-layer.
describe("Season export -- GuestPlayer isolation (ADR-0106)", () => {
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixtureIds = await seedTestFixture(testDb);
    auth.updateOrganisationId(fixtureIds.organisationId);
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it("never includes a GuestPlayer's name, even when the GuestPlayer participated in the same finalized round via LeagueMatchGuestAssignment", async () => {
    const player = fixtureIds.players[0];
    const matchId = fixtureIds.matches["Bla"]!;

    await testDb.matchRound.update({
      where: { id: fixtureIds.matchRoundId },
      data: { status: "FINALIZED" },
    });

    await testDb.selection.create({
      data: {
        matchId,
        matchRoundId: fixtureIds.matchRoundId,
        playerId: player.id,
        role: "CORE",
        status: "FINALIZED",
        organisationId: fixtureIds.organisationId,
      },
    });

    const guestPlayer = await testDb.guestPlayer.create({
      data: { name: "Oliver Hansen", organisationId: fixtureIds.organisationId, footballGroupId: fixtureIds.footballGroupId },
    });
    await testDb.leagueRoundParticipant.create({
      data: { matchRoundId: fixtureIds.matchRoundId, guestPlayerId: guestPlayer.id, organisationId: fixtureIds.organisationId },
    });
    await testDb.leagueMatchGuestAssignment.create({
      data: {
        matchId,
        matchRoundId: fixtureIds.matchRoundId,
        guestPlayerId: guestPlayer.id,
        organisationId: fixtureIds.organisationId,
      },
    });

    const { GET } = await import("@/app/api/season/export/route");
    const { NextRequest } = await import("next/server");
    const request = new NextRequest(
      `http://localhost/api/season/export?leagueSeasonId=${fixtureIds.leagueSeasonId}&format=json&visibility=coach`,
    );
    const response = await GET(request);
    expect(response.status).toBe(200);

    const text = await response.text();
    expect(text).not.toContain("Oliver Hansen");
    expect(text).not.toContain(guestPlayer.id);

    expect(text).toContain(player.firstName);

    await testDb.leagueMatchGuestAssignment.deleteMany({ where: { guestPlayerId: guestPlayer.id } });
    await testDb.leagueRoundParticipant.deleteMany({ where: { guestPlayerId: guestPlayer.id } });
    await testDb.guestPlayer.delete({ where: { id: guestPlayer.id } });
  });
});
