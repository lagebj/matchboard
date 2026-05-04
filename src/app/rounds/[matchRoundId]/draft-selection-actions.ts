'use server'

import { revalidatePath } from "next/cache";
import {
  addPlayerToDraftMatch,
  removePlayerFromDraftMatch,
  changeDraftPlayerRole,
  replaceDraftMatchPlayer,
} from "@/lib/selection/manual-draft-edit";
import { SelectionRole } from "@/generated/prisma/client";

export async function addPlayerToMatchAction(formData: FormData) {
  const matchId = formData.get("matchId");
  const playerId = formData.get("playerId");
  const role = formData.get("role");
  const overrideReason = formData.get("overrideReason");

  if (typeof matchId !== "string" || !matchId) throw new Error("Match ID is required.");
  if (typeof playerId !== "string" || !playerId) throw new Error("Player ID is required.");
  if (typeof role !== "string" || !role) throw new Error("Role is required.");

  const overrideReasonStr = typeof overrideReason === "string" && overrideReason.trim() ? overrideReason.trim() : undefined;

  const result = await addPlayerToDraftMatch(matchId, playerId, role as SelectionRole, overrideReasonStr);

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
  const overrideReason = formData.get("overrideReason");

  if (typeof matchId !== "string" || !matchId) throw new Error("Match ID is required.");
  if (typeof playerId !== "string" || !playerId) throw new Error("Player ID is required.");
  if (typeof role !== "string" || !role) throw new Error("Role is required.");

  const overrideReasonStr = typeof overrideReason === "string" && overrideReason.trim() ? overrideReason.trim() : undefined;

  const result = await changeDraftPlayerRole(matchId, playerId, role as SelectionRole, overrideReasonStr);

  revalidatePath("/rounds");
  revalidatePath(`/rounds/${formData.get("matchRoundId") ?? ""}`);

  return result;
}

export async function replacePlayerInMatchAction(formData: FormData) {
  const matchId = formData.get("matchId");
  const outgoingPlayerId = formData.get("outgoingPlayerId");
  const incomingPlayerId = formData.get("incomingPlayerId");
  const role = formData.get("role");
  const overrideReason = formData.get("overrideReason");

  if (typeof matchId !== "string" || !matchId) throw new Error("Match ID is required.");
  if (typeof outgoingPlayerId !== "string" || !outgoingPlayerId) throw new Error("Outgoing player ID is required.");
  if (typeof incomingPlayerId !== "string" || !incomingPlayerId) throw new Error("Incoming player ID is required.");
  if (typeof role !== "string" || !role) throw new Error("Role is required.");

  const overrideReasonStr = typeof overrideReason === "string" && overrideReason.trim() ? overrideReason.trim() : undefined;

  const result = await replaceDraftMatchPlayer(matchId, outgoingPlayerId, incomingPlayerId, role as SelectionRole, overrideReasonStr);

  revalidatePath("/rounds");
  revalidatePath(`/rounds/${formData.get("matchRoundId") ?? ""}`);

  return result;
}