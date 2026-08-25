'use server'

import { revalidatePath } from "next/cache";
import { requireCoachAccess } from "@/lib/auth";
import { auth } from "@/auth";
import { resolveOrganisationAccess, resolveOrganisationAdminOrOwner, resolveOrganisationOwner } from "@/lib/organisations/organisation-resolver";
import { getOrganisationBySlug, getUserOrganisations } from "@/lib/organisations/organisation-domain";
import { createInvitation, acceptInvitation, revokeInvitation, declineInvitation } from "@/lib/organisations/organisation-invitation";
import {
  logOrganisationInvitationCreate,
  logOrganisationInvitationAccept,
  logOrganisationInvitationRevoke,
  logOrganisationInvitationDecline,
  logOrganisationMembershipUpdate,
  logOrganisationMembershipRemove,
} from "@/lib/security/audit-log";
import { logger } from "@/lib/logger";
import { suspendOrganisation, reactivateOrganisation, deleteOrganisation } from "@/lib/organisations/organisation-lifecycle";
import { enqueueNotification, sendNotificationNow, cancelNotificationByIdempotencyKey } from "@/lib/email/outbox";
import { db } from "@/lib/db";
import type { OrganisationRole, PrismaClient } from "@/generated/prisma/client";
import { rateLimit } from "@/lib/rate-limit";
import { hashToken } from "@/lib/organisations/organisation-invitation";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";

const VALID_ORGANISATION_ROLES = new Set<string>(["OWNER", "ADMIN", "COACH", "VIEWER", "SUPPORT"]);

export async function getOrganisationAction(slug: string) {
  const ctx = await resolveOrganisationAccess(slug);
  setTenantOrganisationId(ctx.organisationId);
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
  const ctx = await resolveOrganisationAdminOrOwner(organisationSlug);
  setTenantOrganisationId(ctx.organisationId);

  const createKey = `invitation-create:${ctx.userId}`;
  const { allowed } = await rateLimit(createKey, 10, 60_000);
  if (!allowed) {
    return { success: false as const, error: "Too many invitation attempts. Please wait a minute and try again." };
  }
  // Display-name enrichment only — resolveOrganisationAdminOrOwner() above already
  // performed the real authorization check (it calls requireCoachAccess() internally),
  // so this is a plain session read, not a second authorization decision (ARR-0008).
  const session = await auth();
  const inviterName = session?.user?.name || ctx.userEmail;

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
    logger.error({ err }, "[invitation] Immediate send failed, will retry via cron");
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
  const { allowed } = await rateLimit(tokenKey, 10, 60_000);
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
  setTenantOrganisationId(ctx.organisationId);

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
    logger.error({ err }, "[invitation] Failed to cancel notification on revoke");
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
  const { allowed } = await rateLimit(tokenKey, 10, 60_000);
  if (!allowed) {
    return { success: false as const, error: "Too many attempts. Please wait a minute and try again." };
  }

  const result = await declineInvitation({ token: token.trim(), userId: coachId, userEmail: coachEmail });

  if (!result.success) {
    logOrganisationInvitationDecline(coachEmail, "", "failure", result.error);
    return { success: false as const, error: result.error };
  }

  logOrganisationInvitationDecline(coachEmail, result.invitationId, "success");

  cancelNotificationByIdempotencyKey(`invitation-${result.invitationId}`).catch((err) => {
    logger.error({ err }, "[invitation] Failed to cancel notification on decline");
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
  setTenantOrganisationId(ctx.organisationId);

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

export async function removeMemberAction(
  organisationSlug: string,
  membershipId: string,
) {
  const ctx = await resolveOrganisationAdminOrOwner(organisationSlug);
  setTenantOrganisationId(ctx.organisationId);

  if (!membershipId?.trim()) {
    return { success: false as const, error: "Membership ID is required." };
  }

  if (ctx.userId === membershipId.trim()) {
    return { success: false as const, error: "You cannot remove yourself. Transfer ownership first or contact support." };
  }

  const membership = await db.organisationMembership.findFirst({
    where: { id: membershipId.trim(), organisationId: ctx.organisationId },
    select: { id: true, userId: true, role: true },
  });

  if (!membership) {
    logOrganisationMembershipRemove(ctx.userEmail, ctx.organisationId, "failure", "membership_not_found");
    return { success: false as const, error: "Membership not found in this organisation." };
  }

  if (membership.role === "OWNER") {
    logOrganisationMembershipRemove(ctx.userEmail, ctx.organisationId, "failure", "cannot_remove_owner");
    return { success: false as const, error: "Cannot remove the organisation owner. Transfer ownership first." };
  }

  if (membership.role === "ADMIN" && ctx.role !== "OWNER") {
    logOrganisationMembershipRemove(ctx.userEmail, ctx.organisationId, "failure", "cannot_remove_admin");
    return { success: false as const, error: "Only the owner can remove an admin." };
  }

  await db.organisationMembership.delete({
    where: { id: membership.id },
  });

  logOrganisationMembershipRemove(ctx.userEmail, ctx.organisationId, "success", `${membership.role} member removed`);
  revalidatePath(`/o/${organisationSlug}`);

  return { success: true as const };
}

export async function suspendOrganisationAction(organisationSlug: string, reason: string) {
  const ctx = await resolveOrganisationOwner(organisationSlug);
  setTenantOrganisationId(ctx.organisationId);

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
  setTenantOrganisationId(ctx.organisationId);

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
  setTenantOrganisationId(ctx.organisationId);

  const result = await deleteOrganisation(ctx.organisationId);

  if (!result.success) {
    return { success: false as const, error: result.error };
  }

  revalidatePath("/organisations");

  return { success: true as const };
}