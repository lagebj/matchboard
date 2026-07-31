import { db } from "@/lib/db";
import type { PrismaClient } from "@/generated/prisma/client";

export interface SuspendOrganisationResult {
  success: boolean;
  error?: string;
}

export interface ReactivateOrganisationResult {
  success: boolean;
  error?: string;
}

export interface DeleteOrganisationResult {
  success: boolean;
  error?: string;
}

export async function suspendOrganisation(
  organisationId: string,
  reason: string,
  client: PrismaClient = db,
): Promise<SuspendOrganisationResult> {
  if (!reason?.trim()) {
    return { success: false, error: "Suspension reason is required." };
  }

  const org = await client.organisation.findUnique({
    where: { id: organisationId },
    select: { id: true, suspendedAt: true },
  });

  if (!org) {
    return { success: false, error: "Organisation not found." };
  }

  if (org.suspendedAt) {
    return { success: false, error: "Organisation is already suspended." };
  }

  await client.organisation.update({
    where: { id: organisationId },
    data: {
      suspendedAt: new Date(),
      suspendedReason: reason.trim(),
    },
  });

  return { success: true };
}

export async function reactivateOrganisation(
  organisationId: string,
  client: PrismaClient = db,
): Promise<ReactivateOrganisationResult> {
  const org = await client.organisation.findUnique({
    where: { id: organisationId },
    select: { id: true, suspendedAt: true },
  });

  if (!org) {
    return { success: false, error: "Organisation not found." };
  }

  if (!org.suspendedAt) {
    return { success: false, error: "Organisation is not suspended." };
  }

  await client.organisation.update({
    where: { id: organisationId },
    data: {
      suspendedAt: null,
      suspendedReason: null,
    },
  });

  return { success: true };
}

export async function isOrganisationSuspended(
  organisationId: string,
  client: PrismaClient = db,
): Promise<boolean> {
  const org = await client.organisation.findUnique({
    where: { id: organisationId },
    select: { suspendedAt: true },
  });

  return org?.suspendedAt !== null && org?.suspendedAt !== undefined;
}

export async function deleteOrganisation(
  organisationId: string,
  client: PrismaClient = db,
): Promise<DeleteOrganisationResult> {
  const org = await client.organisation.findUnique({
    where: { id: organisationId },
    select: {
      id: true,
      suspendedAt: true,
      isSynthetic: true,
      _count: {
        select: {
          memberships: true,
          teams: true,
          players: true,
        },
      },
    },
  });

  if (!org) {
    return { success: false, error: "Organisation not found." };
  }

  if (!org.suspendedAt && !org.isSynthetic) {
    return { success: false, error: "Organisation must be suspended before deletion." };
  }

  await client.organisation.delete({
    where: { id: organisationId },
  });

  return { success: true };
}