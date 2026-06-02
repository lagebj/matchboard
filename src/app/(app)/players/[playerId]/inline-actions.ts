"use server";

import { revalidatePath } from "next/cache";
import { requireCoachAccess } from "@/lib/auth";
import { db } from "@/lib/db";

export async function updatePlayerFieldAction(
  playerId: string,
  field: string,
  value: string,
): Promise<{ success: boolean; error?: string }> {
  await requireCoachAccess();

  const allowedFields = new Set([
    "firstName",
    "lastName",
    "coreTeamId",
    "primaryPosition",
    "secondaryPosition",
    "tertiaryPosition",
    "preferredFoot",
    "secondaryFoot",
    "bestSide",
    "currentAvailability",
    "nonRotatable",
    "reducedMatchLoadAllowed",
    "ballControl",
    "passing",
    "firstTouch",
    "oneVOneAttacking",
    "positioning",
    "oneVOneDefending",
    "decisionMaking",
    "effort",
    "teamplay",
    "concentration",
    "speed",
    "strength",
    "notes",
  ]);

  if (!allowedFields.has(field)) {
    return { success: false, error: `Field "${field}" is not editable.` };
  }

  try {
    const player = await db.player.findFirst({
      where: { id: playerId, removedAt: null },
      select: { id: true },
    });

    if (!player) {
      return { success: false, error: "Player not found." };
    }

    const parsedValue = field === "nonRotatable" || field === "reducedMatchLoadAllowed"
      ? value === "true"
      : field === "coreTeamId" && value === ""
        ? null
        : [
            "ballControl",
            "passing",
            "firstTouch",
            "oneVOneAttacking",
            "positioning",
            "oneVOneDefending",
            "decisionMaking",
            "effort",
            "teamplay",
            "concentration",
            "speed",
            "strength",
          ].includes(field)
          ? parseInt(value, 10) || 0
          : value;

    await db.player.update({
      where: { id: player.id },
      data: { [field]: parsedValue },
    });

    revalidatePath(`/players/${playerId}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Update failed." };
  }
}