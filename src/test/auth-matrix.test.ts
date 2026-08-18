import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupTestDb, teardownTestDb } from "@/test/test-db";
import {
  createTestOrganisation,
  createTestTeam,
  createTestPlayer,
  createTestUser,
  createTestAccount,
  createTestMembership,
} from "@/test/support/factories";
import type { PrismaClient } from "@/generated/prisma/client";

let db: PrismaClient;

interface DualOrgFixture {
  orgAId: string;
  orgBId: string;
  groupA1Id: string;
  groupA2Id: string;
  groupB1Id: string;
  teamA1BluesId: string;
  teamA1WhitesId: string;
  teamA2EaglesId: string;
  teamB1LionsId: string;
  ownerAUserId: string;
  ownerAMembershipId: string;
  adminAUserId: string;
  adminAMembershipId: string;
  coachAllAUserId: string;
  coachAllAMembershipId: string;
  coachA1UserId: string;
  coachA1MembershipId: string;
  coachA2UserId: string;
  coachA2MembershipId: string;
  viewerAUserId: string;
  viewerAMembershipId: string;
  coachB1UserId: string;
  coachB1MembershipId: string;
  playerA1Id: string;
  playerB1Id: string;
}

let fixture: DualOrgFixture;

beforeAll(async () => {
  db = await setupTestDb();

  const orgA = await createTestOrganisation(db, { name: "Org A" });
  const orgB = await createTestOrganisation(db, { name: "Org B" });

  const groupA1 = await db.footballGroup.create({
    data: { name: "Group A1", slug: `group-a1-${Date.now()}`, type: "AGE_GROUP", organisationId: orgA.id },
  });
  const groupA2 = await db.footballGroup.create({
    data: { name: "Group A2", slug: `group-a2-${Date.now()}`, type: "AGE_GROUP", organisationId: orgA.id },
  });
  const groupB1 = await db.footballGroup.create({
    data: { name: "Group B1", slug: `group-b1-${Date.now()}`, type: "AGE_GROUP", organisationId: orgB.id },
  });

  const teamA1Blues = await createTestTeam(db, orgA.id, groupA1.id, { name: "A1 Blues" });
  const teamA1Whites = await createTestTeam(db, orgA.id, groupA1.id, { name: "A1 Whites" });
  const teamA2Eagles = await createTestTeam(db, orgA.id, groupA2.id, { name: "A2 Eagles" });
  const teamB1Lions = await createTestTeam(db, orgB.id, groupB1.id, { name: "B1 Lions" });

  const playerA1 = await createTestPlayer(db, orgA.id, teamA1Blues.id);
  const playerB1 = await createTestPlayer(db, orgB.id, teamB1Lions.id);

  const ownerAUser = await createTestUser(db, { email: "owner-a@test.example.com", name: "Owner A" });
  await createTestAccount(db, ownerAUser.id);
  const ownerAMembership = await createTestMembership(db, orgA.id, ownerAUser.id, { role: "OWNER" });

  const adminAUser = await createTestUser(db, { email: "admin-a@test.example.com", name: "Admin A" });
  await createTestAccount(db, adminAUser.id);
  const adminAMembership = await createTestMembership(db, orgA.id, adminAUser.id, { role: "ADMIN" });

  const coachAllAUser = await createTestUser(db, { email: "coach-all-a@test.example.com", name: "Coach All A" });
  await createTestAccount(db, coachAllAUser.id);
  const coachAllAMembership = await createTestMembership(db, orgA.id, coachAllAUser.id, { role: "COACH" });
  await db.groupAccess.create({ data: { membershipId: coachAllAMembership.id, footballGroupId: groupA1.id, organisationId: orgA.id, role: "GROUP_COACH" } });
  await db.groupAccess.create({ data: { membershipId: coachAllAMembership.id, footballGroupId: groupA2.id, organisationId: orgA.id, role: "GROUP_COACH" } });

  const coachA1User = await createTestUser(db, { email: "coach-a1@test.example.com", name: "Coach A1" });
  await createTestAccount(db, coachA1User.id);
  const coachA1Membership = await createTestMembership(db, orgA.id, coachA1User.id, { role: "COACH" });
  await db.groupAccess.create({ data: { membershipId: coachA1Membership.id, footballGroupId: groupA1.id, organisationId: orgA.id, role: "GROUP_COACH" } });

  const coachA2User = await createTestUser(db, { email: "coach-a2@test.example.com", name: "Coach A2" });
  await createTestAccount(db, coachA2User.id);
  const coachA2Membership = await createTestMembership(db, orgA.id, coachA2User.id, { role: "COACH" });
  await db.groupAccess.create({ data: { membershipId: coachA2Membership.id, footballGroupId: groupA2.id, organisationId: orgA.id, role: "GROUP_COACH" } });

  const viewerAUser = await createTestUser(db, { email: "viewer-a@test.example.com", name: "Viewer A" });
  await createTestAccount(db, viewerAUser.id);
  const viewerAMembership = await createTestMembership(db, orgA.id, viewerAUser.id, { role: "VIEWER" });

  const coachB1User = await createTestUser(db, { email: "coach-b1@test.example.com", name: "Coach B1" });
  await createTestAccount(db, coachB1User.id);
  const coachB1Membership = await createTestMembership(db, orgB.id, coachB1User.id, { role: "COACH" });
  await db.groupAccess.create({ data: { membershipId: coachB1Membership.id, footballGroupId: groupB1.id, organisationId: orgB.id, role: "GROUP_COACH" } });

  fixture = {
    orgAId: orgA.id,
    orgBId: orgB.id,
    groupA1Id: groupA1.id,
    groupA2Id: groupA2.id,
    groupB1Id: groupB1.id,
    teamA1BluesId: teamA1Blues.id,
    teamA1WhitesId: teamA1Whites.id,
    teamA2EaglesId: teamA2Eagles.id,
    teamB1LionsId: teamB1Lions.id,
    ownerAUserId: ownerAUser.id,
    ownerAMembershipId: ownerAMembership.id,
    adminAUserId: adminAUser.id,
    adminAMembershipId: adminAMembership.id,
    coachAllAUserId: coachAllAUser.id,
    coachAllAMembershipId: coachAllAMembership.id,
    coachA1UserId: coachA1User.id,
    coachA1MembershipId: coachA1Membership.id,
    coachA2UserId: coachA2User.id,
    coachA2MembershipId: coachA2Membership.id,
    viewerAUserId: viewerAUser.id,
    viewerAMembershipId: viewerAMembership.id,
    coachB1UserId: coachB1User.id,
    coachB1MembershipId: coachB1Membership.id,
    playerA1Id: playerA1.id,
    playerB1Id: playerB1.id,
  };
});

afterAll(async () => {
  await teardownTestDb();
});

describe("Authorization matrix: cross-organization data isolation", () => {
  it("Org A teams are isolated from Org B queries", async () => {
    const orgATeams = await db.team.findMany({
      where: { organisationId: fixture.orgAId, archivedAt: null },
    });
    for (const team of orgATeams) {
      expect(team.organisationId).toBe(fixture.orgAId);
    }
    const orgATeamIds = orgATeams.map((t) => t.id);
    expect(orgATeamIds).not.toContain(fixture.teamB1LionsId);
  });

  it("Org B teams are isolated from Org A queries", async () => {
    const orgBTeams = await db.team.findMany({
      where: { organisationId: fixture.orgBId, archivedAt: null },
    });
    for (const team of orgBTeams) {
      expect(team.organisationId).toBe(fixture.orgBId);
    }
    const orgBTeamIds = orgBTeams.map((t) => t.id);
    expect(orgBTeamIds).not.toContain(fixture.teamA1BluesId);
    expect(orgBTeamIds).not.toContain(fixture.teamA2EaglesId);
  });

  it("Org A player cannot be found via Org B filter", async () => {
    const orgBPlayers = await db.player.findMany({
      where: { organisationId: fixture.orgBId, removedAt: null },
    });
    const orgBPlayerIds = orgBPlayers.map((p) => p.id);
    expect(orgBPlayerIds).not.toContain(fixture.playerA1Id);
  });

  it("Org B player cannot be found via Org A filter", async () => {
    const orgAPlayers = await db.player.findMany({
      where: { organisationId: fixture.orgAId, removedAt: null },
    });
    const orgAPlayerIds = orgAPlayers.map((p) => p.id);
    expect(orgAPlayerIds).not.toContain(fixture.playerB1Id);
  });

  it("Cross-org team ID substitution returns empty results", async () => {
    const result = await db.team.findMany({
      where: { id: fixture.teamB1LionsId, organisationId: fixture.orgAId },
    });
    expect(result).toHaveLength(0);
  });

  it("Cross-org player ID substitution returns empty results", async () => {
    const result = await db.player.findMany({
      where: { id: fixture.playerB1Id, organisationId: fixture.orgAId },
    });
    expect(result).toHaveLength(0);
  });
});

describe("Authorization matrix: cross-group access within organization", () => {
  it("Group A1 teams are separate from Group A2 teams", async () => {
    const groupA1Teams = await db.team.findMany({
      where: { organisationId: fixture.orgAId, footballGroupId: fixture.groupA1Id, archivedAt: null },
    });
    const groupA1TeamIds = groupA1Teams.map((t) => t.id);

    expect(groupA1TeamIds).toContain(fixture.teamA1BluesId);
    expect(groupA1TeamIds).toContain(fixture.teamA1WhitesId);
    expect(groupA1TeamIds).not.toContain(fixture.teamA2EaglesId);
  });

  it("Group A2 teams are separate from Group A1 teams", async () => {
    const groupA2Teams = await db.team.findMany({
      where: { organisationId: fixture.orgAId, footballGroupId: fixture.groupA2Id, archivedAt: null },
    });
    const groupA2TeamIds = groupA2Teams.map((t) => t.id);

    expect(groupA2TeamIds).toContain(fixture.teamA2EaglesId);
    expect(groupA2TeamIds).not.toContain(fixture.teamA1BluesId);
    expect(groupA2TeamIds).not.toContain(fixture.teamA1WhitesId);
  });

  it("Group A1 filter does not return Group A2 players via coreTeam", async () => {
    const groupA1Players = await db.player.findMany({
      where: {
        organisationId: fixture.orgAId,
        coreTeam: { footballGroupId: fixture.groupA1Id },
        removedAt: null,
      },
    });

    for (const player of groupA1Players) {
      if (player.coreTeamId) {
        const team = await db.team.findUnique({ where: { id: player.coreTeamId } });
        expect(team?.footballGroupId).toBe(fixture.groupA1Id);
      }
    }
  });

  it("Group A2 filter does not return Group A1 players via coreTeam", async () => {
    const groupA2Players = await db.player.findMany({
      where: {
        organisationId: fixture.orgAId,
        coreTeam: { footballGroupId: fixture.groupA2Id },
        removedAt: null,
      },
    });

    for (const player of groupA2Players) {
      if (player.coreTeamId) {
        const team = await db.team.findUnique({ where: { id: player.coreTeamId } });
        expect(team?.footballGroupId).toBe(fixture.groupA2Id);
      }
    }
  });
});

describe("Authorization matrix: role-based group access", () => {
  it("OWNER membership exists in Org A and not in Org B", async () => {
    const ownerAInOrgA = await db.organisationMembership.findFirst({
      where: { userId: fixture.ownerAUserId, organisationId: fixture.orgAId },
    });
    expect(ownerAInOrgA).not.toBeNull();
    expect(ownerAInOrgA?.role).toBe("OWNER");

    const ownerAInOrgB = await db.organisationMembership.findFirst({
      where: { userId: fixture.ownerAUserId, organisationId: fixture.orgBId },
    });
    expect(ownerAInOrgB).toBeNull();
  });

  it("coach-all-a has GroupAccess for both A1 and A2", async () => {
    const groupAccesses = await db.groupAccess.findMany({
      where: { membershipId: fixture.coachAllAMembershipId },
    });
    const accessedGroupIds = groupAccesses.map((ga) => ga.footballGroupId);
    expect(accessedGroupIds).toContain(fixture.groupA1Id);
    expect(accessedGroupIds).toContain(fixture.groupA2Id);
    expect(accessedGroupIds).toHaveLength(2);
  });

  it("coach-a1 has GroupAccess only for A1", async () => {
    const groupAccesses = await db.groupAccess.findMany({
      where: { membershipId: fixture.coachA1MembershipId },
    });
    const accessedGroupIds = groupAccesses.map((ga) => ga.footballGroupId);
    expect(accessedGroupIds).toContain(fixture.groupA1Id);
    expect(accessedGroupIds).not.toContain(fixture.groupA2Id);
    expect(accessedGroupIds).toHaveLength(1);
  });

  it("coach-a2 has GroupAccess only for A2", async () => {
    const groupAccesses = await db.groupAccess.findMany({
      where: { membershipId: fixture.coachA2MembershipId },
    });
    const accessedGroupIds = groupAccesses.map((ga) => ga.footballGroupId);
    expect(accessedGroupIds).toContain(fixture.groupA2Id);
    expect(accessedGroupIds).not.toContain(fixture.groupA1Id);
    expect(accessedGroupIds).toHaveLength(1);
  });

  it("coach-b1 has GroupAccess only for B1 in Org B", async () => {
    const groupAccesses = await db.groupAccess.findMany({
      where: { membershipId: fixture.coachB1MembershipId },
    });
    const accessedGroupIds = groupAccesses.map((ga) => ga.footballGroupId);
    expect(accessedGroupIds).toContain(fixture.groupB1Id);
    expect(accessedGroupIds).toHaveLength(1);

    for (const ga of groupAccesses) {
      expect(ga.organisationId).toBe(fixture.orgBId);
    }
  });

  it("VIEWER has no GroupAccess entries", async () => {
    const groupAccesses = await db.groupAccess.findMany({
      where: { membershipId: fixture.viewerAMembershipId },
    });
    expect(groupAccesses).toHaveLength(0);
  });
});

describe("Authorization matrix: membership isolation", () => {
  it("Org A membership does not include Org B users", async () => {
    const orgAMemberships = await db.organisationMembership.findMany({
      where: { organisationId: fixture.orgAId },
    });
    const orgAUserIds = orgAMemberships.map((m) => m.userId);
    expect(orgAUserIds).toContain(fixture.ownerAUserId);
    expect(orgAUserIds).toContain(fixture.adminAUserId);
    expect(orgAUserIds).toContain(fixture.coachAllAUserId);
    expect(orgAUserIds).toContain(fixture.coachA1UserId);
    expect(orgAUserIds).toContain(fixture.coachA2UserId);
    expect(orgAUserIds).toContain(fixture.viewerAUserId);

    expect(orgAUserIds).not.toContain(fixture.coachB1UserId);
  });

  it("Org B membership does not include Org A users", async () => {
    const orgBMemberships = await db.organisationMembership.findMany({
      where: { organisationId: fixture.orgBId },
    });
    const orgBUserIds = orgBMemberships.map((m) => m.userId);
    expect(orgBUserIds).toContain(fixture.coachB1UserId);

    expect(orgBUserIds).not.toContain(fixture.ownerAUserId);
    expect(orgBUserIds).not.toContain(fixture.coachA1UserId);
  });

  it("GroupAccess entries are scoped to the correct organisation", async () => {
    const orgAGroupAccesses = await db.groupAccess.findMany({
      where: { organisationId: fixture.orgAId },
    });
    for (const ga of orgAGroupAccesses) {
      expect(ga.organisationId).toBe(fixture.orgAId);
      const group = await db.footballGroup.findUnique({ where: { id: ga.footballGroupId } });
      expect(group?.organisationId).toBe(fixture.orgAId);
    }

    const orgBGroupAccesses = await db.groupAccess.findMany({
      where: { organisationId: fixture.orgBId },
    });
    for (const ga of orgBGroupAccesses) {
      expect(ga.organisationId).toBe(fixture.orgBId);
      const group = await db.footballGroup.findUnique({ where: { id: ga.footballGroupId } });
      expect(group?.organisationId).toBe(fixture.orgBId);
    }
  });

  it("Org A membership cannot have GroupAccess pointing to Org B groups", async () => {
    const orgAMemberships = await db.organisationMembership.findMany({
      where: { organisationId: fixture.orgAId },
    });
    const orgAMembershipIds = orgAMemberships.map((m) => m.id);

    const orgBGroups = await db.footballGroup.findMany({
      where: { organisationId: fixture.orgBId },
    });
    const orgBGroupIds = orgBGroups.map((g) => g.id);

    const crossGroupAccesses = await db.groupAccess.findMany({
      where: {
        membershipId: { in: orgAMembershipIds },
        footballGroupId: { in: orgBGroupIds },
      },
    });
    expect(crossGroupAccesses).toHaveLength(0);
  });
});

describe("Authorization matrix: data query isolation with org filter", () => {
  it("Team query with Org A filter excludes all Org B teams", async () => {
    const orgATeams = await db.team.findMany({
      where: { organisationId: fixture.orgAId, archivedAt: null },
    });
    for (const team of orgATeams) {
      expect(team.organisationId).toBe(fixture.orgAId);
    }

    const orgATeamIds = new Set(orgATeams.map((t) => t.id));
    expect(orgATeamIds.has(fixture.teamB1LionsId)).toBe(false);
  });

  it("Player query with Org A filter excludes all Org B players", async () => {
    const orgAPlayers = await db.player.findMany({
      where: { organisationId: fixture.orgAId, removedAt: null },
    });
    for (const player of orgAPlayers) {
      expect(player.organisationId).toBe(fixture.orgAId);
    }
  });

  it("Group query with Org A filter excludes Org B groups", async () => {
    const orgAGroups = await db.footballGroup.findMany({
      where: { organisationId: fixture.orgAId },
    });
    for (const group of orgAGroups) {
      expect(group.organisationId).toBe(fixture.orgAId);
    }

    const orgAGroupIds = orgAGroups.map((g) => g.id);
    expect(orgAGroupIds).toContain(fixture.groupA1Id);
    expect(orgAGroupIds).toContain(fixture.groupA2Id);
    expect(orgAGroupIds).not.toContain(fixture.groupB1Id);
  });

  it("Group query with Org B filter excludes Org A groups", async () => {
    const orgBGroups = await db.footballGroup.findMany({
      where: { organisationId: fixture.orgBId },
    });
    const orgBGroupIds = orgBGroups.map((g) => g.id);
    expect(orgBGroupIds).toContain(fixture.groupB1Id);
    expect(orgBGroupIds).not.toContain(fixture.groupA1Id);
    expect(orgBGroupIds).not.toContain(fixture.groupA2Id);
  });
});