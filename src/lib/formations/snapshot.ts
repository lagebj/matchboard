import type { GameFormat } from "@/generated/prisma/client";
import type { FormationSlotRoleType, FormationSnapshot } from "./types";

export function createFormationSnapshot(
  formationId: string,
  formationName: string,
  gameFormat: GameFormat,
  slots: { id: string; gridX: number; gridY: number; label: string; shortLabel: string; roleType: FormationSlotRoleType; acceptedPositionIds: string[]; sortOrder: number }[],
): FormationSnapshot {
  return {
    formationId,
    formationName,
    gameFormat,
    slots: slots.map((s) => ({
      slotId: s.id,
      gridX: s.gridX,
      gridY: s.gridY,
      label: s.label,
      shortLabel: s.shortLabel,
      roleType: s.roleType,
      acceptedPositionIds: s.acceptedPositionIds,
      sortOrder: s.sortOrder,
    })),
  };
}