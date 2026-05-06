'use server'

import { revalidatePath } from "next/cache";
import {
  addPlayerToDraftMatch,
  removePlayerFromDraftMatch,
  changeDraftPlayerRole,
} from "@/lib/selection/manual-draft-edit";
import { SelectionRole } from "@/generated/prisma/client";
import type { OverrideReasonCategory } from "@/lib/selection/types";
import { OVERRIDE_REASON_CATEGORIES } from "@/lib/selection/types";

export async function addPlayerToMatchAction(formData: FormData) {
  const matchId = formData.get("matchId");
  const playerId = formData.get("playerId");
  const role = formData.get("role");
  const overrideReasonCategory = formData.get("overrideReasonCategory");
  const overrideReasonDetail = formData.get("overrideReasonDetail");

  if (typeof matchId !== "string" || !matchId) throw new Error("Match ID is required.");
  if (typeof playerId !== "string" || !playerId) throw new Error("Player ID is required.");
  if (typeof role !== "string" || !role) throw new Error("Role is required.");

  const category = typeof overrideReasonCategory === "string" && OVERRIDE_REASON_CATEGORIES.includes(overrideReasonCategory as OverrideReasonCategory)
    ? (overrideReasonCategory as OverrideReasonCategory)
    : undefined;
  const detail = typeof overrideReasonDetail === "string" && overrideReasonDetail.trim() ? overrideReasonDetail.trim() : undefined;

  const result = await addPlayerToDraftMatch(matchId, playerId, role as SelectionRole, category, detail);

  revalidatePath("/rounds");
  revalidatePath(`/rounds/${formData.get("matchRoundId") ?? ""}`);

  return result;
}

export async function removePlayerFromMatchAction(formData: FormData) {
  const matchId = formData.get("matchId");
  const playerId = formData.get("playerId");

  if (typeof matchId !== "string" || !matchId) throw new Error("Match ID is required.");
  if (typeof playerId !== "string" || !playerId) throw new Error("Player ID is required.");

  const result = await removePlayerFromDraftMatch(matchId, playerId);

  revalidatePath("/rounds");
  revalidatePath(`/rounds/${formData.get("matchRoundId") ?? ""}`);

  return result;
}

export async function changePlayerRoleAction(formData: FormData) {
  const matchId = formData.get("matchId");
  const playerId = formData.get("playerId");
  const role = formData.get("role");
  const overrideReasonCategory = formData.get("overrideReasonCategory");
  const overrideReasonDetail = formData.get("overrideReasonDetail");

  if (typeof matchId !== "string" || !matchId) throw new Error("Match ID is required.");
  if (typeof playerId !== "string" || !playerId) throw new Error("Player ID is required.");
  if (typeof role !== "string" || !role) throw new Error("Role is required.");

  const category = typeof overrideReasonCategory === "string" && OVERRIDE_REASON_CATEGORIES.includes(overrideReasonCategory as OverrideReasonCategory)
    ? (overrideReasonCategory as OverrideReasonCategory)
    : undefined;
  const detail = typeof overrideReasonDetail === "string" && overrideReasonDetail.trim() ? overrideReasonDetail.trim() : undefined;

  const result = await changeDraftPlayerRole(matchId, playerId, role as SelectionRole, category, detail);

  revalidatePath("/rounds");
  revalidatePath(`/rounds/${formData.get("matchRoundId") ?? ""}`);

  return result;
}