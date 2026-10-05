import type { GameFormat } from "@/generated/prisma/client";
import type { FormationSlotRoleType, BroadPosition } from "./types";
import { canonicalPositionForCell } from "@/domain/positions/grid";
import { canonicalCompactLabel, canonicalFullLabel } from "@/domain/positions/canonical-labels";

const OUTFIELD_ROLE_TYPE_BY_GRID_Y: Readonly<Record<number, FormationSlotRoleType>> = {
  0: "FORWARD",
  1: "ATTACKING_MIDFIELDER",
  2: "MIDFIELDER",
  3: "DEFENSIVE_MIDFIELDER",
  4: "DEFENDER",
};

/**
 * Broad composition-eligibility defaults for a non-3v3 outfield slot, by depth row and
 * left/centre/right third of the row (x0-1 / x2 / x3-4) — unrelated to exact tactical identity
 * (ADR-0154 does not change this field's semantics, only the label/shortLabel below).
 */
function acceptedPositionIdsFor(gridX: number, gridY: number): BroadPosition[] {
  const third = gridX <= 1 ? "left" : gridX >= 3 ? "right" : "centre";
  switch (gridY) {
    case 0:
      return third === "centre" ? ["forward"] : ["forward", "midfielder"];
    case 1:
      return ["midfielder", "forward"];
    case 2:
      return ["midfielder"];
    case 3:
      return ["midfielder", "defender"];
    case 4:
      return third === "centre" ? ["defender"] : ["defender", "midfielder"];
    default:
      return ["flexible"];
  }
}

/**
 * Suggested label/shortLabel/roleType/acceptedPositionIds for a new formation slot at
 * (gridX, gridY). For non-3v3 formats, every one of the five lanes at an outfield depth row
 * resolves to its own exact canonical position/label via the single domain authority
 * (ADR-0154 §9: "must use the exact cell", never a 3-lane left/centre/right collapse). 3v3's
 * own flavoured terminology (`THREE_A_SIDE`, a 3-outfield-player format where a genuine 5-lane
 * row essentially never occurs) is preserved unchanged.
 */
export function suggestSlotDefaults(
  gridX: number,
  gridY: number,
  gameFormat: GameFormat,
): {
  label: string;
  shortLabel: string;
  roleType: FormationSlotRoleType;
  acceptedPositionIds: BroadPosition[];
} {
  const is3v3 = gameFormat === "THREE_A_SIDE";

  if (!is3v3 && gridY === 5 && gridX === 2) {
    return {
      label: "Goalkeeper",
      shortLabel: "GK",
      roleType: "GOALKEEPER",
      acceptedPositionIds: ["goalkeeper"],
    };
  }

  if (!is3v3) {
    const position = canonicalPositionForCell(gridX, gridY);
    const outfieldRoleType = OUTFIELD_ROLE_TYPE_BY_GRID_Y[gridY];
    if (position && outfieldRoleType) {
      return {
        label: canonicalFullLabel(position),
        shortLabel: canonicalCompactLabel(position),
        roleType: outfieldRoleType,
        acceptedPositionIds: acceptedPositionIdsFor(gridX, gridY),
      };
    }
  }

  // 3v3 (and any y5/out-of-range cell for non-3v3) keep the existing 3-bucket, format-flavoured
  // defaults unchanged — a 3-outfield-player format never realistically needs a fifth lane.
  const isLeft = gridX <= 1;
  const isRight = gridX >= 3;

  switch (gridY) {
    case 0: {
      if (isLeft) return { label: "Left forward", shortLabel: "LF", roleType: "FORWARD", acceptedPositionIds: ["forward", "midfielder"] };
      if (isRight) return { label: "Right forward", shortLabel: "RF", roleType: "FORWARD", acceptedPositionIds: ["forward", "midfielder"] };
      return { label: "Striker", shortLabel: "ST", roleType: "FORWARD", acceptedPositionIds: ["forward"] };
    }
    case 1: {
      if (isLeft) return { label: "Left attacker", shortLabel: "LA", roleType: "ATTACKING_MIDFIELDER", acceptedPositionIds: ["forward", "midfielder", "flexible"] };
      if (isRight) return { label: "Right attacker", shortLabel: "RA", roleType: "ATTACKING_MIDFIELDER", acceptedPositionIds: ["forward", "midfielder", "flexible"] };
      return { label: "Attacking mid", shortLabel: "AM", roleType: "ATTACKING_MIDFIELDER", acceptedPositionIds: ["midfielder", "flexible"] };
    }
    case 2: {
      if (isLeft) return { label: "Left mid", shortLabel: "LM", roleType: "MIDFIELDER", acceptedPositionIds: ["midfielder", "flexible"] };
      if (isRight) return { label: "Right mid", shortLabel: "RM", roleType: "MIDFIELDER", acceptedPositionIds: ["midfielder", "flexible"] };
      return { label: "Centre mid", shortLabel: "CM", roleType: "MIDFIELDER", acceptedPositionIds: ["midfielder", "flexible"] };
    }
    case 3: {
      if (isLeft) return { label: "Left defensive mid", shortLabel: "LDM", roleType: "DEFENSIVE_MIDFIELDER", acceptedPositionIds: ["midfielder", "defender", "flexible"] };
      if (isRight) return { label: "Right defensive mid", shortLabel: "RDM", roleType: "DEFENSIVE_MIDFIELDER", acceptedPositionIds: ["midfielder", "defender", "flexible"] };
      return { label: "Defensive mid", shortLabel: "DM", roleType: "DEFENSIVE_MIDFIELDER", acceptedPositionIds: ["midfielder", "defender", "flexible"] };
    }
    case 4: {
      if (isLeft) return { label: "Left deep", shortLabel: "LD", roleType: "DEFENDER", acceptedPositionIds: ["defender", "midfielder", "flexible"] };
      if (isRight) return { label: "Right deep", shortLabel: "RD", roleType: "DEFENDER", acceptedPositionIds: ["defender", "midfielder", "flexible"] };
      return { label: "Centre deep", shortLabel: "CD", roleType: "DEFENDER", acceptedPositionIds: ["defender", "midfielder", "flexible"] };
    }
    case 5: {
      if (is3v3) {
        if (isLeft) return { label: "Left deep", shortLabel: "LD", roleType: "FREE", acceptedPositionIds: ["defender", "midfielder", "flexible"] };
        if (isRight) return { label: "Right deep", shortLabel: "RD", roleType: "FREE", acceptedPositionIds: ["defender", "midfielder", "flexible"] };
        return { label: "Deep", shortLabel: "D", roleType: "FREE", acceptedPositionIds: ["defender", "midfielder", "flexible"] };
      }
      if (isLeft) return { label: "Left goalkeeper", shortLabel: "GK", roleType: "GOALKEEPER", acceptedPositionIds: ["goalkeeper"] };
      if (isRight) return { label: "Right goalkeeper", shortLabel: "GK", roleType: "GOALKEEPER", acceptedPositionIds: ["goalkeeper"] };
      return { label: "Goalkeeper", shortLabel: "GK", roleType: "GOALKEEPER", acceptedPositionIds: ["goalkeeper"] };
    }
    default:
      return { label: "Free", shortLabel: "F", roleType: "FREE", acceptedPositionIds: ["flexible"] };
  }
}
