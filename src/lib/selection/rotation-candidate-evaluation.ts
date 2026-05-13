import {
  formatShortDate,
  getCalendarDayDifference,
  isInSameWeek,
  isSameCalendarDay,
} from "@/lib/date-utils";
import { getRules } from "@/lib/rules/get-rules";
import type { ExcludedPlayer } from "@/lib/selection/types";
import {
  type CoreCandidate,
  type MatchRecord,
  type MostRecentRegisteredAppearance,
  type PathDestination,
  type PlayerRecord,
  type RegisteredSelectionSnapshot,
  type RotationCandidateCategory,
} from "@/lib/selection/selection-types";
import { formatSelectionStatus, getUniqueReasons } from "@/lib/selection/selection-warnings";

function getAbsoluteCalendarDayDifference(leftDate: Date, rightDate: Date): number {
  if (leftDate >= rightDate) {
    return getCalendarDayDifference(leftDate, rightDate);
  }

  return getCalendarDayDifference(rightDate, leftDate);
}

export function findHigherPriorityOpportunity(
  player: PlayerRecord,
  currentMatch: MatchRecord,
  registeredMatches: MatchRecord[],
  rules: Awaited<ReturnType<typeof getRules>>,
  allRotationPaths: PathDestination[],
): CoreCandidate["higherPriorityOpportunity"] {
  if (player.nonRotatable) {
    return null;
  }

  const playerPaths = allRotationPaths.filter(
    (path) => path.fromTeamId === player.coreTeamId && path.toTeamId !== player.coreTeamId,
  );

  const playerPathTeamIds = new Set(playerPaths.map((path) => path.toTeamId));

  const matchedOpportunity =
    registeredMatches.find((otherMatch) => {
      if (otherMatch.startsAt <= currentMatch.startsAt) {
        return false;
      }

      const dayDifference = getAbsoluteCalendarDayDifference(otherMatch.startsAt, currentMatch.startsAt);

      if (dayDifference > rules.minDaysBetweenAnyMatches) {
        return false;
      }

      if (!playerPathTeamIds.has(otherMatch.teamId)) {
        return false;
      }

      const supportPath = playerPaths.find(
        (p) => p.toTeamId === otherMatch.teamId && p.role === "SUPPORT",
      );
      const devPath = playerPaths.find(
        (p) => p.toTeamId === otherMatch.teamId && p.role === "DEVELOPMENT",
      );

      return supportPath !== undefined || devPath !== undefined;
    }) ?? null;

  if (!matchedOpportunity) {
    return null;
  }

  return {
    kind: getHigherPriorityOpportunityKind(player, matchedOpportunity, playerPaths),
    match: matchedOpportunity,
  };
}

function getHigherPriorityOpportunityKind(
  player: PlayerRecord,
  match: MatchRecord,
  playerPaths: PathDestination[],
): "development" | "support" {
  const supportPath = playerPaths.find(
    (p) => p.toTeamId === match.teamId && p.role === "SUPPORT",
  );
  if (supportPath) {
    return "support";
  }

  return "development";
}

export function buildCandidateBlockerSummary(
  excludedPlayers: ExcludedPlayer[],
  playerIds: string[],
) {
  const playerIdSet = new Set(playerIds);
  return getUniqueReasons(
    excludedPlayers
      .filter((player) => playerIdSet.has(player.playerId))
      .map((player) => player.exclusionReason),
  ).slice(0, 3);
}

export function findMissedCoreMatchThisWeek(
  player: PlayerRecord,
  currentMatch: MatchRecord,
  latestSavedSelections: RegisteredSelectionSnapshot[],
): RegisteredSelectionSnapshot | null {
  if (player.nonRotatable) {
    return null;
  }

  return (
    latestSavedSelections.find((selection) => {
      if (!isInSameWeek(currentMatch.startsAt, selection.match.startsAt)) {
        return false;
      }

      if (selection.match.startsAt >= currentMatch.startsAt) {
        return false;
      }

      if (selection.match.teamId !== player.coreTeamId) {
        return false;
      }

      return !selection.players.some((selectionPlayer) => selectionPlayer.playerId === player.id);
    }) ?? null
  );
}

export function getMostRecentRegisteredAppearance(
  playerId: string,
  currentMatch: MatchRecord,
  latestSavedSelections: RegisteredSelectionSnapshot[],
): MostRecentRegisteredAppearance | null {
  let mostRecentAppearance: MostRecentRegisteredAppearance | null = null;

  for (const selection of latestSavedSelections) {
    if (selection.match.startsAt >= currentMatch.startsAt) {
      continue;
    }

    const selectionPlayer = selection.players.find((p) => p.playerId === playerId);

    if (!selectionPlayer) {
      continue;
    }

    if (!mostRecentAppearance || selection.match.startsAt > mostRecentAppearance.match.startsAt) {
      mostRecentAppearance = {
        match: selection.match,
        roleType: selectionPlayer.roleType,
        status: selection.status,
      };
    }
  }

  return mostRecentAppearance;
}

export function getRepeatRotationBlockCode(candidateCategory: RotationCandidateCategory) {
  if (candidateCategory === "SUPPORT") {
    return "support_return_to_core_before_repeat";
  }

  if (candidateCategory === "DEVELOPMENT") {
    return "development_return_to_core_before_repeat";
  }

  return "rotation_return_to_core_before_repeat";
}

export function getRegisteredAppearanceCounts(
  latestSavedSelections: RegisteredSelectionSnapshot[],
) {
  const registeredAppearanceCountByPlayerId = new Map<string, number>();

  for (const selection of latestSavedSelections) {
    for (const selectionPlayer of selection.players) {
      registeredAppearanceCountByPlayerId.set(
        selectionPlayer.playerId,
        (registeredAppearanceCountByPlayerId.get(selectionPlayer.playerId) ?? 0) + 1,
      );
    }
  }

  return registeredAppearanceCountByPlayerId;
}

export function buildRepeatRotationBlockReason(
  candidateCategory: RotationCandidateCategory,
  player: PlayerRecord,
  playerName: string,
  mostRecentAppearance: MostRecentRegisteredAppearance,
) {
  const recentRole = mostRecentAppearance.roleType.toLowerCase();
  const recentStatus = formatSelectionStatus(mostRecentAppearance.status);
  const recentMatchDate = formatShortDate(mostRecentAppearance.match.startsAt);
  const recentTargetTeamName = mostRecentAppearance.match.team.name;

  if (candidateCategory === "SUPPORT") {
    return `Excluded because ${playerName} already has a ${recentStatus} ${recentRole} appearance for ${recentTargetTeamName} on ${recentMatchDate}. ${player.coreTeam?.name ?? "Unassigned"} must get an own core-team match before ${playerName} can take another support slot.`;
  }

  if (candidateCategory === "DEVELOPMENT") {
    return `Excluded because ${playerName} already has a ${recentStatus} ${recentRole} appearance for ${recentTargetTeamName} on ${recentMatchDate}. ${player.coreTeam?.name ?? "Unassigned"} must get an own core-team match before ${playerName} can take another development slot.`;
  }

  return `Excluded because ${playerName} already has a ${recentStatus} ${recentRole} appearance for ${recentTargetTeamName} on ${recentMatchDate}. ${player.coreTeam?.name ?? "Unassigned"} must get an own core-team match before ${playerName} can rotate again.`;
}

export function buildRegisteredMatchConflict(
  playerName: string,
  currentMatch: MatchRecord,
  registeredPlans: RegisteredSelectionSnapshot[],
  rules: Awaited<ReturnType<typeof getRules>>,
) {
  for (const registeredPlan of registeredPlans) {
    if (isSameCalendarDay(currentMatch.startsAt, registeredPlan.match.startsAt)) {
      return {
        code: "registered_match_conflict",
        reason:
          `Excluded because ${playerName} already appears in a ${formatSelectionStatus(registeredPlan.status)} selection for ${registeredPlan.match.team.name} on ${formatShortDate(registeredPlan.match.startsAt)}.`,
      };
    }

    const dayDifference = getAbsoluteCalendarDayDifference(
      currentMatch.startsAt,
      registeredPlan.match.startsAt,
    );

    if (dayDifference < rules.minDaysBetweenAnyMatches) {
      return {
        code: "registered_minimum_match_spacing",
        reason:
          `Excluded because ${playerName} already appears in a ${formatSelectionStatus(registeredPlan.status)} selection on ${formatShortDate(registeredPlan.match.startsAt)} and the rules require at least ${rules.minDaysBetweenAnyMatches} days between matches.`,
      };
    }
  }

  return null;
}