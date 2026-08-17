import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { PrismaClient } from "@/generated/prisma/client";
import { createOrganisation, generateOrganisationSlug } from "@/lib/organisations/organisation-domain";
import { createInvitation, acceptInvitation } from "@/lib/organisations/organisation-invitation";
import { suspendOrganisation, reactivateOrganisation, deleteOrganisation, isOrganisationSuspended } from "@/lib/organisations/organisation-lifecycle";
import { resolveOrgFilterForUser, resolveOrgFilterForMachine } from "@/lib/tenancy/resolve-org-filter";
import { organisationFilter } from "@/lib/tenancy/tenant-filter";
import { createMachinePrincipal } from "@/lib/machine-principal/machine-principal";
import { setupTestDb, teardownTestDb, cleanTestDb, createTestGroup } from "@/test/test-db";
import { mockAuthContext } from "@/test/support/auth-mock";

mockAuthContext();

describe("MT-7: First-tenant and synthetic-tenant validation", () => {
  let db: PrismaClient;

  beforeAll(async () => {
    db = await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await cleanTestDb(db);
  });

  describe("First-tenant validation: complete org lifecycle", () => {
    it("creates an org, adds owner, creates teams and players, and scopes data correctly", async () => {
      const owner = await db.user.create({
        data: { email: "owner@firsttenant.test", name: "Org Owner" },
      });

      const slug = await generateOrganisationSlug("First Tenant FC", db);
      const orgResult = await createOrganisation({
        name: "First Tenant FC",
        slug,
        ownerUserId: owner.id,
      }, db);
      expect(orgResult.success).toBe(true);
      if (!orgResult.success) return;

      const orgId = orgResult.id;

      const membership = await db.organisationMembership.findFirst({
        where: { userId: owner.id, organisationId: orgId },
      });
      expect(membership).not.toBeNull();
      expect(membership!.role).toBe("OWNER");

      const org1Group = await createTestGroup(db, orgId);
      const team = await db.team.create({
        data: {
          name: "First Team",
          organisationId: orgId,
          footballGroupId: org1Group,
          targetSquadSize: 11,
          minCorePlayers: 8,
          targetSupportCount: 2,
          maxSupportCount: 5,
          minSupportPlayers: 0,
          supportPriority: 1,
          developmentSlots: 3,
          minAcceptedSquadSize: 9,
          maxSquadSize: 14,
        },
      });
      expect(team.organisationId).toBe(orgId);

      const player = await db.player.create({
        data: {
          playerCode: 5001,
          firstName: "First",
          lastName: "Player",
          active: true,
          coreTeamId: team.id,
          primaryPosition: "CM",
          preferredFoot: "RIGHT",
          secondaryFoot: "LEFT",
          bestSide: "CENTER",
          currentAvailability: "AVAILABLE",
          organisationId: orgId,
        },
      });
      expect(player.organisationId).toBe(orgId);

      const orgFilter = organisationFilter(orgId);
      const teamsInOrg = await db.team.findMany({ where: orgFilter });
      const playersInOrg = await db.player.findMany({ where: orgFilter });

      expect(teamsInOrg).toHaveLength(1);
      expect(playersInOrg).toHaveLength(1);
      expect(teamsInOrg[0]!.name).toBe("First Team");

      const secondOrg = await db.organisation.create({
        data: { name: "Second Org", slug: "second-org-validation" },
      });

      const teamsInSecondOrg = await db.team.findMany({
        where: { organisationId: secondOrg.id },
      });
      expect(teamsInSecondOrg).toHaveLength(0);

      const playersInSecondOrg = await db.player.findMany({
        where: { organisationId: secondOrg.id },
      });
      expect(playersInSecondOrg).toHaveLength(0);
    });

    it("invitation flow: owner invites coach, coach accepts, coach sees org data", async () => {
      const owner = await db.user.create({
        data: { email: "owner@invite.test", name: "Inv Owner" },
      });
      const coach = await db.user.create({
        data: { email: "coach@invite.test", name: "Inv Coach" },
      });

      const slug = await generateOrganisationSlug("Invite Org", db);
      const orgResult = await createOrganisation({
        name: "Invite Org",
        slug,
        ownerUserId: owner.id,
      }, db);
      expect(orgResult.success).toBe(true);
      if (!orgResult.success) return;

      const invitation = await createInvitation({
        organisationId: orgResult.id,
        invitedEmail: "coach@invite.test",
        intendedRole: "COACH",
        invitedByUserId: owner.id,
        inviterRole: "OWNER",
      }, db);
      expect(invitation.success).toBe(true);
      if (!invitation.success) return;

      const acceptResult = await acceptInvitation({
        token: invitation.token!,
        userId: coach.id,
        userEmail: "coach@invite.test",
      }, db);
      expect(acceptResult.success).toBe(true);

      const coachMembership = await db.organisationMembership.findFirst({
        where: { userId: coach.id, organisationId: orgResult.id },
      });
      expect(coachMembership).not.toBeNull();
      expect(coachMembership!.role).toBe("COACH");

      const coachOrgFilter = await resolveOrgFilterForUser(coach.id, db);
      expect(coachOrgFilter.type).toBe("org");
      if (coachOrgFilter.type === "org") {
        expect(coachOrgFilter.organisationId).toBe(orgResult.id);
      }
    });

    it("second org is completely isolated from first org", async () => {
      const org1 = await db.organisation.create({
        data: { name: "Isolation Org 1", slug: "isolation-org-1-val" },
      });
      const org2 = await db.organisation.create({
        data: { name: "Isolation Org 2", slug: "isolation-org-2-val" },
      });
      const org1Group2 = await createTestGroup(db, org1.id);
      const org2Group2 = await createTestGroup(db, org2.id);

      const team1 = await db.team.create({
        data: { name: "Isolated Team 1", organisationId: org1.id, footballGroupId: org1Group2, targetSquadSize: 11, minCorePlayers: 8, targetSupportCount: 0, maxSupportCount: 5, minSupportPlayers: 0, supportPriority: 1, developmentSlots: 3, minAcceptedSquadSize: 9, maxSquadSize: 14 },
      });
      const team2 = await db.team.create({
        data: { name: "Isolated Team 2", organisationId: org2.id, footballGroupId: org2Group2, targetSquadSize: 11, minCorePlayers: 8, targetSupportCount: 0, maxSupportCount: 5, minSupportPlayers: 0, supportPriority: 1, developmentSlots: 3, minAcceptedSquadSize: 9, maxSquadSize: 14 },
      });

      await db.player.create({
        data: { playerCode: 6001, firstName: "P1", lastName: "Org1", active: true, coreTeamId: team1.id, primaryPosition: "GK", preferredFoot: "RIGHT", secondaryFoot: "LEFT", bestSide: "CENTER", currentAvailability: "AVAILABLE", organisationId: org1.id },
      });
      await db.player.create({
        data: { playerCode: 6002, firstName: "P2", lastName: "Org2", active: true, coreTeamId: team2.id, primaryPosition: "ST", preferredFoot: "LEFT", secondaryFoot: "RIGHT", bestSide: "CENTER", currentAvailability: "AVAILABLE", organisationId: org2.id },
      });

      const org1Teams = await db.team.findMany({ where: { organisationId: org1.id } });
      const org2Teams = await db.team.findMany({ where: { organisationId: org2.id } });
      const org1Players = await db.player.findMany({ where: { organisationId: org1.id } });
      const org2Players = await db.player.findMany({ where: { organisationId: org2.id } });

      expect(org1Teams).toHaveLength(1);
      expect(org2Teams).toHaveLength(1);
      expect(org1Players).toHaveLength(1);
      expect(org2Players).toHaveLength(1);
      expect(org1Teams[0]!.name).toBe("Isolated Team 1");
      expect(org2Teams[0]!.name).toBe("Isolated Team 2");
    });

    it("suspension and reactivation lifecycle works correctly", async () => {
      const org = await db.organisation.create({
        data: { name: "Suspend Org", slug: "suspend-org-val" },
      });

      expect(await isOrganisationSuspended(org.id, db)).toBe(false);

      const suspendResult = await suspendOrganisation(org.id, "Test suspension", db);
      expect(suspendResult.success).toBe(true);

      expect(await isOrganisationSuspended(org.id, db)).toBe(true);

      const doubleSuspend = await suspendOrganisation(org.id, "Double suspend", db);
      expect(doubleSuspend.success).toBe(false);

      const reactivateResult = await reactivateOrganisation(org.id, db);
      expect(reactivateResult.success).toBe(true);

      expect(await isOrganisationSuspended(org.id, db)).toBe(false);

      const doubleReactivate = await reactivateOrganisation(org.id, db);
      expect(doubleReactivate.success).toBe(false);
    });

    it("suspension is tracked and resolvers can check suspension state", async () => {
      const org = await db.organisation.create({
        data: { name: "Suspend Check Org", slug: "suspend-check-val" },
      });

      expect(await isOrganisationSuspended(org.id, db)).toBe(false);

      const suspendResult = await suspendOrganisation(org.id, "Check suspension", db);
      expect(suspendResult.success).toBe(true);

      const suspendedOrg = await db.organisation.findUnique({
        where: { id: org.id },
        select: { suspendedAt: true, suspendedReason: true },
      });
      expect(suspendedOrg!.suspendedAt).not.toBeNull();
      expect(suspendedOrg!.suspendedReason).toBe("Check suspension");

      expect(await isOrganisationSuspended(org.id, db)).toBe(true);

      await reactivateOrganisation(org.id, db);

      const reactivatedOrg = await db.organisation.findUnique({
        where: { id: org.id },
        select: { suspendedAt: true, suspendedReason: true },
      });
      expect(reactivatedOrg!.suspendedAt).toBeNull();
      expect(reactivatedOrg!.suspendedReason).toBeNull();
    });

    it("deletion removes org and cascades to teams and players", async () => {
      const org = await db.organisation.create({
        data: { name: "Delete Org", slug: "delete-org-val", suspendedAt: new Date(), suspendedReason: "Deletion test" },
      });
      const orgGroup3 = await createTestGroup(db, org.id);

      const team = await db.team.create({
        data: { name: "Delete Team", organisationId: org.id, footballGroupId: orgGroup3, targetSquadSize: 11, minCorePlayers: 8, targetSupportCount: 0, maxSupportCount: 5, minSupportPlayers: 0, supportPriority: 1, developmentSlots: 3, minAcceptedSquadSize: 9, maxSquadSize: 14 },
      });

      await db.player.create({
        data: { playerCode: 7001, firstName: "Del", lastName: "Player", active: true, coreTeamId: team.id, primaryPosition: "GK", preferredFoot: "RIGHT", secondaryFoot: "LEFT", bestSide: "CENTER", currentAvailability: "AVAILABLE", organisationId: org.id },
      });

      const deleteResult = await deleteOrganisation(org.id, db);
      expect(deleteResult.success).toBe(true);

      const foundOrg = await db.organisation.findUnique({ where: { id: org.id } });
      expect(foundOrg).toBeNull();

      const foundTeam = await db.team.findUnique({ where: { id: team.id } });
      expect(foundTeam).toBeNull();

      const foundPlayers = await db.player.findMany({ where: { organisationId: org.id } });
      expect(foundPlayers).toHaveLength(0);
    });
  });

  describe("Synthetic-tenant validation", () => {
    it("synthetic org is isolated from normal orgs and machine principal is bound to it", async () => {
      const syntheticOrg = await db.organisation.create({
        data: { name: "Canary Test", slug: "canary-test-val", isSynthetic: true },
      });
      const normalOrg = await db.organisation.create({
        data: { name: "Normal Test", slug: "normal-test-val" },
      });
      const syntheticGroup = await createTestGroup(db, syntheticOrg.id);
      const normalGroup = await createTestGroup(db, normalOrg.id);

      const { principal } = await createMachinePrincipal({
        organisationId: syntheticOrg.id,
        name: "Canary Bot",
        scopes: ["scenario:read", "fixtures:read"],
      }, db);

      expect(principal.organisationId).toBe(syntheticOrg.id);

      const filter = await resolveOrgFilterForMachine(principal.id, syntheticOrg.id, db);
      expect(filter.type).toBe("org");
      if (filter.type === "org") {
        expect(filter.organisationId).toBe(syntheticOrg.id);
      }

      const crossOrgFilter = await resolveOrgFilterForMachine(principal.id, normalOrg.id, db).catch((e: Error) => {
        expect(e.message).toMatch(/does not belong to this organisation/);
        return null;
      });
      expect(crossOrgFilter).toBeNull();

      const syntheticTeams = await db.team.findMany({ where: { organisationId: syntheticOrg.id } });
      const normalTeams = await db.team.findMany({ where: { organisationId: normalOrg.id } });
      expect(syntheticTeams).toHaveLength(0);
      expect(normalTeams).toHaveLength(0);

      await db.team.create({
        data: { name: "Canary Team", organisationId: syntheticOrg.id, footballGroupId: syntheticGroup, targetSquadSize: 11, minCorePlayers: 8, targetSupportCount: 0, maxSupportCount: 5, minSupportPlayers: 0, supportPriority: 1, developmentSlots: 3, minAcceptedSquadSize: 9, maxSquadSize: 14 },
      });
      await db.team.create({
        data: { name: "Normal Team", organisationId: normalOrg.id, footballGroupId: normalGroup, targetSquadSize: 11, minCorePlayers: 8, targetSupportCount: 0, maxSupportCount: 5, minSupportPlayers: 0, supportPriority: 1, developmentSlots: 3, minAcceptedSquadSize: 9, maxSquadSize: 14 },
      });

      const syntheticTeamsAfter = await db.team.findMany({ where: { organisationId: syntheticOrg.id } });
      const normalTeamsAfter = await db.team.findMany({ where: { organisationId: normalOrg.id } });
      expect(syntheticTeamsAfter).toHaveLength(1);
      expect(normalTeamsAfter).toHaveLength(1);

      const syntheticDeleteResult = await deleteOrganisation(syntheticOrg.id, db);
      expect(syntheticDeleteResult.success).toBe(true);

      const syntheticOrgAfter = await db.organisation.findUnique({ where: { id: syntheticOrg.id } });
      expect(syntheticOrgAfter).toBeNull();

      const normalOrgAfter = await db.organisation.findUnique({ where: { id: normalOrg.id } });
      expect(normalOrgAfter).not.toBeNull();
    });

    it("no global allowlist remains as ordinary authorisation", async () => {
      const { isAllowedCoach } = await import("@/lib/allowlist");

      expect(isAllowedCoach("anyone@example.com")).toBe(false);

      const originalEnv = process.env.ALLOWED_COACH_EMAILS;
      process.env.ALLOWED_COACH_EMAILS = "test@example.com,admin@example.com";

      expect(isAllowedCoach("test@example.com")).toBe(true);
      expect(isAllowedCoach("admin@example.com")).toBe(true);
      expect(isAllowedCoach("other@example.com")).toBe(false);

      process.env.ALLOWED_COACH_EMAILS = originalEnv || "";
    });
  });
});