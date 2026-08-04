import { db } from "@/lib/db";
import type { PrismaClient } from "@/generated/prisma/client";
import type { OrganisationRole } from "@/generated/prisma/client";

export type OrganisationMutationResult =
  | { success: true; id: string }
  | { success: false; error: string };

export type MembershipResult =
  | { success: true; membershipId: string }
  | { success: false; error: string };

const VALID_ROLES: OrganisationRole[] = ["OWNER", "ADMIN", "COACH", "VIEWER", "SUPPORT"];

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
  if (targetRole === "SUPPORT") return false;
  if (actorRole === "OWNER") return true;
  if (actorRole === "ADMIN") return targetRole === "COACH" || targetRole === "VIEWER";
  return false;
}

export function canManageRole(actorRole: OrganisationRole, targetRole: OrganisationRole): boolean {
  if (targetRole === "SUPPORT") return actorRole === "OWNER";
  if (actorRole === "OWNER") return true;
  if (actorRole === "ADMIN") return targetRole !== "OWNER" && targetRole !== "ADMIN";
  return false;
}

export function canCreateTeam(role: OrganisationRole): boolean {
  if (role === "SUPPORT") return false;
  return role === "OWNER" || role === "ADMIN";
}

export function canManageMemberships(role: OrganisationRole): boolean {
  if (role === "SUPPORT") return false;
  return role === "OWNER" || role === "ADMIN";
}

export function canDeleteOrganisation(role: OrganisationRole): boolean {
  if (role === "SUPPORT") return false;
  return role === "OWNER";
}

export function canTransferOwnership(role: OrganisationRole): boolean {
  if (role === "SUPPORT") return false;
  return role === "OWNER";
}

export function canAccessAllTeams(role: OrganisationRole): boolean {
  if (role === "SUPPORT") return false;
  return role === "OWNER" || role === "ADMIN";
}

export async function createOrganisation(data: {
  name: string;
  slug: string;
  ownerUserId: string;
}, client: PrismaClient = db): Promise<OrganisationMutationResult> {
  const existingSlug = await client.organisation.findUnique({
    where: { slug: data.slug },
    select: { id: true },
  });

  if (existingSlug) {
    return { success: false, error: "An organisation with this slug already exists." };
  }

  const organisation = await client.organisation.create({
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
          groupAccesses: { include: { group: { select: { id: true, name: true, slug: true } } } },
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
      groupAccesses: { include: { group: { select: { id: true, name: true, slug: true } } } },
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

export async function generateOrganisationSlug(name: string, client: PrismaClient = db): Promise<string> {
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
    const existing = await client.organisation.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!existing) return slug;

    suffix++;
    slug = `${baseSlug}-${suffix}`;
  }
}