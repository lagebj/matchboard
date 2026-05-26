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

  const roundId = typeof matchRoundId === "string" ? matchRoundId : "";
  if (roundId) await reconcileAndRevalidate(roundId);

  return result;
}