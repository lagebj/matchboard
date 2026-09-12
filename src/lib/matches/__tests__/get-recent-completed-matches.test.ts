import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, seedTestFixture, getTestDb, type TestFixtureIds } from "@/test/test-db";
import { getRecentCompletedMatches } from "../get-recent-completed-matches";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";

let db: PrismaClient;
let fixture: TestFixtureIds;
let orgFilter: OrgFilterMode;

vi.mock("@/lib/db", () => ({
  get db() {
    return getTestDb();
  },
}));

const orgUrl = (path: string) => `/o/test-org${path}`;

describe("getRecentCompletedMatches", () => {
  beforeAll(async () => {
    db = await setupTestDb();
    fixture = await seedTestFixture(db);
    orgFilter = {
      type: "org",
      filter: { organisationId: fixture.organisationId },
      filterNullable: { organisationId: fixture.organisationId },
      organisationId: fixture.organisationId,
    };
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it("returns nothing when no match has a completed report", async () => {
    const rows = await getRecentCompletedMatches(orgFilter, orgUrl);
    expect(rows).toEqual([]);
  });

  it("includes only REPORTED/LOCKED reports, not DRAFT ones", async () => {
    const teamNames = Object.keys(fixture.matches);
    const [teamA, teamB] = teamNames;
    const matchAId = fixture.matches[teamA];
    const matchBId = fixture.matches[teamB];

    await db.postMatchReport.create({
      data: { matchId: matchAId, organisationId: fixture.organisationId, status: "LOCKED", homeGoals: 3, awayGoals: 1 },
    });
    await db.postMatchReport.create({
      data: { matchId: matchBId, organisationId: fixture.organisationId, status: "DRAFT", homeGoals: 0, awayGoals: 0 },
    });

    try {
      const rows = await getRecentCompletedMatches(orgFilter, orgUrl);
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe(matchAId);
      expect(rows[0].href).toBe(`/o/test-org/matches/${matchAId}`);
    } finally {
      await db.postMatchReport.deleteMany({ where: { matchId: { in: [matchAId, matchBId] } } });
    }
  });

  it("computes own-team goals/outcome from the HOME perspective and marks it done", async () => {
    const teamName = Object.keys(fixture.matches)[0];
    const matchId = fixture.matches[teamName];
    // Fixture matches are always homeAway: "HOME".
    await db.postMatchReport.create({
      data: { matchId, organisationId: fixture.organisationId, status: "LOCKED", homeGoals: 4, awayGoals: 2 },
    });

    try {
      const rows = await getRecentCompletedMatches(orgFilter, orgUrl);
      const row = rows.find((r) => r.id === matchId);
      expect(row).toBeDefined();
      expect(row!.lifecycle).toBe("done");
      expect(row!.resultOutcomeForOwnTeam).toBe("win");
    } finally {
      await db.postMatchReport.deleteMany({ where: { matchId } });
    }
  });

  it("respects the limit and orders most-recently-kicked-off first", async () => {
    const teamNames = Object.keys(fixture.matches);
    for (const [i, teamName] of teamNames.entries()) {
      await db.postMatchReport.create({
        data: { matchId: fixture.matches[teamName], organisationId: fixture.organisationId, status: "LOCKED", homeGoals: i, awayGoals: 0 },
      });
    }

    try {
      const rows = await getRecentCompletedMatches(orgFilter, orgUrl, 2);
      expect(rows).toHaveLength(2);
    } finally {
      await db.postMatchReport.deleteMany({ where: { matchId: { in: Object.values(fixture.matches) } } });
    }
  });

  it("never returns another organisation's completed matches", async () => {
    const otherOrg = await db.organisation.create({ data: { name: "Other Org", slug: `other-org-${Date.now()}` } });
    const otherGroup = await db.footballGroup.create({
      data: { name: "Other Group", slug: `other-group-${Date.now()}`, type: "AGE_GROUP", organisationId: otherOrg.id },
    });
    const otherTeam = await db.team.create({
      data: { name: "Other Team", footballGroupId: otherGroup.id, organisationId: otherOrg.id },
    });
    const otherSeason = await db.season.create({ data: { name: "Other Season", year: 2026, organisationId: otherOrg.id } });
    const otherLeagueSeason = await db.leagueSeason.create({
      data: {
        name: "Other Period",
        part: "SPRING",
        seasonId: otherSeason.id,
        startDate: new Date("2025-01-06"),
        endDate: new Date("2025-06-30"),
        organisationId: otherOrg.id,
        footballGroupId: otherGroup.id,
      },
    });
    const otherRound = await db.matchRound.create({
      data: { name: "Other round", leagueSeasonId: otherLeagueSeason.id, status: "DRAFT", organisationId: otherOrg.id },
    });
    const otherMatch = await db.match.create({
      data: {
        matchRoundId: otherRound.id,
        teamId: otherTeam.id,
        opponent: "Other Opponent",
        startsAt: new Date("2025-04-28T10:00:00Z"),
        homeAway: "HOME",
        organisationId: otherOrg.id,
      },
    });
    await db.postMatchReport.create({
      data: { matchId: otherMatch.id, organisationId: otherOrg.id, status: "LOCKED", homeGoals: 5, awayGoals: 0 },
    });

    const rows = await getRecentCompletedMatches(orgFilter, orgUrl);
    expect(rows.some((r) => r.id === otherMatch.id)).toBe(false);
  });
});
