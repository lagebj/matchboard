'use server'

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireActorContext, requireMutationRole, requireTeamAccess } from "@/lib/auth/actor-context";
import { buildPathWithSearch } from "@/lib/build-path-with-search";
import { getRules } from "@/lib/rules/get-rules";

function readText(formData: FormData, fieldName: string): string {
  const value = formData.get(fieldName);

  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function readRequiredInteger(formData: FormData, fieldName: string): number {
  const value = readText(formData, fieldName);
  const parsedValue = Number.parseInt(value, 10);

  if (!Number.isInteger(parsedValue) || parsedValue < 0) {
    throw new Error(`${fieldName} must be a whole number greater than or equal to 0.`);
  }

  return parsedValue;
}

function readOptionalInt(formData: FormData, fieldName: string): number | null {
  const value = readText(formData, fieldName);
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : null;
}

function readOptionalBool(formData: FormData, fieldName: string): boolean {
  return formData.get(fieldName) === "on";
}

type ActionState = { error: string };

const VALID_ROLES = ["SUPPORT", "DEVELOPMENT", "BACKFILL"] as const;
type RotationPathRole = typeof VALID_ROLES[number];

function validateRole(role: string): RotationPathRole {
  if (!VALID_ROLES.includes(role as RotationPathRole)) {
    throw new Error(`Role must be one of: ${VALID_ROLES.join(", ")}.`);
  }
  return role as RotationPathRole;
}

export async function saveRulesAction(formData: FormData) {
  const ctx = await requireActorContext();
  requireMutationRole(ctx);
  try {
    const rules = await getRules();

    if (ctx.orgFilter.type === "org" && rules.organisationId !== ctx.orgFilter.organisationId) {
      throw new Error("Rule configuration not found or access denied.");
    }

    await db.ruleConfig.update({
      where: { id: rules.id },
      data: {
        minDaysBetweenAnyMatches: readRequiredInteger(formData, "minDaysBetweenAnyMatches"),
        warningThreshold: readRequiredInteger(formData, "warningThreshold"),
      },
    });
  } catch (error) {
    redirect(
      buildPathWithSearch("/rules", {
        error: error instanceof Error ? error.message : "Could not save the rule configuration.",
      }),
    );
  }

  revalidatePath("/rules");
  redirect(
    buildPathWithSearch("/rules", {
      saved: "1",
    }),
  );
}

export async function createRotationPathAction(prevState: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireActorContext();
  requireMutationRole(ctx);
  try {
    const fromTeamId = readText(formData, "fromTeamId");
    const toTeamId = readText(formData, "toTeamId");
    const roleRaw = readText(formData, "role");
    const purpose = readText(formData, "purpose");
    const priority = readOptionalInt(formData, "priority");
    const minimumCount = readOptionalInt(formData, "minimumCount");
    const targetCount = readOptionalInt(formData, "targetCount");
    const maximumCount = readOptionalInt(formData, "maximumCount");
    const cooldownRounds = readOptionalInt(formData, "cooldownRounds");
    const allowDoubleLoad = readOptionalBool(formData, "allowDoubleLoad");
    const minRestSpacingHours = readOptionalInt(formData, "minRestSpacingHours");
    const maxDoubleLoadsPerPeriod = readOptionalInt(formData, "maxDoubleLoadsPerPeriod");

    if (!fromTeamId) throw new Error("Source team is required.");
    if (!toTeamId) throw new Error("Target team is required.");
    if (!roleRaw) throw new Error("Role is required.");

    const role = validateRole(roleRaw);

    if (fromTeamId === toTeamId) {
      throw new Error("Source and target team must be different.");
    }

    const [fromTeam, toTeam] = await Promise.all([
      db.team.findUnique({ where: { id: fromTeamId, archivedAt: null } }),
      db.team.findUnique({ where: { id: toTeamId, archivedAt: null } }),
    ]);

    if (!fromTeam) throw new Error("Source team not found.");
    if (!toTeam) throw new Error("Target team not found.");

    requireTeamAccess(ctx, fromTeamId);
    requireTeamAccess(ctx, toTeamId);

    if (ctx.orgFilter.type === "org") {
      if (fromTeam.organisationId !== ctx.orgFilter.organisationId || toTeam.organisationId !== ctx.orgFilter.organisationId) {
        throw new Error("Source or target team not found or access denied.");
      }
    }

    const existing = await db.rotationPath.findFirst({
      where: { fromTeamId, toTeamId, role },
    });

    if (existing) {
      throw new Error(`A ${role} path from ${fromTeam.name} to ${toTeam.name} already exists.`);
    }

    await db.rotationPath.create({
      data: {
        fromTeamId,
        toTeamId,
        role,
        purpose: purpose || `${role} path`,
        minimumCount,
        targetCount,
        maximumCount,
        cooldownRounds,
        priority,
        allowDoubleLoad,
        minRestSpacingHours,
        maxDoubleLoadsPerPeriod,
        ...(ctx.orgFilter.type === "org" ? { organisationId: ctx.orgFilter.organisationId } : {}),
      },
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not create rotation path." };
  }

  const fromTeamId = readText(formData, "fromTeamId");
  const toTeamId = readText(formData, "toTeamId");

  revalidatePath("/rules");
  revalidatePath(`/teams/${fromTeamId}`);
  revalidatePath(`/teams/${toTeamId}`);

  const teamId = readText(formData, "redirectTeamId") || toTeamId;
  redirect(buildPathWithSearch(`/teams/${teamId}`, { saved: "rotation-path-created" }));
}

export async function updateRotationPathAction(prevState: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireActorContext();
  requireMutationRole(ctx);
  try {
    const pathId = readText(formData, "pathId");
    if (!pathId) throw new Error("Rotation path ID is required.");

    const existingPath = await db.rotationPath.findUnique({ where: { id: pathId } });
    if (!existingPath) throw new Error("Rotation path not found.");

    if (ctx.orgFilter.type === "org" && existingPath.organisationId !== ctx.orgFilter.organisationId) {
      throw new Error("Rotation path not found or access denied.");
    }

    requireTeamAccess(ctx, existingPath.fromTeamId);
    requireTeamAccess(ctx, existingPath.toTeamId);

    const purpose = readText(formData, "purpose");
    const priority = readOptionalInt(formData, "priority");
    const minimumCount = readOptionalInt(formData, "minimumCount");
    const targetCount = readOptionalInt(formData, "targetCount");
    const maximumCount = readOptionalInt(formData, "maximumCount");
    const cooldownRounds = readOptionalInt(formData, "cooldownRounds");
    const allowDoubleLoad = readOptionalBool(formData, "allowDoubleLoad");
    const minRestSpacingHours = readOptionalInt(formData, "minRestSpacingHours");
    const maxDoubleLoadsPerPeriod = readOptionalInt(formData, "maxDoubleLoadsPerPeriod");
    const active = formData.get("active") === "on";

    await db.rotationPath.update({
      where: { id: pathId },
      data: {
        purpose: purpose || existingPath.purpose,
        priority,
        minimumCount,
        targetCount,
        maximumCount,
        cooldownRounds,
        allowDoubleLoad,
        minRestSpacingHours,
        maxDoubleLoadsPerPeriod,
        active,
      },
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not update rotation path." };
  }

  const fromTeamId = readText(formData, "fromTeamId");
  const toTeamId = readText(formData, "toTeamId");

  revalidatePath("/rules");
  revalidatePath(`/teams/${fromTeamId}`);
  revalidatePath(`/teams/${toTeamId}`);

  const teamId = readText(formData, "redirectTeamId") || fromTeamId;
  redirect(buildPathWithSearch(`/teams/${teamId}`, { saved: "rotation-path-updated" }));
}

export async function deleteRotationPathAction(prevState: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireActorContext();
  requireMutationRole(ctx);
  try {
    const pathId = readText(formData, "pathId");
    if (!pathId) throw new Error("Rotation path ID is required.");

    const existingPath = await db.rotationPath.findUnique({
      where: { id: pathId },
      select: { id: true, fromTeamId: true, toTeamId: true, organisationId: true },
    });

    if (!existingPath) throw new Error("Rotation path not found.");

    if (ctx.orgFilter.type === "org" && existingPath.organisationId !== ctx.orgFilter.organisationId) {
      throw new Error("Rotation path not found or access denied.");
    }

    requireTeamAccess(ctx, existingPath.fromTeamId);
    requireTeamAccess(ctx, existingPath.toTeamId);

    await db.rotationPath.delete({ where: { id: pathId } });

    revalidatePath("/rules");
    revalidatePath(`/teams/${existingPath.fromTeamId}`);
    revalidatePath(`/teams/${existingPath.toTeamId}`);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not delete rotation path." };
  }

  const teamId = readText(formData, "redirectTeamId");
  redirect(buildPathWithSearch(`/teams/${teamId}`, { saved: "rotation-path-deleted" }));
}

export async function toggleRotationPathActiveAction(prevState: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireActorContext();
  requireMutationRole(ctx);
  try {
    const pathId = readText(formData, "pathId");
    if (!pathId) throw new Error("Rotation path ID is required.");

    const existingPath = await db.rotationPath.findUnique({
      where: { id: pathId },
      select: { id: true, active: true, fromTeamId: true, toTeamId: true, organisationId: true },
    });

    if (!existingPath) throw new Error("Rotation path not found.");

    if (ctx.orgFilter.type === "org" && existingPath.organisationId !== ctx.orgFilter.organisationId) {
      throw new Error("Rotation path not found or access denied.");
    }

    requireTeamAccess(ctx, existingPath.fromTeamId);
    requireTeamAccess(ctx, existingPath.toTeamId);

    await db.rotationPath.update({
      where: { id: pathId },
      data: { active: !existingPath.active },
    });

    revalidatePath("/rules");
    revalidatePath(`/teams/${existingPath.fromTeamId}`);
    revalidatePath(`/teams/${existingPath.toTeamId}`);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not toggle rotation path." };
  }

  const teamId = readText(formData, "redirectTeamId");
  redirect(buildPathWithSearch(`/teams/${teamId}`, { saved: "rotation-path-toggled" }));
}