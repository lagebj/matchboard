import { db } from "@/lib/db";
import type { AvailabilityStatus } from "@/generated/prisma/client";

export type PlayerMutationResult =
  | { success: true; playerId: string }
  | { success: false; error: string };

const VALID_AVAILABILITY_STATUSES: AvailabilityStatus[] = [
  "AVAILABLE",
  "INJURED",
  "SICK",
  "AWAY",
  "TENTATIVE",
  "UNKNOWN",
];

export function isValidAvailabilityStatus(status: string): status is AvailabilityStatus {
  return (VALID_AVAILABILITY_STATUSES as readonly string[]).includes(status);
}

export async function togglePlayerActive(playerId: string): Promise<PlayerMutationResult> {
  const player = await db.player.findFirst({
    where: { id: playerId, removedAt: null },
    select: { id: true, active: true },
  });

  if (!player) {
    return { success: false, error: "Player not found." };
  }

  await db.player.update({
    where: { id: player.id },
    data: { active: !player.active },
  });

  return { success: true, playerId: player.id };
}

export async function removePlayer(playerId: string): Promise<PlayerMutationResult> {
  const player = await db.player.findFirst({
    where: { id: playerId, removedAt: null },
    select: { id: true },
  });

  if (!player) {
    return { success: false, error: "Player not found." };
  }

  await db.player.update({
    where: { id: player.id },
    data: { active: false, removedAt: new Date() },
  });

  return { success: true, playerId: player.id };
}

export async function restorePlayer(playerId: string): Promise<PlayerMutationResult> {
  const player = await db.player.findFirst({
    where: { id: playerId, removedAt: { not: null } },
    select: { id: true },
  });

  if (!player) {
    return { success: false, error: "Player not found or not removed." };
  }

  await db.player.update({
    where: { id: player.id },
    data: { active: true, removedAt: null },
  });

  return { success: true, playerId: player.id };
}

export async function setPlayerAvailability(
  playerId: string,
  availability: AvailabilityStatus,
): Promise<PlayerMutationResult> {
  if (!isValidAvailabilityStatus(availability)) {
    return { success: false, error: `Invalid availability status: ${availability}` };
  }

  const player = await db.player.findFirst({
    where: { id: playerId, removedAt: null },
    select: { id: true },
  });

  if (!player) {
    return { success: false, error: "Player not found." };
  }

  await db.player.update({
    where: { id: player.id },
    data: { currentAvailability: availability },
  });

  return { success: true, playerId: player.id };
}

export async function updatePlayerCoreTeam(
  playerId: string,
  coreTeamId: string | null,
): Promise<PlayerMutationResult> {
  const player = await db.player.findFirst({
    where: { id: playerId, removedAt: null },
    select: { id: true },
  });

  if (!player) {
    return { success: false, error: "Player not found." };
  }

  if (coreTeamId !== null) {
    const team = await db.team.findFirst({
      where: { id: coreTeamId, archivedAt: null },
      select: { id: true },
    });
    if (!team) {
      return { success: false, error: "Team not found or archived." };
    }
  }

  await db.player.update({
    where: { id: player.id },
    data: { coreTeamId },
  });

  return { success: true, playerId: player.id };
}