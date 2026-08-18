"use server";

import { revalidatePath } from "next/cache";
import { requireActorContext, requireMutationRole, requirePlayerTeamAccess, requireTeamAccess } from "@/lib/auth/actor-context";
import { db } from "@/lib/db";
import { playerPositionValues } from "@/lib/player-form-options";
import { syncPlayerPositions } from "@/lib/players/sync-player-positions";

const VALID_POSITIONS: ReadonlySet<string> = new Set(playerPositionValues);

export async function updatePlayerFieldAction(
  playerId: string,
  field: string,
  value: string,
): Promise<{ success: boolean; error?: string }> {
  const ctx = await requireActorContext();
  requireMutationRole(ctx);
  await requirePlayerTeamAccess(ctx, playerId);

  const allowedFields = new Set([
    "firstName",
    "lastName",
    "shirtNumber",
    "coreTeamId",
    "primaryPosition",
    "secondaryPosition",
    "tertiaryPosition",
    "preferredFoot",
    "secondaryFoot",
    "bestSide",
    "currentAvailability",
    "goalkeeperAbility",
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
      where: { id: playerId, removedAt: null, ...ctx.orgFilter.filter },
      select: { id: true, primaryPosition: true, secondaryPosition: true, tertiaryPosition: true },
    });

    if (!player) {
      return { success: false, error: "Player not found." };
    }

    const numericFields = [
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
    ];

    let parsedValue: string | number | boolean | null;

    if (field === "nonRotatable" || field === "reducedMatchLoadAllowed") {
      parsedValue = value === "true";
    } else if (field === "shirtNumber") {
      if (value === "" || value === "null" || value === "—") {
        parsedValue = null;
      } else {
        const num = parseInt(value, 10);
        if (isNaN(num) || num < 1 || num > 99) {
          return { success: false, error: "Shirt number must be between 1 and 99." };
        }
        parsedValue = num;
      }
    } else if (field === "goalkeeperAbility") {
      if (value === "" || value === "null" || value === "—") {
        parsedValue = "NO";
      } else if (value !== "NO" && value !== "EMERGENCY" && value !== "YES") {
        return { success: false, error: "Invalid goalkeeper ability value." };
      } else {
        parsedValue = value;
      }
    } else if (field === "coreTeamId" && value === "") {
      parsedValue = null;
    } else if (field === "coreTeamId" && value !== "") {
      await requireTeamAccess(ctx, value);
      parsedValue = value;
    } else if (field === "primaryPosition") {
      if (!VALID_POSITIONS.has(value)) {
        return { success: false, error: "Invalid position value." };
      }
      const secondary = player.secondaryPosition;
      const tertiary = player.tertiaryPosition;
      if ((secondary && secondary === value) || (tertiary && tertiary === value)) {
        return { success: false, error: "Primary position must differ from secondary and tertiary positions." };
      }
      parsedValue = value;
    } else if (field === "secondaryPosition" || field === "tertiaryPosition") {
      if (value === "" || value === "None") {
        parsedValue = null;
      } else if (!VALID_POSITIONS.has(value)) {
        return { success: false, error: "Invalid position value." };
      } else {
        const primary = player.primaryPosition;
        const other = field === "secondaryPosition" ? player.tertiaryPosition : player.secondaryPosition;
        if (primary === value) {
          return { success: false, error: "Position must differ from primary position." };
        }
        if (other && other === value) {
          return { success: false, error: "Position must differ from other positions." };
        }
        parsedValue = value;
      }
      } else if (numericFields.includes(field)) {
        if (value === "" || value === "null" || value === "—") {
          parsedValue = null;
        } else {
          const num = parseInt(value, 10);
          if (isNaN(num) || num < 1 || num > 10) {
            return { success: false, error: "Rating must be between 1 and 10, or left blank for not rated." };
          }
          parsedValue = num;
        }
    } else {
      parsedValue = value;
    }

    await db.player.update({
      where: { id: player.id },
      data: { [field]: parsedValue },
    });

    const isPositionField = field === "primaryPosition" || field === "secondaryPosition" || field === "tertiaryPosition";
    if (isPositionField) {
      const updated = await db.player.findFirstOrThrow({
        where: { id: player.id, ...ctx.orgFilter.filter },
        select: { primaryPosition: true, secondaryPosition: true, tertiaryPosition: true },
      });
      await syncPlayerPositions({
        playerId: player.id,
        primaryPosition: updated.primaryPosition,
        secondaryPosition: updated.secondaryPosition,
        tertiaryPosition: updated.tertiaryPosition,
      });
    }

    revalidatePath(`/players/${playerId}`);
    revalidatePath("/players");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Update failed." };
  }
}