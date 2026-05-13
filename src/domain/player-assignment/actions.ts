"use server";

import { requireCoachAccess } from "@/lib/auth";
import { getPlayerAssignmentBoard, movePlayerToTeam } from "@/domain/player-assignment/service";

export async function fetchPlayerAssignmentBoard() {
  await requireCoachAccess();
  return getPlayerAssignmentBoard();
}

export async function movePlayerToTeamAction(input: {
  playerId: string;
  targetTeamId: string | null;
  previousTeamId?: string | null;
  reason?: string;
}) {
  await requireCoachAccess();
  return movePlayerToTeam(input);
}