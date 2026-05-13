// ┌─────────────────────────────────────────────────────────────────────┐
// │ QUARANTINED: This module is no longer part of the generation       │
// │ pipeline. Controlled double-load has been removed from planned     │
// │ generation. A player must not be planned for two matches in the   │
// │ same round/week. This file is retained for:                       │
// │   1. Historical data migration (migrate-double-load-roles.ts)     │
// │   2. Manual overrides that may still reference controlled         │
// │      double-load concepts                                        │
// │   3. Reference for understanding the old pipeline                 │
// │                                                                  │
// │ DO NOT re-add this to generateRound() or any generation path.    │
// │ Actual double-load (from post-match reports) is tracked via the   │
// │ effective participation layer, not via Selection.controlledDouble  │
// │ Load.                                                             │
// └─────────────────────────────────────────────────────────────────────┘

import { db } from "@/lib/db";
import type { GeneratedSelection, SelectedPlayer, SelectionWarning } from "@/lib/selection/types";

type _DoubleLoadPath = {
  id: string;
  fromTeamId: string;
  toTeamId: string;
  role: string;
  minRestSpacingHours: number | null;
  maxDoubleLoadsPerPeriod: number | null;
};

type DoubleLoadAssignment = {
  playerId: string;
  playerName: string;
  playerPosition: string;
  coreTeamId: string;
  coreTeamName: string;
  fromMatchId: string;
  toMatchId: string;
  toTeamId: string;
  toTeamName: string;
  restHours: number;
  rotationPathId: string;
};

export type DoubleLoadResult = {
  matchResults: GeneratedSelection[];
  assignments: DoubleLoadAssignment[];
  warnings: SelectionWarning[];
};

function hoursBetween(earlier: Date, later: Date): number {
  return (later.getTime() - earlier.getTime()) / (1000 * 60 * 60);
}

export async function evaluateControlledDoubleLoad(
  matchResults: GeneratedSelection[],
  assignedPlayerIds: Set<string>,
  matchRoundId: string,
): Promise<DoubleLoadResult> {
  const warnings: SelectionWarning[] = [];
  const assignments: DoubleLoadAssignment[] = [];

  const doubleLoadPaths = await db.rotationPath.findMany({
    where: { active: true, allowDoubleLoad: true },
    select: {
      id: true,
      fromTeamId: true,
      toTeamId: true,
      role: true,
      minRestSpacingHours: true,
      maxDoubleLoadsPerPeriod: true,
    },
  });

  if (doubleLoadPaths.length === 0) {
    return { matchResults, assignments, warnings };
  }

  const matchRound = await db.matchRound.findUnique({
    where: { id: matchRoundId },
    select: { planningPeriodId: true },
  });

  if (!matchRound) {
    return { matchResults, assignments, warnings };
  }

  const doubleLoadCounts = await loadDoubleLoadCounts(matchRound.planningPeriodId);

  const allMatches = await db.match.findMany({
    where: { id: { in: matchResults.map((r) => r.matchId) } },
    select: {
      id: true,
      teamId: true,
      startsAt: true,
      team: { select: { id: true, name: true, maxSquadSize: true, targetSquadSize: true } },
    },
  });

  const matchById = new Map(allMatches.map((m) => [m.id, m]));

  type PlayerLocation = {
    playerId: string;
    playerName: string;
    playerPosition: string;
    coreTeamId: string;
    coreTeamName: string;
    nonRotatable: boolean;
    matchId: string;
    matchDate: Date;
    selectionCategory: string;
    controlledDoubleLoad: boolean;
  };

  const playerLocations: PlayerLocation[] = [];
  for (const result of matchResults) {
    const matchData = matchById.get(result.matchId);
    if (!matchData) continue;

    for (const player of result.selectedPlayers) {
      playerLocations.push({
        playerId: player.playerId,
        playerName: player.playerName,
        playerPosition: player.playerPosition,
        coreTeamId: player.coreTeamId,
        coreTeamName: player.coreTeamName,
        nonRotatable: player.nonRotatable,
        matchId: result.matchId,
        matchDate: matchData.startsAt,
        selectionCategory: player.selectionCategory,
        controlledDoubleLoad: player.controlledDoubleLoad === true,
      });
    }
  }

  const playerById = new Map<string, PlayerLocation[]>();
  for (const loc of playerLocations) {
    const existing = playerById.get(loc.playerId) ?? [];
    existing.push(loc);
    playerById.set(loc.playerId, existing);
  }

  type Candidate = {
    playerId: string;
    playerName: string;
    playerPosition: string;
    coreTeamId: string;
    coreTeamName: string;
    fromMatchId: string;
    fromMatchDate: Date;
    toMatchId: string;
    toMatchDate: Date;
    toTeamId: string;
    toTeamName: string;
    restHours: number;
    minRestHours: number;
    maxDoubleLoads: number;
    existingDoubleLoadCount: number;
    rotationPathId: string;
    pathRole: string;
    nonRotatable: boolean;
  };

  const candidates: Candidate[] = [];

  for (const path of doubleLoadPaths) {
    const playersFromTeam = playerLocations.filter(
      (loc) => loc.coreTeamId === path.fromTeamId,
    );

    for (const playerLoc of playersFromTeam) {
      if (playerLoc.nonRotatable) continue;
      if (playerLoc.controlledDoubleLoad) continue;

      const toMatches = matchResults.filter((r) => {
        const mData = matchById.get(r.matchId);
        if (!mData) return false;
        if (mData.teamId !== path.toTeamId) return false;
        if (r.matchId === playerLoc.matchId) return false;
        return true;
      });

      for (const toMatchResult of toMatches) {
        const toMatchData = matchById.get(toMatchResult.matchId);
        if (!toMatchData) continue;

        const fromDate = playerLoc.matchDate;
        const toDate = toMatchData.startsAt;

        if (fromDate.toDateString() === toDate.toDateString()) continue;

        const earlier = fromDate < toDate ? fromDate : toDate;
        const later = fromDate < toDate ? toDate : fromDate;
        const restHours = hoursBetween(earlier, later);

        const minRest = path.minRestSpacingHours ?? 0;
        if (restHours < minRest) continue;

        const existingCount = doubleLoadCounts.get(playerLoc.playerId) ?? 0;
        const maxAllowed = path.maxDoubleLoadsPerPeriod ?? Infinity;

        const baseRole = playerLoc.coreTeamId === path.toTeamId ? "CORE" : path.role;

        candidates.push({
          playerId: playerLoc.playerId,
          playerName: playerLoc.playerName,
          playerPosition: playerLoc.playerPosition,
          coreTeamId: playerLoc.coreTeamId,
          coreTeamName: playerLoc.coreTeamName,
          fromMatchId: playerLoc.matchId,
          fromMatchDate: fromDate,
          toMatchId: toMatchResult.matchId,
          toMatchDate: toDate,
          toTeamId: path.toTeamId,
          toTeamName: toMatchData.team.name,
          restHours,
          minRestHours: minRest,
          maxDoubleLoads: maxAllowed === Infinity ? -1 : maxAllowed,
          existingDoubleLoadCount: existingCount,
          rotationPathId: path.id,
          pathRole: baseRole,
          nonRotatable: playerLoc.nonRotatable,
        });
      }
    }
  }

  candidates.sort((left, right) => {
    const leftRemaining = left.maxDoubleLoads === -1 ? Infinity : left.maxDoubleLoads - left.existingDoubleLoadCount;
    const rightRemaining = right.maxDoubleLoads === -1 ? Infinity : right.maxDoubleLoads - right.existingDoubleLoadCount;
    const leftEligible = leftRemaining > 0;
    const rightEligible = rightRemaining > 0;
    if (leftEligible && !rightEligible) return -1;
    if (!leftEligible && rightEligible) return 1;
    return left.existingDoubleLoadCount - right.existingDoubleLoadCount;
  });

  const usedPlayerIds = new Set<string>();
  const updatedResults = [...matchResults];
  const updatedAssignedIds = new Set(assignedPlayerIds);

  for (const candidate of candidates) {
    if (candidate.maxDoubleLoads !== -1 && candidate.existingDoubleLoadCount >= candidate.maxDoubleLoads) {
      if (!usedPlayerIds.has(candidate.playerId)) {
        warnings.push({
          severity: "WARNING",
          code: "double_load_exceeded_max",
          message: `${candidate.playerName} has reached the maximum double-load count (${candidate.maxDoubleLoads}) for this planning period and is not eligible for another double-load.`,
          playerId: candidate.playerId,
        });
        usedPlayerIds.add(candidate.playerId);
      }
      continue;
    }

    const toMatchIdx = updatedResults.findIndex((r) => r.matchId === candidate.toMatchId);
    if (toMatchIdx < 0) continue;

    const toMatch = updatedResults[toMatchIdx]!;
    const toMatchData = matchById.get(candidate.toMatchId);
    if (!toMatchData) continue;

    if (toMatch.selectedPlayers.length >= toMatchData.team.maxSquadSize) {
      warnings.push({
        severity: "WARNING",
        code: "double_load_squad_full",
        message: `${candidate.playerName} cannot double-load into ${candidate.toTeamName} — squad is at maximum size (${toMatchData.team.maxSquadSize}).`,
        playerId: candidate.playerId,
        matchId: candidate.toMatchId,
        teamId: candidate.toTeamId,
      });
      continue;
    }

    const doubleLoadPlayer: SelectedPlayer = {
      autoSelected: true,
      chosenPosition: candidate.playerPosition,
      coreTeamId: candidate.coreTeamId,
      coreTeamName: candidate.coreTeamName,
      controlledDoubleLoad: true,
      eligibility: true,
      explanations: [
        {
          code: "controlled_double_load",
          summary: `${candidate.playerName} was selected as controlled double-load for ${candidate.toTeamName}, playing a second match in this round with ${Math.round(candidate.restHours)}h rest between matches.`,
          hardRule: false,
        },
      ],
      finalSelected: false,
      manualOverride: false,
      nonRotatable: candidate.nonRotatable,
      playerId: candidate.playerId,
      playerName: candidate.playerName,
      playerPosition: candidate.playerPosition,
      priorityScore: 50,
      selectionCategory: candidate.pathRole as SelectedPlayer["selectionCategory"],
      selectionReason: `Controlled double-load: ${candidate.playerName} plays a second match in this round for ${candidate.toTeamName} with ${Math.round(candidate.restHours)}h rest.`,
    };

    updatedResults[toMatchIdx] = {
      ...toMatch,
      selectedPlayers: [...toMatch.selectedPlayers, doubleLoadPlayer],
    };

    assignments.push({
      playerId: candidate.playerId,
      playerName: candidate.playerName,
      playerPosition: candidate.playerPosition,
      coreTeamId: candidate.coreTeamId,
      coreTeamName: candidate.coreTeamName,
      fromMatchId: candidate.fromMatchId,
      toMatchId: candidate.toMatchId,
      toTeamId: candidate.toTeamId,
      toTeamName: candidate.toTeamName,
      restHours: candidate.restHours,
      rotationPathId: candidate.rotationPathId,
    });

    updatedAssignedIds.add(candidate.playerId);
  }

  return { matchResults: updatedResults, assignments, warnings };
}

async function loadDoubleLoadCounts(
  planningPeriodId: string,
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();

  const finalizedSelections = await db.selection.findMany({
    where: {
      controlledDoubleLoad: true,
      match: {
        matchRound: {
          planningPeriodId,
          status: "FINALIZED",
        },
      },
    },
    select: { playerId: true },
  });

  for (const s of finalizedSelections) {
    counts.set(s.playerId, (counts.get(s.playerId) ?? 0) + 1);
  }

  return counts;
}