import { db } from "@/lib/db";
import type { OrganisationRole } from "@/generated/prisma/client";

export type OrganisationMutationResult =
  | { success: true; id: string }
  | { success: false; error: string };

export type MembershipResult =
  | { success: true; membershipId: string }
  | { success: false; error: string };

const VALID_ROLES: OrganisationRole[] = ["OWNER", "ADMIN", "COACH", "VIEWER"];

export function isValidOrganisationRole(role: string): role is OrganisationRole {
  return VALID_ROLES.includes(role as OrganisationRole);
}

export function requireValidOrganisationRole(role: string): OrganisationRole {
  if (!isValidOrganisationRole(role)) {
    throw new Error(`Invalid organisation role: ${role}`);
  }
  return role as OrganisationRole;
}

export function canInviteRole(actorRole: OrganisationRole, targetRole: OrganisationRole): boolean {
  if (actorRole === "OWNER") return true;
  if (actorRole === "ADMIN") return targetRole === "COACH" || targetRole === "VIEWER";
  return false;
}

export function canManageRole(actorRole: OrganisationRole, targetRole: OrganisationRole): boolean {
  if (actorRole === "OWNER") return true;
  if (actorRole === "ADMIN") return targetRole !== "OWNER" && targetRole !== "ADMIN";
  return false;
}

export function canCreateTeam(role: OrganisationRole): boolean {
  return role === "OWNER" || role === "ADMIN";
}

export function canManageMemberships(role: OrganisationRole): boolean {
  return role === "OWNER" || role === "ADMIN";
}

export function canDeleteOrganisation(role: OrganisationRole): boolean {
  return role === "OWNER";
}

export function canTransferOwnership(role: OrganisationRole): boolean {
  return role === "OWNER";
}

export function canAccessAllTeams(role: OrganisationRole): boolean {
  return role === "OWNER" || role === "ADMIN";
}

export async function createOrganisation(data: {
  name: string;
  slug: string;
  ownerUserId: string;
}): Promise<OrganisationMutationResult> {
  const existingSlug = await db.organisation.findUnique({
    where: { slug: data.slug },
    select: { id: true },
  });

  if (existingSlug) {
    return { success: false, error: "An organisation with this slug already exists." };
  }

  const organisation = await db.organisation.create({
    data: {
      name: data.name,
      slug: data.slug,
      memberships: {
        create: {
          userId: data.ownerUserId,
          role: "OWNER",
        },
      },
    },
  });

  return { success: true, id: organisation.id };
}

export async function getOrganisationBySlug(slug: string) {
  return db.organisation.findUnique({
    where: { slug },
    include: {
      memberships: {
        include: {
          user: { select: { id: true, email: true, name: true, image: true } },
          teamAccesses: { include: { team: { select: { id: true, name: true } } } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

export async function getOrganisationMembership(userId: string, organisationId: string) {
  return db.organisationMembership.findUnique({
    where: { userId_organisationId: { userId, organisationId } },
    include: {
      teamAccesses: { include: { team: { select: { id: true, name: true } } } },
    },
  });
}

export async function getUserOrganisations(userId: string) {
  return db.organisationMembership.findMany({
    where: { userId },
    include: {
      organisation: { select: { id: true, name: true, slug: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function addTeamAccess(
  membershipId: string,
  teamId: string,
): Promise<MembershipResult> {
  const membership = await db.organisationMembership.findUnique({
    where: { id: membershipId },
    select: { role: true, organisationId: true },
  });

  if (!membership) {
    return { success: false, error: "Membership not found." };
  }

  const team = await db.team.findFirst({
    where: { id: teamId, organisationId: membership.organisationId },
    select: { id: true },
  });

  if (!team) {
    return { success: false, error: "Team not found in this organisation." };
  }

  if (membership.role !== "COACH" && membership.role !== "VIEWER") {
    return { success: false, error: "Team access is only for COACH and VIEWER roles." };
  }

  const teamAccess = await db.teamAccess.upsert({
    where: { membershipId_teamId: { membershipId, teamId } },
    update: {},
    create: { membershipId, teamId },
  });

  return { success: true, membershipId: teamAccess.membershipId };
}

export async function removeTeamAccess(
  membershipId: string,
  teamId: string,
): Promise<MembershipResult> {
  await db.teamAccess.deleteMany({
    where: { membershipId, teamId },
  });

  return { success: true, membershipId };
}

export async function generateOrganisationSlug(name: string): Promise<string> {
  const baseSlug = name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/--+/g, "-")
    .replace(/^-+|-+$/g, "");

  let slug = baseSlug;
  let suffix = 1;

  while (true) {
    const existing = await db.organisation.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!existing) return slug;

    suffix++;
    slug = `${baseSlug}-${suffix}`;
  }
}