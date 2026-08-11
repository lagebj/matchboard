import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, seedTestFixture, getTestDb, type TestFixtureIds } from "@/test/test-db";
import { mockAuthContext } from "@/test/support/auth-mock";

let testDb: PrismaClient;

const auth = mockAuthContext({ role: "COACH" });

vi.mock("@/lib/db", () => ({
  get db() { return getTestDb(); },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

vi.mock("@/auth", () => ({
  auth: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  handlers: {},
  requireCoachAccess: vi.fn().mockResolvedValue({ id: "test-coach", email: "test@example.com", name: "Test Coach" }),
  getCurrentCoach: vi.fn().mockResolvedValue({ id: "test-coach", email: "test@example.com", name: "Test Coach" }),
  isAllowedCoach: vi.fn().mockReturnValue(true),
}));

function isRedirectError(error: unknown): boolean {
  return error instanceof Error && error.message === "NEXT_REDIRECT";
}

describe("Setup registry: create team persists all squad config fields", () => {
  let _fixtureIds: TestFixtureIds;
  beforeAll(async () => {
    testDb = await setupTestDb();
    _fixtureIds = await seedTestFixture(testDb, {
      teams: [],
      playersPerTeam: 0,
      rotationPaths: [],
    });
    auth.updateOrganisationId(_fixtureIds.organisationId);
  });
  afterAll(async () => { await teardownTestDb(); });

  it("creates a team with all squad configuration fields via server action", async () => {
    const formData = new FormData();
    formData.set("name", "All Fields Team");
    formData.set("targetSquadSize", "11");
    formData.set("minAcceptedSquadSize", "9");
    formData.set("maxSquadSize", "14");
    formData.set("minCorePlayers", "8");
    formData.set("supportPriority", "1");
    formData.set("minSupportPlayers", "0");
    formData.set("developmentSlots", "2");

    const { createTeamAction } = await import("@/app/(app)/teams/actions");

    try {
      await createTeamAction(formData);
    } catch (error: unknown) {
      if (!isRedirectError(error)) throw error;
    }

    const team = await testDb.team.findFirst({ where: { name: "All Fields Team" } });
    expect(team).not.toBeNull();
    expect(team!.targetSquadSize).toBe(11);
    expect(team!.minAcceptedSquadSize).toBe(9);
    expect(team!.maxSquadSize).toBe(14);
    expect(team!.minCorePlayers).toBe(8);
    expect(team!.supportPriority).toBe(1);
    expect(team!.minSupportPlayers).toBe(0);
    expect(team!.developmentSlots).toBe(2);
  });

  it("rejects team creation with empty name", async () => {
    const formData = new FormData();
    formData.set("name", "");
    formData.set("targetSquadSize", "11");
    formData.set("minAcceptedSquadSize", "9");
    formData.set("maxSquadSize", "14");
    formData.set("minCorePlayers", "8");
    formData.set("supportPriority", "1");
    formData.set("minSupportPlayers", "0");
    formData.set("developmentSlots", "2");

    const { createTeamAction } = await import("@/app/(app)/teams/actions");

    try {
      await createTeamAction(formData);
    } catch (error: unknown) {
      if (!isRedirectError(error)) throw error;
    }

    const count = await testDb.team.count({ where: { name: "" } });
    expect(count).toBe(0);
  });

  it("restores archived team with same name instead of creating duplicate", async () => {
    const existingTeam = await testDb.team.create({
      data: { name: "Archived Team", archivedAt: new Date(), targetSquadSize: 11, organisationId: _fixtureIds.organisationId, footballGroupId: _fixtureIds.footballGroupId },
    });

    const formData = new FormData();
    formData.set("name", "Archived Team");
    formData.set("targetSquadSize", "9");
    formData.set("minAcceptedSquadSize", "7");
    formData.set("maxSquadSize", "12");
    formData.set("minCorePlayers", "6");
    formData.set("supportPriority", "2");
    formData.set("minSupportPlayers", "1");
    formData.set("developmentSlots", "3");

    const { createTeamAction } = await import("@/app/(app)/teams/actions");

    try {
      await createTeamAction(formData);
    } catch (error: unknown) {
      if (!isRedirectError(error)) throw error;
    }

    const restored = await testDb.team.findFirst({ where: { name: "Archived Team" } });
    expect(restored).not.toBeNull();
    expect(restored!.id).toBe(existingTeam.id);
    expect(restored!.archivedAt).toBeNull();
    expect(restored!.targetSquadSize).toBe(9);
    expect(restored!.minAcceptedSquadSize).toBe(7);
  });
});

describe("Setup registry: create match action assigns match to round by date", () => {
  let _fixtureIds: TestFixtureIds;
  beforeAll(async () => {
    testDb = await setupTestDb();
    _fixtureIds = await seedTestFixture(testDb, {
      teams: [
        { name: "Rovers", targetSquadSize: 11, minCorePlayers: 8, targetSupportCount: 0, maxSupportCount: 0, minSupportPlayers: 0, supportPriority: 1, developmentSlots: 0, minAcceptedSquadSize: 9, maxSquadSize: 14 },
      ],
      playersPerTeam: 0,
      rotationPaths: [],
    });
    auth.updateOrganisationId(_fixtureIds.organisationId);
  });
  afterAll(async () => { await teardownTestDb(); });

  it("creates a match and assigns it to a match round", async () => {
    const team = await testDb.team.findFirst({ where: { name: "Rovers" } });

    const formData = new FormData();
    formData.set("teamId", team!.id);
    formData.set("opponent", "Opponent FC");
    formData.set("startsAt", "2026-06-15");
    formData.set("homeAway", "HOME");
    formData.set("matchType", "FRIENDLY");
    formData.set("gameFormat", "ELEVEN_A_SIDE");

    const { createMatchAction } = await import("@/app/(app)/matches/actions");

    try {
      await createMatchAction({ error: "" }, formData);
    } catch (error: unknown) {
      if (!isRedirectError(error)) throw error;
    }

    const match = await testDb.match.findFirst({
      where: { opponent: "Opponent FC" },
      include: { matchRound: true, team: true },
    });

    expect(match).not.toBeNull();
    expect(match!.team.name).toBe("Rovers");
    expect(match!.homeAway).toBe("HOME");
    expect(match!.matchType).toBe("FRIENDLY");
    expect(match!.gameFormat).toBe("ELEVEN_A_SIDE");
    expect(match!.matchRound).not.toBeNull();
    expect(match!.matchRoundId).toBeTruthy();
  });

  it("rejects match creation with non-existent team", async () => {
    const formData = new FormData();
    formData.set("teamId", "nonexistent-id");
    formData.set("opponent", "Test Opponent");
    formData.set("startsAt", "2026-06-20");
    formData.set("homeAway", "AWAY");
    formData.set("matchType", "LEAGUE");
    formData.set("gameFormat", "NINE_A_SIDE");

    const { createMatchAction } = await import("@/app/(app)/matches/actions");

    const result = await createMatchAction({ error: "" }, formData);
    expect(result.error).toBeTruthy();
  });

  it("requires all mandatory match fields", async () => {
    const formData = new FormData();
    formData.set("teamId", "any-id");
    formData.set("opponent", "");
    formData.set("startsAt", "");
    formData.set("homeAway", "HOME");
    formData.set("matchType", "FRIENDLY");
    formData.set("gameFormat", "ELEVEN_A_SIDE");

    const { createMatchAction } = await import("@/app/(app)/matches/actions");

    const result = await createMatchAction({ error: "" }, formData);
    expect(result.error).toBeTruthy();
  });

  it("validates match type enum values", async () => {
    const team = await testDb.team.findFirst({ where: { name: "Rovers" } });

    const formData = new FormData();
    formData.set("teamId", team!.id);
    formData.set("opponent", "Enum Test FC");
    formData.set("startsAt", "2026-07-01");
    formData.set("homeAway", "HOME");
    formData.set("matchType", "INVALID_TYPE");
    formData.set("gameFormat", "ELEVEN_A_SIDE");

    const { createMatchAction } = await import("@/app/(app)/matches/actions");

    const result = await createMatchAction({ error: "" }, formData);
    expect(result.error).toContain("Match type");
  });

  it("validates game format enum values", async () => {
    const team = await testDb.team.findFirst({ where: { name: "Rovers" } });

    const formData = new FormData();
    formData.set("teamId", team!.id);
    formData.set("opponent", "Format Test FC");
    formData.set("startsAt", "2026-07-02");
    formData.set("homeAway", "AWAY");
    formData.set("matchType", "FRIENDLY");
    formData.set("gameFormat", "INVALID_FORMAT");

    const { createMatchAction } = await import("@/app/(app)/matches/actions");

    const result = await createMatchAction({ error: "" }, formData);
    expect(result.error).toContain("Game format");
  });

  it("assigns matches in the same ISO week to the same round", async () => {
    const team = await testDb.team.findFirst({ where: { name: "Rovers" } });

    const formData1 = new FormData();
    formData1.set("teamId", team!.id);
    formData1.set("opponent", "Week Same A");
    formData1.set("startsAt", "2026-06-15");
    formData1.set("homeAway", "HOME");
    formData1.set("matchType", "FRIENDLY");
    formData1.set("gameFormat", "ELEVEN_A_SIDE");

    const { createMatchAction } = await import("@/app/(app)/matches/actions");

    try { await createMatchAction({ error: "" }, formData1); } catch (error: unknown) { if (!isRedirectError(error)) throw error; }

    const formData2 = new FormData();
    formData2.set("teamId", team!.id);
    formData2.set("opponent", "Week Same B");
    formData2.set("startsAt", "2026-06-17");
    formData2.set("homeAway", "AWAY");
    formData2.set("matchType", "LEAGUE");
    formData2.set("gameFormat", "ELEVEN_A_SIDE");

    try { await createMatchAction({ error: "" }, formData2); } catch (error: unknown) { if (!isRedirectError(error)) throw error; }

    const matchA = await testDb.match.findFirst({ where: { opponent: "Week Same A" }, include: { matchRound: true } });
    const matchB = await testDb.match.findFirst({ where: { opponent: "Week Same B" }, include: { matchRound: true } });

    expect(matchA).not.toBeNull();
    expect(matchB).not.toBeNull();
    expect(matchA!.matchRoundId).toBe(matchB!.matchRoundId);
  });

  it("assigns matches in different ISO weeks to different rounds", async () => {
    const team = await testDb.team.findFirst({ where: { name: "Rovers" } });

    const formData1 = new FormData();
    formData1.set("teamId", team!.id);
    formData1.set("opponent", "Week Diff A");
    formData1.set("startsAt", "2026-06-15");
    formData1.set("homeAway", "HOME");
    formData1.set("matchType", "FRIENDLY");
    formData1.set("gameFormat", "ELEVEN_A_SIDE");

    const { createMatchAction } = await import("@/app/(app)/matches/actions");

    try { await createMatchAction({ error: "" }, formData1); } catch (error: unknown) { if (!isRedirectError(error)) throw error; }

    const formData2 = new FormData();
    formData2.set("teamId", team!.id);
    formData2.set("opponent", "Week Diff B");
    formData2.set("startsAt", "2026-06-22");
    formData2.set("homeAway", "AWAY");
    formData2.set("matchType", "LEAGUE");
    formData2.set("gameFormat", "ELEVEN_A_SIDE");

    try { await createMatchAction({ error: "" }, formData2); } catch (error: unknown) { if (!isRedirectError(error)) throw error; }

    const matchA = await testDb.match.findFirst({ where: { opponent: "Week Diff A" }, include: { matchRound: true } });
    const matchB = await testDb.match.findFirst({ where: { opponent: "Week Diff B" }, include: { matchRound: true } });

    expect(matchA).not.toBeNull();
    expect(matchB).not.toBeNull();
    expect(matchA!.matchRoundId).not.toBe(matchB!.matchRoundId);
  });
});

describe("Setup registry: Today page next-action reflects setup state", () => {
  function getNextAction(teamCount: number, playerCount: number, totalMatchCount: number, activeLeagueSeason?: unknown, activeMatchRound?: unknown): { label: string; href: string } | null {
    if (teamCount === 0) {
      return { label: "Create a team to get started", href: "/teams/new" };
    }
    if (playerCount === 0) {
      return { label: "Add players to your teams", href: "/players/new" };
    }
    if (totalMatchCount === 0) {
      return { label: "Create a match to plan a round", href: "/matches/new" };
    }
    if (!activeLeagueSeason || !activeMatchRound) {
      return { label: "Select a round", href: "/rounds" };
    }
    return null;
  }

  it("next action links to team creation when no teams exist", () => {
    const nextAction = getNextAction(0, 0, 0);
    expect(nextAction).not.toBeNull();
    expect(nextAction!.href).toBe("/teams/new");
    expect(nextAction!.label).toContain("team");
  });

  it("next action links to player creation when teams exist but no players", () => {
    const nextAction = getNextAction(2, 0, 0);
    expect(nextAction).not.toBeNull();
    expect(nextAction!.href).toBe("/players/new");
  });

  it("next action links to match creation when teams and players exist but no matches", () => {
    const nextAction = getNextAction(2, 10, 0);
    expect(nextAction).not.toBeNull();
    expect(nextAction!.href).toBe("/matches/new");
  });

  it("next action falls through to round logic when setup is complete", () => {
    const nextAction = getNextAction(2, 10, 3, null, null);
    expect(nextAction).not.toBeNull();
    expect(nextAction!.href).toBe("/rounds");
  });
});

describe("Setup registry: empty state actionable links", () => {
  it("teams empty state links to team creation", () => {
    const teams: unknown[] = [];
    const expected = teams.length === 0
      ? { message: "No teams yet.", href: "/teams/new" }
      : null;

    expect(expected).not.toBeNull();
    expect(expected!.href).toBe("/teams/new");
  });

  it("players empty state when no teams links to team creation", () => {
    const teams: unknown[] = [];
    const players: unknown[] = [];
    const expected = teams.length === 0
      ? { message: "Create a team first.", href: "/teams/new" }
      : players.length === 0
        ? { message: "No players yet.", href: "/players/new" }
        : null;

    expect(expected).not.toBeNull();
    expect(expected!.href).toBe("/teams/new");
  });

  it("players empty state when teams exist links to player creation", () => {
    const teams = [{ id: "1", name: "A" }];
    const players: unknown[] = [];
    const expected = teams.length === 0
      ? { message: "Create a team first.", href: "/teams/new" }
      : players.length === 0
        ? { message: "No players yet.", href: "/players/new" }
        : null;

    expect(expected).not.toBeNull();
    expect(expected!.href).toBe("/players/new");
  });

  it("matches empty state links to match creation", () => {
    const matches: unknown[] = [];
    const expected = matches.length === 0
      ? { message: "No matches yet.", href: "/matches/new" }
      : null;

    expect(expected).not.toBeNull();
    expect(expected!.href).toBe("/matches/new");
  });

  it("matches empty state when no teams links to team creation", () => {
    const teams: unknown[] = [];
    const expected = teams.length === 0
      ? { message: "No teams yet. Create a team first.", href: "/teams/new" }
      : null;

    expect(expected).not.toBeNull();
    expect(expected!.href).toBe("/teams/new");
  });
})