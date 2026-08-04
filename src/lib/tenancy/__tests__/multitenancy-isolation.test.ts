import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupTestDb, teardownTestDb, createTestGroup } from "@/test/test-db";
import { organisationFilter, organisationFilterNullable, requireOrganisationId } from "@/lib/tenancy/tenant-filter";
import type { OrganisationAccessContext } from "@/lib/organisations/organisation-access";
import { OrganisationAccessError, requireRole, requireTeamAccess } from "@/lib/organisations/organisation-access";
import { canAccessAllTeams, canCreateTeam, canManageMemberships, canInviteRole, canManageRole, canDeleteOrganisation, canTransferOwnership } from "@/lib/organisations/organisation-domain";
import type { PrismaClient } from "@/generated/prisma/client";

describe("Multitenancy isolation", () => {
  let db: PrismaClient;

  beforeAll(async () => {
    db = await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  describe("organisationFilter", () => {
    it("returns correct filter for a given organisationId", () => {
      const filter = organisationFilter("org-123");
      expect(filter).toEqual({ organisationId: "org-123" });
    });

    it("can be spread into Prisma where clauses", () => {
      const where = {
        ...organisationFilter("org-456"),
        archivedAt: null,
      };
      expect(where).toEqual({
        organisationId: "org-456",
        archivedAt: null,
      });
    });
  });

  describe("organisationFilterNullable", () => {
    it("returns filter compatible with nullable organisationId fields", () => {
      const filter = organisationFilterNullable("org-789");
      expect(filter).toEqual({ organisationId: "org-789" });
    });
  });

  describe("requireOrganisationId", () => {
    const validCtx: OrganisationAccessContext = {
      userId: "user-1",
      userEmail: "coach@test.com",
      organisationId: "org-123",
      organisationSlug: "test-club",
      organisationName: "Test Club",
      role: "COACH",
      membershipId: "mem-1",
      accessibleGroupIds: [],
      groupAccesses: [],
      canAccessAllTeams: false,
      canCreateTeam: false,
      canManageMemberships: false,
      canInviteRole: () => false,
      canManageRole: () => false,
      canDeleteOrganisation: false,
      canTransferOwnership: false,
    };

    it("returns organisationId from valid context", () => {
      expect(requireOrganisationId(validCtx)).toBe("org-123");
    });
  });

  describe("Organisation role permissions", () => {
    it("OWNER can do everything", () => {
      expect(canAccessAllTeams("OWNER")).toBe(true);
      expect(canCreateTeam("OWNER")).toBe(true);
      expect(canManageMemberships("OWNER")).toBe(true);
      expect(canInviteRole("OWNER", "ADMIN")).toBe(true);
      expect(canInviteRole("OWNER", "COACH")).toBe(true);
      expect(canManageRole("OWNER", "ADMIN")).toBe(true);
      expect(canDeleteOrganisation("OWNER")).toBe(true);
      expect(canTransferOwnership("OWNER")).toBe(true);
    });

    it("ADMIN can manage teams and most memberships", () => {
      expect(canAccessAllTeams("ADMIN")).toBe(true);
      expect(canCreateTeam("ADMIN")).toBe(true);
      expect(canManageMemberships("ADMIN")).toBe(true);
      expect(canInviteRole("ADMIN", "COACH")).toBe(true);
      expect(canInviteRole("ADMIN", "VIEWER")).toBe(true);
      expect(canInviteRole("ADMIN", "ADMIN")).toBe(false);
      expect(canManageRole("ADMIN", "COACH")).toBe(true);
      expect(canManageRole("ADMIN", "ADMIN")).toBe(false);
      expect(canManageRole("ADMIN", "OWNER")).toBe(false);
      expect(canDeleteOrganisation("ADMIN")).toBe(false);
      expect(canTransferOwnership("ADMIN")).toBe(false);
    });

    it("COACH has limited permissions", () => {
      expect(canAccessAllTeams("COACH")).toBe(false);
      expect(canCreateTeam("COACH")).toBe(false);
      expect(canManageMemberships("COACH")).toBe(false);
      expect(canInviteRole("COACH", "VIEWER")).toBe(false);
      expect(canManageRole("COACH", "VIEWER")).toBe(false);
      expect(canDeleteOrganisation("COACH")).toBe(false);
      expect(canTransferOwnership("COACH")).toBe(false);
    });

    it("VIEWER has minimal permissions", () => {
      expect(canAccessAllTeams("VIEWER")).toBe(false);
      expect(canCreateTeam("VIEWER")).toBe(false);
      expect(canManageMemberships("VIEWER")).toBe(false);
      expect(canInviteRole("VIEWER", "COACH")).toBe(false);
      expect(canDeleteOrganisation("VIEWER")).toBe(false);
      expect(canTransferOwnership("VIEWER")).toBe(false);
    });
  });

  describe("requireRole", () => {
    const coachCtx: OrganisationAccessContext = {
      userId: "user-1",
      userEmail: "coach@test.com",
      organisationId: "org-1",
      organisationSlug: "test",
      organisationName: "Test",
      role: "COACH",
      membershipId: "mem-1",
      accessibleGroupIds: [],
      groupAccesses: [],
      canAccessAllTeams: false,
      canCreateTeam: false,
      canManageMemberships: false,
      canInviteRole: () => false,
      canManageRole: () => false,
      canDeleteOrganisation: false,
      canTransferOwnership: false,
    };

    it("allows access when role matches", () => {
      expect(() => requireRole(coachCtx, "COACH")).not.toThrow();
      expect(() => requireRole(coachCtx, "COACH", "ADMIN")).not.toThrow();
    });

    it("throws OrganisationAccessError when role does not match", () => {
      expect(() => requireRole(coachCtx, "OWNER")).toThrow(OrganisationAccessError);
      expect(() => requireRole(coachCtx, "ADMIN")).toThrow(OrganisationAccessError);
    });
  });

  describe("requireTeamAccess", () => {
    const coachCtx: OrganisationAccessContext = {
      userId: "user-1",
      userEmail: "coach@test.com",
      organisationId: "org-1",
      organisationSlug: "test",
      organisationName: "Test",
      role: "COACH",
      membershipId: "mem-1",
      accessibleGroupIds: ["group-a", "group-b"],
      groupAccesses: [],
      canAccessAllTeams: false,
      canCreateTeam: false,
      canManageMemberships: false,
      canInviteRole: () => false,
      canManageRole: () => false,
      canDeleteOrganisation: false,
      canTransferOwnership: false,
    };

    const adminCtx: OrganisationAccessContext = {
      ...coachCtx,
      role: "ADMIN",
      canAccessAllTeams: true,
    };

    it("ADMIN with canAccessAllTeams can access any team", () => {
      expect(() => requireTeamAccess(adminCtx, "team-c")).not.toThrow();
    });
  });

  describe("Cross-organisation data isolation", () => {
    it("teams from different organisations are isolated by organisationFilter", async () => {
      const org1 = await db.organisation.create({
        data: { name: "Club Alpha", slug: `club-alpha-${Date.now()}` },
      });
      const org2 = await db.organisation.create({
        data: { name: "Club Beta", slug: `club-beta-${Date.now()}` },
      });
      const org1Group = await createTestGroup(db, org1.id);
      const org2Group = await createTestGroup(db, org2.id);

      await db.team.create({
        data: { name: "Alpha Team 1", organisationId: org1.id, footballGroupId: org1Group },
      });
      await db.team.create({
        data: { name: "Alpha Team 2", organisationId: org1.id, footballGroupId: org1Group },
      });
      await db.team.create({
        data: { name: "Beta Team 1", organisationId: org2.id, footballGroupId: org2Group },
      });

      const org1Teams = await db.team.findMany({
        where: { ...organisationFilter(org1.id), archivedAt: null },
      });
      const org2Teams = await db.team.findMany({
        where: { ...organisationFilter(org2.id), archivedAt: null },
      });

      expect(org1Teams).toHaveLength(2);
      expect(org1Teams.every((t) => t.organisationId === org1.id)).toBe(true);
      expect(org2Teams).toHaveLength(1);
      expect(org2Teams.every((t) => t.organisationId === org2.id)).toBe(true);

      expect(org1Teams.map((t) => t.name)).toEqual(expect.arrayContaining(["Alpha Team 1", "Alpha Team 2"]));
      expect(org2Teams.map((t) => t.name)).toEqual(["Beta Team 1"]);
    });

    it("players from different organisations are isolated", async () => {
      const org1 = await db.organisation.create({
        data: { name: "Club Gamma", slug: `club-gamma-${Date.now()}` },
      });
      const org2 = await db.organisation.create({
        data: { name: "Club Delta", slug: `club-delta-${Date.now()}` },
      });
      const org1Group2 = await createTestGroup(db, org1.id);
      const org2Group2 = await createTestGroup(db, org2.id);

      const org1Team = await db.team.create({
        data: { name: "Gamma Team", organisationId: org1.id, footballGroupId: org1Group2 },
      });
      const org2Team = await db.team.create({
        data: { name: "Delta Team", organisationId: org2.id, footballGroupId: org2Group2 },
      });

      await db.player.create({
        data: {
          playerCode: Math.floor(Math.random() * 90000) + 10000,
          firstName: "Gamma",
          lastName: "Player",
          active: true,
          coreTeamId: org1Team.id,
          primaryPosition: "CM",
          preferredFoot: "RIGHT",
          secondaryFoot: "WEAK",
          bestSide: "CENTER",
          currentAvailability: "AVAILABLE",
          organisationId: org1.id,
        },
      });
      await db.player.create({
        data: {
          playerCode: Math.floor(Math.random() * 90000) + 10000,
          firstName: "Delta",
          lastName: "Player",
          active: true,
          coreTeamId: org2Team.id,
          primaryPosition: "ST",
          preferredFoot: "RIGHT",
          secondaryFoot: "WEAK",
          bestSide: "CENTER",
          currentAvailability: "AVAILABLE",
          organisationId: org2.id,
        },
      });

      const org1Players = await db.player.findMany({
        where: { ...organisationFilter(org1.id), removedAt: null },
      });
      const org2Players = await db.player.findMany({
        where: { ...organisationFilter(org2.id), removedAt: null },
      });

      expect(org1Players).toHaveLength(1);
      expect(org1Players[0].firstName).toBe("Gamma");
      expect(org2Players).toHaveLength(1);
      expect(org2Players[0].firstName).toBe("Delta");
    });

    it("matches from different organisations are isolated", async () => {
      const org1 = await db.organisation.create({
        data: { name: "Club Epsilon", slug: `club-epsilon-${Date.now()}` },
      });
      const org2 = await db.organisation.create({
        data: { name: "Club Zeta", slug: `club-zeta-${Date.now()}` },
      });
      const org1Group3 = await createTestGroup(db, org1.id);
      const org2Group3 = await createTestGroup(db, org2.id);

      const org1Season = await db.season.create({
        data: { name: "Epsilon 2026", year: 2026, organisationId: org1.id },
      });
      const org1League = await db.leagueSeason.create({
        data: {
          name: "Epsilon Spring",
          part: "SPRING",
          seasonId: org1Season.id,
          startDate: new Date("2026-04-01"),
          endDate: new Date("2026-06-30"),
          organisationId: org1.id,
          footballGroupId: org1Group3,
        },
      });
      const org1Round = await db.matchRound.create({
        data: {
          name: "W1 Epsilon",
          leagueSeasonId: org1League.id,
          status: "DRAFT",
          organisationId: org1.id,
        },
      });
      const org1Team = await db.team.create({
        data: { name: "Epsilon Team", organisationId: org1.id, footballGroupId: org1Group3 },
      });

      const org2Season = await db.season.create({
        data: { name: "Zeta 2026", year: 2026, organisationId: org2.id },
      });
      const _org2League = await db.leagueSeason.create({
        data: {
          name: "Zeta Spring",
          part: "SPRING",
          seasonId: org2Season.id,
          startDate: new Date("2026-04-01"),
          endDate: new Date("2026-06-30"),
          organisationId: org2.id,
          footballGroupId: org2Group3,
        },
      });

      await db.match.create({
        data: {
          matchRoundId: org1Round.id,
          teamId: org1Team.id,
          opponent: "Opponent Epsilon",
          startsAt: new Date("2026-04-05T10:00:00Z"),
          homeAway: "HOME",
          squadSize: 11,
          matchType: "FRIENDLY",
          gameFormat: "ELEVEN_A_SIDE",
          organisationId: org1.id,
        },
      });

      const org1Matches = await db.match.findMany({
        where: organisationFilter(org1.id),
      });
      const org2Matches = await db.match.findMany({
        where: organisationFilter(org2.id),
      });

      expect(org1Matches).toHaveLength(1);
      expect(org1Matches[0].opponent).toBe("Opponent Epsilon");
      expect(org2Matches).toHaveLength(0);
    });

    it("organisationFilter can be combined with other filters", async () => {
      const org = await db.organisation.create({
        data: { name: "Club Eta", slug: `club-eta-${Date.now()}` },
      });
      const orgGroup4 = await createTestGroup(db, org.id);

      await db.team.create({ data: { name: "Active Team", organisationId: org.id, footballGroupId: orgGroup4 } });
      await db.team.create({ data: { name: "Archived Team", organisationId: org.id, archivedAt: new Date(), footballGroupId: orgGroup4 } });

      const activeOrgTeams = await db.team.findMany({
        where: { ...organisationFilter(org.id), archivedAt: null },
      });

      expect(activeOrgTeams).toHaveLength(1);
      expect(activeOrgTeams[0].name).toBe("Active Team");
    });
  });

  describe("Organisation invitation flow", () => {
    it("creates and accepts an invitation within an organisation", async () => {
      const org = await db.organisation.create({
        data: { name: "Invite Club", slug: `invite-club-${Date.now()}` },
      });

      const owner = await db.user.create({
        data: { email: `owner-invite-${Date.now()}@test.com`, name: "Owner" },
      });
      const invitee = await db.user.create({
        data: { email: `invitee-${Date.now()}@test.com`, name: "Invitee" },
      });

      await db.organisationMembership.create({
        data: { userId: owner.id, organisationId: org.id, role: "OWNER" },
      });

      const invitation = await db.organisationInvitation.create({
        data: {
          organisationId: org.id,
          invitedEmail: invitee.email!,
          intendedRole: "COACH",
          invitedByUserId: owner.id,
          token: `token-${Date.now()}`,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      expect(invitation.organisationId).toBe(org.id);
      expect(invitation.intendedRole).toBe("COACH");
      expect(invitation.status).toBe("PENDING");

      await db.organisationMembership.create({
        data: { userId: invitee.id, organisationId: org.id, role: "COACH" },
      });
      await db.organisationInvitation.update({
        where: { id: invitation.id },
        data: { status: "ACCEPTED", acceptedAt: new Date() },
      });

      const membership = await db.organisationMembership.findUnique({
        where: { userId_organisationId: { userId: invitee.id, organisationId: org.id } },
      });
      expect(membership).not.toBeNull();
      expect(membership!.role).toBe("COACH");
    });
  });
});