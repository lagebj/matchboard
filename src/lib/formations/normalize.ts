import type { GameFormat } from "@/generated/prisma/client";
import type { FormationSlotData } from "./types";

const FORMAT_REQUIRES_GK: GameFormat[] = ["FIVE_A_SIDE", "SEVEN_A_SIDE", "NINE_A_SIDE", "ELEVEN_A_SIDE"];

export function findFormationDataIssues(formation: {
  gameFormat: string;
  slots: FormationSlotData[];
}): { field: string; message: string }[] {
  const issues: { field: string; message: string }[] = [];
  const format = formation.gameFormat as GameFormat;
  const requiresGK = FORMAT_REQUIRES_GK.includes(format);

  const hasGKSlot = formation.slots.some(
    (s) => s.roleType === "GOALKEEPER"
  );

  if (requiresGK && !hasGKSlot && format !== "THREE_A_SIDE") {
    issues.push({
      field: "slots",
      message: `${format} formations should have a GOALKEEPER slot`,
    });
  }

  if (format === "THREE_A_SIDE" && hasGKSlot) {
    issues.push({
      field: "slots",
      message: "3v3 formations must not have a GOALKEEPER slot",
    });
  }

  for (const slot of formation.slots) {
    if (slot.roleType === "GOALKEEPER" && slot.gridY !== 5) {
      issues.push({
        field: `slot.${slot.id ?? `${slot.gridX}-${slot.gridY}`}.gridY`,
        message: `GOALKEEPER slot "${slot.shortLabel}" should be at gridY 5, found gridY ${slot.gridY}`,
      });
    }

    if (slot.roleType === "FORWARD" && slot.gridY > 1) {
      issues.push({
        field: `slot.${slot.id ?? `${slot.gridX}-${slot.gridY}`}.gridY`,
        message: `FORWARD slot "${slot.shortLabel}" should normally be at gridY 0 or 1, found gridY ${slot.gridY}`,
      });
    }

    if (slot.gridX < 0 || slot.gridX > 4) {
      issues.push({
        field: `slot.${slot.id ?? `${slot.gridX}-${slot.gridY}`}.gridX`,
        message: `Invalid gridX ${slot.gridX} — must be 0-4`,
      });
    }

    if (slot.gridY < 0 || slot.gridY > 5) {
      issues.push({
        field: `slot.${slot.id ?? `${slot.gridX}-${slot.gridY}`}.gridY`,
        message: `Invalid gridY ${slot.gridY} — must be 0-5`,
      });
    }
  }

  return issues;
}