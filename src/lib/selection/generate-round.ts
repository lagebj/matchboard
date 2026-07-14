import { db } from "@/lib/db";
import { generateSelection } from "@/lib/selection/generate-selection";
import { resolveRoundSupport, resolveSquadRepair } from "@/lib/selection/resolve-round-support";
import { routeCoreMatchDrops, type RoutedDrop } from "@/lib/selection/route-core-match-drops";
import { resolveRoundConflicts } from "@/lib/selection/resolve-round-conflicts";
import { validateGeneratedRoundInvariants } from "@/lib/selection/validate-generated-round-invariants";
import type {
  CoreMatchDropCandidate,
  GeneratedRound,
  GeneratedSelection,
  GenerationSummary,
  SelectedPlayer,
  SelectionWarning,
} from "@/lib/selection/types";
import { type ReadinessSignalEntry } from "@/lib/selection/readiness-scoring";
import { buildPolicyInput } from "@/lib/policies/build-policy-input";
import { evaluateSelectionPolicy } from "@/lib/policies/policy-evaluation";
import { coachFacingBlockedReason, coachFacingWarningMessage } from "@/lib/policies/policy-evaluation";

export async function generateMatchRound(matchRoundId: string): Promise<GeneratedRound> {
  const matchRound = await db.matchRound.findUnique({
    where: { id: matchRoundId },
    include: {
      matches: {
        where: { status: { not: "CANCELLED" } },
        include: {
          team: {
            select: {
              id: true,
              name: true,
              minSupportPlayers: true,
              targetSquadSize: true,
              targetSupportCount: true,
              supportPriority: true,
            },
          },
        },
        orderBy: [{ startsAt: "asc" }],
      },
    },
  });

  if (!matchRound) {
    throw new Error("Match round not found.");
  }

  const readinessSignalsRaw = await db.playerReadinessSignal.findMany({
    select: {
      playerId: true,
      signalType: true,
      value: true,
    },
  });

  const readinessSignals: ReadinessSignalEntry[] = readinessSignalsRaw.map((s) => ({
    playerId: s.playerId,
    signalType: s.signalType as ReadinessSignalEntry["signalType"],
    value: s.value as ReadinessSignalEntry["value"],
  }));

  if (matchRound.matches.length === 0) {
    return {
      generatedAt: new Date(),
      generationSummary: { supportNeeds: [], routedCoreMatchDrops: [], unroutedExclusions: [] },
      matchRoundId,
      matchResults: [],
      roundWarnings: [],
    };
  }

  const sortedMatches = [...matchRound.matches].sort((left, right) => {
    const leftPriority = left.team.supportPriority ?? 0;
    const rightPriority = right.team.supportPriority ?? 0;
    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }
    return left.startsAt.getTime() - right.startsAt.getTime();
  });

  const matchResults: GeneratedSelection[] = [];
  const roundWarnings: SelectionWarning[] = [];

  // Phase 1: Per-match core selection (deferRotation mode, fills only minCorePlayers)
  for (const match of sortedMatches) {
    const result = await generateSelection(match.id, { deferRotation: true });
    matchResults.push(result);
  }

  // Phase 2: Round-level required support resolution
  const supportResolution = await resolveRoundSupport(matchResults, readinessSignals);
  roundWarnings.push(...supportResolution.roundWarnings);

  // Phase 3: Cross-match conflict resolution
  const conflictResolution = resolveRoundConflicts(supportResolution.resolvedMatchResults);

  roundWarnings.push(...conflictResolution.conflictWarnings);

  const allAssignedPlayerIds = new Set(supportResolution.assignedPlayerIds);
  for (const result of conflictResolution.resolvedMatchResults) {
    for (const player of result.selectedPlayers) {
      allAssignedPlayerIds.add(player.playerId);
    }
  }

  let finalResults = conflictResolution.resolvedMatchResults;

  // Phase 4: Development routing (core match drops routed as development)
  const coreMatchDropCandidates = await extractCoreMatchDropCandidates(
    finalResults,
  );

  if (coreMatchDropCandidates.length > 0) {
    const routedDrops = await routeCoreMatchDrops(
      coreMatchDropCandidates,
      finalResults,
    );

    for (const drop of routedDrops) {
      allAssignedPlayerIds.add(drop.playerId);
    }

    finalResults = applyRoutedDrops(finalResults, routedDrops);
  }

  // Phase 5: Squad repair (repairing teams weakened by support movement)
  const squadRepairResult = await resolveSquadRepair(
    finalResults,
    allAssignedPlayerIds,
    supportResolution.supportAssignments,
    readinessSignals,
  );
  roundWarnings.push(...squadRepairResult.warnings);
  finalResults = squadRepairResult.matchResults;

  // Phase 5b: Self-squad-repair — re-include excluded own-core players for teams below target
  finalResults = selfSquadRepairBelowTarget(finalResults, sortedMatches, allAssignedPlayerIds);

  // Phase 6: Post-pipeline validation and warning persistence
  const rotationPaths = await db.rotationPath.findMany({
    where: { active: true },
    select: { fromTeamId: true, toTeamId: true, role: true, active: true },
  });

  const teamIdByMatchId = new Map<string, string>();
  for (const match of matchRound.matches) {
    teamIdByMatchId.set(match.id, match.teamId);
  }

  const invariantViolations = validateGeneratedRoundInvariants(finalResults, rotationPaths, teamIdByMatchId);
  for (const violation of invariantViolations) {
    roundWarnings.push({
      code: violation.code,
      message: violation.message,
      playerId: violation.playerId,
      teamId: violation.targetTeamId,
      matchId: violation.matchId,
    });
  }

  for (const result of finalResults) {
    const duplicateIds = result.selectedPlayers
      .map((p) => p.playerId)
      .filter((id, index, arr) => arr.indexOf(id) !== index);

    for (const duplicateId of [...new Set(duplicateIds)]) {
      roundWarnings.push({
        code: "duplicate_player_in_match",
        message: `Player appears more than once in ${result.teamName} after round-level generation. This should be reviewed manually.`,
        playerId: duplicateId,
      });
    }

    for (const otherResult of finalResults) {
      if (otherResult.matchId === result.matchId) continue;

      const otherPlayerIds = new Set(otherResult.selectedPlayers.map((p) => p.playerId));
      for (const player of result.selectedPlayers) {
        if (otherPlayerIds.has(player.playerId)) {
          roundWarnings.push({
            code: "player_in_multiple_matches",
            message: `${player.playerName} appears in both ${result.teamName} and ${otherResult.teamName} in the same match round. This is a hard rule violation.`,
            playerId: player.playerId,
          });
        }
      }
    }
  }

  // Phase 7: Policy-derived warnings (additive, non-blocking)
  try {
    const matchTeamIds = sortedMatches.map((m) => m.teamId);
    const teams = await db.team.findMany({
      where: { id: { in: matchTeamIds } },
      select: { id: true, name: true, targetSquadSize: true, minAcceptedSquadSize: true, maxSquadSize: true },
    });

    const policyInput = buildPolicyInput({
      mode: "league",
      phase: "post_selection",
      decisionType: "league_match_selection",
      fairnessScope: "round",
      players: await db.player.findMany({
        where: { removedAt: null },
        select: {
          id: true, firstName: true, lastName: true, active: true, removedAt: true,
          primaryPosition: true, secondaryPosition: true, tertiaryPosition: true,
          goalkeeperAbility: true, nonRotatable: true, shirtNumber: true, coreTeamId: true,
          availabilities: { where: { matchRoundId }, select: { status: true, matchRoundId: true } },
        },
      }),
      teams: teams.map((t) => ({
        id: t.id,
        name: t.name,
        targetSquadSize: t.targetSquadSize,
        minSquadSize: t.minAcceptedSquadSize,
        maxSquadSize: t.maxSquadSize,
      })),
      squads: finalResults.map((r) => ({
        id: r.matchId,
        name: r.teamName,
        teamId: r.teamId,
        playerIdList: r.selectedPlayers.map((p) => p.playerId),
        primaryGoalkeeperCount: r.selectedPlayers.filter((p) => p.selectionCategory === "CORE" && p.playerPosition === "GK").length,
        secondaryGoalkeeperCount: r.selectedPlayers.filter((p) => p.selectionCategory !== "CORE" && p.playerPosition === "GK").length,
        anyGoalkeeperCount: r.selectedPlayers.filter((p) => p.playerPosition === "GK").length,
      })),
      matches: sortedMatches.map((m) => ({
        id: m.id,
        startsAt: m.startsAt,
        matchStatus: m.status,
      })),
      nowIso: new Date().toISOString(),
      leagueMatchId: matchRoundId,
    });

    const policyResult = await evaluateSelectionPolicy(policyInput);

    for (const [playerId, reasons] of Object.entries(policyResult.result.blocked)) {
      for (const reason of reasons) {
        roundWarnings.push({
          code: `policy_blocked_${reason}`,
          message: coachFacingBlockedReason(reason),
          playerId,
        });
      }
    }

    for (const warning of policyResult.result.warnings) {
      roundWarnings.push({
        code: warning.code,
        message: coachFacingWarningMessage(warning),
        playerId: warning.playerId,
        teamId: warning.teamId,
        matchId: warning.matchId,
      });
    }
  } catch {
    // Policy evaluation failure must not block generation.
    // Generation results are always produced; policy warnings are additive.
  }

  return {
    generatedAt: new Date(),
    generationSummary: buildGenerationSummary(finalResults, sortedMatches),
    matchRoundId,
    matchResults: finalResults,
    roundWarnings,
  };
}

function buildGenerationSummary(
  matchResults: GeneratedSelection[],
  sortedMatches: Array<{ team: { id: string; name: string; minSupportPlayers: number; targetSupportCount: number; supportPriority: number } }>,
): GenerationSummary {
  const supportNeeds = sortedMatches.map((match) => {
    const result = matchResults.find((r) => r.teamName === match.team.name);
    const filledCount = result?.selectedPlayers.filter((p) => p.selectionCategory === "SUPPORT").length ?? 0;

    return {
      teamName: match.team.name,
      supportPriority: match.team.supportPriority,
      targetSupportCount: match.team.targetSupportCount,
      minSupportCount: match.team.minSupportPlayers,
      filledCount,
    };
  });

  const routedCoreMatchDrops: Array<{ playerName: string; fromTeamName: string; toTeamName: string; role: string }> = [];
  for (const result of matchResults) {
    for (const player of result.selectedPlayers) {
      const isRoutedDrop = player.explanations.some((e) => e.code === "core_match_drop_routed" || e.code === "core_match_drop_for_support");
      if (isRoutedDrop) {
        routedCoreMatchDrops.push({
          playerName: player.playerName,
          fromTeamName: player.coreTeamName,
          toTeamName: result.teamName,
          role: player.selectionCategory,
        });
      }
    }
  }

  const allSelectedPlayerIds = new Set<string>();
  for (const result of matchResults) {
    for (const player of result.selectedPlayers) {
      allSelectedPlayerIds.add(player.playerId);
    }
  }

  const unroutedExclusions: Array<{ playerName: string; coreTeamName: string; reason: string }> = [];
  for (const result of matchResults) {
    for (const excluded of result.excludedPlayers) {
      const isDropOrOverflow =
        excluded.automaticSelectionCategory === "CORE" ||
        (excluded.eligibility === false && excluded.automaticSelectionCategory !== null);

      if (isDropOrOverflow && !allSelectedPlayerIds.has(excluded.playerId)) {
        unroutedExclusions.push({
          playerName: excluded.playerName,
          coreTeamName: excluded.coreTeamName,
          reason: excluded.exclusionReason,
        });
      }
    }
  }

  return {
    supportNeeds,
    routedCoreMatchDrops,
    unroutedExclusions,
  };
}

async function extractCoreMatchDropCandidates(
  matchResults: GeneratedSelection[],
): Promise<CoreMatchDropCandidate[]> {
  const candidates: CoreMatchDropCandidate[] = [];

  const excludedPlayerIds: string[] = [];
  for (const result of matchResults) {
    for (const excluded of result.excludedPlayers) {
      const isSurplusCore = excluded.automaticSelectionCategory === "CORE" && excluded.eligibility !== false;
      if (!isSurplusCore) continue;

      excludedPlayerIds.push(excluded.playerId);
      candidates.push({
        playerId: excluded.playerId,
        playerName: excluded.playerName,
        coreTeamId: excluded.coreTeamId ?? "",
        coreTeamName: excluded.coreTeamName,
        playerPosition: excluded.playerPosition,
        primaryPosition: excluded.playerPosition,
        secondaryPosition: null,
        tertiaryPosition: null,
        nonRotatable: excluded.nonRotatable,
        fromMatchId: result.matchId,
      });
    }
  }

  if (excludedPlayerIds.length > 0) {
    const nonRotatableIds = new Set(
      (await db.player.findMany({
        where: { id: { in: excludedPlayerIds }, nonRotatable: true },
        select: { id: true },
      })).map((p) => p.id),
    );
    return candidates.filter((c) => !nonRotatableIds.has(c.playerId));
  }

  return candidates;
}

function applyRoutedDrops(
  matchResults: GeneratedSelection[],
  routedDrops: RoutedDrop[],
): GeneratedSelection[] {
  if (routedDrops.length === 0) {
    return matchResults;
  }

  const teamToMatchIndex = new Map<string, number>();
  for (let i = 0; i < matchResults.length; i++) {
    const matchTeams = new Set<string>();
    matchTeams.add(matchResults[i]!.teamName);
    teamToMatchIndex.set(matchResults[i]!.teamName, i);
  }

  const routedPlayerIds = new Set(routedDrops.map((d) => d.playerId));

  const routedDropEntries: SelectedPlayer[] = routedDrops.map((drop) => {
    const positionFitMessage =
      drop.positionFit === "primary"
        ? "Position fit is primary."
        : drop.positionFit === "secondary"
          ? "Position fit is secondary."
          : drop.positionFit === "tertiary"
            ? "Position fit is tertiary."
            : "Position fit does not match needed positions.";

    return {
      autoSelected: true,
      chosenPosition: drop.playerPosition,
      coreTeamId: drop.fromTeamId,
      coreTeamName: drop.fromTeamName,
      eligibility: true,
      explanations: [
        { code: "core_match_drop_routed", summary: `Routed as core match drop from ${drop.fromTeamName} to ${drop.targetTeamName} with role ${drop.role}. ${positionFitMessage}`, hardRule: false },
        { code: "core_match_drop_priority", summary: `Core match drop candidates are prioritized over ordinary development candidates.`, hardRule: false },
      ],
      finalSelected: false,
      manualOverride: false,
      nonRotatable: drop.nonRotatable,
      playerId: drop.playerId,
      playerName: drop.playerName,
      playerPosition: drop.primaryPosition,
      priorityScore: 100 + drop.priorityBonus,
      selectionCategory: drop.role,
      selectionReason: `Selected as ${drop.role.toLowerCase()} for ${drop.targetTeamName} after being dropped as surplus core from ${drop.fromTeamName}.`,
    };
  });

  const result = matchResults.map((matchResult) => {
    const dropsForThisMatch = routedDrops.filter(
      (d) => d.targetMatchId === matchResult.matchId,
    );

    if (dropsForThisMatch.length === 0 && !matchResult.selectedPlayers.some((p) => routedPlayerIds.has(p.playerId))) {
      return matchResult;
    }

    const newSelectedPlayers = matchResult.selectedPlayers.filter(
      (p) => !routedPlayerIds.has(p.playerId),
    );

    const newExcludedPlayers = matchResult.excludedPlayers.filter(
      (p) => !routedPlayerIds.has(p.playerId),
    );

    for (const drop of dropsForThisMatch) {
      const dropEntry = routedDropEntries.find((e) => e.playerId === drop.playerId);
      if (!dropEntry) continue;

      if (newSelectedPlayers.some((p) => p.playerId === drop.playerId)) continue;

      newSelectedPlayers.push(dropEntry);
    }

    return {
      ...matchResult,
      selectedPlayers: newSelectedPlayers,
      excludedPlayers: newExcludedPlayers,
    };
  });

  return result;
}

function selfSquadRepairBelowTarget(
  matchResults: GeneratedSelection[],
  sortedMatches: Array<{ team: { name: string; targetSquadSize: number } }>,
  assignedPlayerIds: Set<string>,
): GeneratedSelection[] {
  const teamTargets = new Map(sortedMatches.map((m) => [m.team.name, m.team.targetSquadSize]));

  return matchResults.map((result) => {
    const target = teamTargets.get(result.teamName) ?? 11;
    const shortfall = target - result.selectedPlayers.length;
    if (shortfall <= 0) return result;

    const ownExcluded = result.excludedPlayers.filter(
      (p) => p.coreTeamId !== undefined && p.coreTeamName === result.teamName,
    );

    const available = ownExcluded.filter((p) => !assignedPlayerIds.has(p.playerId) && p.eligibility !== false);
    const toReinclude = available.slice(0, shortfall);

    if (toReinclude.length === 0) return result;

    const reincludedIds = new Set(toReinclude.map((p) => p.playerId));

    const reincludePlayers: SelectedPlayer[] = toReinclude.map((p) => ({
      autoSelected: p.autoSelected,
      chosenPosition: p.playerPosition,
      coreTeamId: p.coreTeamId ?? "",
      coreTeamName: p.coreTeamName ?? result.teamName,
      eligibility: p.eligibility,
      explanations: [
        ...p.explanations,
        { code: "self_squad_repair", summary: `${p.playerName} was re-included in ${result.teamName} because the squad was below target after round-level support resolution.`, hardRule: false },
      ],
      finalSelected: false,
      manualOverride: p.manualOverride,
      nonRotatable: p.nonRotatable,
      playerId: p.playerId,
      playerName: p.playerName,
      playerPosition: p.playerPosition,
      priorityScore: p.priorityScore ?? 0,
      selectionCategory: "SUPPORT" as const,
      selectionReason: `Re-included in ${result.teamName} as squad repair to meet target squad size after support rotation.`,
    }));

    for (const p of toReinclude) {
      assignedPlayerIds.add(p.playerId);
    }

    return {
      ...result,
      selectedPlayers: [...result.selectedPlayers, ...reincludePlayers],
      excludedPlayers: result.excludedPlayers.filter((p) => !reincludedIds.has(p.playerId)),
    };
  });
}