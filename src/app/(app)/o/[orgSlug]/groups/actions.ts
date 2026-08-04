'use server'

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireActorContext, requireMutationRole } from "@/lib/auth/actor-context";
import { resolveGroupContext, requireGroupMutationRole } from "@/lib/auth/group-context";
import {
  createFootballGroup,
  updateFootballGroup,
  deactivateFootballGroup,
  addPlayerToGroup,
  removePlayerFromGroup,
  transferPlayerBetweenGroups,
  addGroupAccess,
  removeGroupAccess,
  listGroupsForOrganisation,
  getGroupWithDetails,
} from "@/lib/groups/group-domain";
import {
  createGroupMovementPath,
  deactivateGroupMovementPath,
  reactivateGroupMovementPath,
  listGroupMovementPaths,
  getGroupMovementPath,
} from "@/lib/groups/group-movement-path";
import type { FootballGroupType, GroupAccessRole } from "@/generated/prisma/client";

const VALID_GROUP_TYPES: Set<string> = new Set(["AGE_GROUP", "GENDER_GROUP", "COMPETITIVE_GROUP", "CUSTOM"]);
const VALID_GROUP_ACCESS_ROLES: Set<string> = new Set(["GROUP_COACH", "GROUP_VIEWER"]);

export async function createGroupAction(formData: FormData) {
  const ctx = await requireActorContext();
  requireMutationRole(ctx);

  const name = formData.get("name") as string | null;
  const type = formData.get("type") as string | null;
  const cohortYear = formData.get("cohortYear") as string | null;
  const description = formData.get("description") as string | null;

  if (!name || name.trim().length === 0) {
    redirect(`/o/${ctx.organisationSlug}/groups?error=Group+name+is+required`);
  }

  if (!type || !VALID_GROUP_TYPES.has(type)) {
    redirect(`/o/${ctx.organisationSlug}/groups?error=Invalid+group+type`);
  }

  const parsedCohortYear = cohortYear ? parseInt(cohortYear, 10) : undefined;
  if (cohortYear && (isNaN(parsedCohortYear!) || parsedCohortYear! < 2000 || parsedCohortYear! > 2100)) {
    redirect(`/o/${ctx.organisationSlug}/groups?error=Invalid+cohort+year`);
  }

  const result = await createFootballGroup({
    name: name.trim(),
    type: type as FootballGroupType,
    cohortYear: parsedCohortYear,
    description: description?.trim() || undefined,
    organisationId: ctx.organisationId,
  });

  if (!result.success) {
    redirect(`/o/${ctx.organisationSlug}/groups?error=${encodeURIComponent(result.error)}`);
  }

  revalidatePath(`/o/${ctx.organisationSlug}/groups`);
  redirect(`/o/${ctx.organisationSlug}/groups/${result.groupId}`);
}

export async function updateGroupAction(groupId: string, formData: FormData) {
  const ctx = await requireActorContext();
  requireMutationRole(ctx);

  await resolveGroupContext(ctx.organisationId, groupId, ctx.membershipId, ctx.role);

  const name = formData.get("name") as string | null;
  const type = formData.get("type") as string | null;
  const cohortYear = formData.get("cohortYear") as string | null;
  const description = formData.get("description") as string | null;

  if (name !== null && name.trim().length === 0) {
    redirect(`/o/${ctx.organisationSlug}/groups/${groupId}?error=Group+name+cannot+be+empty`);
  }

  const parsedCohortYear = cohortYear === "" ? null : cohortYear ? parseInt(cohortYear, 10) : undefined;
  if (cohortYear && cohortYear !== "" && (isNaN(parsedCohortYear as number) || (parsedCohortYear as number) < 2000 || (parsedCohortYear as number) > 2100)) {
    redirect(`/o/${ctx.organisationSlug}/groups/${groupId}?error=Invalid+cohort+year`);
  }

  const result = await updateFootballGroup(groupId, {
    name: name?.trim() || undefined,
    type: (type && VALID_GROUP_TYPES.has(type) ? type : undefined) as FootballGroupType | undefined,
    cohortYear: parsedCohortYear,
    description: description === null ? undefined : description?.trim(),
  }, ctx.organisationId);

  if (!result.success) {
    redirect(`/o/${ctx.organisationSlug}/groups/${groupId}?error=${encodeURIComponent(result.error)}`);
  }

  revalidatePath(`/o/${ctx.organisationSlug}/groups`);
  revalidatePath(`/o/${ctx.organisationSlug}/groups/${groupId}`);
  redirect(`/o/${ctx.organisationSlug}/groups/${groupId}`);
}

export async function deactivateGroupAction(groupId: string) {
  const ctx = await requireActorContext();
  requireMutationRole(ctx);

  await resolveGroupContext(ctx.organisationId, groupId, ctx.membershipId, ctx.role);

  const result = await deactivateFootballGroup(groupId, ctx.organisationId);

  if (!result.success) {
    redirect(`/o/${ctx.organisationSlug}/groups/${groupId}?error=${encodeURIComponent(result.error)}`);
  }

  revalidatePath(`/o/${ctx.organisationSlug}/groups`);
  redirect(`/o/${ctx.organisationSlug}/groups`);
}

export async function addPlayerToGroupAction(groupId: string, playerId: string, formData: FormData) {
  const ctx = await requireActorContext();
  requireMutationRole(ctx);

  const groupCtx = await resolveGroupContext(ctx.organisationId, groupId, ctx.membershipId, ctx.role);
  requireGroupMutationRole(groupCtx);

  const membershipType = (formData.get("membershipType") as string) || "PRIMARY";
  const coreTeamId = (formData.get("coreTeamId") as string) || undefined;

  const result = await addPlayerToGroup(playerId, groupId, ctx.organisationId, {
    membershipType: membershipType as "PRIMARY" | "SECONDARY" | "TEMPORARY",
    coreTeamId,
  });

  if (!result.success) {
    return { success: false as const, error: result.error };
  }

  revalidatePath(`/o/${ctx.organisationSlug}/groups/${groupId}`);
  return { success: true as const };
}

export async function removePlayerFromGroupAction(groupId: string, playerId: string) {
  const ctx = await requireActorContext();
  requireMutationRole(ctx);

  const groupCtx = await resolveGroupContext(ctx.organisationId, groupId, ctx.membershipId, ctx.role);
  requireGroupMutationRole(groupCtx);

  const result = await removePlayerFromGroup(playerId, groupId, ctx.organisationId);

  if (!result.success) {
    return { success: false as const, error: result.error };
  }

  revalidatePath(`/o/${ctx.organisationSlug}/groups/${groupId}`);
  return { success: true as const };
}

export async function transferPlayerAction(
  playerId: string,
  sourceGroupId: string,
  targetGroupId: string,
  formData: FormData,
) {
  const ctx = await requireActorContext();
  requireMutationRole(ctx);

  await resolveGroupContext(ctx.organisationId, sourceGroupId, ctx.membershipId, ctx.role);
  await resolveGroupContext(ctx.organisationId, targetGroupId, ctx.membershipId, ctx.role);

  const coreTeamId = (formData.get("coreTeamId") as string) || undefined;

  const result = await transferPlayerBetweenGroups(playerId, sourceGroupId, targetGroupId, ctx.organisationId, {
    coreTeamId,
  });

  if (!result.success) {
    return { success: false as const, error: result.error };
  }

  revalidatePath(`/o/${ctx.organisationSlug}/groups/${sourceGroupId}`);
  revalidatePath(`/o/${ctx.organisationSlug}/groups/${targetGroupId}`);
  return { success: true as const };
}

export async function addGroupAccessAction(groupId: string, membershipId: string, role: string) {
  const ctx = await requireActorContext();
  requireMutationRole(ctx);

  const groupCtx = await resolveGroupContext(ctx.organisationId, groupId, ctx.membershipId, ctx.role);
  requireGroupMutationRole(groupCtx);

  if (!VALID_GROUP_ACCESS_ROLES.has(role)) {
    return { success: false as const, error: "Invalid group access role." };
  }

  const result = await addGroupAccess(membershipId, groupId, role as GroupAccessRole);

  if (!result.success) {
    return { success: false as const, error: result.error };
  }

  revalidatePath(`/o/${ctx.organisationSlug}/groups/${groupId}`);
  return { success: true as const, accessId: result.success ? (result as { success: true; accessId: string }).accessId : undefined };
}

export async function removeGroupAccessAction(groupId: string, membershipId: string) {
  const ctx = await requireActorContext();
  requireMutationRole(ctx);

  const groupCtx = await resolveGroupContext(ctx.organisationId, groupId, ctx.membershipId, ctx.role);
  requireGroupMutationRole(groupCtx);

  const result = await removeGroupAccess(membershipId, groupId);

  if (!result.success) {
    return { success: false as const, error: result.error };
  }

  revalidatePath(`/o/${ctx.organisationSlug}/groups/${groupId}`);
  return { success: true as const };
}

export async function listGroupsAction() {
  const ctx = await requireActorContext();
  return listGroupsForOrganisation(ctx.organisationId);
}

export async function getGroupDetailAction(groupId: string) {
  const ctx = await requireActorContext();
  await resolveGroupContext(ctx.organisationId, groupId, ctx.membershipId, ctx.role);
  return getGroupWithDetails(groupId, ctx.organisationId);
}

export async function createGroupMovementPathAction(
  fromGroupId: string,
  toGroupId: string,
  role: string,
  scope: string = "MATCH",
) {
  const ctx = await requireActorContext();
  requireMutationRole(ctx);

  const VALID_ROLES = ["SUPPORT", "DEVELOPMENT", "CONFIDENCE_REBUILD", "BACKFILL"];
  const VALID_SCOPES = ["MATCH", "EVENT"];

  if (!VALID_ROLES.includes(role)) {
    return { success: false as const, error: "Invalid role." };
  }
  if (!VALID_SCOPES.includes(scope)) {
    return { success: false as const, error: "Invalid scope." };
  }

  const result = await createGroupMovementPath({
    organisationId: ctx.organisationId,
    fromGroupId,
    toGroupId,
    role: role as "SUPPORT" | "DEVELOPMENT" | "CONFIDENCE_REBUILD" | "BACKFILL",
    scope: scope as "MATCH" | "EVENT",
  });

  if (!result.success) {
    return { success: false as const, error: result.error! };
  }

  revalidatePath(`/o/${ctx.organisationSlug}/groups`);
  return { success: true as const, pathId: result.pathId };
}

export async function deactivateGroupMovementPathAction(pathId: string) {
  const ctx = await requireActorContext();
  requireMutationRole(ctx);

  const path = await getGroupMovementPath(pathId, ctx.organisationId);
  if (!path) {
    return { success: false as const, error: "Movement path not found." };
  }

  const result = await deactivateGroupMovementPath(pathId, ctx.organisationId);
  if (!result.success) {
    return { success: false as const, error: result.error! };
  }

  revalidatePath(`/o/${ctx.organisationSlug}/groups`);
  return { success: true as const };
}

export async function reactivateGroupMovementPathAction(pathId: string) {
  const ctx = await requireActorContext();
  requireMutationRole(ctx);

  const result = await reactivateGroupMovementPath(pathId, ctx.organisationId);
  if (!result.success) {
    return { success: false as const, error: result.error! };
  }

  revalidatePath(`/o/${ctx.organisationSlug}/groups`);
  return { success: true as const };
}

export async function listGroupMovementPathsAction(options?: {
  groupId?: string;
  activeOnly?: boolean;
  scope?: string;
}) {
  const ctx = await requireActorContext();

  return listGroupMovementPaths(ctx.organisationId, {
    groupId: options?.groupId,
    activeOnly: options?.activeOnly,
    scope: options?.scope as "MATCH" | "EVENT" | undefined,
  });
}