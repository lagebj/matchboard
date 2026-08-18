'use server'

import { revalidatePath } from "next/cache";
import { requireCoachAccess } from "@/lib/auth";
import { resolveOrganisationAccess, resolveOrganisationAdminOrOwner, resolveOrganisationOwner } from "@/lib/organisations/organisation-resolver";
import { createOrganisation, getOrganisationBySlug, getUserOrganisations, generateOrganisationSlug } from "@/lib/organisations/organisation-domain";
import { createInvitation, acceptInvitation, revokeInvitation, declineInvitation } from "@/lib/organisations/organisation-invitation";
import {
  logOrganisationCreate,
  logOrganisationInvitationCreate,
  logOrganisationInvitationAccept,
  logOrganisationInvitationRevoke,
  logOrganisationMembershipUpdate,
} from "@/lib/security/audit-log";
import { suspendOrganisation, reactivateOrganisation, deleteOrganisation } from "@/lib/organisations/organisation-lifecycle";
import { enqueueNotification, sendNotificationNow, cancelNotificationByIdempotencyKey } from "@/lib/email/outbox";
import { db } from "@/lib/db";
import type { OrganisationRole, PrismaClient } from "@/generated/prisma/client";
import { rateLimit } from "@/lib/rate-limit";
import { hashToken } from "@/lib/organisations/organisation-invitation";

const VALID_ORGANISATION_ROLES = new Set<string>(["OWNER", "ADMIN", "COACH", "VIEWER", "SUPPORT"]);

export async function createOrganisationAction(name: string) {
  const coach = await requireCoachAccess();
  const coachEmail: string = coach.email ?? "unknown";
  const coachId: string = coach.id ?? "";

  const trimmedName = name?.trim();
  if (!trimmedName) {
    return { success: false as const, error: "Organisation name is required." };
  }

  const slug = await generateOrganisationSlug(trimmedName);
  const result = await createOrganisation({ name: trimmedName, slug, ownerUserId: coachId });

  if (!result.success) {
    logOrganisationCreate(coachEmail, "", "failure");
    return { success: false as const, error: result.error };
  }

  logOrganisationCreate(coachEmail, result.id, "success");
  revalidatePath("/organisations");

  return { success: true as const, organisationId: result.id };
}

export async function getOrganisationAction(slug: string) {
  await resolveOrganisationAccess(slug);
  const org = await getOrganisationBySlug(slug);
  return org;
}

export async function listUserOrganisationsAction() {
  const coach = await requireCoachAccess();
  return getUserOrganisations(coach.id ?? "");
}

export async function createInvitationAction(
  organisationSlug: string,
  inviteeEmail: string,
  role: string,
) {
  const coach = await requireCoachAccess();
  const ctx = await resolveOrganisationAdminOrOwner(organisationSlug);

  const createKey = `invitation-create:${ctx.userId}`;
  const { allowed } = rateLimit(createKey, 10, 60_000);
  if (!allowed) {
    return { success: false as const, error: "Too many invitation attempts. Please wait a minute and try again." };
  }
  const inviterName = coach.name || ctx.userEmail;

  if (!role || !VALID_ORGANISATION_ROLES.has(role)) {
    return { success: false as const, error: "Valid role is required (OWNER, ADMIN, COACH, VIEWER)." };
  }

  const targetRole = role as OrganisationRole;
  if (!ctx.canInviteRole(targetRole)) {
    logOrganisationInvitationCreate(ctx.userEmail, ctx.organisationId, "failure", "role_not_allowed");
    return { success: false as const, error: "You cannot invite someone with this role." };
  }

  const trimmedEmail = inviteeEmail?.trim().toLowerCase();
  if (!trimmedEmail) {
    return { success: false as const, error: "Invitee email is required." };
  }

  let invitationId = "";
  let outboxId = "";

  try {
    await db.$transaction(async (tx) => {
      const result = await createInvitation(
        {
          organisationId: ctx.organisationId,
          invitedEmail: trimmedEmail,
          intendedRole: targetRole,
          invitedByUserId: ctx.userId,
          inviterRole: ctx.role,
        },
        tx as unknown as PrismaClient,
      );

      if (!result.success) {
        throw new Error(result.error);
      }

      invitationId = result.invitationId;


      const notificationId = await enqueueNotification(
        {
          organisationId: ctx.organisationId,
          idempotencyKey: `invitation-${result.invitationId}`,
          template: "ORGANISATION_INVITATION",
          payload: {
            organisationName: ctx.organisationName,
            inviterName: inviterName,
            inviterEmail: ctx.userEmail,
            inviteeEmail: trimmedEmail,
            role: targetRole,
            acceptUrl: `/invite/${result.token}`,
            organisationSlug: ctx.organisationSlug,
          },
          recipientEmail: trimmedEmail,
        },
        tx as unknown as PrismaClient,
      );

      outboxId = notificationId;
    });
  } catch (err: unknown) {
    logOrganisationInvitationCreate(ctx.userEmail, ctx.organisationId, "failure", err instanceof Error ? err.message : "Unknown error");
    return { success: false as const, error: err instanceof Error ? err.message : "Failed to create invitation." };
  }

  logOrganisationInvitationCreate(ctx.userEmail, ctx.organisationId, "success");
  revalidatePath(`/o/${organisationSlug}`);

  sendNotificationNow(outboxId).catch((err) => {
    console.error("[invitation] Immediate send failed, will retry via cron:", err);
  });

  return { success: true as const, invitationId };
}

export async function acceptInvitationAction(token: string) {
  const coach = await requireCoachAccess();
  const coachEmail: string = coach.email ?? "unknown";
  const coachId: string = coach.id ?? "";

  if (!token?.trim()) {
    return { success: false as const, error: "Invitation token is required." };
  }

  const tokenKey = `invitation-accept:${hashToken(token.trim())}`;
  const { allowed } = rateLimit(tokenKey, 10, 60_000);
  if (!allowed) {
    return { success: false as const, error: "Too many attempts. Please wait a minute and try again." };
  }

  const result = await acceptInvitation({ token: token.trim(), userId: coachId, userEmail: coachEmail });

  if (!result.success) {
    logOrganisationInvitationAccept(coachEmail, "", "failure");
    return { success: false as const, error: result.error };
  }

  logOrganisationInvitationAccept(coachEmail, result.invitationId, "success");
  revalidatePath("/organisations");

  return { success: true as const, invitationId: result.invitationId };
}

export async function revokeInvitationAction(organisationSlug: string, invitationId: string) {
  const ctx = await resolveOrganisationAdminOrOwner(organisationSlug);

  if (!invitationId?.trim()) {
    return { success: false as const, error: "Invitation ID is required." };
  }

  const result = await revokeInvitation({
    invitationId: invitationId.trim(),
    revokerRole: ctx.role,
  });

  if (!result.success) {
    logOrganisationInvitationRevoke(ctx.userEmail, ctx.organisationId, "failure", result.error);
    return { success: false as const, error: result.error };
  }

  logOrganisationInvitationRevoke(ctx.userEmail, ctx.organisationId, "success");
  revalidatePath(`/o/${organisationSlug}`);

  cancelNotificationByIdempotencyKey(`invitation-${invitationId.trim()}`).catch((err) => {
    console.error("[invitation] Failed to cancel notification on revoke:", err);
  });

  return { success: true as const };
}

export async function declineInvitationAction(token: string) {
  const coach = await requireCoachAccess();
  const coachEmail: string = coach.email ?? "unknown";
  const coachId: string = coach.id ?? "";

  if (!token?.trim()) {
    return { success: false as const, error: "Invitation token is required." };
  }

  const tokenKey = `invitation-decline:${hashToken(token.trim())}`;
  const { allowed } = rateLimit(tokenKey, 10, 60_000);
  if (!allowed) {
    return { success: false as const, error: "Too many attempts. Please wait a minute and try again." };
  }

  const result = await declineInvitation({ token: token.trim(), userId: coachId, userEmail: coachEmail });

  if (!result.success) {
    return { success: false as const, error: result.error };
  }

  cancelNotificationByIdempotencyKey(`invitation-${result.invitationId}`).catch((err) => {
    console.error("[invitation] Failed to cancel notification on decline:", err);
  });

  revalidatePath("/organisations");

  return { success: true as const, invitationId: result.invitationId };
}

export async function updateMembershipRoleAction(
  organisationSlug: string,
  membershipId: string,
  newRole: string,
) {
  const ctx = await resolveOrganisationOwner(organisationSlug);

  if (!membershipId?.trim()) {
    return { success: false as const, error: "Membership ID is required." };
  }
  if (!newRole || !VALID_ORGANISATION_ROLES.has(newRole)) {
    return { success: false as const, error: "Valid role is required." };
  }

  const targetRole = newRole as OrganisationRole;
  if (!ctx.canManageRole(targetRole)) {
    logOrganisationMembershipUpdate(ctx.userEmail, ctx.organisationId, "failure", "role_not_allowed");
    return { success: false as const, error: "You cannot assign this role." };
  }

  const { db } = await import("@/lib/db");
  const membership = await db.organisationMembership.findUnique({ where: { id: membershipId.trim() } });
  if (!membership || membership.organisationId !== ctx.organisationId) {
    logOrganisationMembershipUpdate(ctx.userEmail, ctx.organisationId, "failure", "membership_not_found");
    return { success: false as const, error: "Membership not found in this organisation." };
  }

  await db.organisationMembership.update({
    where: { id: membership.id },
    data: { role: targetRole },
  });

  logOrganisationMembershipUpdate(ctx.userEmail, ctx.organisationId, "success", `${membership.role} → ${targetRole}`);
  revalidatePath(`/o/${organisationSlug}`);

  return { success: true as const };
}

export async function suspendOrganisationAction(organisationSlug: string, reason: string) {
  const ctx = await resolveOrganisationOwner(organisationSlug);

  if (!reason?.trim()) {
    return { success: false as const, error: "Suspension reason is required." };
  }

  const result = await suspendOrganisation(ctx.organisationId, reason.trim());

  if (!result.success) {
    return { success: false as const, error: result.error };
  }

  revalidatePath("/organisations");
  revalidatePath(`/o/${organisationSlug}`);

  return { success: true as const };
}

export async function reactivateOrganisationAction(organisationSlug: string) {
  const ctx = await resolveOrganisationOwner(organisationSlug);

  const result = await reactivateOrganisation(ctx.organisationId);

  if (!result.success) {
    return { success: false as const, error: result.error };
  }

  revalidatePath("/organisations");
  revalidatePath(`/o/${organisationSlug}`);

  return { success: true as const };
}

export async function deleteOrganisationAction(organisationSlug: string) {
  const ctx = await resolveOrganisationOwner(organisationSlug);

  const result = await deleteOrganisation(ctx.organisationId);

  if (!result.success) {
    return { success: false as const, error: result.error };
  }

  revalidatePath("/organisations");

  return { success: true as const };
}