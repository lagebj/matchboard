import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupTestDb, teardownTestDb } from "@/test/test-db";
import {
  createTestOrganisation,
  createTestUser,
  createTestAccount,
  createTestMembership,
} from "@/test/support/factories";
import {
  createInvitation,
  acceptInvitation,
  declineInvitation,
  revokeInvitation,
  hashToken,
} from "@/lib/organisations/organisation-invitation";
import type { PrismaClient } from "@/generated/prisma/client";

let db: PrismaClient;

beforeAll(async () => {
  db = await setupTestDb();
});

afterAll(async () => {
  await teardownTestDb();
});

describe("Invitation security: token handling", () => {
  it("creates an invitation with a SHA-256 token hash", async () => {
    const org = await createTestOrganisation(db);
    const owner = await createTestUser(db, { email: "owner-inv1@test.example.com" });
    await createTestAccount(db, owner.id);
    await createTestMembership(db, org.id, owner.id, { role: "OWNER" });

    const result = await createInvitation({
      organisationId: org.id,
      invitedEmail: "invitee-inv1@test.example.com",
      intendedRole: "COACH",
      invitedByUserId: owner.id,
      inviterRole: "OWNER",
    }, db);

    expect(result.success).toBe(true);
    if (!result.success) return;

    const stored = await db.organisationInvitation.findUnique({
      where: { id: result.invitationId },
    });
    expect(stored).not.toBeNull();
    expect(stored!.tokenHash).toBe(hashToken(result.token!));
    expect(stored!.status).toBe("PENDING");
  });

  it("token is nullified after acceptance", async () => {
    const org = await createTestOrganisation(db);
    const owner = await createTestUser(db, { email: "owner-inv2@test.example.com" });
    await createTestAccount(db, owner.id);
    await createTestMembership(db, org.id, owner.id, { role: "OWNER" });
    const coach = await createTestUser(db, { email: "coach-inv2@test.example.com" });
    await createTestAccount(db, coach.id);

    const invitation = await createInvitation({
      organisationId: org.id,
      invitedEmail: "coach-inv2@test.example.com",
      intendedRole: "COACH",
      invitedByUserId: owner.id,
      inviterRole: "OWNER",
    }, db);
    expect(invitation.success).toBe(true);
    if (!invitation.success) return;

    const acceptResult = await acceptInvitation({
      token: invitation.token!,
      userId: coach.id,
      userEmail: "coach-inv2@test.example.com",
    }, db);
    expect(acceptResult.success).toBe(true);

    const stored = await db.organisationInvitation.findUnique({
      where: { id: invitation.invitationId },
    });
    expect(stored!.status).toBe("ACCEPTED");
    expect(stored!.token).toBeNull();
  });

  it("token is nullified after decline", async () => {
    const org = await createTestOrganisation(db);
    const owner = await createTestUser(db, { email: "owner-inv3@test.example.com" });
    await createTestAccount(db, owner.id);
    await createTestMembership(db, org.id, owner.id, { role: "OWNER" });
    const coach = await createTestUser(db, { email: "coach-inv3@test.example.com" });
    await createTestAccount(db, coach.id);

    const invitation = await createInvitation({
      organisationId: org.id,
      invitedEmail: "coach-inv3@test.example.com",
      intendedRole: "COACH",
      invitedByUserId: owner.id,
      inviterRole: "OWNER",
    }, db);
    expect(invitation.success).toBe(true);
    if (!invitation.success) return;

    const declineResult = await declineInvitation({
      token: invitation.token!,
      userId: coach.id,
      userEmail: "coach-inv3@test.example.com",
    }, db);
    expect(declineResult.success).toBe(true);

    const stored = await db.organisationInvitation.findUnique({
      where: { id: invitation.invitationId },
    });
    expect(stored!.status).toBe("DECLINED");
    expect(stored!.token).toBeNull();
  });

  it("token is nullified after revocation", async () => {
    const org = await createTestOrganisation(db);
    const owner = await createTestUser(db, { email: "owner-inv4@test.example.com" });
    await createTestAccount(db, owner.id);
    await createTestMembership(db, org.id, owner.id, { role: "OWNER" });

    const invitation = await createInvitation({
      organisationId: org.id,
      invitedEmail: "coach-inv4@test.example.com",
      intendedRole: "COACH",
      invitedByUserId: owner.id,
      inviterRole: "OWNER",
    }, db);
    expect(invitation.success).toBe(true);
    if (!invitation.success) return;

    const revokeResult = await revokeInvitation({
      invitationId: invitation.invitationId,
      revokerRole: "OWNER",
    }, db);
    expect(revokeResult.success).toBe(true);

    const stored = await db.organisationInvitation.findUnique({
      where: { id: invitation.invitationId },
    });
    expect(stored!.status).toBe("REVOKED");
    expect(stored!.token).toBeNull();
  });

  it("cannot accept an already-accepted invitation (replay prevention)", async () => {
    const org = await createTestOrganisation(db);
    const owner = await createTestUser(db, { email: "owner-inv5@test.example.com" });
    await createTestAccount(db, owner.id);
    await createTestMembership(db, org.id, owner.id, { role: "OWNER" });
    const coach = await createTestUser(db, { email: "coach-inv5@test.example.com" });
    await createTestAccount(db, coach.id);

    const invitation = await createInvitation({
      organisationId: org.id,
      invitedEmail: "coach-inv5@test.example.com",
      intendedRole: "COACH",
      invitedByUserId: owner.id,
      inviterRole: "OWNER",
    }, db);
    expect(invitation.success).toBe(true);
    if (!invitation.success) return;

    const accept1 = await acceptInvitation({
      token: invitation.token!,
      userId: coach.id,
      userEmail: "coach-inv5@test.example.com",
    }, db);
    expect(accept1.success).toBe(true);

    const accept2 = await acceptInvitation({
      token: invitation.token!,
      userId: coach.id,
      userEmail: "coach-inv5@test.example.com",
    }, db);
    expect(accept2.success).toBe(false);
  });

  it("cannot accept an invitation with the wrong email", async () => {
    const org = await createTestOrganisation(db);
    const owner = await createTestUser(db, { email: "owner-inv6@test.example.com" });
    await createTestAccount(db, owner.id);
    await createTestMembership(db, org.id, owner.id, { role: "OWNER" });
    const coach = await createTestUser(db, { email: "coach-inv6@test.example.com" });
    await createTestAccount(db, coach.id);

    const invitation = await createInvitation({
      organisationId: org.id,
      invitedEmail: "different-inv6@test.example.com",
      intendedRole: "COACH",
      invitedByUserId: owner.id,
      inviterRole: "OWNER",
    }, db);
    expect(invitation.success).toBe(true);
    if (!invitation.success) return;

    const acceptResult = await acceptInvitation({
      token: invitation.token!,
      userId: coach.id,
      userEmail: "coach-inv6@test.example.com",
    }, db);
    expect(acceptResult.success).toBe(false);
  });

  it("cannot accept an invitation for an org you are already a member of", async () => {
    const org = await createTestOrganisation(db);
    const owner = await createTestUser(db, { email: "owner-inv7@test.example.com" });
    await createTestAccount(db, owner.id);
    await createTestMembership(db, org.id, owner.id, { role: "OWNER" });

    const invitation = await createInvitation({
      organisationId: org.id,
      invitedEmail: "owner-inv7@test.example.com",
      intendedRole: "COACH",
      invitedByUserId: owner.id,
      inviterRole: "OWNER",
    }, db);
    expect(invitation.success).toBe(false);
    if (invitation.success) return;
    expect(invitation.error).toContain("already a member");
  });

  it("cannot create duplicate pending invitations for the same email and org", async () => {
    const org = await createTestOrganisation(db);
    const owner = await createTestUser(db, { email: "owner-inv8@test.example.com" });
    await createTestAccount(db, owner.id);
    await createTestMembership(db, org.id, owner.id, { role: "OWNER" });

    const invitation1 = await createInvitation({
      organisationId: org.id,
      invitedEmail: "coach-inv8@test.example.com",
      intendedRole: "COACH",
      invitedByUserId: owner.id,
      inviterRole: "OWNER",
    }, db);
    expect(invitation1.success).toBe(true);

    const invitation2 = await createInvitation({
      organisationId: org.id,
      invitedEmail: "coach-inv8@test.example.com",
      intendedRole: "COACH",
      invitedByUserId: owner.id,
      inviterRole: "OWNER",
    }, db);
    expect(invitation2.success).toBe(false);
  });

  it("acceptance creates membership but no GroupAccess entries", async () => {
    const org = await createTestOrganisation(db);
    const owner = await createTestUser(db, { email: "owner-inv9@test.example.com" });
    await createTestAccount(db, owner.id);
    await createTestMembership(db, org.id, owner.id, { role: "OWNER" });
    const coach = await createTestUser(db, { email: "coach-inv9@test.example.com" });
    await createTestAccount(db, coach.id);

    const invitation = await createInvitation({
      organisationId: org.id,
      invitedEmail: "coach-inv9@test.example.com",
      intendedRole: "COACH",
      invitedByUserId: owner.id,
      inviterRole: "OWNER",
    }, db);
    expect(invitation.success).toBe(true);
    if (!invitation.success) return;

    const acceptResult = await acceptInvitation({
      token: invitation.token!,
      userId: coach.id,
      userEmail: "coach-inv9@test.example.com",
    }, db);
    expect(acceptResult.success).toBe(true);

    const membership = await db.organisationMembership.findFirst({
      where: { userId: coach.id, organisationId: org.id },
    });
    expect(membership).not.toBeNull();
    expect(membership!.role).toBe("COACH");

    const groupAccess = await db.groupAccess.findMany({
      where: { membershipId: membership!.id },
    });
    expect(groupAccess).toHaveLength(0);
  });

  it("VIEWER role invitation creates VIEWER membership", async () => {
    const org = await createTestOrganisation(db);
    const owner = await createTestUser(db, { email: "owner-inv10@test.example.com" });
    await createTestAccount(db, owner.id);
    await createTestMembership(db, org.id, owner.id, { role: "OWNER" });
    const viewer = await createTestUser(db, { email: "viewer-inv10@test.example.com" });
    await createTestAccount(db, viewer.id);

    const invitation = await createInvitation({
      organisationId: org.id,
      invitedEmail: "viewer-inv10@test.example.com",
      intendedRole: "VIEWER",
      invitedByUserId: owner.id,
      inviterRole: "OWNER",
    }, db);
    expect(invitation.success).toBe(true);
    if (!invitation.success) return;

    const acceptResult = await acceptInvitation({
      token: invitation.token!,
      userId: viewer.id,
      userEmail: "viewer-inv10@test.example.com",
    }, db);
    expect(acceptResult.success).toBe(true);

    const membership = await db.organisationMembership.findFirst({
      where: { userId: viewer.id, organisationId: org.id },
    });
    expect(membership).not.toBeNull();
    expect(membership!.role).toBe("VIEWER");
  });

  it("COACH cannot invite OWNER or ADMIN", async () => {
    const org = await createTestOrganisation(db);
    const coach = await createTestUser(db, { email: "coach-inv11@test.example.com" });
    await createTestAccount(db, coach.id);
    await createTestMembership(db, org.id, coach.id, { role: "COACH" });

    const inviteOwner = await createInvitation({
      organisationId: org.id,
      invitedEmail: "new-owner@test.example.com",
      intendedRole: "OWNER",
      invitedByUserId: coach.id,
      inviterRole: "COACH",
    }, db);
    expect(inviteOwner.success).toBe(false);

    const inviteAdmin = await createInvitation({
      organisationId: org.id,
      invitedEmail: "new-admin@test.example.com",
      intendedRole: "ADMIN",
      invitedByUserId: coach.id,
      inviterRole: "COACH",
    }, db);
    expect(inviteAdmin.success).toBe(false);
  });

  it("non-member cannot create invitation", async () => {
    const org = await createTestOrganisation(db);
    const outsider = await createTestUser(db, { email: "outsider-inv12@test.example.com" });
    await createTestAccount(db, outsider.id);

    const result = await createInvitation({
      organisationId: org.id,
      invitedEmail: "target-inv12@test.example.com",
      intendedRole: "COACH",
      invitedByUserId: outsider.id,
      inviterRole: "COACH",
    }, db);
    expect(result.success).toBe(false);
  });
});

describe("Invitation security: cross-organisation isolation", () => {
  it("invitation from org A does not grant access to org B data", async () => {
    const orgA = await createTestOrganisation(db, { name: "Cross-Org A" });
    const orgB = await createTestOrganisation(db, { name: "Cross-Org B" });

    const ownerA = await createTestUser(db, { email: "owner-cross-a@test.example.com" });
    await createTestAccount(db, ownerA.id);
    await createTestMembership(db, orgA.id, ownerA.id, { role: "OWNER" });

    const coach = await createTestUser(db, { email: "coach-cross@test.example.com" });
    await createTestAccount(db, coach.id);

    const invitation = await createInvitation({
      organisationId: orgA.id,
      invitedEmail: "coach-cross@test.example.com",
      intendedRole: "COACH",
      invitedByUserId: ownerA.id,
      inviterRole: "OWNER",
    }, db);
    expect(invitation.success).toBe(true);
    if (!invitation.success) return;

    const acceptResult = await acceptInvitation({
      token: invitation.token!,
      userId: coach.id,
      userEmail: "coach-cross@test.example.com",
    }, db);
    expect(acceptResult.success).toBe(true);

    const membershipInA = await db.organisationMembership.findFirst({
      where: { userId: coach.id, organisationId: orgA.id },
    });
    expect(membershipInA).not.toBeNull();

    const membershipInB = await db.organisationMembership.findFirst({
      where: { userId: coach.id, organisationId: orgB.id },
    });
    expect(membershipInB).toBeNull();
  });

  it("invitation token from org A cannot be used to join org B", async () => {
    const orgA = await createTestOrganisation(db, { name: "Token Org A" });
    const orgB = await createTestOrganisation(db, { name: "Token Org B" });

    const ownerA = await createTestUser(db, { email: "owner-token-a@test.example.com" });
    await createTestAccount(db, ownerA.id);
    await createTestMembership(db, orgA.id, ownerA.id, { role: "OWNER" });

    const invitation = await createInvitation({
      organisationId: orgA.id,
      invitedEmail: "coach-token@test.example.com",
      intendedRole: "COACH",
      invitedByUserId: ownerA.id,
      inviterRole: "OWNER",
    }, db);
    expect(invitation.success).toBe(true);

    const hashInDB = await db.organisationInvitation.findFirst({
      where: { tokenHash: hashToken(invitation.success ? invitation.token! : "") },
    });
    expect(hashInDB).not.toBeNull();
    expect(hashInDB!.organisationId).toBe(orgA.id);
    expect(hashInDB!.organisationId).not.toBe(orgB.id);
  });
});

describe("Invitation security: expiry", () => {
  it("expired invitation cannot be accepted", async () => {
    const org = await createTestOrganisation(db);
    const owner = await createTestUser(db, { email: "owner-expiry@test.example.com" });
    await createTestAccount(db, owner.id);
    await createTestMembership(db, org.id, owner.id, { role: "OWNER" });
    const coach = await createTestUser(db, { email: "coach-expiry@test.example.com" });
    await createTestAccount(db, coach.id);

    const invitation = await createInvitation({
      organisationId: org.id,
      invitedEmail: "coach-expiry@test.example.com",
      intendedRole: "COACH",
      invitedByUserId: owner.id,
      inviterRole: "OWNER",
    }, db);
    expect(invitation.success).toBe(true);
    if (!invitation.success) return;

    await db.organisationInvitation.update({
      where: { id: invitation.invitationId },
      data: { expiresAt: new Date("2020-01-01") },
    });

    const acceptResult = await acceptInvitation({
      token: invitation.token!,
      userId: coach.id,
      userEmail: "coach-expiry@test.example.com",
    }, db);
    expect(acceptResult.success).toBe(false);
    if (acceptResult.success) return;
    expect(acceptResult.error).toContain("expired");

    const stored = await db.organisationInvitation.findUnique({
      where: { id: invitation.invitationId },
    });
    expect(stored!.status).toBe("EXPIRED");
    expect(stored!.token).toBeNull();
  });
});
