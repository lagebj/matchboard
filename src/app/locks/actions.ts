'use server'

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { buildPathWithSearch } from "@/lib/build-path-with-search";

export type LockType = "LOCKED_IN" | "LOCKED_OUT";

function isValidLockType(value: string): value is LockType {
  return value === "LOCKED_IN" || value === "LOCKED_OUT";
}

export async function createPlayerLockAction(
  matchRoundId: string,
  playerId: string,
  lockType: string,
  reason: string,
  returnPath?: string,
) {
  const resolvedPath = returnPath || "/";

  if (!matchRoundId) {
    redirect(buildPathWithSearch(resolvedPath, { error: "Match round ID is required." }));
  }

  if (!playerId) {
    redirect(buildPathWithSearch(resolvedPath, { error: "Player ID is required." }));
  }

  if (!isValidLockType(lockType)) {
    redirect(buildPathWithSearch(resolvedPath, { error: "Lock type must be LOCKED_IN or LOCKED_OUT." }));
  }

  const player = await db.player.findUnique({
    where: { id: playerId, removedAt: null },
    select: { id: true },
  });

  if (!player) {
    redirect(buildPathWithSearch(resolvedPath, { error: "Player not found." }));
  }

  await db.playerLock.upsert({
    where: {
      matchRoundId_playerId: { matchRoundId, playerId },
    },
    update: {
      lockType,
      reason: reason || null,
    },
    create: {
      matchRoundId,
      playerId,
      lockType,
      reason: reason || null,
    },
  });

  revalidatePath("/");
  revalidatePath("/matchday");
  revalidatePath("/selection");
  if (resolvedPath.startsWith("/selection/")) {
    revalidatePath(resolvedPath);
  }
}

export async function removePlayerLockAction(lockId: string, returnPath?: string) {
  const resolvedPath = returnPath || "/";

  if (!lockId) {
    redirect(buildPathWithSearch(resolvedPath, { error: "Lock ID is required." }));
  }

  const lock = await db.playerLock.findUnique({
    where: { id: lockId },
    select: { id: true },
  });

  if (!lock) {
    redirect(buildPathWithSearch(resolvedPath, { error: "Lock not found." }));
  }

  await db.playerLock.delete({
    where: { id: lock.id },
  });

  revalidatePath("/");
  revalidatePath("/matchday");
  revalidatePath("/selection");
  if (resolvedPath.startsWith("/selection/")) {
    revalidatePath(resolvedPath);
  }
}