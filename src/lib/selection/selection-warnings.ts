import { SelectionStatus } from "@/generated/prisma/client";

export function getUniqueReasons(reasons: string[]) {
  return [...new Set(reasons.filter(Boolean))];
}

export function formatTeamNameList(teamNames: string[]) {
  const uniqueTeamNames = [...new Set(teamNames.filter(Boolean))];

  if (uniqueTeamNames.length === 0) {
    return "";
  }

  if (uniqueTeamNames.length === 1) {
    return uniqueTeamNames[0]!;
  }

  return `${uniqueTeamNames.slice(0, -1).join(", ")} and ${uniqueTeamNames.at(-1)}`;
}

export function formatSelectionStatus(status: SelectionStatus) {
  return status === SelectionStatus.FINALIZED ? "finalized" : "draft";
}

export function buildShortSquadWarningMessage(
  selectedCount: number,
  squadSize: number,
  blockers: string[],
) {
  if (blockers.length === 0) {
    return `Only ${selectedCount} player(s) could be filled automatically for a target squad size of ${squadSize}.`;
  }

  return `Only ${selectedCount} player(s) could be filled automatically for a target squad size of ${squadSize}. Automatic filling stopped because ${blockers.join(" ")}`;
}