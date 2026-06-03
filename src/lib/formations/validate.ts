import type { GameFormat } from "@/generated/prisma/client";
import type { FormationSlotRoleType, FormationSlotData, FormationData } from "./types";
import { GAME_FORMAT_PLAYERS } from "./types";

export type FormationValidationIssue =
  | { type: "error"; code: string; message: string }
  | { type: "warning"; code: string; message: string };

export type FormationValidationResult = {
  valid: boolean;
  issues: FormationValidationIssue[];
  slotCount: number;
  requiredSlots: number;
  goalkeeperCount: number;
  hasDuplicateCoordinates: boolean;
  missingMetadataSlots: string[];
};

export function validateFormationForMatchUse(
  formation: Pick<FormationData, "gameFormat" | "slots">,
): FormationValidationResult {
  const { gameFormat, slots } = formation;
  const requiredSlots = GAME_FORMAT_PLAYERS[gameFormat];
  const is3v3 = gameFormat === "THREE_A_SIDE";

  const issues: FormationValidationIssue[] = [];

  const slotCount = slots.length;

  if (slotCount < requiredSlots) {
    issues.push({
      type: "error",
      code: "INSUFFICIENT_SLOTS",
      message: `This formation has ${slotCount} of ${requiredSlots} required slots.`,
    });
  }

  if (slotCount > requiredSlots) {
    issues.push({
      type: "error",
      code: "TOO_MANY_SLOTS",
      message: `This formation has ${slotCount} slots but ${requiredSlots} are required.`,
    });
  }

  const coordinateSet = new Set<string>();
  const duplicateCoordinates: string[] = [];
  for (const slot of slots) {
    const key = `${slot.gridX},${slot.gridY}`;
    if (coordinateSet.has(key)) {
      duplicateCoordinates.push(key);
    }
    coordinateSet.add(key);
  }

  if (duplicateCoordinates.length > 0) {
    issues.push({
      type: "error",
      code: "DUPLICATE_COORDINATES",
      message: `Duplicate grid coordinates: ${duplicateCoordinates.join(", ")}`,
    });
  }

  const missingMetadataSlots: string[] = [];
  for (const slot of slots) {
    if (!slot.label.trim()) missingMetadataSlots.push(slot.shortLabel || `(${slot.gridX},${slot.gridY})`);
    if (!slot.shortLabel.trim()) missingMetadataSlots.push(slot.label || `(${slot.gridX},${slot.gridY})`);
    if (!slot.roleType) missingMetadataSlots.push(slot.shortLabel || `(${slot.gridX},${slot.gridY})`);
    if (!slot.acceptedPositionIds || slot.acceptedPositionIds.length === 0) {
      missingMetadataSlots.push(slot.shortLabel || `(${slot.gridX},${slot.gridY})`);
    }
  }

  const uniqueMissing = [...new Set(missingMetadataSlots)];
  if (uniqueMissing.length > 0) {
    issues.push({
      type: "error",
      code: "INCOMPLETE_SLOT_METADATA",
      message: `Slots missing required metadata: ${uniqueMissing.join(", ")}`,
    });
  }

  const goalkeeperCount = slots.filter((s) => s.roleType === "GOALKEEPER").length;

  if (is3v3) {
    if (goalkeeperCount > 0) {
      issues.push({
        type: "error",
        code: "GOALKEEPER_NOT_ALLOWED",
        message: "3v3 does not use a goalkeeper.",
      });
    }
  } else {
    if (goalkeeperCount === 0) {
      issues.push({
        type: "error",
        code: "GOALKEEPER_REQUIRED",
        message: `${GAME_FORMAT_PLAYERS[gameFormat]}-a-side formations need exactly one goalkeeper.`,
      });
    } else if (goalkeeperCount > 1) {
      issues.push({
        type: "error",
        code: "TOO_MANY_GOALKEEPERS",
        message: `${GAME_FORMAT_PLAYERS[gameFormat]}-a-side formations need exactly one goalkeeper, but ${goalkeeperCount} were found.`,
      });
    }

    if (goalkeeperCount === 1) {
      const gkSlot = slots.find((s) => s.roleType === "GOALKEEPER")!;
      if (gkSlot.gridY !== 5) {
        issues.push({
          type: "warning",
          code: "GOALKEEPER_NOT_IN_DEEP_ROW",
          message: `Goalkeeper is placed in row ${gkSlot.gridY}, which is unusual. Goalkeepers are normally in the deepest row.`,
        });
      }
    }
  }

  return {
    valid: issues.filter((i) => i.type === "error").length === 0,
    issues,
    slotCount,
    requiredSlots,
    goalkeeperCount,
    hasDuplicateCoordinates: duplicateCoordinates.length > 0,
    missingMetadataSlots: uniqueMissing,
  };
}

export function isValidSlotInFormat(
  slot: FormationSlotData,
  gameFormat: GameFormat,
): { valid: boolean; issues: FormationValidationIssue[] } {
  const issues: FormationValidationIssue[] = [];
  const is3v3 = gameFormat === "THREE_A_SIDE";

  if (is3v3 && slot.roleType === "GOALKEEPER") {
    issues.push({
      type: "error",
      code: "GOALKEEPER_NOT_ALLOWED",
      message: "3v3 does not use a goalkeeper.",
    });
  }

  if (slot.gridX < 0 || slot.gridX > 4 || slot.gridY < 0 || slot.gridY > 5) {
    issues.push({
      type: "error",
      code: "INVALID_COORDINATE",
      message: `Grid coordinate (${slot.gridX}, ${slot.gridY}) is outside the 5×6 pitch grid.`,
    });
  }

  return { valid: issues.filter((i) => i.type === "error").length === 0, issues };
}

export function isValidRoleType(
  roleType: string,
): roleType is FormationSlotRoleType {
  return [
    "GOALKEEPER",
    "DEFENDER",
    "DEFENSIVE_MIDFIELDER",
    "MIDFIELDER",
    "ATTACKING_MIDFIELDER",
    "FORWARD",
    "FREE",
  ].includes(roleType);
}