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
import { getTargetTeamEligibility } from "@/lib/selection/get-target-team-eligibility";
import type {
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

type PlayerRecord = Player & {
  allowedFloatTeams: Array<{
    team: Pick<Team, "id" | "name">;
    teamId: string;
  }>;
  coreTeam: Pick<Team, "id" | "name">;
};

type MatchRecord = Pick<Match, "id" | "startsAt" | "targetTeamId"> & {
  targetTeam: Pick<Team, "developmentSlots" | "id" | "name">;
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

type EligibleFloatingPlayer = EvaluatedPlayer & {
  candidateCategory: "DEVELOPMENT" | "FLOAT" | "SUPPORT";
  eligibilityExplanation: string;
};

type FloatingCandidate = EvaluatedPlayer & {
  candidateCategory: "DEVELOPMENT" | "FLOAT" | "SUPPORT";
  chosenPosition: string;
  eligibilityExplanation: string;
  floatingHistory: Awaited<ReturnType<typeof getFloatingHistory>>;
  missedCoreMatchThisWeek: RegisteredSelectionSnapshot | null;
  priorityScore: number;
  recentLoadScore: number;
};

type CoreCandidate = EvaluatedPlayer & {
  higherPriorityOpportunity: {
    kind: "development" | "support";
    match: MatchRecord;
  } | null;
};

type MostRecentRegisteredAppearance = {
  match: MatchRecord;
  roleType: SelectionRole;
  status: SelectionStatus;
};

function getPlayerName(player: Pick<Player, "firstName" | "lastName">): string {
  return player.lastName ? `${player.firstName} ${player.lastName}` : player.firstName;
}

function isLockedCorePlayer(player: PlayerRecord, currentMatch: MatchRecord) {
  return (
    player.coreTeamId === currentMatch.targetTeamId &&
    !player.isFloating &&
    !player.canDropCoreMatch
  );
}

function hasAllowedFloatToTeam(player: PlayerRecord, targetTeamId: string) {
  return player.allowedFloatTeams.some((entry) => entry.teamId === targetTeamId);
}

function findHigherPriorityOpportunity(
  player: PlayerRecord,
  currentMatch: MatchRecord,
  registeredMatches: MatchRecord[],
  rules: Awaited<ReturnType<typeof getRules>>,
): CoreCandidate["higherPriorityOpportunity"] {
  if (!player.isFloating || player.canDropCoreMatch) {
    return null;
  }

  const matchedOpportunity =
    registeredMatches.find((otherMatch) => {
      if (otherMatch.startsAt <= currentMatch.startsAt) {
        return false;
      }

      const dayDifference = getAbsoluteCalendarDayDifference(otherMatch.startsAt, currentMatch.startsAt);

      if (dayDifference > rules.minDaysBetweenAnyMatches) {
        return false;
      }

      if (!hasAllowedFloatToTeam(player, otherMatch.targetTeamId)) {
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

function getFloatingCandidateCategory(
  player: PlayerRecord,
  targetMatch: MatchRecord,
): FloatingCandidate["candidateCategory"] {
  if (targetMatch.supportSourceTeamIds.includes(player.coreTeamId)) {
    return "SUPPORT";
  }

  if (targetMatch.developmentSourceTeamIds.includes(player.coreTeamId)) {
    return "DEVELOPMENT";
  }

  return "FLOAT";
}

function findMissedCoreMatchThisWeek(
  player: PlayerRecord,
  currentMatch: MatchRecord,
  latestSavedSelections: RegisteredSelectionSnapshot[],
): RegisteredSelectionSnapshot | null {
  if (!player.isFloating || player.canDropCoreMatch) {
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

      if (selection.match.targetTeamId !== player.coreTeamId) {
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

    const selectionPlayer = selection.players.find((player) => player.playerId === playerId);

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

function getRepeatFloatingBlockCode(candidateCategory: FloatingCandidate["candidateCategory"]) {
  if (candidateCategory === "SUPPORT") {
    return "support_return_to_core_before_repeat";
  }

  if (candidateCategory === "DEVELOPMENT") {
    return "development_return_to_core_before_repeat";
  }

  return "prevent_consecutive_float";
}

function buildRepeatFloatingBlockReason(
  candidateCategory: FloatingCandidate["candidateCategory"],
  player: PlayerRecord,
  playerName: string,
  mostRecentAppearance: MostRecentRegisteredAppearance,
) {
  const recentRole = mostRecentAppearance.roleType.toLowerCase();
  const recentStatus = formatSelectionStatus(mostRecentAppearance.status);
  const recentMatchDate = formatShortDate(mostRecentAppearance.match.startsAt);
  const recentTargetTeamName = mostRecentAppearance.match.targetTeam.name;

  if (candidateCategory === "SUPPORT") {
    return `Excluded because ${playerName} already has a ${recentStatus} ${recentRole} appearance for ${recentTargetTeamName} on ${recentMatchDate}. ${player.coreTeam.name} must get an own core-team match before ${playerName} can take another support slot.`;
  }

  if (candidateCategory === "DEVELOPMENT") {
    return `Excluded because ${playerName} already has a ${recentStatus} ${recentRole} appearance for ${recentTargetTeamName} on ${recentMatchDate}. ${player.coreTeam.name} must get an own core-team match before ${playerName} can take another development slot.`;
  }

  return `Excluded because the latest registered or finalized match for ${playerName} was already a floating appearance for ${recentTargetTeamName} on ${recentMatchDate}. The player must complete an own-team match for ${player.coreTeam.name} before floating again.`;
}

function buildRegisteredMatchConflict(
  playerName: string,
  currentMatch: MatchRecord,
  eligibilityCategory: "CORE" | "FLOAT",
  registeredPlans: RegisteredSelectionSnapshot[],
  rules: Awaited<ReturnType<typeof getRules>>,
) {
  for (const registeredPlan of registeredPlans) {
    if (isSameCalendarDay(currentMatch.startsAt, registeredPlan.match.startsAt)) {
      return {
        code: "registered_match_conflict",
        reason:
          `Excluded because ${playerName} already appears in a ${formatSelectionStatus(registeredPlan.status)} selection for ${registeredPlan.match.targetTeam.name} on ${formatShortDate(registeredPlan.match.startsAt)}.`,
      };
    }

    const dayDifference = getAbsoluteCalendarDayDifference(
      currentMatch.startsAt,
      registeredPlan.match.startsAt,
    );

    if (
      eligibilityCategory === "CORE" &&
      registeredPlan.players.some((selectionPlayer) => isFloatingSelectionRole(selectionPlayer.roleType)) &&
      dayDifference <= rules.blockCoreMatchIfFloatingWithinDays
    ) {
      return {
        code: "registered_core_match_blocked_after_float",
        reason:
          `Excluded because ${playerName} already has a ${formatSelectionStatus(registeredPlan.status)} floating selection for ${registeredPlan.match.targetTeam.name} on ${formatShortDate(registeredPlan.match.startsAt)}, and the core match is inside the ${rules.blockCoreMatchIfFloatingWithinDays}-day block window.`,
      };
    }

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

export async function generateSelection(matchId: string): Promise<GeneratedSelection> {
  const [match, players, rules, registeredMatches, savedSelections] = await Promise.all([
    db.match.findUnique({
      where: { id: matchId },
      include: {
        targetTeam: {
          select: {
            developmentTargetRelationships: {
              select: {
                sourceTeamId: true,
              },
            },
            developmentSlots: true,
            id: true,
            minSupportPlayers: true,
            name: true,
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
        allowedFloatTeams: {
          include: {
            team: {
              select: {
                id: true,
                name: true,
              },
            },
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
        targetTeam: {
          select: {
            developmentTargetRelationships: {
              select: {
                sourceTeamId: true,
              },
            },
            developmentSlots: true,
            id: true,
            name: true,
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
    db.matchSelection.findMany({
      where: {
        matchId: {
          not: matchId,
        },
      },
      include: {
        match: {
          include: {
            targetTeam: {
              select: {
                developmentTargetRelationships: {
                  select: {
                    sourceTeamId: true,
                  },
                },
                developmentSlots: true,
                id: true,
                name: true,
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
        players: {
          where: {
            wasManuallyRemoved: false,
          },
          select: {
            playerId: true,
            roleType: true,
          },
        },
      },
      orderBy: [{ createdAt: "desc" }],
    }),
  ]);

  if (!match) {
    throw new Error("Match not found.");
  }

  const latestSavedSelectionByMatchId = new Map<string, RegisteredSelectionSnapshot>();

  for (const selection of savedSelections) {
    if (latestSavedSelectionByMatchId.has(selection.matchId)) {
      continue;
    }

    latestSavedSelectionByMatchId.set(selection.matchId, {
      match: {
        developmentSlots: selection.match.targetTeam.developmentSlots,
        id: selection.match.id,
        developmentSourceTeamIds: selection.match.targetTeam.developmentTargetRelationships.map(
          (relationship) => relationship.sourceTeamId,
        ),
        startsAt: selection.match.startsAt,
        supportSourceTeamIds: selection.match.targetTeam.supportTargetRelationships.map(
          (relationship) => relationship.sourceTeamId,
        ),
        supportSourceTeamNames: selection.match.targetTeam.supportTargetRelationships.map(
          (relationship) => relationship.sourceTeam.name,
        ),
        targetTeam: selection.match.targetTeam,
        targetTeamId: selection.match.targetTeamId,
      },
      players: selection.players,
      status: selection.status,
    });
  }

  const latestSavedSelections = [...latestSavedSelectionByMatchId.values()];
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
    developmentSlots: match.targetTeam.developmentSlots,
    developmentSourceTeamIds: match.targetTeam.developmentTargetRelationships.map(
      (relationship) => relationship.sourceTeamId,
    ),
    id: match.id,
    startsAt: match.startsAt,
    supportSourceTeamIds: match.targetTeam.supportTargetRelationships.map(
      (relationship) => relationship.sourceTeamId,
    ),
    supportSourceTeamNames: match.targetTeam.supportTargetRelationships.map(
      (relationship) => relationship.sourceTeam.name,
    ),
    targetTeam: match.targetTeam,
    targetTeamId: match.targetTeamId,
  };
  const normalizedRegisteredMatches: MatchRecord[] = registeredMatches.map((registeredMatch) => ({
    developmentSlots: registeredMatch.targetTeam.developmentSlots,
    developmentSourceTeamIds: registeredMatch.targetTeam.developmentTargetRelationships.map(
      (relationship) => relationship.sourceTeamId,
    ),
    id: registeredMatch.id,
    startsAt: registeredMatch.startsAt,
    supportSourceTeamIds: registeredMatch.targetTeam.supportTargetRelationships.map(
      (relationship) => relationship.sourceTeamId,
    ),
    supportSourceTeamNames: registeredMatch.targetTeam.supportTargetRelationships.map(
      (relationship) => relationship.sourceTeam.name,
    ),
    targetTeam: registeredMatch.targetTeam,
    targetTeamId: registeredMatch.targetTeamId,
  }));

  const selectedPlayers: SelectedPlayer[] = [];
  const excludedPlayers: ExcludedPlayer[] = [];
  const warnings: SelectionWarning[] = [];
  const eligibleCorePlayers: CoreCandidate[] = [];
  const eligibleFloatingPlayers: EligibleFloatingPlayer[] = [];
  const playerById = new Map(players.map((player) => [player.id, player]));

  for (const player of players) {
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
        coreMatchDropAllowed: player.canDropCoreMatch,
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
        exclusionReason,
      });
      continue;
    }

    if (player.currentAvailability !== "AVAILABLE") {
      const exclusionReason = `Excluded because the player is currently marked as ${player.currentAvailability.toLowerCase()}.`;
      excludedPlayers.push({
        autoSelected: false,
        coreMatchDropAllowed: player.canDropCoreMatch,
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
        exclusionReason,
      });
      continue;
    }

    const eligibility = getTargetTeamEligibility(player, match.targetTeam);

    if (!eligibility.allowed) {
      excludedPlayers.push({
        autoSelected: false,
        coreMatchDropAllowed: player.canDropCoreMatch,
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
        exclusionReason: eligibility.explanation,
      });
      continue;
    }

    const registeredConflict = buildRegisteredMatchConflict(
      playerName,
      currentMatchRecord,
      eligibility.selectionCategory,
      registeredPlansByPlayerId.get(player.id) ?? [],
      rules,
    );

    if (registeredConflict) {
      excludedPlayers.push({
        autoSelected: false,
        coreMatchDropAllowed: player.canDropCoreMatch,
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
        exclusionReason: registeredConflict.reason,
      });
      continue;
    }

    if (eligibility.selectionCategory === "CORE") {
      eligibleCorePlayers.push({
        ...evaluatedPlayer,
        higherPriorityOpportunity: findHigherPriorityOpportunity(
          player,
          currentMatchRecord,
          normalizedRegisteredMatches,
          rules,
        ),
      });
      continue;
    }

    eligibleFloatingPlayers.push({
      ...evaluatedPlayer,
      candidateCategory: getFloatingCandidateCategory(player, currentMatchRecord),
      eligibilityExplanation: eligibility.explanation,
    });
  }

  const selectedCorePlayers = [...eligibleCorePlayers];

  if (rules.allowCoreMatchDrop && selectedCorePlayers.length > match.squadSize) {
    const overflowCount = selectedCorePlayers.length - match.squadSize;
    const markedCandidatesWithHistory = await Promise.all(
      selectedCorePlayers
        .filter((candidate) => candidate.player.canDropCoreMatch)
        .map(async (candidate) => ({
          candidate,
          inferredDroppedCoreMatches: await getCoreMatchDropHistory({
            blockCoreMatchIfFloatingWithinDays: rules.blockCoreMatchIfFloatingWithinDays,
            coreTeamId: candidate.player.coreTeamId,
            currentMatchDate: match.startsAt,
            currentMatchId: match.id,
            minDaysBetweenAnyMatches: rules.minDaysBetweenAnyMatches,
            playerId: candidate.player.id,
          }),
        })),
    );

    const droppableCandidates = markedCandidatesWithHistory
      .filter(
        ({ inferredDroppedCoreMatches }) =>
          inferredDroppedCoreMatches < rules.maxCoreMatchDropsPerPlayer,
      )
      .sort((left, right) => {
        if (left.inferredDroppedCoreMatches !== right.inferredDroppedCoreMatches) {
          return left.inferredDroppedCoreMatches - right.inferredDroppedCoreMatches;
        }

        return left.candidate.playerName.localeCompare(right.candidate.playerName);
      });

    for (const { candidate } of droppableCandidates.slice(0, overflowCount)) {
      excludedPlayers.push({
        autoSelected: false,
        coreMatchDropAllowed: candidate.player.canDropCoreMatch,
        coreTeamName: candidate.player.coreTeam.name,
        eligibility: true,
        explanations: [
          buildExplanation("eligible_core_player", "Eligible as a core player before applying the drop rule.", true),
          buildExplanation(
            "core_match_drop_rule",
            `${candidate.playerName} was excluded because the player is marked as allowed to drop one core-team match and this slot is being used as that drop.`,
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
        exclusionReason: "Dropped by the core-match drop rule.",
      });

      const candidateIndex = selectedCorePlayers.findIndex(
        (selectedCandidate) => selectedCandidate.player.id === candidate.player.id,
      );

      if (candidateIndex >= 0) {
        selectedCorePlayers.splice(candidateIndex, 1);
      }
    }
  }

  const availableFloatingCandidates: Omit<FloatingCandidate, "priorityScore">[] = [];

  for (const { candidateCategory, eligibilityExplanation, player, playerName, playerPosition } of eligibleFloatingPlayers) {
    const [floatingHistory, finalizedHistory] = await Promise.all([
      getFloatingHistory(player.id, match.startsAt),
      getFinalizedPlayerHistory(player.id, match.id, match.startsAt),
    ]);
    const mostRecentAppearance = getMostRecentRegisteredAppearance(
      player.id,
      currentMatchRecord,
      latestSavedSelections,
    );
    const totalDevelopmentMatches = finalizedHistory.filter(
      (historyEntry) => historyEntry.roleType === SelectionRole.DEVELOPMENT,
    ).length;

    if (
      rules.preventConsecutiveFloat &&
      mostRecentAppearance &&
      isFloatingSelectionRole(mostRecentAppearance.roleType)
    ) {
      const exclusionReason = buildRepeatFloatingBlockReason(
        candidateCategory,
        player,
        playerName,
        mostRecentAppearance,
      );

      excludedPlayers.push({
        autoSelected: false,
        coreMatchDropAllowed: player.canDropCoreMatch,
        coreTeamName: player.coreTeam.name,
        eligibility: true,
        explanations: [
          buildExplanation("floating_allowed", eligibilityExplanation, true),
          buildExplanation(getRepeatFloatingBlockCode(candidateCategory), exclusionReason, true),
        ],
        finalSelected: false,
        manualOverride: false,
        playerId: player.id,
        playerName,
        playerPosition,
        priorityScore: null,
        selectionCategory: "EXCLUDED",
        exclusionReason,
      });
      continue;
    }

    if (floatingHistory.totalFloatingMatches >= rules.maxTotalFloatMatches) {
      const exclusionReason =
        `Excluded because ${playerName} already has ${floatingHistory.totalFloatingMatches} finalized floating matches and the rules allow at most ${rules.maxTotalFloatMatches}.`;

      excludedPlayers.push({
        autoSelected: false,
        coreMatchDropAllowed: player.canDropCoreMatch,
        coreTeamName: player.coreTeam.name,
        eligibility: true,
        explanations: [
          buildExplanation("floating_allowed", eligibilityExplanation, true),
          buildExplanation("maximum_total_float_matches", exclusionReason, true),
        ],
        finalSelected: false,
        manualOverride: false,
        playerId: player.id,
        playerName,
        playerPosition,
        priorityScore: null,
        selectionCategory: "EXCLUDED",
        exclusionReason,
      });
      continue;
    }

    if (
      candidateCategory === "DEVELOPMENT" &&
      player.maxDevelopmentMatches !== null &&
      totalDevelopmentMatches >= player.maxDevelopmentMatches
    ) {
      const exclusionReason =
        `Excluded because ${playerName} already has ${totalDevelopmentMatches} finalized development match(es), which reaches the player's individual limit of ${player.maxDevelopmentMatches}.`;

      excludedPlayers.push({
        autoSelected: false,
        coreMatchDropAllowed: player.canDropCoreMatch,
        coreTeamName: player.coreTeam.name,
        eligibility: true,
        explanations: [
          buildExplanation("floating_allowed", eligibilityExplanation, true),
          buildExplanation("development_match_limit", exclusionReason, true),
        ],
        finalSelected: false,
        manualOverride: false,
        playerId: player.id,
        playerName,
        playerPosition,
        priorityScore: null,
        selectionCategory: "EXCLUDED",
        exclusionReason,
      });
      continue;
    }

    availableFloatingCandidates.push({
      candidateCategory,
      chosenPosition: getPrimaryChosenPosition(player.primaryPosition),
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
      recentLoadScore: getRecentLoadScore(finalizedHistory),
    });
  }

  selectedCorePlayers.sort((left, right) => {
    const leftPriority = left.higherPriorityOpportunity
      ? left.higherPriorityOpportunity.kind === "support"
        ? 4
        : 3
      : left.player.canDropCoreMatch
        ? 2
        : left.player.isFloating
          ? 1
          : 0;
    const rightPriority = right.higherPriorityOpportunity
      ? right.higherPriorityOpportunity.kind === "support"
        ? 4
        : 3
      : right.player.canDropCoreMatch
        ? 2
        : right.player.isFloating
          ? 1
          : 0;

    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }

    return left.playerName.localeCompare(right.playerName);
  });

  const directSupportTarget = Math.min(match.targetTeam.minSupportPlayers, match.squadSize);
  const supportCandidateCount = availableFloatingCandidates.filter(
    (candidate) => candidate.candidateCategory === "SUPPORT",
  ).length;
  const reservedDirectSupportPlayers = Math.min(directSupportTarget, supportCandidateCount);
  const developmentCandidateCount = availableFloatingCandidates.filter(
    (candidate) => candidate.candidateCategory === "DEVELOPMENT",
  ).length;
  const preservedForSupportCandidates = selectedCorePlayers.filter(
    (candidate) => candidate.higherPriorityOpportunity?.kind === "support",
  );
  const extraSupportBackfillTarget = Math.min(
    Math.max(
      match.squadSize - reservedDirectSupportPlayers - (selectedCorePlayers.length - preservedForSupportCandidates.length),
      0,
    ),
    Math.max(match.squadSize - directSupportTarget, 0),
  );
  const effectiveSupportTarget = Math.min(
    directSupportTarget + extraSupportBackfillTarget,
    match.squadSize,
  );
  const reservedSupportPlayers = Math.min(effectiveSupportTarget, supportCandidateCount);
  const extraReservedSupportPlayers = Math.max(reservedSupportPlayers - reservedDirectSupportPlayers, 0);
  const effectiveDevelopmentTarget = Math.min(
    currentMatchRecord.developmentSlots,
    Math.max(match.squadSize - reservedSupportPlayers, 0),
  );
  const reservedDevelopmentPlayers = Math.min(effectiveDevelopmentTarget, developmentCandidateCount);
  const coreSelectionLimit = Math.max(
    match.squadSize - reservedSupportPlayers - reservedDevelopmentPlayers,
    0,
  );
  const preservedSupportTargetTeams = formatTeamNameList(
    preservedForSupportCandidates.map(
      (candidate) => candidate.higherPriorityOpportunity?.match.targetTeam.name ?? "",
    ),
  );

  for (const { player, playerName, playerPosition } of selectedCorePlayers.slice(0, coreSelectionLimit)) {
    const selectionReason = `Selected as an eligible core player for ${match.targetTeam.name}.`;
    const explanations = [
      buildExplanation("eligible_core_player", selectionReason, true),
      buildExplanation(
        "support_development_then_core_priority",
        `Selected after support and development reservations were applied because ${playerName} still fit the remaining core-team capacity for ${match.targetTeam.name}.`,
        true,
      ),
    ];

    if (reservedSupportPlayers > 0) {
      explanations.push(
        buildExplanation(
          "team_support_slots_reserved",
          `${match.targetTeam.name} reserves ${reservedSupportPlayers} support slot(s), which reduced the available core-team capacity.`,
            true,
          ),
        );
    }

    if (reservedDevelopmentPlayers > 0) {
      explanations.push(
        buildExplanation(
          "team_development_slots_reserved",
          `${match.targetTeam.name} reserves ${reservedDevelopmentPlayers} development slot(s), so core-player selection was capped at ${coreSelectionLimit} slot(s) after support and development priorities were applied.`,
          true,
        ),
      );
    }

    selectedPlayers.push({
      autoSelected: true,
      chosenPosition: getPrimaryChosenPosition(player.primaryPosition),
      coreMatchDropAllowed: player.canDropCoreMatch,
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
        ? `${candidate.playerName} was held out of ${match.targetTeam.name} because ${candidate.higherPriorityOpportunity.match.targetTeam.name} has a higher-priority support need in close date proximity.`
        : `${candidate.playerName} was held out of ${match.targetTeam.name} because ${candidate.higherPriorityOpportunity.match.targetTeam.name} has a higher-priority development opportunity in close date proximity.`
      : candidate.player.isFloating && reservedDevelopmentPlayers > 0
        ? `${candidate.playerName} was left out because support and development slots were prioritized ahead of floating-enabled core-team coverage.`
      : candidate.player.canDropCoreMatch && reservedSupportPlayers > 0
        ? `${candidate.playerName} was left out because support coverage was prioritized ahead of own-team players who can drop one core match.`
        : `${candidate.playerName} was left out because the number of eligible core players exceeded the available core-team slots.`;

    excludedPlayers.push({
      autoSelected: false,
      coreMatchDropAllowed: candidate.player.canDropCoreMatch,
      coreTeamName: candidate.player.coreTeam.name,
      eligibility: true,
        explanations: [
          buildExplanation("eligible_core_player", "Eligible as a core player before final squad capping.", true),
          buildExplanation(
            candidate.higherPriorityOpportunity
              ? candidate.higherPriorityOpportunity.kind === "support"
                ? "support_priority_over_core"
                : "development_priority_over_core"
              : candidate.player.isFloating && reservedDevelopmentPlayers > 0
                ? "reserved_development_priority_over_floating_core"
              : candidate.player.canDropCoreMatch && reservedSupportPlayers > 0
                ? "support_priority_over_core_drop"
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

  if (extraSupportBackfillTarget > 0) {
    warnings.push({
      code: "support_backfill_priority",
      message:
        extraReservedSupportPlayers > 0
          ? `${match.targetTeam.name} is preserving ${preservedForSupportCandidates.length} core player(s) for higher-priority support needs in ${preservedSupportTargetTeams}. The engine therefore reserved ${extraReservedSupportPlayers} extra support slot(s) beyond the configured minimum of ${directSupportTarget}.`
          : `${match.targetTeam.name} is preserving ${preservedForSupportCandidates.length} core player(s) for higher-priority support needs in ${preservedSupportTargetTeams}, but no extra eligible support players were available beyond the configured minimum of ${directSupportTarget}.`,
    });
  }

  if (effectiveSupportTarget > reservedSupportPlayers) {
    const supportSourcePlayerIds = players
      .filter((player) => currentMatchRecord.supportSourceTeamIds.includes(player.coreTeamId))
      .map((player) => player.id);
    const supportBlockers = buildCandidateBlockerSummary(excludedPlayers, supportSourcePlayerIds);
    warnings.push({
      code: "support_requirement_shortfall",
      message: `${match.targetTeam.name} needs ${effectiveSupportTarget} support player(s) (${directSupportTarget} configured minimum${extraSupportBackfillTarget > 0 ? ` and ${extraSupportBackfillTarget} extra backfill slot(s)` : ""}), but only ${reservedSupportPlayers} eligible support player(s) were available from ${formatTeamNameList(currentMatchRecord.supportSourceTeamNames) || "the configured support teams"}.${supportBlockers.length > 0 ? ` Main blockers: ${supportBlockers.join(" ")}` : ""}`,
    });
  }

  if (effectiveDevelopmentTarget > reservedDevelopmentPlayers) {
    const developmentSourcePlayerIds = players
      .filter((player) => currentMatchRecord.developmentSourceTeamIds.includes(player.coreTeamId))
      .map((player) => player.id);
    const developmentBlockers = buildCandidateBlockerSummary(
      excludedPlayers,
      developmentSourcePlayerIds,
    );
    warnings.push({
      code: "development_slot_shortfall",
      message: `${match.targetTeam.name} reserves ${effectiveDevelopmentTarget} development slot(s), but only ${reservedDevelopmentPlayers} eligible development player(s) were available within configured source teams and player-specific development limits.${developmentBlockers.length > 0 ? ` Main blockers: ${developmentBlockers.join(" ")}` : ""}`,
    });
  }

  const rankedFloatingCandidates: FloatingCandidate[] = availableFloatingCandidates.map((candidate) => ({
    ...candidate,
    priorityScore:
      50 +
      (candidate.candidateCategory === "SUPPORT" ? 40 : 0) +
      (candidate.candidateCategory === "DEVELOPMENT" ? 25 : 0) +
      (candidate.missedCoreMatchThisWeek ? 30 : 0) -
      (rules.preferLowerFloatCount ? candidate.floatingHistory.totalFloatingMatches * 5 : 0) -
      (rules.preferLowRecentLoad ? candidate.recentLoadScore * 2 : 0) -
      (rules.preferPositionBalance
        ? getPositionNeedScore(selectedPlayers, candidate.chosenPosition) * 3
        : 0),
  }));

  rankedFloatingCandidates.sort((left, right) => {
    const leftCategoryPriority =
      left.candidateCategory === "SUPPORT" ? 2 : left.candidateCategory === "DEVELOPMENT" ? 1 : 0;
    const rightCategoryPriority =
      right.candidateCategory === "SUPPORT" ? 2 : right.candidateCategory === "DEVELOPMENT" ? 1 : 0;

    if (leftCategoryPriority !== rightCategoryPriority) {
      return rightCategoryPriority - leftCategoryPriority;
    }

    if (left.priorityScore !== right.priorityScore) {
      return right.priorityScore - left.priorityScore;
    }

    return left.playerName.localeCompare(right.playerName);
  });

  rankedFloatingCandidates
    .slice(0, Math.max(match.squadSize - selectedPlayers.length, 0))
    .forEach((candidate) => {
      const alreadySelectedSupportPlayers = selectedPlayers.filter(
        (player) => player.selectionCategory === "SUPPORT",
      ).length;
      const alreadySelectedDevelopmentPlayers = selectedPlayers.filter(
        (player) => player.selectionCategory === "DEVELOPMENT",
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
        ? `Selected as a support player for ${match.targetTeam.name}.`
        : fillsReservedSupportSlot
          ? `Selected as an extra support player for ${match.targetTeam.name} to backfill core players preserved for higher-priority support work elsewhere.`
        : candidate.candidateCategory === "DEVELOPMENT"
          ? `Selected as a development player for ${match.targetTeam.name}.`
        : `Selected as an eligible floating player for ${match.targetTeam.name}.`;
      const explanations = [
        buildExplanation("floating_allowed", candidate.eligibilityExplanation, true),
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
            `${match.targetTeam.name} has a configured minimum support requirement of ${directSupportTarget}, so this slot was reserved for direct support coverage from configured support teams.`,
            true,
          ),
        );
      }

      if (fillsReservedSupportSlot && !fillsReservedDirectSupportSlot) {
        explanations.push(
          buildExplanation(
            "indirect_support_backfill",
            `${candidate.playerName} was selected as extra support because ${match.targetTeam.name} is preserving core players for higher-priority support work in ${preservedSupportTargetTeams}.`,
            true,
          ),
        );
      }

      if (candidate.candidateCategory === "SUPPORT") {
        explanations.push(
          buildExplanation(
            "support_priority_over_core",
            `${candidate.playerName} was prioritized because ${candidate.player.coreTeam.name} is configured as a support team for ${match.targetTeam.name}.`,
            true,
          ),
        );
      }

      if (candidate.candidateCategory === "DEVELOPMENT") {
        explanations.push(
          buildExplanation(
            "development_priority_over_core",
            fillsReservedDevelopmentSlot
              ? `${candidate.playerName} was prioritized to fill one of ${reservedDevelopmentPlayers} reserved development slot(s) for ${match.targetTeam.name}.`
              : `${candidate.playerName} was prioritized as a development player because ${candidate.player.coreTeam.name} is configured as a development source team for ${match.targetTeam.name}.`,
            true,
          ),
        );
      }

      if (candidate.missedCoreMatchThisWeek) {
        explanations.push(
          buildExplanation(
            "same_week_missed_core_priority",
            `${candidate.playerName} was prioritized because the player missed a saved core-team selection earlier in the same week and should be prioritized for a floating opportunity.`,
            true,
          ),
        );
      }

      selectedPlayers.push({
        autoSelected: true,
        chosenPosition: candidate.chosenPosition,
        coreMatchDropAllowed: candidate.player.canDropCoreMatch,
        coreTeamName: candidate.player.coreTeam.name,
        eligibility: true,
        explanations,
        finalSelected: false,
        manualOverride: false,
        playerId: candidate.player.id,
        playerName: candidate.playerName,
        playerPosition: candidate.playerPosition,
        priorityScore: candidate.priorityScore,
        selectionCategory: candidate.candidateCategory,
        selectionReason,
      });
    });

  if (selectedPlayers.length < match.squadSize) {
    const blockers = [
      effectiveSupportTarget > reservedSupportPlayers
        ? `${match.targetTeam.name} still lacked ${effectiveSupportTarget - reservedSupportPlayers} required support player(s).`
        : "",
      effectiveDevelopmentTarget > reservedDevelopmentPlayers
        ? `${match.targetTeam.name} still lacked ${effectiveDevelopmentTarget - reservedDevelopmentPlayers} development slot fill(s).`
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

    if (!matchingPlayer || !isLockedCorePlayer(matchingPlayer, currentMatchRecord)) {
      continue;
    }

    warnings.push({
      code: "locked_core_player_unselected",
      message: `${excludedPlayer.playerName} is a locked ${match.targetTeam.name} core player and was not selected. Reason: ${excludedPlayer.exclusionReason}`,
      playerId: excludedPlayer.playerId,
    });
  }

  return {
    excludedPlayers,
    generatedAt: new Date(),
    matchDate: match.startsAt,
    matchId: match.id,
    opponent: match.opponent,
    selectedPlayers,
    teamName: match.targetTeam.name,
    warnings,
  };
}
