'use server'
 
import { revalidatePath } from "next/cache";
import {
  addPlayerToDraftMatch,
  removePlayerFromDraftMatch,
  changeDraftPlayerRole,
} from "@/lib/selection/manual-draft-edit";
import { SelectionRole } from "@/generated/prisma/client";
import { requireCoachAccess } from "@/lib/auth";
import type { OverrideReasonCategory } from "@/lib/selection/types";
import { OVERRIDE_REASON_CATEGORIES } from "@/lib/selection/types";
import { reconcileRoundAfterDraftMutation } from "@/lib/selection/reconcile-integrity";
import { movePlannedSelectionWithinRound } from "@/lib/selection/move-planned-selection";
import { logManualOverride } from "@/lib/security/audit-log";

async function reconcileAndRevalidate(matchRoundId: string) {
  try {
    await reconcileRoundAfterDraftMutation(matchRoundId);
  } catch {
    // reconciliation failure must not block the mutation
  }
  revalidatePath("/rounds");
  revalidatePath(`/rounds/${matchRoundId}`);
  revalidatePath("/fixtures");
  revalidatePath("/assistant");
}

export async function addPlayerToMatchAction(formData: FormData) {
  await requireCoachAccess();
  const matchId = formData.get("matchId");
  const playerId = formData.get("playerId");
  const role = formData.get("role");
  const overrideReasonCategory = formData.get("overrideReasonCategory");
  const overrideReasonDetail = formData.get("overrideReasonDetail");
  const matchRoundId = formData.get("matchRoundId");

  if (typeof matchId !== "string" || !matchId) throw new Error("Match ID is required.");
  if (typeof playerId !== "string" || !playerId) throw new Error("Player ID is required.");
  if (typeof role !== "string" || !role) throw new Error("Role is required.");

  const category = typeof overrideReasonCategory === "string" && OVERRIDE_REASON_CATEGORIES.includes(overrideReasonCategory as OverrideReasonCategory)
    ? (overrideReasonCategory as OverrideReasonCategory)
    : undefined;
  const detail = typeof overrideReasonDetail === "string" && overrideReasonDetail.trim() ? overrideReasonDetail.trim() : undefined;

  const result = await addPlayerToDraftMatch(matchId, playerId, role as SelectionRole, category, detail);

  if (result.success && category) {
    const coach = await requireCoachAccess();
    logManualOverride(coach.email ?? "unknown", "selection", `${matchId}:${playerId}`, category);
  }

  const roundId = typeof matchRoundId === "string" ? matchRoundId : "";
  if (roundId) await reconcileAndRevalidate(roundId);

  return result;
}

export async function removePlayerFromMatchAction(formData: FormData) {
  await requireCoachAccess();
  const matchId = formData.get("matchId");
  const playerId = formData.get("playerId");
  const matchRoundId = formData.get("matchRoundId");

  if (typeof matchId !== "string" || !matchId) throw new Error("Match ID is required.");
  if (typeof playerId !== "string" || !playerId) throw new Error("Player ID is required.");

  const result = await removePlayerFromDraftMatch(matchId, playerId);

  const roundId = typeof matchRoundId === "string" ? matchRoundId : "";
  if (roundId) await reconcileAndRevalidate(roundId);

  return result;
}

export async function changePlayerRoleAction(formData: FormData) {
  await requireCoachAccess();
  const matchId = formData.get("matchId");
  const playerId = formData.get("playerId");
  const role = formData.get("role");
  const overrideReasonCategory = formData.get("overrideReasonCategory");
  const overrideReasonDetail = formData.get("overrideReasonDetail");
  const matchRoundId = formData.get("matchRoundId");

  if (typeof matchId !== "string" || !matchId) throw new Error("Match ID is required.");
  if (typeof playerId !== "string" || !playerId) throw new Error("Player ID is required.");
  if (typeof role !== "string" || !role) throw new Error("Role is required.");

  const category = typeof overrideReasonCategory === "string" && OVERRIDE_REASON_CATEGORIES.includes(overrideReasonCategory as OverrideReasonCategory)
    ? (overrideReasonCategory as OverrideReasonCategory)
    : undefined;
  const detail = typeof overrideReasonDetail === "string" && overrideReasonDetail.trim() ? overrideReasonDetail.trim() : undefined;

  const result = await changeDraftPlayerRole(matchId, playerId, role as SelectionRole, category, detail);

  if (result.success && category) {
    const coach = await requireCoachAccess();
    logManualOverride(coach.email ?? "unknown", "selection_role", `${matchId}:${playerId}`, category);
  }

  const roundId = typeof matchRoundId === "string" ? matchRoundId : "";
  if (roundId) await reconcileAndRevalidate(roundId);

  return result;
}

export async function movePlayerWithinRoundAction(formData: FormData) {
  await requireCoachAccess();
  const matchRoundId = formData.get("matchRoundId");
  const playerId = formData.get("playerId");
  const fromMatchId = formData.get("fromMatchId");
  const toMatchId = formData.get("toMatchId");
  const targetRole = formData.get("targetRole");
  const overrideReasonCategory = formData.get("overrideReasonCategory");
  const overrideReasonDetail = formData.get("overrideReasonDetail");

  if (typeof matchRoundId !== "string" || !matchRoundId) throw new Error("Match round ID is required.");
  if (typeof playerId !== "string" || !playerId) throw new Error("Player ID is required.");
  if (typeof fromMatchId !== "string" || !fromMatchId) throw new Error("Source match ID is required.");
  if (typeof toMatchId !== "string" || !toMatchId) throw new Error("Target match ID is required.");
  if (typeof targetRole !== "string" || !targetRole) throw new Error("Target role is required.");

  const category = typeof overrideReasonCategory === "string" && OVERRIDE_REASON_CATEGORIES.includes(overrideReasonCategory as OverrideReasonCategory)
    ? (overrideReasonCategory as OverrideReasonCategory)
    : undefined;
  const detail = typeof overrideReasonDetail === "string" && overrideReasonDetail.trim() ? overrideReasonDetail.trim() : undefined;

  const result = await movePlannedSelectionWithinRound({
    matchRoundId,
    playerId,
    fromMatchId,
    toMatchId,
    targetRole: targetRole as SelectionRole,
    overrideReasonCategory: category,
    overrideReasonDetail: detail,
  });

  if (result.success) {
    await reconcileAndRevalidate(matchRoundId);
  }

  return result;
}