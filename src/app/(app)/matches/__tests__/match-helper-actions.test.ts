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

import {
  addLeagueMatchHelperAction,
  removeLeagueMatchHelperAction,
  getLeagueMatchHelpersAction,
} from "../match-helper-actions";
import { getLiveMatchPreMatchPackageAction } from "../[matchId]/live/live-actions";
import { seedReportFromFinalizedSquad } from "@/lib/reports/report-mutations";

async function selectPlayerForMatch(matchId: string, playerId: string, status: "DRAFT" | "FINALIZED" = "FINALIZED") {
  await testDb.selection.create({
    data: { matchId, matchRoundId: fixture.matchRoundId, playerId, role: "CORE", status, organisationId: fixture.organisationId },
  });
}

describe("League Match helper actions (ADR-0077)", () => {
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
    await testDb.liveMatchEvent.deleteMany({});
    await testDb.liveMatchSession.deleteMany({});
    await testDb.postMatchPlayerActual.deleteMany({});
    await testDb.postMatchReport.deleteMany({});
    await testDb.matchHelperAssignment.deleteMany({});
    await testDb.selection.deleteMany({});
    await testDb.matchRound.update({ where: { id: fixture.matchRoundId }, data: { status: "DRAFT" } });
  });

  it("scenario 1 + 5: adds a helper in a finalized round without moving the planned assignment; round stays finalized", async () => {
    const teamAPlayer = fixture.players.find((p) => p.coreTeamName === "Bla")!;
    const teamBPlayer = fixture.players.find((p) => p.coreTeamName === "Hvit")!;
    await selectPlayerForMatch(fixture.matches.Bla!, teamAPlayer.id, "FINALIZED");
    await selectPlayerForMatch(fixture.matches.Hvit!, teamBPlayer.id, "FINALIZED");
    await testDb.matchRound.update({ where: { id: fixture.matchRoundId }, data: { status: "FINALIZED" } });

    const result = await addLeagueMatchHelperAction({ matchId: fixture.matches.Hvit!, playerId: teamAPlayer.id });
    expect(result.success).toBe(true);

    const round = await testDb.matchRound.findUniqueOrThrow({ where: { id: fixture.matchRoundId } });
    expect(round.status).toBe("FINALIZED");

    const originalSelection = await testDb.selection.findFirst({ where: { playerId: teamAPlayer.id, matchRoundId: fixture.matchRoundId } });
    expect(originalSelection!.matchId).toBe(fixture.matches.Bla);
    expect(originalSelection!.status).toBe("FINALIZED");

    const helpers = await getLeagueMatchHelpersAction(fixture.matches.Hvit!);
    expect(helpers.some((h) => h.playerId === teamAPlayer.id)).toBe(true);
  });

  it("scenario 3: a helper is available in the live pre-match package roster", async () => {
    const teamAPlayer = fixture.players.find((p) => p.coreTeamName === "Bla")!;
    const teamBPlayer = fixture.players.find((p) => p.coreTeamName === "Hvit")!;
    await selectPlayerForMatch(fixture.matches.Bla!, teamAPlayer.id, "FINALIZED");
    await selectPlayerForMatch(fixture.matches.Hvit!, teamBPlayer.id, "FINALIZED");

    const addResult = await addLeagueMatchHelperAction({ matchId: fixture.matches.Hvit!, playerId: teamAPlayer.id });
    expect(addResult.success).toBe(true);

    const pkg = await getLiveMatchPreMatchPackageAction(fixture.matches.Hvit!);
    expect(pkg.success).toBe(true);
    if (!pkg.success) return;

    const helperEntry = pkg.data.squad.find((p) => p.playerId === teamAPlayer.id);
    expect(helperEntry).toBeDefined();
    expect(helperEntry!.isHelper).toBe(true);

    // Team 2's own planned player is still present too.
    expect(pkg.data.squad.some((p) => p.playerId === teamBPlayer.id)).toBe(true);
  });

  it("scenario 4: duplicate add fails safely", async () => {
    const teamAPlayer = fixture.players.find((p) => p.coreTeamName === "Bla")!;
    const first = await addLeagueMatchHelperAction({ matchId: fixture.matches.Hvit!, playerId: teamAPlayer.id });
    expect(first.success).toBe(true);

    const second = await addLeagueMatchHelperAction({ matchId: fixture.matches.Hvit!, playerId: teamAPlayer.id });
    expect(second.success).toBe(false);
    if (second.success) return;
    expect(second.error).toMatch(/already a participant/i);
  });

  it("scenario 5: removing a helper does not touch the planned round assignment", async () => {
    const teamAPlayer = fixture.players.find((p) => p.coreTeamName === "Bla")!;
    await selectPlayerForMatch(fixture.matches.Bla!, teamAPlayer.id, "FINALIZED");

    const added = await addLeagueMatchHelperAction({ matchId: fixture.matches.Hvit!, playerId: teamAPlayer.id });
    expect(added.success).toBe(true);
    if (!added.success) return;

    const removed = await removeLeagueMatchHelperAction(added.assignmentId);
    expect(removed.success).toBe(true);

    const originalSelection = await testDb.selection.findFirst({ where: { playerId: teamAPlayer.id, matchRoundId: fixture.matchRoundId } });
    expect(originalSelection!.matchId).toBe(fixture.matches.Bla);
    expect(originalSelection!.status).toBe("FINALIZED");

    const helpers = await getLeagueMatchHelpersAction(fixture.matches.Hvit!);
    expect(helpers.some((h) => h.playerId === teamAPlayer.id)).toBe(false);
  });

  it("scenario 6: a helper added before the match already appears in the seeded after-match report", async () => {
    const teamAPlayer = fixture.players.find((p) => p.coreTeamName === "Bla")!;
    const teamBPlayer = fixture.players.find((p) => p.coreTeamName === "Hvit")!;
    await selectPlayerForMatch(fixture.matches.Bla!, teamAPlayer.id, "FINALIZED");
    await selectPlayerForMatch(fixture.matches.Hvit!, teamBPlayer.id, "FINALIZED");

    const added = await addLeagueMatchHelperAction({ matchId: fixture.matches.Hvit!, playerId: teamAPlayer.id });
    expect(added.success).toBe(true);

    const orgFilter = {
      type: "org" as const,
      filter: { organisationId: fixture.organisationId },
      filterNullable: { organisationId: fixture.organisationId },
      organisationId: fixture.organisationId,
    };
    const seedResult = await seedReportFromFinalizedSquad(fixture.matches.Hvit!, orgFilter);
    expect(seedResult.success).toBe(true);

    const report = await testDb.postMatchReport.findFirstOrThrow({ where: { matchId: fixture.matches.Hvit! } });
    const helperActual = await testDb.postMatchPlayerActual.findFirst({
      where: { reportId: report.id, playerId: teamAPlayer.id },
    });
    expect(helperActual).not.toBeNull();
    expect(helperActual!.source).toBe("EMERGENCY_BACKFILL");
    expect(helperActual!.unplannedAppearanceReason).toBe("EMERGENCY_SQUAD_COVER");

    // The coach does not need to add them again — only one actual row exists for this player.
    const allActualsForPlayer = await testDb.postMatchPlayerActual.findMany({
      where: { reportId: report.id, playerId: teamAPlayer.id },
    });
    expect(allActualsForPlayer).toHaveLength(1);
  });

  it("scenario 7: a match in another organisation cannot receive a helper (tenant isolation)", async () => {
    const teamAPlayer = fixture.players.find((p) => p.coreTeamName === "Bla")!;

    auth.updateOrganisationId("a-completely-different-organisation-id");
    const result = await addLeagueMatchHelperAction({ matchId: fixture.matches.Hvit!, playerId: teamAPlayer.id });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toMatch(/not found|access denied/i);

    auth.updateOrganisationId(fixture.organisationId);
    const helpers = await getLeagueMatchHelpersAction(fixture.matches.Hvit!);
    expect(helpers).toHaveLength(0);
  });

  it("removal is refused once the player has recorded live match events", async () => {
    const teamAPlayer = fixture.players.find((p) => p.coreTeamName === "Bla")!;
    const added = await addLeagueMatchHelperAction({ matchId: fixture.matches.Hvit!, playerId: teamAPlayer.id });
    expect(added.success).toBe(true);
    if (!added.success) return;

    const session = await testDb.liveMatchSession.create({
      data: { matchId: fixture.matches.Hvit!, coachId: "test-user-id", organisationId: fixture.organisationId, status: "ACTIVE" },
    });
    await testDb.liveMatchEvent.create({
      data: {
        matchId: fixture.matches.Hvit!,
        sessionId: session.id,
        eventType: "SCORER_SET",
        playerId: teamAPlayer.id,
        organisationId: fixture.organisationId,
      },
    });

    const removed = await removeLeagueMatchHelperAction(added.assignmentId);
    expect(removed.success).toBe(false);
    if (removed.success) return;
    expect(removed.error).toMatch(/recorded live match events/i);
  });
});
