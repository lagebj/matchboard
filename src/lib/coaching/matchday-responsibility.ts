import { db } from "@/lib/db";
import {
  type MatchdayResponsibilityType,
  MATCHDAY_RESPONSIBILITIES,
  MATCHDAY_RESPONSIBILITY_DESCRIPTIONS,
} from "./types";

export function validateMatchdayResponsibility(value: string): value is MatchdayResponsibilityType {
  return MATCHDAY_RESPONSIBILITIES.includes(value as MatchdayResponsibilityType);
}

export async function setMatchdayResponsibility(
  selectionId: string,
  responsibility: MatchdayResponsibilityType | null
) {
  if (responsibility !== null && !validateMatchdayResponsibility(responsibility)) {
    throw new Error(`Invalid matchday responsibility: ${responsibility}`);
  }

  const selection = await db.selection.findUnique({
    where: { id: selectionId },
    select: { status: true },
  });

  if (!selection) {
    throw new Error(`Selection not found: ${selectionId}`);
  }

  if (selection.status === "FINALIZED") {
    throw new Error("Cannot modify matchday responsibility on a finalized selection");
  }

  return db.selection.update({
    where: { id: selectionId },
    data: { matchdayResponsibility: responsibility },
  });
}

export async function removeMatchdayResponsibility(selectionId: string) {
  return setMatchdayResponsibility(selectionId, null);
}

export async function getMatchdayResponsibility(selectionId: string) {
  const selection = await db.selection.findUnique({
    where: { id: selectionId },
    select: { matchdayResponsibility: true },
  });
  return selection?.matchdayResponsibility ?? null;
}

export async function getResponsibilitiesForMatch(matchId: string) {
  const selections = await db.selection.findMany({
    where: { matchId, matchdayResponsibility: { not: null } },
    select: {
      id: true,
      playerId: true,
      matchdayResponsibility: true,
    },
  });

  return selections.map((s) => ({
    selectionId: s.id,
    playerId: s.playerId,
    responsibility: s.matchdayResponsibility as MatchdayResponsibilityType,
    description: MATCHDAY_RESPONSIBILITY_DESCRIPTIONS[s.matchdayResponsibility as MatchdayResponsibilityType],
  }));
}

export function getResponsibilityDescription(responsibility: MatchdayResponsibilityType): string {
  return MATCHDAY_RESPONSIBILITY_DESCRIPTIONS[responsibility];
}