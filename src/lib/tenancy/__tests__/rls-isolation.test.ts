import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, cleanTestDb, createTestGroup, type TestFixtureIds } from "@/test/test-db";
import { AuthorizationError } from "@/lib/auth";

describe("RLS tenant isolation", () => {
  let db: PrismaClient;
  let _fixture: TestFixtureIds;

  beforeAll(async () => {
    db = await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await cleanTestDb(db);
  });

  describe("application-level tenant filtering", () => {
    it("scopes team queries to the correct organisation", async () => {
      const org1 = await db.organisation.create({
        data: { name: "Org One", slug: "org-one-rls" },
      });
      const org1Group = await createTestGroup(db, org1.id);
      const org2 = await db.organisation.create({
        data: { name: "Org Two", slug: "org-two-rls" },
      });
      const org2Group = await createTestGroup(db, org2.id);

      const team1 = await db.team.create({
        data: { name: "Team Alpha", organisationId: org1.id, footballGroupId: org1Group, targetSquadSize: 11, minCorePlayers: 8, targetSupportCount: 0, maxSupportCount: 5, minSupportPlayers: 0, supportPriority: 1, developmentSlots: 3, minAcceptedSquadSize: 9, maxSquadSize: 14 },
      });
      const team2 = await db.team.create({
        data: { name: "Team Beta", organisationId: org2.id, footballGroupId: org2Group, targetSquadSize: 11, minCorePlayers: 8, targetSupportCount: 0, maxSupportCount: 5, minSupportPlayers: 0, supportPriority: 1, developmentSlots: 3, minAcceptedSquadSize: 9, maxSquadSize: 14 },
      });

      const org1Teams = await db.team.findMany({ where: { organisationId: org1.id } });
      const org2Teams = await db.team.findMany({ where: { organisationId: org2.id } });

      expect(org1Teams).toHaveLength(1);
      expect(org1Teams[0].id).toBe(team1.id);
      expect(org2Teams).toHaveLength(1);
      expect(org2Teams[0].id).toBe(team2.id);
    });

    it("scopes player queries to the correct organisation", async () => {
      const org1 = await db.organisation.create({
        data: { name: "Org One Players", slug: "org-one-players" },
      });
      const org1Group = await createTestGroup(db, org1.id);
      const org2 = await db.organisation.create({
        data: { name: "Org Two Players", slug: "org-two-players" },
      });
      const org2Group = await createTestGroup(db, org2.id);

      const team1 = await db.team.create({
        data: { name: "Team A", organisationId: org1.id, footballGroupId: org1Group, targetSquadSize: 11, minCorePlayers: 8, targetSupportCount: 0, maxSupportCount: 5, minSupportPlayers: 0, supportPriority: 1, developmentSlots: 3, minAcceptedSquadSize: 9, maxSquadSize: 14 },
      });
      const team2 = await db.team.create({
        data: { name: "Team B", organisationId: org2.id, footballGroupId: org2Group, targetSquadSize: 11, minCorePlayers: 8, targetSupportCount: 0, maxSupportCount: 5, minSupportPlayers: 0, supportPriority: 1, developmentSlots: 3, minAcceptedSquadSize: 9, maxSquadSize: 14 },
      });

      const player1 = await db.player.create({
        data: { playerCode: 2001, firstName: "Alice", coreTeamId: team1.id, primaryPosition: "CB", preferredFoot: "RIGHT", secondaryFoot: "WEAK", bestSide: "CENTER", organisationId: org1.id },
      });
      const player2 = await db.player.create({
        data: { playerCode: 2002, firstName: "Bob", coreTeamId: team2.id, primaryPosition: "CM", preferredFoot: "RIGHT", secondaryFoot: "WEAK", bestSide: "CENTER", organisationId: org2.id },
      });

      const org1Players = await db.player.findMany({ where: { organisationId: org1.id } });
      const org2Players = await db.player.findMany({ where: { organisationId: org2.id } });

      expect(org1Players).toHaveLength(1);
      expect(org1Players[0].id).toBe(player1.id);
      expect(org2Players).toHaveLength(1);
      expect(org2Players[0].id).toBe(player2.id);
    });

    it("prevents cross-organisation team reads via application filter", async () => {
      const org1 = await db.organisation.create({
        data: { name: "Org Isolated", slug: "org-isolated" },
      });
      const _org1Group = await createTestGroup(db, org1.id);
      const org2 = await db.organisation.create({
        data: { name: "Org Other", slug: "org-other-isolated" },
      });
      const org2Group = await createTestGroup(db, org2.id);

      await db.team.create({
        data: { name: "Secret Team", organisationId: org2.id, footballGroupId: org2Group, targetSquadSize: 11, minCorePlayers: 8, targetSupportCount: 0, maxSupportCount: 5, minSupportPlayers: 0, supportPriority: 1, developmentSlots: 3, minAcceptedSquadSize: 9, maxSquadSize: 14 },
      });

      const org1Teams = await db.team.findMany({ where: { organisationId: org1.id } });
      expect(org1Teams).toHaveLength(0);
    });

    it("scopes match queries to the correct organisation", async () => {
      const org1 = await db.organisation.create({
        data: { name: "Match Org 1", slug: "match-org-1" },
      });
      const org1Group = await createTestGroup(db, org1.id);
      const org2 = await db.organisation.create({
        data: { name: "Match Org 2", slug: "match-org-2" },
      });
      const org2Group = await createTestGroup(db, org2.id);

      const team1 = await db.team.create({
        data: { name: "Match Team 1", organisationId: org1.id, footballGroupId: org1Group, targetSquadSize: 11, minCorePlayers: 8, targetSupportCount: 0, maxSupportCount: 5, minSupportPlayers: 0, supportPriority: 1, developmentSlots: 3, minAcceptedSquadSize: 9, maxSquadSize: 14 },
      });
      const _team2 = await db.team.create({
        data: { name: "Match Team 2", organisationId: org2.id, footballGroupId: org2Group, targetSquadSize: 11, minCorePlayers: 8, targetSupportCount: 0, maxSupportCount: 5, minSupportPlayers: 0, supportPriority: 1, developmentSlots: 3, minAcceptedSquadSize: 9, maxSquadSize: 14 },
      });

      const season1 = await db.season.create({
        data: { name: "Season 1", year: 2026, organisationId: org1.id },
      });
      const period1 = await db.leagueSeason.create({
        data: { name: "Period 1", part: "SPRING", seasonId: season1.id, startDate: new Date("2026-04-01"), endDate: new Date("2026-06-30"), organisationId: org1.id, footballGroupId: org1Group },
      });
      const round1 = await db.matchRound.create({
        data: { name: "R1", leagueSeasonId: period1.id, status: "DRAFT", organisationId: org1.id },
      });
      const opponent1 = await db.opponentTeam.create({
        data: { displayName: "Opp 1", normalizedName: "opp-1", organisationId: org1.id },
      });
      const match1 = await db.match.create({
        data: { matchRoundId: round1.id, teamId: team1.id, opponent: "Opp 1", opponentTeamId: opponent1.id, startsAt: new Date(), homeAway: "HOME", squadSize: 11, matchType: "FRIENDLY", gameFormat: "ELEVEN_A_SIDE", organisationId: org1.id },
      });

      const org1Matches = await db.match.findMany({ where: { organisationId: org1.id } });
      const org2Matches = await db.match.findMany({ where: { organisationId: org2.id } });

      expect(org1Matches).toHaveLength(1);
      expect(org1Matches[0].id).toBe(match1.id);
      expect(org2Matches).toHaveLength(0);
    });

    it("organisation membership is scoped to organisation", async () => {
      const org = await db.organisation.create({
        data: { name: "Membership Org", slug: "membership-org-rls" },
      });
      const _orgGroup = await createTestGroup(db, org.id);
      const user = await db.user.create({
        data: { email: "member-rls@example.com", name: "Test Member" },
      });

      const membership = await db.organisationMembership.create({
        data: { userId: user.id, organisationId: org.id, role: "COACH" },
      });

      const found = await db.organisationMembership.findMany({
        where: { organisationId: org.id },
      });
      expect(found).toHaveLength(1);
      expect(found[0].id).toBe(membership.id);
    });

    it("cross-organisation player reads return empty via application filter", async () => {
      const org1 = await db.organisation.create({
        data: { name: "Cross Org 1", slug: "cross-org-1" },
      });
      const _org1Group = await createTestGroup(db, org1.id);
      const org2 = await db.organisation.create({
        data: { name: "Cross Org 2", slug: "cross-org-2" },
      });
      const org2Group = await createTestGroup(db, org2.id);
      const team2 = await db.team.create({
        data: { name: "Cross Team 2", organisationId: org2.id, footballGroupId: org2Group, targetSquadSize: 11, minCorePlayers: 8, targetSupportCount: 0, maxSupportCount: 5, minSupportPlayers: 0, supportPriority: 1, developmentSlots: 3, minAcceptedSquadSize: 9, maxSquadSize: 14 },
      });

      await db.player.create({
        data: { playerCode: 3001, firstName: "Secret", coreTeamId: team2.id, primaryPosition: "GK", preferredFoot: "RIGHT", secondaryFoot: "WEAK", bestSide: "CENTER", organisationId: org2.id },
      });

      const org1Players = await db.player.findMany({ where: { organisationId: org1.id } });
      expect(org1Players).toHaveLength(0);
    });
  });

  describe("tenant context helpers", () => {
    it("validates organisationId format", async () => {
      const { isValidOrganisationId } = await import("../tenant-client");
      expect(isValidOrganisationId("")).toBe(false);
      expect(isValidOrganisationId("a".repeat(65))).toBe(false);
      expect(isValidOrganisationId("valid-id")).toBe(true);
      expect(isValidOrganisationId("org123")).toBe(true);
      expect(isValidOrganisationId("abc_def")).toBe(true);
      expect(isValidOrganisationId("id with spaces")).toBe(false);
      expect(isValidOrganisationId("id'; DROP TABLE--")).toBe(false);
    });

    it("withTenantContext sets and uses tenant context in a transaction", async () => {
      const { withTenantContext } = await import("../tenant-client");
      const org = await db.organisation.create({
        data: { name: "Tenant Context Org", slug: "tenant-context-org" },
      });
      const orgGroup = await createTestGroup(db, org.id);
      const team = await db.team.create({
        data: { name: "Context Team", organisationId: org.id, footballGroupId: orgGroup, targetSquadSize: 11, minCorePlayers: 8, targetSupportCount: 0, maxSupportCount: 5, minSupportPlayers: 0, supportPriority: 1, developmentSlots: 3, minAcceptedSquadSize: 9, maxSquadSize: 14 },
      });

      const teams = await withTenantContext(db, org.id, async (tx) => {
        return tx.team.findMany({ where: { organisationId: org.id } });
      });

      expect(teams).toHaveLength(1);
      expect(teams[0].id).toBe(team.id);
    });

    it("withTenantContext rejects invalid organisationId", async () => {
      const { withTenantContext } = await import("../tenant-client");
      await expect(
        withTenantContext(db, "", async (tx) => tx.team.findMany())
      ).rejects.toThrow("Invalid organisationId");

      await expect(
        withTenantContext(db, "a".repeat(65), async (tx) => tx.team.findMany())
      ).rejects.toThrow("Invalid organisationId");
    });
  });

  describe("resolveOrgFilterForUser integration", () => {
    it("throws AuthorizationError when user has no organisation membership", async () => {
      const { resolveOrgFilterForUser } = await import("../resolve-org-filter");
      const user = await db.user.create({
        data: { email: "no-org-rls@example.com", name: "No Org User" },
      });

      await expect(resolveOrgFilterForUser(user.id, db)).rejects.toThrow(AuthorizationError);
    });

    it("returns org-scoped filter when user has organisation membership", async () => {
      const { resolveOrgFilterForUser } = await import("../resolve-org-filter");
      const org = await db.organisation.create({
        data: { name: "Scoped Org", slug: "scoped-org-rls" },
      });
      const _orgGroup = await createTestGroup(db, org.id);
      const user = await db.user.create({
        data: { email: "scoped-rls@example.com", name: "Scoped User" },
      });
      await db.organisationMembership.create({
        data: { userId: user.id, organisationId: org.id, role: "COACH" },
      });

      const result = await resolveOrgFilterForUser(user.id, db);

      expect(result.type).toBe("org");
      if (result.type === "org") {
        expect(result.organisationId).toBe(org.id);
        expect(result.filter).toEqual({ organisationId: org.id });
        expect(result.filterNullable).toEqual({ organisationId: org.id });
      }
    });
  });
});