import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, seedTestFixture, getTestDb, type TestFixtureIds } from "@/test/test-db";
import {
  getEffectiveLeagueMatchRoster,
  getLeagueMatchHelperCandidates,
  assertLeagueMatchHelperEligible,
} from "@/lib/matches/match-helper-eligibility";

let testDb: PrismaClient;
let fixture: TestFixtureIds;

vi.mock("@/lib/db", () => ({
  get db() { return getTestDb(); },
}));

function orgFilter(organisationId: string) {
  return {
    type: "org" as const,
    filter: { organisationId },
    filterNullable: { organisationId },
    organisationId,
  };
}

async function selectPlayerForMatch(matchId: string, matchRoundId: string, playerId: string, organisationId: string, status: "DRAFT" | "FINALIZED" = "DRAFT") {
  await testDb.selection.create({
    data: { matchId, matchRoundId, playerId, role: "CORE", status, organisationId },
  });
}

describe("League Match helpers — eligibility (ADR-0077)", () => {
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixture = await seedTestFixture(testDb, { playersPerTeam: 3 });
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await testDb.postMatchPlayerActual.deleteMany({});
    await testDb.postMatchReport.deleteMany({});
    await testDb.matchHelperAssignment.deleteMany({});
    await testDb.selection.deleteMany({});
    await testDb.matchRound.update({ where: { id: fixture.matchRoundId }, data: { status: "DRAFT" } });
  });

  it("scenario 1: helper can be added in a finalized round and the round stays finalized", async () => {
    const teamAPlayer = fixture.players.find((p) => p.coreTeamName === "Bla")!;
    const teamBPlayer = fixture.players.find((p) => p.coreTeamName === "Hvit")!;
    await selectPlayerForMatch(fixture.matches.Bla!, fixture.matchRoundId, teamAPlayer.id, fixture.organisationId, "FINALIZED");
    await selectPlayerForMatch(fixture.matches.Hvit!, fixture.matchRoundId, teamBPlayer.id, fixture.organisationId, "FINALIZED");
    await testDb.matchRound.update({ where: { id: fixture.matchRoundId }, data: { status: "FINALIZED" } });

    const filter = orgFilter(fixture.organisationId);
    const eligibility = await assertLeagueMatchHelperEligible(fixture.matches.Hvit!, teamAPlayer.id, filter);
    expect(eligibility.eligible).toBe(true);

    await testDb.matchHelperAssignment.create({
      data: {
        matchId: fixture.matches.Hvit!,
        playerId: teamAPlayer.id,
        sourceTeamId: fixture.teams.Bla!,
        organisationId: fixture.organisationId,
      },
    });

    const round = await testDb.matchRound.findUniqueOrThrow({ where: { id: fixture.matchRoundId } });
    expect(round.status).toBe("FINALIZED");

    // scenario 5: normal assignment preserved
    const teamAPlayerSelection = await testDb.selection.findFirst({
      where: { playerId: teamAPlayer.id, matchRoundId: fixture.matchRoundId },
    });
    expect(teamAPlayerSelection!.matchId).toBe(fixture.matches.Bla);
    expect(teamAPlayerSelection!.status).toBe("FINALIZED");

    const roster = await getEffectiveLeagueMatchRoster(fixture.matches.Hvit!, filter);
    expect(roster.some((r) => r.playerId === teamAPlayer.id && r.source === "helper")).toBe(true);
  });

  it("scenario 2: player who already played another match in the round remains eligible to help", async () => {
    const teamAPlayer = fixture.players.find((p) => p.coreTeamName === "Bla")!;
    await selectPlayerForMatch(fixture.matches.Bla!, fixture.matchRoundId, teamAPlayer.id, fixture.organisationId, "FINALIZED");

    // Simulate Team 1's match already completed with this player having played.
    const report = await testDb.postMatchReport.create({
      data: { matchId: fixture.matches.Bla!, organisationId: fixture.organisationId, status: "LOCKED" },
    });
    await testDb.postMatchPlayerActual.create({
      data: {
        organisationId: fixture.organisationId,
        reportId: report.id,
        matchId: fixture.matches.Bla!,
        playerId: teamAPlayer.id,
        source: "PLANNED",
        attendanceStatus: "PRESENT",
      },
    });

    const filter = orgFilter(fixture.organisationId);
    const eligibility = await assertLeagueMatchHelperEligible(fixture.matches.Hvit!, teamAPlayer.id, filter);
    expect(eligibility.eligible).toBe(true);
  });

  it("scenario 4: adding the same player twice to the same match fails safely", async () => {
    const teamAPlayer = fixture.players.find((p) => p.coreTeamName === "Bla")!;

    await testDb.matchHelperAssignment.create({
      data: {
        matchId: fixture.matches.Hvit!,
        playerId: teamAPlayer.id,
        sourceTeamId: fixture.teams.Bla!,
        organisationId: fixture.organisationId,
      },
    });

    const filter = orgFilter(fixture.organisationId);
    const eligibility = await assertLeagueMatchHelperEligible(fixture.matches.Hvit!, teamAPlayer.id, filter);
    expect(eligibility.eligible).toBe(false);
    expect(eligibility.reason).toMatch(/already a participant/i);
  });

  it("does not exclude a player already planned for another team in this round from helper candidates", async () => {
    const teamAPlayer = fixture.players.find((p) => p.coreTeamName === "Bla")!;
    await selectPlayerForMatch(fixture.matches.Bla!, fixture.matchRoundId, teamAPlayer.id, fixture.organisationId, "FINALIZED");

    const filter = orgFilter(fixture.organisationId);
    const candidates = await getLeagueMatchHelperCandidates(fixture.matches.Hvit!, filter);
    const candidate = candidates.find((c) => c.playerId === teamAPlayer.id);
    expect(candidate).toBeDefined();
    expect(candidate!.currentRoundTeamName).toBe("Bla");
  });

  it("excludes a player already participating in the target match from candidates", async () => {
    const teamBPlayer = fixture.players.find((p) => p.coreTeamName === "Hvit")!;
    await selectPlayerForMatch(fixture.matches.Hvit!, fixture.matchRoundId, teamBPlayer.id, fixture.organisationId, "FINALIZED");

    const filter = orgFilter(fixture.organisationId);
    const candidates = await getLeagueMatchHelperCandidates(fixture.matches.Hvit!, filter);
    expect(candidates.some((c) => c.playerId === teamBPlayer.id)).toBe(false);
  });

  it("cross-organisation isolation: a match in another organisation is not found", async () => {
    const otherOrgFilter = orgFilter("some-other-org-id");
    const eligibility = await assertLeagueMatchHelperEligible(fixture.matches.Hvit!, fixture.players[0]!.id, otherOrgFilter);
    expect(eligibility.eligible).toBe(false);
    expect(eligibility.reason).toMatch(/not found|access denied/i);
  });

  it("marks a player with a match-specific absence as not an active participant, others unaffected (item #3)", async () => {
    const teamAPlayer = fixture.players.find((p) => p.coreTeamName === "Bla")!;
    const teamAPlayer2 = fixture.players.filter((p) => p.coreTeamName === "Bla")[1]!;
    await selectPlayerForMatch(fixture.matches.Bla!, fixture.matchRoundId, teamAPlayer.id, fixture.organisationId, "DRAFT");
    await selectPlayerForMatch(fixture.matches.Bla!, fixture.matchRoundId, teamAPlayer2.id, fixture.organisationId, "DRAFT");

    const report = await testDb.postMatchReport.create({
      data: { matchId: fixture.matches.Bla!, organisationId: fixture.organisationId, status: "DRAFT" },
    });
    await testDb.matchReportAbsence.create({
      data: {
        organisationId: fixture.organisationId,
        matchReportId: report.id,
        matchId: fixture.matches.Bla!,
        playerId: teamAPlayer.id,
        reason: "AWAY",
      },
    });

    const roster = await getEffectiveLeagueMatchRoster(fixture.matches.Bla!, orgFilter(fixture.organisationId));

    const absentEntry = roster.find((r) => r.playerId === teamAPlayer.id);
    expect(absentEntry?.isActiveParticipant).toBe(false);
    expect(absentEntry?.absenceReason).toBe("AWAY");

    const otherEntry = roster.find((r) => r.playerId === teamAPlayer2.id);
    expect(otherEntry?.isActiveParticipant).toBe(true);
    expect(otherEntry?.absenceReason).toBeNull();
  });
});
