import { type Player, SelectionRole } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { isFloatingSelectionRole } from "@/lib/match-utils";
import { getRules } from "@/lib/rules/get-rules";
import { getCoreMatchDropHistory } from "@/lib/selection/get-core-match-drop-history";
import { getFinalizedPlayerHistory } from "@/lib/selection/get-finalized-player-history";
import { getFloatingHistory } from "@/lib/selection/get-floating-history";
import { getConsecutiveSupportCount } from "@/lib/selection/get-consecutive-support-count";
import { getPlanningPeriodFairness } from "@/lib/selection/get-planning-period-fairness";
import { getTargetTeamEligibility } from "@/lib/selection/get-target-team-eligibility";
import { buildExplanation } from "@/lib/selection/explanation-generation";
import {
  checkPathCooldown,
  getSuitabilityAndReadinessScore,
  isDevelopmentBlocked,
  isSupportAvoidSuitability,
} from "@/lib/selection/selection-eligibility";
import { type PlanningPeriodRoleCounts, getRecentLoadScore } from "@/lib/selection/selection-fairness";
import {
  buildCandidateBlockerSummary,
  buildRegisteredMatchConflict,
  buildRepeatRotationBlockReason,
  findHigherPriorityOpportunity,
  findMissedCoreMatchThisWeek,
  getMostRecentRegisteredAppearance,
  getRegisteredAppearanceCounts,
  getRepeatRotationBlockCode,
} from "@/lib/selection/rotation-candidate-evaluation";
import {
  buildShortSquadWarningMessage,
  formatTeamNameList,
} from "@/lib/selection/selection-warnings";
import {
  getNeededPositions,
  getPrimaryChosenPosition,
  getPositionMatchLevel,
  getRankedRotationCandidates,
} from "@/lib/selection/rotation-candidate-ranking";
import type {
  AutomaticSelectionCategory,
  ExcludedPlayer,
  GeneratedSelection,
  SelectedPlayer,
  SelectionWarning,
} from "@/lib/selection/types";
import type {
  CoreCandidate,
  EligibleRotationPlayer,
  MatchRecord,
  PathDestination,
  PlayerRecord,
  RegisteredSelectionSnapshot,
  RotationCandidate,
  RotationCandidateCategory,
} from "@/lib/selection/selection-types";

type RotationPathWithTeamName = {
  fromTeamId: string;
  fromTeam: { name: string };
  toTeamId: string;
  role: string;
  cooldownRounds: number | null;
};

function deriveSourceTeamIdsFromPaths(
  rotationPaths: RotationPathWithTeamName[],
  targetTeamId: string,
  role: "SUPPORT" | "DEVELOPMENT",
): string[] {
  return [
    ...new Set(
      rotationPaths
        .filter((p) => p.toTeamId === targetTeamId && p.role === role)
        .map((p) => p.fromTeamId),
    ),
  ];
}

function deriveSourceTeamNamesFromPaths(
  rotationPaths: RotationPathWithTeamName[],
  targetTeamId: string,
): string[] {
  return [
    ...new Set(
      rotationPaths
        .filter((p) => p.toTeamId === targetTeamId && p.role === "SUPPORT")
        .map((p) => p.fromTeam.name),
    ),
  ];
}

function getPlayerName(player: Pick<Player, "firstName" | "lastName">): string {
  return player.lastName ? `${player.firstName} ${player.lastName}` : player.firstName;
}

export async function generateSelection(matchId: string, options?: { deferRotation?: boolean }): Promise<GeneratedSelection> {
  const deferRotation = options?.deferRotation ?? false;
  const [match, players, rules, registeredMatches, savedSelections, rotationPaths, finalizedPathHistory] = await Promise.all([
    db.match.findUnique({
      where: { id: matchId },
      include: {
        team: {
           select: {
             developmentSlots: true,
             id: true,
             maxSquadSize: true,
             maxSupportCount: true,
             minAcceptedSquadSize: true,
             minCorePlayers: true,
             minSupportPlayers: true,
             name: true,
             supportPriority: true,
             targetSupportCount: true,
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
             developmentSlots: true,
             id: true,
             maxSquadSize: true,
             maxSupportCount: true,
             minAcceptedSquadSize: true,
             minCorePlayers: true,
             minSupportPlayers: true,
             name: true,
             supportPriority: true,
             targetSupportCount: true,
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
             developmentSlots: true,
             id: true,
             maxSquadSize: true,
             maxSupportCount: true,
             minAcceptedSquadSize: true,
             minCorePlayers: true,
             minSupportPlayers: true,
             name: true,
             supportPriority: true,
             targetSupportCount: true,
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
        fromTeam: {
          select: {
            name: true,
          },
        },
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
  const consecutiveSupportByPlayer = new Map<string, number>();

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
    const _manuallyRemoved = matchSelections.filter((s) => {
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
        developmentSourceTeamIds: deriveSourceTeamIdsFromPaths(rotationPaths, selectionRecord.match.teamId, "DEVELOPMENT"),
        startsAt: selectionRecord.match.startsAt,
        supportSourceTeamIds: deriveSourceTeamIdsFromPaths(rotationPaths, selectionRecord.match.teamId, "SUPPORT"),
        supportSourceTeamNames: deriveSourceTeamNamesFromPaths(rotationPaths, selectionRecord.match.teamId),
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
    developmentSlots: match.team.developmentSlots,
    developmentSourceTeamIds: deriveSourceTeamIdsFromPaths(rotationPaths, match.teamId, "DEVELOPMENT"),
    id: match.id,
    startsAt: match.startsAt,
    supportSourceTeamIds: deriveSourceTeamIdsFromPaths(rotationPaths, match.teamId, "SUPPORT"),
    supportSourceTeamNames: deriveSourceTeamNamesFromPaths(rotationPaths, match.teamId),
    team: match.team,
    teamId: match.teamId,
  };
  const normalizedRegisteredMatches: MatchRecord[] = registeredMatches.map((registeredMatch) => ({
    developmentSlots: registeredMatch.team.developmentSlots,
    developmentSourceTeamIds: deriveSourceTeamIdsFromPaths(rotationPaths, registeredMatch.teamId, "DEVELOPMENT"),
    id: registeredMatch.id,
    startsAt: registeredMatch.startsAt,
    supportSourceTeamIds: deriveSourceTeamIdsFromPaths(rotationPaths, registeredMatch.teamId, "SUPPORT"),
    supportSourceTeamNames: deriveSourceTeamNamesFromPaths(rotationPaths, registeredMatch.teamId),
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
        nonRotatable: player.nonRotatable,
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
        nonRotatable: player.nonRotatable,
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
        nonRotatable: player.nonRotatable,
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
      const hasSupportPath = player.rotationPathsFromCoreTeam.some(
        (p) => p.toTeamId === currentMatchRecord.teamId && p.role === "SUPPORT",
      );
      if (hasSupportPath) {
        warnings.push({
          severity: "WARNING",
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
        nonRotatable: player.nonRotatable,
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
        nonRotatable: player.nonRotatable,
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
        nonRotatable: player.nonRotatable,
        playerId: player.id,
        playerName,
        playerPosition,
        priorityScore: null,
        selectionCategory: "EXCLUDED",
        automaticSelectionCategory:
          eligibility.selectionCategory === "CORE"
            ? "CORE"
            : (eligibility.selectionCategory as AutomaticSelectionCategory),
        exclusionReason: registeredConflict.reason,
      });
      continue;
    }

    if (player.currentAvailability === "TENTATIVE") {
      warnings.push({
        severity: "WARNING",
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
      candidateCategory: eligibility.selectionCategory as RotationCandidateCategory,
      eligibilityExplanation: eligibility.explanation,
    });
  }

  const selectedCorePlayers = [...eligibleCorePlayers];

  if (selectedCorePlayers.length > match.team.maxSquadSize) {
    const overflowCount = selectedCorePlayers.length - match.team.maxSquadSize;

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
        nonRotatable: candidate.player.nonRotatable,
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

  const supportCandidatePlayerIds = eligibleRotationPlayers
    .filter((p) => p.candidateCategory === "SUPPORT")
    .map((p) => p.player.id);

  if (supportCandidatePlayerIds.length > 0) {
    const results = await Promise.all(
      supportCandidatePlayerIds.map(async (playerId) => {
        const result = await getConsecutiveSupportCount(playerId, match.startsAt);
        return { playerId, count: result.consecutiveSupportRounds };
      }),
    );
    for (const { playerId, count } of results) {
      consecutiveSupportByPlayer.set(playerId, count);
    }
  }

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
        nonRotatable: player.nonRotatable,
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
        nonRotatable: player.nonRotatable,
        playerId: player.id,
        playerName,
        playerPosition,
        priorityScore: null,
        selectionCategory: "EXCLUDED",
        automaticSelectionCategory: candidateCategory as AutomaticSelectionCategory,
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
        nonRotatable: player.nonRotatable,
        playerId: player.id,
        playerName,
        playerPosition,
        priorityScore: null,
        selectionCategory: "EXCLUDED",
        automaticSelectionCategory: candidateCategory as AutomaticSelectionCategory,
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

  let directSupportTarget = deferRotation ? 0 : Math.min(match.team.minSupportPlayers, match.team.maxSquadSize);
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
        match.team.maxSquadSize - reservedDirectSupportPlayers - (selectedCorePlayers.length - preservedForSupportCandidates.length),
        0,
      ),
      Math.max(match.team.maxSquadSize - directSupportTarget, 0),
    );
    const uncappedSupportTarget = Math.min(
      directSupportTarget + extraSupportBackfillTarget,
      match.team.maxSquadSize,
    );
    const configuredSupportCap = match.team.targetSupportCount || match.team.maxSupportCount;
    effectiveSupportTarget = configuredSupportCap
      ? Math.min(uncappedSupportTarget, configuredSupportCap)
      : uncappedSupportTarget;
    reservedSupportPlayers = Math.min(effectiveSupportTarget, supportCandidateCount);
    effectiveDevelopmentTarget = Math.min(
      currentMatchRecord.developmentSlots,
      Math.max(match.team.maxSquadSize - reservedSupportPlayers, 0),
    );
    reservedDevelopmentPlayers = Math.min(effectiveDevelopmentTarget, developmentCandidateCount);
    effectiveExtraSupportBackfillTarget = extraSupportBackfillTarget;
  }

  const extraReservedSupportPlayers = deferRotation ? 0 : Math.max(reservedSupportPlayers - reservedDirectSupportPlayers, 0);
  const coreSelectionLimit = deferRotation
    ? match.team.minCorePlayers
    : Math.max(
        match.team.maxSquadSize - reservedSupportPlayers - reservedDevelopmentPlayers,
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
        severity: "WARNING",
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
        severity: "WARNING",
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
        severity: "WARNING",
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
      nonRotatable: candidate.player.nonRotatable,
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
      consecutiveSupportByPlayer,
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
    selectedPlayers.length < match.team.maxSquadSize
  ) {
    if (!takeTopRotationCandidate((candidate) => candidate.candidateCategory === "SUPPORT")) {
      break;
    }
  }

  while (
    selectedPlayers.filter((p) => p.selectionCategory === "DEVELOPMENT").length <
      reservedDevelopmentPlayers &&
    selectedPlayers.length < match.team.maxSquadSize
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
      nonRotatable: player.nonRotatable,
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
      nonRotatable: candidate.player.nonRotatable,
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
      severity: "WARNING",
      code: "core_player_overflow",
      message:
        reservedSupportPlayers > 0 || reservedDevelopmentPlayers > 0
          ? `Eligible core players exceeded the ${coreSelectionLimit} core slots left after reserving ${reservedSupportPlayers} support slot(s) and ${reservedDevelopmentPlayers} development slot(s).`
          : "Eligible core players exceeded squad size, so only the highest-priority core slots were kept.",
    });
  }

  if (!deferRotation && effectiveExtraSupportBackfillTarget > 0) {
    warnings.push({
      severity: "SCORING_PREFERENCE",
      code: "support_backfill_priority",
      message:
        extraReservedSupportPlayers > 0
          ? `${match.team.name} is preserving ${preservedForSupportCandidates.length} core player(s) for higher-priority support needs in ${preservedSupportTargetTeams}. The engine therefore reserved ${extraReservedSupportPlayers} extra support slot(s) beyond the configured minimum of ${directSupportTarget}.`
          : `${match.team.name} is preserving ${preservedForSupportCandidates.length} core player(s) for higher-priority support needs in ${preservedSupportTargetTeams}, but no extra eligible support players were available beyond the configured minimum of ${directSupportTarget}.`,
    });
  }

  if (!deferRotation && effectiveSupportTarget > reservedSupportPlayers) {
    const supportSourcePlayerIds = playerRecords
      .filter((player) =>
        player.rotationPathsFromCoreTeam.some(
          (p) => p.toTeamId === currentMatchRecord.teamId && p.role === "SUPPORT",
        ),
      )
      .map((player) => player.id);
    const supportBlockers = buildCandidateBlockerSummary(excludedPlayers, supportSourcePlayerIds);
    const supportSourceTeamNames = [...new Set(
      playerRecords
        .filter((player) =>
          player.rotationPathsFromCoreTeam.some(
            (p) => p.toTeamId === currentMatchRecord.teamId && p.role === "SUPPORT",
          ),
        )
        .map((player) => player.coreTeam.name),
    )];
    warnings.push({
      severity: "WARNING",
      code: "support_requirement_shortfall",
      message: `${match.team.name} needs ${effectiveSupportTarget} support player(s) (${directSupportTarget} configured minimum${effectiveExtraSupportBackfillTarget > 0 ? ` and ${effectiveExtraSupportBackfillTarget} extra backfill slot(s)` : ""}), but only ${reservedSupportPlayers} eligible support player(s) were available from ${formatTeamNameList(supportSourceTeamNames) || "the configured support teams"}.${supportBlockers.length > 0 ? ` Main blockers: ${supportBlockers.join(" ")}` : ""}`,
    });
  }

  if (!deferRotation && effectiveDevelopmentTarget > reservedDevelopmentPlayers) {
    const developmentSourcePlayerIds = playerRecords
      .filter((player) =>
        player.rotationPathsFromCoreTeam.some(
          (p) => p.toTeamId === currentMatchRecord.teamId && p.role === "DEVELOPMENT",
        ),
      )
      .map((player) => player.id);
    const developmentBlockers = buildCandidateBlockerSummary(
      excludedPlayers,
      developmentSourcePlayerIds,
    );
      warnings.push({
        severity: "WARNING",
        code: "development_slot_shortfall",
        message: `${match.team.name} reserves ${effectiveDevelopmentTarget} development slot(s), but only ${reservedDevelopmentPlayers} eligible development player(s) were available within configured source teams.${developmentBlockers.length > 0 ? ` Main blockers: ${developmentBlockers.join(" ")}` : ""}`,
      });
  }

  if (!deferRotation) {
    while (selectedPlayers.length < match.team.maxSquadSize) {
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
          severity: "WARNING",
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
      nonRotatable: playerRecord.nonRotatable,
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

  const minAccepted = match.team.minAcceptedSquadSize ?? match.squadSize;

  if (selectedPlayers.length < minAccepted) {
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
      severity: "HARD_BLOCK",
      code: "squad_below_minimum",
      message: `${match.team.name} has only ${selectedPlayers.length} player(s), below the minimum accepted squad size of ${minAccepted}.${blockers.length > 0 ? ` Blockers: ${blockers.join(" ")}` : ""}`,
    });
  } else if (selectedPlayers.length < match.squadSize) {
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
      severity: "WARNING",
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
      severity: "WARNING",
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
    teamId: match.teamId,
    teamName: match.team.name,
    warnings,
  };
}