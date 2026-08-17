import { db } from "@/lib/db";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";
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
  responsibility: MatchdayResponsibilityType | null,
  orgFilter: OrgFilterMode
) {
  if (responsibility !== null && !validateMatchdayResponsibility(responsibility)) {
    throw new Error(`Invalid matchday responsibility: ${responsibility}`);
  }

  const selection = await db.selection.findFirst({
    where: { id: selectionId, ...orgFilter.filter },
    select: { status: true },
  });

  if (!selection) {
    throw new Error(`Selection not found: ${selectionId}`);
  }

  if (selection.status === "FINALIZED") {
    throw new Error("Cannot modify matchday responsibility on a finalised selection");
  }

  return db.selection.update({
    where: { id: selectionId },
    data: { matchdayResponsibility: responsibility },
  });
}

export async function removeMatchdayResponsibility(selectionId: string, orgFilter: OrgFilterMode) {
  return setMatchdayResponsibility(selectionId, null, orgFilter);
}

export async function getMatchdayResponsibility(selectionId: string, orgFilter: OrgFilterMode) {
  const selection = await db.selection.findFirst({
    where: { id: selectionId, ...orgFilter.filter },
    select: { matchdayResponsibility: true },
  });
  return selection?.matchdayResponsibility ?? null;
}

export async function getResponsibilitiesForMatch(matchId: string, orgFilter: OrgFilterMode) {
  const selections = await db.selection.findMany({
    where: { matchId, matchdayResponsibility: { not: null }, ...orgFilter.filter },
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