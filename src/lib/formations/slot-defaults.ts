import type { GameFormat } from "@/generated/prisma/client";
import type { FormationSlotRoleType, BroadPosition } from "./types";

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
  const isLeft = gridX <= 1;
  const isRight = gridX >= 3;

  if (!is3v3 && gridY === 5 && gridX === 2) {
    return {
      label: "Goalkeeper",
      shortLabel: "GK",
      roleType: "GOALKEEPER",
      acceptedPositionIds: ["goalkeeper"],
    };
  }

  switch (gridY) {
    case 0: {
      if (isLeft) return { label: is3v3 ? "Left forward" : "Left winger", shortLabel: is3v3 ? "LF" : "LW", roleType: "FORWARD", acceptedPositionIds: is3v3 ? ["forward", "midfielder"] : ["forward", "midfielder"] };
      if (isRight) return { label: is3v3 ? "Right forward" : "Right winger", shortLabel: is3v3 ? "RF" : "RW", roleType: "FORWARD", acceptedPositionIds: is3v3 ? ["forward", "midfielder"] : ["forward", "midfielder"] };
      return { label: "Striker", shortLabel: "ST", roleType: "FORWARD", acceptedPositionIds: ["forward"] };
    }
    case 1: {
      if (isLeft) return { label: is3v3 ? "Left attacker" : "Left attacking mid", shortLabel: is3v3 ? "LA" : "LAM", roleType: "ATTACKING_MIDFIELDER", acceptedPositionIds: is3v3 ? ["forward", "midfielder", "flexible"] : ["midfielder", "forward"] };
      if (isRight) return { label: is3v3 ? "Right attacker" : "Right attacking mid", shortLabel: is3v3 ? "RA" : "RAM", roleType: "ATTACKING_MIDFIELDER", acceptedPositionIds: is3v3 ? ["forward", "midfielder", "flexible"] : ["midfielder", "forward"] };
      return { label: "Attacking mid", shortLabel: "AM", roleType: "ATTACKING_MIDFIELDER", acceptedPositionIds: is3v3 ? ["midfielder", "flexible"] : ["midfielder", "forward"] };
    }
    case 2: {
      if (isLeft) return { label: "Left mid", shortLabel: "LM", roleType: "MIDFIELDER", acceptedPositionIds: is3v3 ? ["midfielder", "flexible"] : ["midfielder"] };
      if (isRight) return { label: "Right mid", shortLabel: "RM", roleType: "MIDFIELDER", acceptedPositionIds: is3v3 ? ["midfielder", "flexible"] : ["midfielder"] };
      return { label: "Centre mid", shortLabel: "CM", roleType: "MIDFIELDER", acceptedPositionIds: is3v3 ? ["midfielder", "flexible"] : ["midfielder"] };
    }
    case 3: {
      if (isLeft) return { label: "Left defensive mid", shortLabel: "LDM", roleType: "DEFENSIVE_MIDFIELDER", acceptedPositionIds: is3v3 ? ["midfielder", "defender", "flexible"] : ["midfielder", "defender"] };
      if (isRight) return { label: "Right defensive mid", shortLabel: "RDM", roleType: "DEFENSIVE_MIDFIELDER", acceptedPositionIds: is3v3 ? ["midfielder", "defender", "flexible"] : ["midfielder", "defender"] };
      return { label: "Defensive mid", shortLabel: "DM", roleType: "DEFENSIVE_MIDFIELDER", acceptedPositionIds: is3v3 ? ["midfielder", "defender", "flexible"] : ["midfielder", "defender"] };
    }
    case 4: {
      if (isLeft) return { label: is3v3 ? "Left deep" : "Left back", shortLabel: is3v3 ? "LD" : "LB", roleType: "DEFENDER", acceptedPositionIds: is3v3 ? ["defender", "midfielder", "flexible"] : ["defender", "midfielder"] };
      if (isRight) return { label: is3v3 ? "Right deep" : "Right back", shortLabel: is3v3 ? "RD" : "RB", roleType: "DEFENDER", acceptedPositionIds: is3v3 ? ["defender", "midfielder", "flexible"] : ["defender", "midfielder"] };
      return { label: is3v3 ? "Centre deep" : "Centre back", shortLabel: is3v3 ? "CD" : "CB", roleType: "DEFENDER", acceptedPositionIds: is3v3 ? ["defender", "midfielder", "flexible"] : ["defender"] };
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