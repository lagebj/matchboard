import { type Match, type Player, SelectionRole, SelectionStatus, type Team } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import {
  formatShortDate,
  getCalendarDayDifference,
  isInSameWeek,
  isSameCalendarDay,
} from "@/lib/date-utils";
import { isFloatingSelectionRole } from "@/lib/match-utils";
import { getRules } from "@/lib/rules/get-rules";
import { getCoreMatchDropHistory } from "@/lib/selection/get-core-match-drop-history";
import { getFinalizedPlayerHistory } from "@/lib/selection/get-finalized-player-history";
import { getFloatingHistory } from "@/lib/selection/get-floating-history";
import { getPlanningPeriodFairness } from "@/lib/selection/get-planning-period-fairness";
import { getTargetTeamEligibility } from "@/lib/selection/get-target-team-eligibility";
import type {
  AutomaticSelectionCategory,
  ExcludedPlayer,
  ExplanationRecord,
  GeneratedSelection,
  SelectedPlayer,
  SelectionWarning,
} from "@/lib/selection/types";

function buildExplanation(code: string, summary: string, hardRule = false): ExplanationRecord {
  return {
    code,
    summary,
    hardRule,
  };
}

function getPrimaryChosenPosition(primaryPosition: string): string {
  return primaryPosition.trim();
}

function getPositionMatchLevel(
  playerPrimaryPosition: string,
  playerSecondaryPosition: string | null,
  playerTertiaryPosition: string | null,
  neededPositions: string[],
): RotationCandidate["positionMatchLevel"] {
  if (neededPositions.length === 0) {
    return "none";
  }

  for (const pos of neededPositions) {
    if (playerPrimaryPosition === pos) {
      return "primary";
    }
  }

  for (const pos of neededPositions) {
    if (playerSecondaryPosition && playerSecondaryPosition === pos) {
      return "secondary";
    }
  }

  for (const pos of neededPositions) {
    if (playerTertiaryPosition && playerTertiaryPosition === pos) {
      return "tertiary";
    }
  }

  return "none";
}

function getSuitabilityAndReadinessScore(
  player: PlayerRecord,
  candidateCategory: RotationCandidate["candidateCategory"],
): number {
  if (candidateCategory === "SUPPORT") {
    if (player.supportSuitability === "strong") return 15;
    if (player.supportSuitability === "avoid") return -25;
    return 0;
  }

  if (candidateCategory === "DEVELOPMENT") {
    if (player.developmentReadiness === "ready") return 10;
    return 0;
  }

  return 0;
}

function isDevelopmentBlocked(player: PlayerRecord): boolean {
  return player.developmentReadiness === "not_ready";
}

function isSupportAvoidSuitability(player: PlayerRecord): boolean {
  return player.supportSuitability === "avoid";
}

function checkPathCooldown(
  playerId: string,
  playerCoreTeamId: string,
  targetTeamId: string,
  candidateCategory: RotationCandidate["candidateCategory"],
  rotationPaths: PathDestination[],
  finalizedSelections: { fromTeamId: string; matchStartsAt: Date; playerId: string; role: string; toTeamId: string }[],
  currentMatchDate: Date,
): { blocked: boolean; reason: string | null } {
  if (candidateCategory !== "SUPPORT" && candidateCategory !== "DEVELOPMENT") {
    return { blocked: false, reason: null };
  }

  const matchingPath = rotationPaths.find(
    (path) =>
      path.fromTeamId === playerCoreTeamId &&
      path.toTeamId === targetTeamId &&
      path.role.toUpperCase() === candidateCategory.toUpperCase(),
  );

  if (!matchingPath || matchingPath.cooldownRounds === null || matchingPath.cooldownRounds === undefined) {
    return { blocked: false, reason: null };
  }

  const cooldownRounds = matchingPath.cooldownRounds;
  if (cooldownRounds <= 0) {
    return { blocked: false, reason: null };
  }

  const pathSelections = finalizedSelections.filter(
    (sel) =>
      sel.playerId === playerId &&
      sel.fromTeamId === playerCoreTeamId &&
      sel.toTeamId === targetTeamId &&
      sel.role.toUpperCase() === candidateCategory.toUpperCase(),
  );

  const sortedSelections = pathSelections
    .filter((sel) => sel.matchStartsAt < currentMatchDate)
    .sort((a, b) => b.matchStartsAt.getTime() - a.matchStartsAt.getTime());

  if (sortedSelections.length === 0) {
    return { blocked: false, reason: null };
  }

  const mostRecentPathSelection = sortedSelections[0]!;

  const uniqueMatchDates = finalizedSelections
    .filter((sel) => sel.matchStartsAt < currentMatchDate)
    .map((sel) => sel.matchStartsAt.getTime());
  const uniqueRoundsSince = new Set(uniqueMatchDates.filter((d) => d >= mostRecentPathSelection.matchStartsAt.getTime())).size;

  if (uniqueRoundsSince <= cooldownRounds) {
    return {
      blocked: true,
      reason: `Path cooldown active: player already served as ${candidateCategory.toLowerCase()} from the same path within the last ${cooldownRounds} round(s).`,
    };
  }

  return { blocked: false, reason: null };
}

function getUniqueReasons(reasons: string[]) {
  return [...new Set(reasons.filter(Boolean))];
}

function formatTeamNameList(teamNames: string[]) {
  const uniqueTeamNames = [...new Set(teamNames.filter(Boolean))];

  if (uniqueTeamNames.length === 0) {
    return "";
  }

  if (uniqueTeamNames.length === 1) {
    return uniqueTeamNames[0]!;
  }

  return `${uniqueTeamNames.slice(0, -1).join(", ")} and ${uniqueTeamNames.at(-1)}`;
}

function getAbsoluteCalendarDayDifference(leftDate: Date, rightDate: Date): number {
  if (leftDate >= rightDate) {
    return getCalendarDayDifference(leftDate, rightDate);
  }

  return getCalendarDayDifference(rightDate, leftDate);
}

function getRecentLoadScore(history: Awaited<ReturnType<typeof getFinalizedPlayerHistory>>) {
  return history.slice(0, 3).length;
}

function getPositionNeedScore(selectedPlayers: SelectedPlayer[], chosenPosition: string) {
  return selectedPlayers.filter((player) => player.chosenPosition === chosenPosition).length;
}

function getAutomaticSelectionCategoryForRotationCandidate(
  candidateCategory: RotationCandidate["candidateCategory"],
): AutomaticSelectionCategory {
  if (candidateCategory === "SUPPORT") {
    return "SUPPORT";
  }

  if (candidateCategory === "DEVELOPMENT") {
    return "DEVELOPMENT";
  }

  if (candidateCategory === "BACKFILL") {
    return "BACKFILL";
  }

  if (candidateCategory === "CONFIDENCE_REBUILD") {
    return "CONFIDENCE_REBUILD";
  }

  return "DEVELOPMENT";
}

function formatSelectionStatus(status: SelectionStatus) {
  return status === SelectionStatus.FINALIZED ? "finalized" : "draft";
}

function buildShortSquadWarningMessage(
  selectedCount: number,
  squadSize: number,
  blockers: string[],
) {
  if (blockers.length === 0) {
    return `Only ${selectedCount} player(s) could be filled automatically for a target squad size of ${squadSize}.`;
  }

  return `Only ${selectedCount} player(s) could be filled automatically for a target squad size of ${squadSize}. Automatic filling stopped because ${blockers.join(" ")}`;
}

type PathDestination = {
  cooldownRounds: number | null;
  fromTeamId: string;
  role: string;
  toTeamId: string;
};

type PlayerRecord = Player & {
  coreTeam: Pick<Team, "id" | "name">;
  rotationPathsFromCoreTeam: PathDestination[];
};

type MatchRecord = Pick<Match, "id" | "startsAt" | "teamId"> & {
  team: Pick<Team, "developmentSlots" | "id" | "maxSquadSize" | "maxSupportCount" | "minCorePlayers" | "minSupportPlayers" | "name" | "targetSupportCount"> & {
    supportPriority: number;
  };
  developmentSlots: number;
  developmentSourceTeamIds: string[];
  supportSourceTeamIds: string[];
  supportSourceTeamNames: string[];
};

type RegisteredSelectionSnapshot = {
  match: MatchRecord;
  players: Array<{
    playerId: string;
    roleType: SelectionRole;
  }>;
  status: SelectionStatus;
};

type EvaluatedPlayer = {
  player: PlayerRecord;
  playerName: string;
  playerPosition: string;
};

type EligibleRotationPlayer = EvaluatedPlayer & {
  candidateCategory: "DEVELOPMENT" | "SUPPORT" | "BACKFILL" | "CONFIDENCE_REBUILD";
  eligibilityExplanation: string;
};

type RotationCandidate = EvaluatedPlayer & {
  candidateCategory: "DEVELOPMENT" | "SUPPORT" | "BACKFILL" | "CONFIDENCE_REBUILD";
  chosenPosition: string;
  cooldownBlocked: boolean;
  cooldownBlockReason: string | null;
  eligibilityExplanation: string;
  floatingHistory: Awaited<ReturnType<typeof getFloatingHistory>>;
  missedCoreMatchThisWeek: RegisteredSelectionSnapshot | null;
  positionMatchLevel: "primary" | "secondary" | "tertiary" | "none";
  priorityScore: number;
  registeredAppearanceCount: number;
  recentLoadScore: number;
  suitabilityScore: number;
};

type CoreCandidate = EvaluatedPlayer & {
  higherPriorityOpportunity: {
    kind: "development" | "support";
    match: MatchRecord;
  } | null;
  registeredAppearanceCount: number;
};

type MostRecentRegisteredAppearance = {
  match: MatchRecord;
  roleType: SelectionRole;
  status: SelectionStatus;
};

function getPlayerName(player: Pick<Player, "firstName" | "lastName">): string {
  return player.lastName ? `${player.firstName} ${player.lastName}` : player.firstName;
}

function getPathBasedCategory(
  player: PlayerRecord,
  targetMatch: MatchRecord,
): RotationCandidate["candidateCategory"] {
  if (targetMatch.supportSourceTeamIds.includes(player.coreTeamId)) {
    const supportPath = player.rotationPathsFromCoreTeam.find(
      (path) => path.toTeamId === targetMatch.teamId && path.role === "SUPPORT",
    );
    if (supportPath) {
      return "SUPPORT";
    }
  }

  if (
    targetMatch.team.developmentSlots > 0 &&
    targetMatch.developmentSourceTeamIds.includes(player.coreTeamId)
  ) {
    const devPath = player.rotationPathsFromCoreTeam.find(
      (path) => path.toTeamId === targetMatch.teamId && path.role === "DEVELOPMENT",
    );
    if (devPath) {
      return "DEVELOPMENT";
    }
  }

  const anyPath = player.rotationPathsFromCoreTeam.find(
    (path) => path.toTeamId === targetMatch.teamId,
  );
  if (anyPath) {
    if (anyPath.role === "SUPPORT") return "SUPPORT";
    if (anyPath.role === "DEVELOPMENT") return "DEVELOPMENT";
    if (anyPath.role === "CONFIDENCE_REBUILD") return "CONFIDENCE_REBUILD";
    if (anyPath.role === "BACKFILL") return "BACKFILL";
  }

  if (targetMatch.supportSourceTeamIds.includes(player.coreTeamId)) {
    return "SUPPORT";
  }

  if (
    targetMatch.team.developmentSlots > 0 &&
    targetMatch.developmentSourceTeamIds.includes(player.coreTeamId)
  ) {
    return "DEVELOPMENT";
  }

  return "DEVELOPMENT";
}

const SUPPORTED_POSITIONS = ["GK", "CB", "CM", "W", "ST"] as const;

function getNeededPositions(
  selectedPlayers: SelectedPlayer[],
  squadSize: number,
): string[] {
  if (selectedPlayers.length === 0) {
    return [...SUPPORTED_POSITIONS];
  }

  const positionCounts = new Map<string, number>();
  for (const pos of SUPPORTED_POSITIONS) {
    positionCounts.set(pos, 0);
  }
  for (const player of selectedPlayers) {
    const pos = player.chosenPosition ?? player.playerPosition;
    const normalized = pos.trim().toUpperCase();
    positionCounts.set(normalized, (positionCounts.get(normalized) ?? 0) + 1);
  }

  const maxCount = Math.max(...positionCounts.values());
  const minCount = Math.min(...positionCounts.values());

  if (maxCount === minCount) {
    return [...SUPPORTED_POSITIONS];
  }

  const needed: string[] = [];
  for (const [pos, count] of positionCounts) {
    if (count <= minCount + 1) {
      needed.push(pos);
    }
  }

  return needed.length > 0 ? needed : [...SUPPORTED_POSITIONS];
}

function getPositionMatchScore(level: RotationCandidate["positionMatchLevel"]): number {
  if (level === "primary") return 20;
  if (level === "secondary") return 10;
  if (level === "tertiary") return 5;
  return 0;
}

type PlanningPeriodRoleCounts = {
  coreCount: number;
  developmentCount: number;
  supportCount: number;
};

function getPlanningPeriodFairnessBonus(
  playerId: string,
  planningPeriodCounts: Map<string, PlanningPeriodRoleCounts> | null,
  candidateCategory: RotationCandidate["candidateCategory"],
): number {
  if (!planningPeriodCounts) return 0;

  const counts = planningPeriodCounts.get(playerId);
  if (!counts) return 0;

  if (counts.coreCount === 0) {
    if (candidateCategory === "SUPPORT" || candidateCategory === "BACKFILL") {
      return -8;
    }
    if (candidateCategory === "DEVELOPMENT") {
      return -5;
    }
  }

  if (counts.supportCount > counts.coreCount) {
    if (candidateCategory === "SUPPORT" || candidateCategory === "BACKFILL") {
      return -6;
    }
  }

  if (candidateCategory === "SUPPORT" || candidateCategory === "BACKFILL") {
    return counts.supportCount * -2;
  }

  if (candidateCategory === "DEVELOPMENT") {
    return counts.developmentCount * -2;
  }

  return counts.coreCount * -1;
}

function getRotationCandidatePriorityScore(
  candidate: Omit<RotationCandidate, "priorityScore">,
  selectedPlayers: SelectedPlayer[],
  planningPeriodCounts: Map<string, PlanningPeriodRoleCounts> | null,
) {
  return (
    50 +
    (candidate.candidateCategory === "SUPPORT" ? 40 : 0) +
    (candidate.candidateCategory === "DEVELOPMENT" ? 25 : 0) +
    (candidate.missedCoreMatchThisWeek ? 30 : 0) +
    getPositionMatchScore(candidate.positionMatchLevel) +
    candidate.suitabilityScore +
    getPlanningPeriodFairnessBonus(candidate.player.id, planningPeriodCounts, candidate.candidateCategory) -
    candidate.registeredAppearanceCount * 4 -
    candidate.floatingHistory.totalFloatingMatches * 3 -
    candidate.recentLoadScore * 2 -
    getPositionNeedScore(selectedPlayers, candidate.chosenPosition) * 3
  );
}

function getRankedRotationCandidates(
  candidates: Array<Omit<RotationCandidate, "priorityScore">>,
  selectedPlayers: SelectedPlayer[],
  planningPeriodCounts: Map<string, PlanningPeriodRoleCounts> | null,
) {
  return candidates
    .map((candidate) => ({
      ...candidate,
      priorityScore: getRotationCandidatePriorityScore(candidate, selectedPlayers, planningPeriodCounts),
    }))
    .sort((left, right) => {
      const leftCategoryPriority =
        left.candidateCategory === "SUPPORT" ? 3 : left.candidateCategory === "DEVELOPMENT" ? 2 : 1;
      const rightCategoryPriority =
        right.candidateCategory === "SUPPORT" ? 3 : right.candidateCategory === "DEVELOPMENT" ? 2 : 1;

      if (leftCategoryPriority !== rightCategoryPriority) {
        return rightCategoryPriority - leftCategoryPriority;
      }

      if (left.priorityScore !== right.priorityScore) {
        return right.priorityScore - left.priorityScore;
      }

      return left.playerName.localeCompare(right.playerName);
    });
}

function findHigherPriorityOpportunity(
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
    (path) => path.toTeamId !== player.coreTeamId && path.role !== "CORE",
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

      return (
        otherMatch.supportSourceTeamIds.includes(player.coreTeamId) ||
        otherMatch.developmentSourceTeamIds.includes(player.coreTeamId)
      );
    }) ?? null;

  if (!matchedOpportunity) {
    return null;
  }

  return {
    kind: getHigherPriorityOpportunityKind(player, matchedOpportunity),
    match: matchedOpportunity,
  };
}

function getHigherPriorityOpportunityKind(
  player: PlayerRecord,
  match: MatchRecord,
): "development" | "support" {
  if (match.supportSourceTeamIds.includes(player.coreTeamId)) {
    return "support";
  }

  return "development";
}

function buildCandidateBlockerSummary(
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

function findMissedCoreMatchThisWeek(
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

function getMostRecentRegisteredAppearance(
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

function getRepeatRotationBlockCode(candidateCategory: RotationCandidate["candidateCategory"]) {
  if (candidateCategory === "SUPPORT") {
    return "support_return_to_core_before_repeat";
  }

  if (candidateCategory === "DEVELOPMENT") {
    return "development_return_to_core_before_repeat";
  }

  return "rotation_return_to_core_before_repeat";
}

function getRegisteredAppearanceCounts(
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

function buildRepeatRotationBlockReason(
  candidateCategory: RotationCandidate["candidateCategory"],
  player: PlayerRecord,
  playerName: string,
  mostRecentAppearance: MostRecentRegisteredAppearance,
) {
  const recentRole = mostRecentAppearance.roleType.toLowerCase();
  const recentStatus = formatSelectionStatus(mostRecentAppearance.status);
  const recentMatchDate = formatShortDate(mostRecentAppearance.match.startsAt);
  const recentTargetTeamName = mostRecentAppearance.match.team.name;

  if (candidateCategory === "SUPPORT") {
    return `Excluded because ${playerName} already has a ${recentStatus} ${recentRole} appearance for ${recentTargetTeamName} on ${recentMatchDate}. ${player.coreTeam.name} must get an own core-team match before ${playerName} can take another support slot.`;
  }

  if (candidateCategory === "DEVELOPMENT") {
    return `Excluded because ${playerName} already has a ${recentStatus} ${recentRole} appearance for ${recentTargetTeamName} on ${recentMatchDate}. ${player.coreTeam.name} must get an own core-team match before ${playerName} can take another development slot.`;
  }

  return `Excluded because ${playerName} already has a ${recentStatus} ${recentRole} appearance for ${recentTargetTeamName} on ${recentMatchDate}. ${player.coreTeam.name} must get an own core-team match before ${playerName} can rotate again.`;
}

function buildRegisteredMatchConflict(
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

export async function generateSelection(matchId: string, options?: { deferRotation?: boolean }): Promise<GeneratedSelection> {
  const deferRotation = options?.deferRotation ?? false;
  const [match, players, rules, registeredMatches, savedSelections, rotationPaths, finalizedPathHistory] = await Promise.all([
    db.match.findUnique({
      where: { id: matchId },
      include: {
        team: {
          select: {
            developmentTargetRelationships: {
              select: {
                sourceTeamId: true,
              },
            },
            developmentSlots: true,
            id: true,
            maxSquadSize: true,
            maxSupportCount: true,
            minCorePlayers: true,
            minSupportPlayers: true,
            name: true,
            supportPriority: true,
            targetSupportCount: true,
            supportTargetRelationships: {
              select: {
                sourceTeamId: true,
                sourceTeam: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    }),
    db.player.findMany({
      where: {
        removedAt: null,
      },
      include: {
        coreTeam: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [
        {
          coreTeam: {
            name: "asc",
          },
        },
        { firstName: "asc" },
        { lastName: "asc" },
        { playerCode: "asc" },
      ],
    }),
    getRules(),
    db.match.findMany({
      where: {
        id: {
          not: matchId,
        },
      },
      include: {
        team: {
          select: {
            developmentTargetRelationships: {
              select: {
                sourceTeamId: true,
              },
            },
            developmentSlots: true,
            id: true,
            maxSquadSize: true,
            maxSupportCount: true,
            minCorePlayers: true,
            minSupportPlayers: true,
            name: true,
            supportPriority: true,
            targetSupportCount: true,
            supportTargetRelationships: {
              select: {
                sourceTeamId: true,
                sourceTeam: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [{ startsAt: "asc" }, { createdAt: "asc" }],
    }),
    db.selection.findMany({
      where: {
        matchId: {
          not: matchId,
        },
      },
      select: {
        matchId: true,
        status: true,
        playerId: true,
        role: true,
        explanation: true,
        match: {
          select: {
            id: true,
            startsAt: true,
            teamId: true,
        team: {
          select: {
            developmentTargetRelationships: {
              select: {
                sourceTeamId: true,
              },
            },
            developmentSlots: true,
            id: true,
            maxSquadSize: true,
            maxSupportCount: true,
            minCorePlayers: true,
            minSupportPlayers: true,
            name: true,
            supportPriority: true,
            targetSupportCount: true,
            supportTargetRelationships: {
              select: {
                sourceTeamId: true,
                sourceTeam: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
          },
        },
      },
      orderBy: [{ createdAt: "desc" }],
    }),
    db.rotationPath.findMany({
      where: {
        active: true,
      },
      select: {
        cooldownRounds: true,
        fromTeamId: true,
        role: true,
        toTeamId: true,
      },
    }),
    db.movementLedger.findMany({
      where: {
        isDraft: false,
      },
      select: {
        fromTeamId: true,
        match: {
          select: {
            startsAt: true,
          },
        },
        playerId: true,
        role: true,
        toTeamId: true,
      },
      orderBy: [{ createdAt: "desc" }],
    }),
  ]);

  if (!match) {
    throw new Error("Match not found.");
  }

  const playerLocks = await db.playerLock.findMany({
    where: {
      matchRoundId: match.matchRoundId,
    },
    select: {
      id: true,
      lockType: true,
      playerId: true,
      reason: true,
    },
  });

  const matchRound = await db.matchRound.findUnique({
    where: { id: match.matchRoundId },
    select: { planningPeriodId: true },
  });

  const planningPeriodCounts = new Map<string, PlanningPeriodRoleCounts>();

  if (matchRound?.planningPeriodId) {
    const fairness = await getPlanningPeriodFairness(matchRound.planningPeriodId);
    for (const playerResult of fairness.players) {
      planningPeriodCounts.set(playerResult.playerId, {
        coreCount: playerResult.coreCount,
        developmentCount: playerResult.developmentCount,
        supportCount: playerResult.supportCount,
      });
    }
  }

  const lockedOutPlayerIds = new Set<string>();
  const lockedInPlayerIds = new Set<string>();

  for (const lock of playerLocks) {
    if (lock.lockType === "LOCKED_OUT") {
      lockedOutPlayerIds.add(lock.playerId);
    } else if (lock.lockType === "LOCKED_IN") {
      lockedInPlayerIds.add(lock.playerId);
    }
  }

  const pathHistoryEntries = finalizedPathHistory.map((entry) => ({
    fromTeamId: entry.fromTeamId,
    matchStartsAt: entry.match.startsAt,
    playerId: entry.playerId,
    role: entry.role,
    toTeamId: entry.toTeamId,
  }));

  const playerPathMap = new Map<string, PathDestination[]>();

  for (const player of players) {
    const pathsForPlayer = rotationPaths.filter(
      (path) => path.fromTeamId === player.coreTeamId && path.toTeamId !== player.coreTeamId,
    );
    playerPathMap.set(player.id, pathsForPlayer as PathDestination[]);
  }

  const playerRecords: PlayerRecord[] = players.map((player) => ({
    ...player,
    rotationPathsFromCoreTeam: playerPathMap.get(player.id) ?? [],
  }));

  const latestSavedSelectionByMatchId = new Map<string, RegisteredSelectionSnapshot>();

  for (const selectionRecord of savedSelections) {
    const explanation = (selectionRecord.explanation ?? {}) as Record<string, unknown>;
    if (explanation.manuallyRemoved === true) {
      continue;
    }

    if (latestSavedSelectionByMatchId.has(selectionRecord.matchId)) {
      continue;
    }

    const matchSelections = savedSelections.filter(
      (s) => s.matchId === selectionRecord.matchId,
    );
    const manuallyRemoved = matchSelections.filter((s) => {
      const e = (s.explanation ?? {}) as Record<string, unknown>;
      return e.manuallyRemoved === true;
    });
    const filteredSelections = matchSelections.filter((s) => {
      const e = (s.explanation ?? {}) as Record<string, unknown>;
      return e.manuallyRemoved !== true;
    });

    if (filteredSelections.length === 0) {
      continue;
    }

    latestSavedSelectionByMatchId.set(selectionRecord.matchId, {
      match: {
        developmentSlots: selectionRecord.match.team.developmentSlots,
        id: selectionRecord.match.id,
        developmentSourceTeamIds: selectionRecord.match.team.developmentTargetRelationships.map(
          (relationship) => relationship.sourceTeamId,
        ),
        startsAt: selectionRecord.match.startsAt,
        supportSourceTeamIds: selectionRecord.match.team.supportTargetRelationships.map(
          (relationship) => relationship.sourceTeamId,
        ),
        supportSourceTeamNames: selectionRecord.match.team.supportTargetRelationships.map(
          (relationship) => relationship.sourceTeam.name,
        ),
        team: selectionRecord.match.team,
        teamId: selectionRecord.match.teamId,
      },
      players: filteredSelections.map((s) => ({
        playerId: s.playerId,
        roleType: s.role,
      })),
      status: selectionRecord.status,
    });
  }

  const latestSavedSelections = [...latestSavedSelectionByMatchId.values()];
  const registeredAppearanceCountByPlayerId = getRegisteredAppearanceCounts(latestSavedSelections);
  const registeredPlansByPlayerId = new Map<string, RegisteredSelectionSnapshot[]>();

  for (const selection of latestSavedSelections) {
    for (const selectionPlayer of selection.players) {
      const existingPlans = registeredPlansByPlayerId.get(selectionPlayer.playerId) ?? [];
      existingPlans.push({
        match: selection.match,
        players: [selectionPlayer],
        status: selection.status,
      });
      registeredPlansByPlayerId.set(selectionPlayer.playerId, existingPlans);
    }
  }

  const currentMatchRecord: MatchRecord = {
    // NOTE: supportPriority is surfaced here for future round-level generation.
    // True cross-match priority ordering requires round-level generation (Phase 7).
    // For per-match generation, each match resolves its own support independently.
    developmentSlots: match.team.developmentSlots,
    developmentSourceTeamIds: match.team.developmentTargetRelationships.map(
      (relationship) => relationship.sourceTeamId,
    ),
    id: match.id,
    startsAt: match.startsAt,
    supportSourceTeamIds: match.team.supportTargetRelationships.map(
      (relationship) => relationship.sourceTeamId,
    ),
    supportSourceTeamNames: match.team.supportTargetRelationships.map(
      (relationship) => relationship.sourceTeam.name,
    ),
    team: match.team,
    teamId: match.teamId,
  };
  const normalizedRegisteredMatches: MatchRecord[] = registeredMatches.map((registeredMatch) => ({
    developmentSlots: registeredMatch.team.developmentSlots,
    developmentSourceTeamIds: registeredMatch.team.developmentTargetRelationships.map(
      (relationship) => relationship.sourceTeamId,
    ),
    id: registeredMatch.id,
    startsAt: registeredMatch.startsAt,
    supportSourceTeamIds: registeredMatch.team.supportTargetRelationships.map(
      (relationship) => relationship.sourceTeamId,
    ),
    supportSourceTeamNames: registeredMatch.team.supportTargetRelationships.map(
      (relationship) => relationship.sourceTeam.name,
    ),
    team: registeredMatch.team,
    teamId: registeredMatch.teamId,
  }));

  const allRotationPathDestinations: PathDestination[] = rotationPaths.filter(
    (path) => path.fromTeamId !== path.toTeamId,
  ) as PathDestination[];

  const selectedPlayers: SelectedPlayer[] = [];
  const excludedPlayers: ExcludedPlayer[] = [];
  const warnings: SelectionWarning[] = [];
  const eligibleCorePlayers: CoreCandidate[] = [];
  const eligibleRotationPlayers: EligibleRotationPlayer[] = [];
  const playerById = new Map(playerRecords.map((player) => [player.id, player]));

  for (const player of playerRecords) {
    const playerName = getPlayerName(player);
    const playerPosition = player.primaryPosition;
    const evaluatedPlayer = {
      player,
      playerName,
      playerPosition,
    };

    if (!player.active) {
      const exclusionReason = "Excluded because the player is inactive.";
      excludedPlayers.push({
        autoSelected: false,
        coreTeamId: player.coreTeam.id,
        coreTeamName: player.coreTeam.name,
        eligibility: false,
        explanations: [buildExplanation("inactive_player", exclusionReason, true)],
        finalSelected: false,
        manualOverride: false,
        playerId: player.id,
        playerName,
        playerPosition,
        priorityScore: null,
        selectionCategory: "EXCLUDED",
        automaticSelectionCategory: null,
        exclusionReason,
      });
      continue;
    }

    if (player.currentAvailability === "INJURED" || player.currentAvailability === "SICK" || player.currentAvailability === "AWAY") {
      const exclusionReason = `Excluded because the player is currently marked as ${player.currentAvailability.toLowerCase()}.`;
      excludedPlayers.push({
        autoSelected: false,
        coreTeamId: player.coreTeam.id,
        coreTeamName: player.coreTeam.name,
        eligibility: false,
        explanations: [buildExplanation("availability_rule", exclusionReason, true)],
        finalSelected: false,
        manualOverride: false,
        playerId: player.id,
        playerName,
        playerPosition,
        priorityScore: null,
        selectionCategory: "EXCLUDED",
        automaticSelectionCategory: null,
        exclusionReason,
      });
      continue;
    }

    if (lockedOutPlayerIds.has(player.id)) {
      const lockRecord = playerLocks.find((lock) => lock.playerId === player.id && lock.lockType === "LOCKED_OUT");
      const lockReason = lockRecord?.reason ? ` ${lockRecord.reason}` : "";
      const exclusionReason = `Excluded because the player is manually locked out of this match round.${lockReason}`;
      excludedPlayers.push({
        autoSelected: false,
        coreTeamId: player.coreTeam.id,
        coreTeamName: player.coreTeam.name,
        eligibility: false,
        explanations: [buildExplanation("player_locked_out", exclusionReason, true)],
        finalSelected: false,
        manualOverride: false,
        playerId: player.id,
        playerName,
        playerPosition,
        priorityScore: null,
        selectionCategory: "EXCLUDED",
        automaticSelectionCategory: null,
        exclusionReason,
      });
      continue;
    }

    const playerPathDestinations = player.rotationPathsFromCoreTeam.filter(
      (path) => path.toTeamId === currentMatchRecord.teamId,
    );

    const eligibility = getTargetTeamEligibility(player, match.team, playerPathDestinations);

    if (player.currentAvailability === "UNKNOWN") {
      const isSupportCandidate = currentMatchRecord.supportSourceTeamIds.includes(player.coreTeamId);
      if (isSupportCandidate) {
        warnings.push({
          code: "unknown_availability_support",
          message: `${playerName} has unknown availability and cannot count toward required support for ${currentMatchRecord.team.name}. Confirm availability before relying on this player.`,
          playerId: player.id,
        });
      }
      const exclusionReason = `Excluded because the player has unknown availability. Confirm availability before selection.`;
      excludedPlayers.push({
        autoSelected: false,
        coreTeamId: player.coreTeam.id,
        coreTeamName: player.coreTeam.name,
        eligibility: false,
        explanations: [buildExplanation("unknown_availability", exclusionReason, true)],
        finalSelected: false,
        manualOverride: false,
        playerId: player.id,
        playerName,
        playerPosition,
        priorityScore: null,
        selectionCategory: "EXCLUDED",
        automaticSelectionCategory: null,
        exclusionReason,
      });
      continue;
    }

    if (!eligibility.allowed) {
      excludedPlayers.push({
        autoSelected: false,
        coreTeamId: player.coreTeam.id,
        coreTeamName: player.coreTeam.name,
        eligibility: false,
        explanations: [buildExplanation("target_team_eligibility", eligibility.explanation, true)],
        finalSelected: false,
        manualOverride: false,
        playerId: player.id,
        playerName,
        playerPosition,
        priorityScore: null,
        selectionCategory: "EXCLUDED",
        automaticSelectionCategory: null,
        exclusionReason: eligibility.explanation,
      });
      continue;
    }

    const registeredConflict = buildRegisteredMatchConflict(
      playerName,
      currentMatchRecord,
      registeredPlansByPlayerId.get(player.id) ?? [],
      rules,
    );

    if (registeredConflict) {
      excludedPlayers.push({
        autoSelected: false,
        coreTeamId: player.coreTeam.id,
        coreTeamName: player.coreTeam.name,
        eligibility: false,
        explanations: [buildExplanation(registeredConflict.code, registeredConflict.reason, true)],
        finalSelected: false,
        manualOverride: false,
        playerId: player.id,
        playerName,
        playerPosition,
        priorityScore: null,
        selectionCategory: "EXCLUDED",
        automaticSelectionCategory:
          eligibility.selectionCategory === "CORE"
            ? "CORE"
            : getAutomaticSelectionCategoryForRotationCandidate(
                getPathBasedCategory(player, currentMatchRecord),
              ),
        exclusionReason: registeredConflict.reason,
      });
      continue;
    }

    if (player.currentAvailability === "TENTATIVE") {
      warnings.push({
        code: "tentative_availability",
        message: `${playerName} is tentative. Selection includes this player but the coach should confirm availability before finalizing.`,
        playerId: player.id,
      });
    }

    if (eligibility.selectionCategory === "CORE") {
      eligibleCorePlayers.push({
        ...evaluatedPlayer,
        higherPriorityOpportunity: deferRotation
          ? null
          : findHigherPriorityOpportunity(
              player,
              currentMatchRecord,
              normalizedRegisteredMatches,
              rules,
              allRotationPathDestinations,
            ),
        registeredAppearanceCount: registeredAppearanceCountByPlayerId.get(player.id) ?? 0,
      });
      continue;
    }

    eligibleRotationPlayers.push({
      ...evaluatedPlayer,
      candidateCategory: getPathBasedCategory(player, currentMatchRecord),
      eligibilityExplanation: eligibility.explanation,
    });
  }

  const selectedCorePlayers = [...eligibleCorePlayers];

  if (selectedCorePlayers.length > match.squadSize) {
    const overflowCount = selectedCorePlayers.length - match.squadSize;

    const reducedLoadCandidates = selectedCorePlayers
      .filter((candidate) => candidate.player.reducedMatchLoadAllowed)
      .filter((candidate) => {
        const candidatePaths = candidate.player.rotationPathsFromCoreTeam;
        if (candidatePaths.length === 0) return true;
        const mostRecent = getMostRecentRegisteredAppearance(candidate.player.id, currentMatchRecord, latestSavedSelections);
        if (!mostRecent) return true;
        if (mostRecent.roleType !== SelectionRole.REDUCED_MATCH_LOAD_DROP && mostRecent.roleType !== SelectionRole.CORE_MATCH_DROP) return true;
        return false;
      });

    const coreDropCandidates = await Promise.all(
      selectedCorePlayers
        .filter((candidate) => !candidate.player.reducedMatchLoadAllowed)
        .map(async (candidate) => ({
          candidate,
          inferredDroppedCoreMatches: await getCoreMatchDropHistory({
            coreTeamId: candidate.player.coreTeamId,
            currentMatchDate: match.startsAt,
            currentMatchId: match.id,
            minDaysBetweenAnyMatches: rules.minDaysBetweenAnyMatches,
            playerId: candidate.player.id,
          }),
        })),
    );

    const droppableCoreCandidates = coreDropCandidates
      .sort((left, right) => {
        if (left.inferredDroppedCoreMatches !== right.inferredDroppedCoreMatches) {
          return left.inferredDroppedCoreMatches - right.inferredDroppedCoreMatches;
        }

        if (left.candidate.registeredAppearanceCount !== right.candidate.registeredAppearanceCount) {
          return right.candidate.registeredAppearanceCount - left.candidate.registeredAppearanceCount;
        }

        return left.candidate.playerName.localeCompare(right.candidate.playerName);
      });

    const allDroppableCandidates = [
      ...reducedLoadCandidates.map((c) => ({ candidate: c, dropType: "REDUCED_MATCH_LOAD_DROP" as const })),
      ...droppableCoreCandidates.map((c) => ({ candidate: c.candidate, dropType: "CORE_MATCH_DROP" as const })),
    ].sort((left, right) => {
      const leftReduced = left.dropType === "REDUCED_MATCH_LOAD_DROP" ? 0 : 1;
      const rightReduced = right.dropType === "REDUCED_MATCH_LOAD_DROP" ? 0 : 1;
      if (leftReduced !== rightReduced) return leftReduced - rightReduced;
      return left.candidate.playerName.localeCompare(right.candidate.playerName);
    });

    for (const { candidate, dropType } of allDroppableCandidates.slice(0, overflowCount)) {
      const isReducedLoadDrop = dropType === "REDUCED_MATCH_LOAD_DROP";
      const dropReason = isReducedLoadDrop
        ? `${candidate.playerName} was excluded because the player is marked for reduced match load and this slot is being used as that drop.`
        : `${candidate.playerName} was excluded as a surplus core player available for core match drop.`;
      const dropCode = isReducedLoadDrop ? "reduced_match_load_drop_rule" : "core_match_drop_rule";

      excludedPlayers.push({
        autoSelected: false,
        coreTeamId: candidate.player.coreTeam.id,
        coreTeamName: candidate.player.coreTeam.name,
        eligibility: true,
        explanations: [
          buildExplanation("eligible_core_player", "Eligible as a core player before applying the drop rule.", true),
          buildExplanation(dropCode, dropReason, true),
        ],
        finalSelected: false,
        manualOverride: false,
        playerId: candidate.player.id,
        playerName: candidate.playerName,
        playerPosition: candidate.playerPosition,
        priorityScore: null,
        selectionCategory: "EXCLUDED",
        automaticSelectionCategory: "CORE",
        exclusionReason: isReducedLoadDrop ? "Dropped by the reduced-match-load drop rule." : "Dropped by the core-match drop rule.",
      });

      const candidateIndex = selectedCorePlayers.findIndex(
        (selectedCandidate) => selectedCandidate.player.id === candidate.player.id,
      );

      if (candidateIndex >= 0) {
        selectedCorePlayers.splice(candidateIndex, 1);
      }
    }
  }

  const availableRotationCandidates: Omit<RotationCandidate, "priorityScore">[] = [];

  for (const { candidateCategory, eligibilityExplanation, player, playerName, playerPosition } of eligibleRotationPlayers) {
    if (candidateCategory === "DEVELOPMENT" && isDevelopmentBlocked(player)) {
      excludedPlayers.push({
        autoSelected: false,
        coreTeamId: player.coreTeam.id,
        coreTeamName: player.coreTeam.name,
        eligibility: true,
        explanations: [
          buildExplanation("rotation_path_allowed", eligibilityExplanation, true),
          buildExplanation("development_not_ready", `Excluded because ${playerName} is marked as development readiness "not_ready" and cannot be automatically selected for development rotation.`, true),
        ],
        finalSelected: false,
        manualOverride: false,
        playerId: player.id,
        playerName,
        playerPosition,
        priorityScore: null,
        selectionCategory: "EXCLUDED",
        automaticSelectionCategory: "DEVELOPMENT",
        exclusionReason: `Excluded because ${playerName} is marked as development readiness "not_ready".`,
      });
      continue;
    }

    const cooldownResult = checkPathCooldown(
      player.id,
      player.coreTeamId,
      currentMatchRecord.teamId,
      candidateCategory,
      rotationPaths,
      pathHistoryEntries,
      match.startsAt,
    );

    if (cooldownResult.blocked) {
      excludedPlayers.push({
        autoSelected: false,
        coreTeamId: player.coreTeam.id,
        coreTeamName: player.coreTeam.name,
        eligibility: true,
        explanations: [
          buildExplanation("rotation_path_allowed", eligibilityExplanation, true),
          buildExplanation("path_cooldown_active", cooldownResult.reason!, true),
        ],
        finalSelected: false,
        manualOverride: false,
        playerId: player.id,
        playerName,
        playerPosition,
        priorityScore: null,
        selectionCategory: "EXCLUDED",
        automaticSelectionCategory: getAutomaticSelectionCategoryForRotationCandidate(candidateCategory),
        exclusionReason: cooldownResult.reason!,
      });
      continue;
    }

    const [floatingHistory, finalizedHistory] = await Promise.all([
      getFloatingHistory(player.id, match.startsAt),
      getFinalizedPlayerHistory(player.id, match.id, match.startsAt),
    ]);
    const mostRecentAppearance = getMostRecentRegisteredAppearance(
      player.id,
      currentMatchRecord,
      latestSavedSelections,
    );

    if (
      mostRecentAppearance &&
      isFloatingSelectionRole(mostRecentAppearance.roleType)
    ) {
      const exclusionReason = buildRepeatRotationBlockReason(
        candidateCategory,
        player,
        playerName,
        mostRecentAppearance,
      );

      excludedPlayers.push({
        autoSelected: false,
        coreTeamId: player.coreTeam.id,
        coreTeamName: player.coreTeam.name,
        eligibility: true,
        explanations: [
          buildExplanation("rotation_path_allowed", eligibilityExplanation, true),
          buildExplanation(getRepeatRotationBlockCode(candidateCategory), exclusionReason, true),
        ],
        finalSelected: false,
        manualOverride: false,
        playerId: player.id,
        playerName,
        playerPosition,
        priorityScore: null,
        selectionCategory: "EXCLUDED",
        automaticSelectionCategory: getAutomaticSelectionCategoryForRotationCandidate(candidateCategory),
        exclusionReason,
      });
      continue;
    }

    const neededPositions = getNeededPositions(selectedPlayers, match.squadSize);
    const positionMatchLevel = getPositionMatchLevel(
      player.primaryPosition,
      player.secondaryPosition,
      player.tertiaryPosition,
      neededPositions,
    );
    const suitabilityScore = getSuitabilityAndReadinessScore(player, candidateCategory);

    availableRotationCandidates.push({
      candidateCategory,
      chosenPosition: getPrimaryChosenPosition(player.primaryPosition),
      cooldownBlocked: false,
      cooldownBlockReason: null,
      eligibilityExplanation,
      floatingHistory,
      missedCoreMatchThisWeek: findMissedCoreMatchThisWeek(
        player,
        currentMatchRecord,
        latestSavedSelections,
      ),
      player,
      playerName,
      playerPosition,
      positionMatchLevel,
      registeredAppearanceCount: registeredAppearanceCountByPlayerId.get(player.id) ?? 0,
      recentLoadScore: getRecentLoadScore(finalizedHistory),
      suitabilityScore,
    });
  }

  selectedCorePlayers.sort((left, right) => {
    const leftPriority = left.higherPriorityOpportunity
      ? left.higherPriorityOpportunity.kind === "support"
        ? 4
        : 3
      : left.player.reducedMatchLoadAllowed
        ? 2
        : 0;
    const rightPriority = right.higherPriorityOpportunity
      ? right.higherPriorityOpportunity.kind === "support"
        ? 4
        : 3
      : right.player.reducedMatchLoadAllowed
        ? 2
        : 0;

    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }

    const leftCoreCount = planningPeriodCounts.get(left.player.id)?.coreCount ?? 0;
    const rightCoreCount = planningPeriodCounts.get(right.player.id)?.coreCount ?? 0;

    if (leftCoreCount !== rightCoreCount) {
      return leftCoreCount - rightCoreCount;
    }

    if (left.registeredAppearanceCount !== right.registeredAppearanceCount) {
      return left.registeredAppearanceCount - right.registeredAppearanceCount;
    }

    return left.playerName.localeCompare(right.playerName);
  });

  let directSupportTarget = deferRotation ? 0 : Math.min(match.team.minSupportPlayers, match.squadSize);
  const supportCandidateCount = availableRotationCandidates.filter(
    (candidate) => candidate.candidateCategory === "SUPPORT",
  ).length;
  const reservedDirectSupportPlayers = deferRotation ? 0 : Math.min(directSupportTarget, supportCandidateCount);
  const developmentCandidateCount = availableRotationCandidates.filter(
    (candidate) => candidate.candidateCategory === "DEVELOPMENT",
  ).length;
  const preservedForSupportCandidates = selectedCorePlayers.filter(
    (candidate) => candidate.higherPriorityOpportunity?.kind === "support",
  );

  let reservedSupportPlayers: number;
  let reservedDevelopmentPlayers: number;
  let effectiveSupportTarget: number;
  let effectiveDevelopmentTarget: number;
  let effectiveExtraSupportBackfillTarget = 0;

  if (deferRotation) {
    reservedSupportPlayers = 0;
    reservedDevelopmentPlayers = 0;
    effectiveSupportTarget = 0;
    effectiveDevelopmentTarget = 0;
    directSupportTarget = 0;
  } else {
    const extraSupportBackfillTarget = Math.min(
      Math.max(
        match.squadSize - reservedDirectSupportPlayers - (selectedCorePlayers.length - preservedForSupportCandidates.length),
        0,
      ),
      Math.max(match.squadSize - directSupportTarget, 0),
    );
    const uncappedSupportTarget = Math.min(
      directSupportTarget + extraSupportBackfillTarget,
      match.squadSize,
    );
    const configuredSupportCap = match.team.targetSupportCount || match.team.maxSupportCount;
    effectiveSupportTarget = configuredSupportCap
      ? Math.min(uncappedSupportTarget, configuredSupportCap)
      : uncappedSupportTarget;
    reservedSupportPlayers = Math.min(effectiveSupportTarget, supportCandidateCount);
    effectiveDevelopmentTarget = Math.min(
      currentMatchRecord.developmentSlots,
      Math.max(match.squadSize - reservedSupportPlayers, 0),
    );
    reservedDevelopmentPlayers = Math.min(effectiveDevelopmentTarget, developmentCandidateCount);
    effectiveExtraSupportBackfillTarget = extraSupportBackfillTarget;
  }

  const extraReservedSupportPlayers = deferRotation ? 0 : Math.max(reservedSupportPlayers - reservedDirectSupportPlayers, 0);
  const coreSelectionLimit = deferRotation
    ? match.team.minCorePlayers
    : Math.max(
        match.squadSize - reservedSupportPlayers - reservedDevelopmentPlayers,
        0,
      );
  const preservedSupportTargetTeams = formatTeamNameList(
    preservedForSupportCandidates.map(
      (candidate) => candidate.higherPriorityOpportunity?.match.team.name ?? "",
    ),
  );
  let remainingRotationCandidates = [...availableRotationCandidates];

  function selectRotationCandidate(candidate: RotationCandidate) {
    const alreadySelectedSupportPlayers = selectedPlayers.filter(
      (p) => p.selectionCategory === "SUPPORT",
    ).length;
    const alreadySelectedDevelopmentPlayers = selectedPlayers.filter(
      (p) => p.selectionCategory === "DEVELOPMENT",
    ).length;
    const fillsReservedDirectSupportSlot =
      candidate.candidateCategory === "SUPPORT" &&
      alreadySelectedSupportPlayers < reservedDirectSupportPlayers;
    const fillsReservedSupportSlot =
      candidate.candidateCategory === "SUPPORT" &&
      alreadySelectedSupportPlayers < reservedSupportPlayers;
    const fillsReservedDevelopmentSlot =
      candidate.candidateCategory === "DEVELOPMENT" &&
      alreadySelectedDevelopmentPlayers < reservedDevelopmentPlayers;
    const selectionReason = fillsReservedDirectSupportSlot
      ? `Selected as a support player for ${currentMatchRecord.team.name}.`
      : fillsReservedSupportSlot
        ? `Selected as an extra support player for ${currentMatchRecord.team.name} to backfill core players preserved for higher-priority support work elsewhere.`
      : candidate.candidateCategory === "SUPPORT"
        ? `Selected as an eligible support player for ${currentMatchRecord.team.name}.`
      : candidate.candidateCategory === "DEVELOPMENT"
        ? `Selected as a development player for ${currentMatchRecord.team.name}.`
      : candidate.candidateCategory === "BACKFILL"
        ? `Selected as a backfill player for ${currentMatchRecord.team.name}.`
      : candidate.candidateCategory === "CONFIDENCE_REBUILD"
        ? `Selected as a confidence rebuild player for ${currentMatchRecord.team.name}.`
      : `Selected as an eligible rotation player for ${currentMatchRecord.team.name}.`;
    const explanations = [
      buildExplanation("rotation_path_allowed", candidate.eligibilityExplanation, true),
      buildExplanation(
        "support_development_then_core_priority",
        `Support slots were applied first, development slots second, and core-team coverage after those reservations.`,
        true,
      ),
    ];

    if (fillsReservedDirectSupportSlot) {
      explanations.push(
        buildExplanation(
          "team_support_requirement",
          `${currentMatchRecord.team.name} has a configured minimum support requirement of ${directSupportTarget}, so this slot was reserved for direct support coverage from configured support teams.`,
          true,
        ),
      );
    }

    if (fillsReservedSupportSlot && !fillsReservedDirectSupportSlot) {
      explanations.push(
        buildExplanation(
          "indirect_support_backfill",
          `${candidate.playerName} was selected as extra support because ${currentMatchRecord.team.name} is preserving core players for higher-priority support work in ${preservedSupportTargetTeams}.`,
          true,
        ),
      );
    }

    if (candidate.candidateCategory === "SUPPORT") {
      explanations.push(
        buildExplanation(
          "support_priority_over_core",
          `${candidate.playerName} was prioritized because ${candidate.player.coreTeam.name} is configured as a support source team for ${currentMatchRecord.team.name}.`,
          true,
        ),
      );
    }

    if (candidate.candidateCategory === "DEVELOPMENT") {
      explanations.push(
        buildExplanation(
          "development_priority_over_core",
          fillsReservedDevelopmentSlot
            ? `${candidate.playerName} was prioritized to fill one of ${reservedDevelopmentPlayers} reserved development slot(s) for ${currentMatchRecord.team.name}.`
            : `${candidate.playerName} was prioritized as a development player because ${candidate.player.coreTeam.name} is configured as a development source team for ${currentMatchRecord.team.name}.`,
          true,
        ),
      );
    }

    if (candidate.missedCoreMatchThisWeek) {
      explanations.push(
        buildExplanation(
          "same_week_missed_core_priority",
          `${candidate.playerName} was prioritized because the player missed a saved core-team selection earlier in the same week and should be prioritized for a rotation opportunity.`,
          true,
        ),
      );
    }

    explanations.push(
      buildExplanation(
        "registered_match_fairness",
        `Total planned match load was considered across every other saved draft or finalized match. ${candidate.playerName} currently has ${candidate.registeredAppearanceCount} other saved involvement(s).`,
        true,
      ),
    );

    if (candidate.positionMatchLevel === "secondary") {
      explanations.push(
        buildExplanation(
          "position_secondary_match",
          `${candidate.playerName} does not have ${currentMatchRecord.team.name}'s needed position as primary but matches on secondary position.`,
          false,
        ),
      );
    }

    if (candidate.positionMatchLevel === "tertiary") {
      explanations.push(
        buildExplanation(
          "position_tertiary_match",
          `${candidate.playerName} matches the needed position only on tertiary position, which is a weak positional fit.`,
          false,
        ),
      );
    }

    if (candidate.positionMatchLevel === "none") {
      warnings.push({
        code: "position_mismatch",
        message: `${candidate.playerName} was selected for ${currentMatchRecord.team.name} but does not match any of the needed positions on primary, secondary, or tertiary. This may weaken the team's positional coverage.`,
        playerId: candidate.player.id,
      });
      explanations.push(
        buildExplanation(
          "position_mismatch",
          `${candidate.playerName} does not match any of the needed positions for ${currentMatchRecord.team.name}. This is a last-resort selection that may affect team performance.`,
          false,
        ),
      );
    }

    if (candidate.candidateCategory === "SUPPORT" && isSupportAvoidSuitability(candidate.player)) {
      warnings.push({
        code: "support_avoid_suitability",
        message: `${candidate.playerName} has support suitability "avoid" but was selected as support because no better alternative was available. Confirm this selection.`,
        playerId: candidate.player.id,
      });
      explanations.push(
        buildExplanation(
          "support_avoid_suitability",
          `${candidate.playerName} is marked as support suitability "avoid" but was selected as a last resort. Coach confirmation is recommended.`,
          false,
        ),
      );
    }

    if ((candidate.candidateCategory === "SUPPORT" || candidate.candidateCategory === "DEVELOPMENT") && candidate.player.supportNoShowCount > 0) {
      warnings.push({
        code: "support_no_show_history",
        message: `${candidate.playerName} has ${candidate.player.supportNoShowCount} recorded no-show(s) for support. Confirm availability before finalizing.`,
        playerId: candidate.player.id,
      });
    }

    selectedPlayers.push({
      autoSelected: true,
      chosenPosition: candidate.chosenPosition,
      coreTeamId: candidate.player.coreTeam.id,
      coreTeamName: candidate.player.coreTeam.name,
      eligibility: true,
      explanations,
      finalSelected: false,
      manualOverride: false,
      playerId: candidate.player.id,
      playerName: candidate.playerName,
      playerPosition: candidate.playerPosition,
      priorityScore: candidate.priorityScore,
      selectionCategory: candidate.candidateCategory as SelectedPlayer["selectionCategory"],
      selectionReason,
    });
  }

  function takeTopRotationCandidate(
    filter: (candidate: Omit<RotationCandidate, "priorityScore">) => boolean,
  ) {
    const candidate = getRankedRotationCandidates(
      remainingRotationCandidates.filter(filter),
      selectedPlayers,
      planningPeriodCounts,
    )[0];

    if (!candidate) {
      return false;
    }

    remainingRotationCandidates = remainingRotationCandidates.filter(
      (entry) => entry.player.id !== candidate.player.id,
    );
    selectRotationCandidate(candidate);
    return true;
  }

  while (
    selectedPlayers.filter((p) => p.selectionCategory === "SUPPORT").length <
      reservedSupportPlayers &&
    selectedPlayers.length < match.squadSize
  ) {
    if (!takeTopRotationCandidate((candidate) => candidate.candidateCategory === "SUPPORT")) {
      break;
    }
  }

  while (
    selectedPlayers.filter((p) => p.selectionCategory === "DEVELOPMENT").length <
      reservedDevelopmentPlayers &&
    selectedPlayers.length < match.squadSize
  ) {
    if (!takeTopRotationCandidate((candidate) => candidate.candidateCategory === "DEVELOPMENT")) {
      break;
    }
  }

  for (const {
    player,
    playerName,
    playerPosition,
    registeredAppearanceCount,
  } of selectedCorePlayers.slice(0, coreSelectionLimit)) {
    const selectionReason = `Selected as an eligible core player for ${match.team.name}.`;
    const explanations = [
      buildExplanation("eligible_core_player", selectionReason, true),
      buildExplanation(
        "support_development_then_core_priority",
        `Selected after support and development reservations were applied because ${playerName} still fit the remaining core-team capacity for ${match.team.name}.`,
        true,
      ),
    ];

    if (reservedSupportPlayers > 0) {
      explanations.push(
        buildExplanation(
          "team_support_slots_reserved",
          `${match.team.name} reserves ${reservedSupportPlayers} support slot(s), which reduced the available core-team capacity.`,
            true,
          ),
      );
    }

    if (reservedDevelopmentPlayers > 0) {
      explanations.push(
        buildExplanation(
          "team_development_slots_reserved",
          `${match.team.name} reserves ${reservedDevelopmentPlayers} development slot(s), so core-player selection was capped at ${coreSelectionLimit} slot(s) after support and development priorities were applied.`,
          true,
        ),
      );
    }

    explanations.push(
      buildExplanation(
        "registered_match_fairness",
        `Total planned match load was considered across every other saved draft or finalized match. ${playerName} currently has ${registeredAppearanceCount} other saved involvement(s).`,
        true,
      ),
    );

    selectedPlayers.push({
      autoSelected: true,
      chosenPosition: getPrimaryChosenPosition(player.primaryPosition),
      coreTeamId: player.coreTeam.id,
        coreTeamName: player.coreTeam.name,
      eligibility: true,
      explanations,
      finalSelected: false,
      manualOverride: false,
      playerId: player.id,
      playerName,
      playerPosition,
      priorityScore: 100,
      selectionCategory: "CORE",
      selectionReason,
    });
  }

  for (const candidate of selectedCorePlayers.slice(coreSelectionLimit)) {
    const overflowExplanation = candidate.higherPriorityOpportunity
      ? candidate.higherPriorityOpportunity.kind === "support"
        ? `${candidate.playerName} was held out of ${match.team.name} because ${candidate.higherPriorityOpportunity.match.team.name} has a higher-priority support need in close date proximity.`
        : `${candidate.playerName} was held out of ${match.team.name} because ${candidate.higherPriorityOpportunity.match.team.name} has a higher-priority development opportunity in close date proximity.`
      : candidate.player.reducedMatchLoadAllowed && reservedSupportPlayers > 0
        ? `${candidate.playerName} was left out because support coverage was prioritized ahead of reduced-match-load core players.`
      : `${candidate.playerName} was left out because the number of eligible core players exceeded the available core-team slots.`;

    excludedPlayers.push({
      autoSelected: false,
      coreTeamId: candidate.player.coreTeam.id,
      coreTeamName: candidate.player.coreTeam.name,
      eligibility: true,
        explanations: [
          buildExplanation("eligible_core_player", "Eligible as a core player before final squad capping.", true),
          buildExplanation(
            candidate.higherPriorityOpportunity
              ? candidate.higherPriorityOpportunity.kind === "support"
                ? "support_priority_over_core"
                : "development_priority_over_core"
              : candidate.player.reducedMatchLoadAllowed && reservedSupportPlayers > 0
                ? "support_priority_over_reduced_load_core"
              : "core_player_overflow",
            overflowExplanation,
            true,
          ),
        ],
      finalSelected: false,
      manualOverride: false,
      playerId: candidate.player.id,
      playerName: candidate.playerName,
      playerPosition: candidate.playerPosition,
      priorityScore: null,
      selectionCategory: "EXCLUDED",
      automaticSelectionCategory: "CORE",
      exclusionReason: overflowExplanation,
    });
  }

  if (selectedCorePlayers.length > coreSelectionLimit) {
    warnings.push({
      code: "core_player_overflow",
      message:
        reservedSupportPlayers > 0 || reservedDevelopmentPlayers > 0
          ? `Eligible core players exceeded the ${coreSelectionLimit} core slots left after reserving ${reservedSupportPlayers} support slot(s) and ${reservedDevelopmentPlayers} development slot(s).`
          : "Eligible core players exceeded squad size, so only the highest-priority core slots were kept.",
    });
  }

  if (!deferRotation && effectiveExtraSupportBackfillTarget > 0) {
    warnings.push({
      code: "support_backfill_priority",
      message:
        extraReservedSupportPlayers > 0
          ? `${match.team.name} is preserving ${preservedForSupportCandidates.length} core player(s) for higher-priority support needs in ${preservedSupportTargetTeams}. The engine therefore reserved ${extraReservedSupportPlayers} extra support slot(s) beyond the configured minimum of ${directSupportTarget}.`
          : `${match.team.name} is preserving ${preservedForSupportCandidates.length} core player(s) for higher-priority support needs in ${preservedSupportTargetTeams}, but no extra eligible support players were available beyond the configured minimum of ${directSupportTarget}.`,
    });
  }

  if (!deferRotation && effectiveSupportTarget > reservedSupportPlayers) {
    const supportSourcePlayerIds = playerRecords
      .filter((player) => currentMatchRecord.supportSourceTeamIds.includes(player.coreTeamId))
      .map((player) => player.id);
    const supportBlockers = buildCandidateBlockerSummary(excludedPlayers, supportSourcePlayerIds);
    warnings.push({
      code: "support_requirement_shortfall",
      message: `${match.team.name} needs ${effectiveSupportTarget} support player(s) (${directSupportTarget} configured minimum${effectiveExtraSupportBackfillTarget > 0 ? ` and ${effectiveExtraSupportBackfillTarget} extra backfill slot(s)` : ""}), but only ${reservedSupportPlayers} eligible support player(s) were available from ${formatTeamNameList(currentMatchRecord.supportSourceTeamNames) || "the configured support teams"}.${supportBlockers.length > 0 ? ` Main blockers: ${supportBlockers.join(" ")}` : ""}`,
    });
  }

  if (!deferRotation && effectiveDevelopmentTarget > reservedDevelopmentPlayers) {
    const developmentSourcePlayerIds = playerRecords
      .filter((player) => currentMatchRecord.developmentSourceTeamIds.includes(player.coreTeamId))
      .map((player) => player.id);
    const developmentBlockers = buildCandidateBlockerSummary(
      excludedPlayers,
      developmentSourcePlayerIds,
    );
    warnings.push({
      code: "development_slot_shortfall",
      message: `${match.team.name} reserves ${effectiveDevelopmentTarget} development slot(s), but only ${reservedDevelopmentPlayers} eligible development player(s) were available within configured source teams.${developmentBlockers.length > 0 ? ` Main blockers: ${developmentBlockers.join(" ")}` : ""}`,
    });
  }

  if (!deferRotation) {
    while (selectedPlayers.length < match.squadSize) {
      if (!takeTopRotationCandidate(() => true)) {
        break;
      }
    }
  }

  const selectedPlayerIds = new Set(selectedPlayers.map((p) => p.playerId));

  for (const playerId of lockedInPlayerIds) {
    if (selectedPlayerIds.has(playerId)) {
      continue;
    }

    const playerRecord = playerById.get(playerId);
    if (!playerRecord) {
      continue;
    }

    const excludedEntry = excludedPlayers.find((p) => p.playerId === playerId);
    if (excludedEntry) {
      const hasHardRuleBlock = excludedEntry.explanations.some(
        (explanation) => explanation.hardRule === true,
      );
      if (hasHardRuleBlock) {
        warnings.push({
          code: "player_locked_in_blocked",
          message: `${getPlayerName(playerRecord)} is locked in but was blocked by a hard rule: ${excludedEntry.exclusionReason}`,
          playerId,
        });
        continue;
      }
    }

    const playerName = getPlayerName(playerRecord);
    const eligibility = getTargetTeamEligibility(playerRecord, match.team, playerRecord.rotationPathsFromCoreTeam.filter((p) => p.toTeamId === currentMatchRecord.teamId));
    const isCore = eligibility.allowed && eligibility.selectionCategory === "CORE";
    const selectionCategory: SelectedPlayer["selectionCategory"] = isCore ? "CORE" : (eligibility.allowed ? eligibility.selectionCategory : "MANUAL");

    selectedPlayers.push({
      autoSelected: false,
      chosenPosition: getPrimaryChosenPosition(playerRecord.primaryPosition),
      coreTeamId: playerRecord.coreTeam.id,
      coreTeamName: playerRecord.coreTeam.name,
      eligibility: eligibility.allowed,
      explanations: [
        buildExplanation("player_locked_in", `${playerName} was included because the player is manually locked in for this match round.`, true),
      ],
      finalSelected: false,
      manualOverride: false,
      playerId: playerRecord.id,
      playerName,
      playerPosition: playerRecord.primaryPosition,
      priorityScore: 200,
      selectionCategory,
      selectionReason: `Selected because ${playerName} is manually locked in for this match round.`,
    });

    const excludedIndex = excludedPlayers.findIndex((p) => p.playerId === playerId);
    if (excludedIndex >= 0) {
      excludedPlayers.splice(excludedIndex, 1);
    }
  }

  if (selectedPlayers.length < match.squadSize) {
    const blockers = [
      effectiveSupportTarget > reservedSupportPlayers
        ? `${match.team.name} still lacked ${effectiveSupportTarget - reservedSupportPlayers} required support player(s).`
        : "",
      effectiveDevelopmentTarget > reservedDevelopmentPlayers
        ? `${match.team.name} still lacked ${effectiveDevelopmentTarget - reservedDevelopmentPlayers} development slot fill(s).`
        : "",
      buildCandidateBlockerSummary(excludedPlayers, [...playerById.keys()]).join(" "),
    ].filter(Boolean);
    warnings.push({
      code: "short_squad",
      message: buildShortSquadWarningMessage(selectedPlayers.length, match.squadSize, blockers),
    });
  }

  for (const excludedPlayer of excludedPlayers) {
    const matchingPlayer = playerById.get(excludedPlayer.playerId);

    if (!matchingPlayer || matchingPlayer.coreTeamId !== currentMatchRecord.teamId) {
      continue;
    }

    warnings.push({
      code: "core_player_unselected",
      message: `${excludedPlayer.playerName} is a ${match.team.name} core player and was not selected. Reason: ${excludedPlayer.exclusionReason}`,
      playerId: excludedPlayer.playerId,
    });
  }

  return {
    excludedPlayers,
    generatedAt: new Date(),
    matchDate: match.startsAt,
    matchId: match.id,
    matchRoundId: match.matchRoundId,
    opponent: match.opponent,
    selectedPlayers,
    teamName: match.team.name,
    warnings,
  };
}