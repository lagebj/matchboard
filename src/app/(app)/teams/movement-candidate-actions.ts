'use server'

import { revalidatePath } from "next/cache";
import { requireCoachAccess } from "@/lib/auth";
import {
  createMovementCandidate,
  updateMovementCandidate,
  deleteMovementCandidate,
  type CreateMovementCandidateInput,
  type UpdateMovementCandidateInput,
} from "@/lib/selection/movement-candidate";
import type { MovementCandidateRole, MovementCandidateRationale } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { resolveOrgFilterForUser, type OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";

const VALID_ROLES = new Set<string>(["SUPPORT", "DEVELOPMENT"]);
const VALID_RATIONALES = new Set<string>([
  "CHALLENGE_EXPOSURE",
  "CONFIDENCE_AND_INVOLVEMENT",
  "STABILISE_TEAM_FUNCTION",
  "SUPPORT_TEAMMATES",
  "POSITIONAL_LEARNING",
  "RESET_AND_RESPONSIBILITY",
  "COACH_JUDGEMENT",
]);
const VALID_STATUSES = new Set<string>(["ACTIVE", "PAUSED"]);

async function requireRotationPathOrgAccess(rotationPathId: string, orgFilter: OrgFilterMode): Promise<void> {
  if (orgFilter.type !== "org") return;
  const path = await db.rotationPath.findFirst({
    where: { id: rotationPathId, ...orgFilter.filter },
    select: { id: true },
  });
  if (!path) throw new Error("Rotation path not found or access denied.");
}

async function requireCandidateOrgAccess(candidateId: string, orgFilter: OrgFilterMode): Promise<void> {
  if (orgFilter.type !== "org") return;
  const candidate = await db.movementCandidate.findFirst({
    where: { id: candidateId, ...orgFilter.filter },
    select: { id: true },
  });
  if (!candidate) throw new Error("Movement candidate not found or access denied.");
}

export async function createMovementCandidateAction(formData: FormData) {
  const coach = await requireCoachAccess();
  const orgFilter = await resolveOrgFilterForUser(coach.id ?? "");

  const playerId = (formData.get("playerId") as string)?.trim() ?? "";
  const rotationPathId = (formData.get("rotationPathId") as string)?.trim() ?? "";
  const role = (formData.get("role") as string)?.trim() ?? "";
  const rationaleCategory = (formData.get("rationaleCategory") as string)?.trim() ?? "";
  const rationaleNote = (formData.get("rationaleNote") as string)?.trim() || null;
  const reviewByStr = (formData.get("reviewBy") as string)?.trim() || null;

  if (!playerId) throw new Error("Player is required.");
  if (!rotationPathId) throw new Error("Rotation path is required.");
  if (!role || !VALID_ROLES.has(role)) throw new Error("Valid role is required (SUPPORT or DEVELOPMENT).");
  if (!rationaleCategory || !VALID_RATIONALES.has(rationaleCategory)) throw new Error("Valid rationale category is required.");

  await requireRotationPathOrgAccess(rotationPathId, orgFilter);

  let reviewBy: Date | null = null;
  if (reviewByStr) {
    const parsed = new Date(reviewByStr);
    if (isNaN(parsed.getTime())) throw new Error("Invalid review-by date.");
    reviewBy = parsed;
  }

  const input: CreateMovementCandidateInput = {
    playerId,
    rotationPathId,
    role: role as MovementCandidateRole,
    rationaleCategory: rationaleCategory as MovementCandidateRationale,
    rationaleNote,
    reviewBy,
    ...(orgFilter.type === "org" ? { organisationId: orgFilter.organisationId } : {}),
  };

  const result = await createMovementCandidate(input);

  if (!result.success) {
    throw new Error(result.error);
  }

  revalidatePath("/teams");
}

export async function updateMovementCandidateAction(candidateId: string, formData: FormData) {
  const coach = await requireCoachAccess();
  const orgFilter = await resolveOrgFilterForUser(coach.id ?? "");

  await requireCandidateOrgAccess(candidateId, orgFilter);

  const status = (formData.get("status") as string)?.trim() || undefined;
  const rationaleCategory = (formData.get("rationaleCategory") as string)?.trim() || undefined;
  const rationaleNote = (formData.get("rationaleNote") as string)?.trim();
  const reviewByStr = (formData.get("reviewBy") as string)?.trim() || null;

  if (status && !VALID_STATUSES.has(status)) throw new Error("Invalid status.");
  if (rationaleCategory && !VALID_RATIONALES.has(rationaleCategory)) throw new Error("Invalid rationale category.");

  let reviewBy: Date | null | undefined = undefined;
  if (reviewByStr) {
    const parsed = new Date(reviewByStr);
    if (isNaN(parsed.getTime())) throw new Error("Invalid review-by date.");
    reviewBy = parsed;
  } else if (formData.has("reviewBy") && reviewByStr === "") {
    reviewBy = null;
  }

  const input: UpdateMovementCandidateInput = {};
  if (status) input.status = status as "ACTIVE" | "PAUSED";
  if (rationaleCategory) input.rationaleCategory = rationaleCategory as MovementCandidateRationale;
  if (rationaleNote !== undefined) input.rationaleNote = rationaleNote || null;
  if (reviewBy !== undefined) input.reviewBy = reviewBy;

  const result = await updateMovementCandidate(candidateId, input);

  if (!result.success) {
    throw new Error(result.error);
  }

  revalidatePath("/teams");
}

export async function toggleMovementCandidateStatusAction(candidateId: string, targetStatus: "ACTIVE" | "PAUSED") {
  const coach = await requireCoachAccess();
  const orgFilter = await resolveOrgFilterForUser(coach.id ?? "");

  await requireCandidateOrgAccess(candidateId, orgFilter);

  if (!VALID_STATUSES.has(targetStatus)) throw new Error("Invalid status.");

  const result = await updateMovementCandidate(candidateId, { status: targetStatus });

  if (!result.success) {
    throw new Error(result.error);
  }

  revalidatePath("/teams");
}

export async function deleteMovementCandidateAction(candidateId: string) {
  const coach = await requireCoachAccess();
  const orgFilter = await resolveOrgFilterForUser(coach.id ?? "");

  await requireCandidateOrgAccess(candidateId, orgFilter);

  const result = await deleteMovementCandidate(candidateId);

  if (!result.success) {
    throw new Error(result.error);
  }

  revalidatePath("/teams");
}