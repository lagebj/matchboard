import { db } from "@/lib/db";
import type { OrganisationRole } from "@/generated/prisma/client";
import { requireValidOrganisationRole, canInviteRole } from "@/lib/organisations/organisation-domain";

export type InvitationResult =
  | { success: true; invitationId: string }
  | { success: false; error: string };

const TOKEN_LENGTH = 32;
const DEFAULT_EXPIRY_DAYS = 7;

function generateToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  const randomValues = new Uint8Array(TOKEN_LENGTH);
  crypto.getRandomValues(randomValues);
  for (let i = 0; i < TOKEN_LENGTH; i++) {
    token += chars[randomValues[i] % chars.length];
  }
  return token;
}

export async function createInvitation(data: {
  organisationId: string;
  invitedEmail: string;
  intendedRole: OrganisationRole;
  invitedByUserId: string;
  inviterRole: OrganisationRole;
}): Promise<InvitationResult> {
  requireValidOrganisationRole(data.intendedRole);

  if (!canInviteRole(data.inviterRole, data.intendedRole)) {
    return { success: false, error: `Role ${data.inviterRole} cannot invite ${data.intendedRole}.` };
  }

  const existingMembership = await db.organisationMembership.findUnique({
    where: {
      userId_organisationId: {
        userId: data.invitedByUserId,
        organisationId: data.organisationId,
      },
    },
    select: { id: true },
  });

  if (!existingMembership) {
    return { success: false, error: "Inviter is not a member of this organisation." };
  }

  const existingActiveInvitation = await db.organisationInvitation.findFirst({
    where: {
      organisationId: data.organisationId,
      invitedEmail: data.invitedEmail.toLowerCase(),
      status: "PENDING",
    },
    select: { id: true },
  });

  if (existingActiveInvitation) {
    return { success: false, error: "An active invitation already exists for this email." };
  }

  const existingMember = await db.organisationMembership.findFirst({
    where: {
      organisationId: data.organisationId,
      user: { email: data.invitedEmail.toLowerCase() },
    },
    select: { id: true },
  });

  if (existingMember) {
    return { success: false, error: "This user is already a member of the organisation." };
  }

  const token = generateToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + DEFAULT_EXPIRY_DAYS);

  const invitation = await db.organisationInvitation.create({
    data: {
      organisationId: data.organisationId,
      invitedEmail: data.invitedEmail.toLowerCase(),
      intendedRole: data.intendedRole,
      token,
      expiresAt,
      invitedByUserId: data.invitedByUserId,
    },
  });

  return { success: true, invitationId: invitation.id };
}

export async function acceptInvitation(data: {
  token: string;
  userId: string;
  userEmail: string;
}): Promise<InvitationResult> {
  const invitation = await db.organisationInvitation.findUnique({
    where: { token: data.token },
    select: {
      id: true,
      organisationId: true,
      invitedEmail: true,
      intendedRole: true,
      status: true,
      expiresAt: true,
    },
  });

  if (!invitation) {
    return { success: false, error: "Invitation not found." };
  }

  if (invitation.status !== "PENDING") {
    return { success: false, error: `Invitation is ${invitation.status.toLowerCase()}.` };
  }

  if (invitation.expiresAt < new Date()) {
    await db.organisationInvitation.update({
      where: { id: invitation.id },
      data: { status: "EXPIRED" },
    });
    return { success: false, error: "Invitation has expired." };
  }

  if (invitation.invitedEmail !== data.userEmail.toLowerCase()) {
    return { success: false, error: "This invitation was sent to a different email address." };
  }

  const existingMembership = await db.organisationMembership.findUnique({
    where: {
      userId_organisationId: {
        userId: data.userId,
        organisationId: invitation.organisationId,
      },
    },
    select: { id: true },
  });

  if (existingMembership) {
    return { success: false, error: "You are already a member of this organisation." };
  }

  await db.$transaction([
    db.organisationMembership.create({
      data: {
        userId: data.userId,
        organisationId: invitation.organisationId,
        role: invitation.intendedRole,
      },
    }),
    db.organisationInvitation.update({
      where: { id: invitation.id },
      data: { status: "ACCEPTED", acceptedAt: new Date() },
    }),
  ]);

  return { success: true, invitationId: invitation.id };
}

export async function revokeInvitation(data: {
  invitationId: string;
  revokerRole: OrganisationRole;
}): Promise<InvitationResult> {
  if (data.revokerRole !== "OWNER" && data.revokerRole !== "ADMIN") {
    return { success: false, error: "Only OWNER or ADMIN can revoke invitations." };
  }

  const invitation = await db.organisationInvitation.findUnique({
    where: { id: data.invitationId },
    select: { status: true },
  });

  if (!invitation) {
    return { success: false, error: "Invitation not found." };
  }

  if (invitation.status !== "PENDING") {
    return { success: false, error: `Cannot revoke invitation with status ${invitation.status.toLowerCase()}.` };
  }

  await db.organisationInvitation.update({
    where: { id: data.invitationId },
    data: { status: "REVOKED", revokedAt: new Date() },
  });

  return { success: true, invitationId: data.invitationId };
}