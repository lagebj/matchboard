import { db } from "@/lib/db";
import type { GeneratedSelection, SelectedPlayer, ExcludedPlayer, SelectionWarning } from "@/lib/selection/types";

type SupportSlot = {
  matchId: string;
  teamId: string;
  teamName: string;
  currentSupportCount: number;
  targetSupportCount: number;
  minSupportCount: number;
  maxSupportCount: number;
  supportPriority: number;
  squadSize: number;
  currentSquadCount: number;
  maxSquadSize: number;
};

type DonorSlot = {
  matchId: string;
  teamId: string;
  teamName: string;
  currentCoreCount: number;
  targetSquadSize: number;
  minAcceptedSquadSize: number;
  minCorePlayers: number;
  surplusCorePlayers: Array<SelectedPlayer | ExcludedPlayer>;
};

type RotationPathRow = {
  fromTeamId: string;
  toTeamId: string;
  role: string;
};

function buildSupportExplanations(
  playerName: string,
  donorTeamName: string,
  receiverTeamName: string,
  supportPriority: number,
): Array<{ code: string; summary: string; hardRule?: boolean }> {
  return [
    { code: "round_support_resolution", summary: `${playerName} was moved from ${donorTeamName} core to ${receiverTeamName} support during round-level support resolution.`, hardRule: false },
    { code: "support_priority_order", summary: `${receiverTeamName} has support priority ${supportPriority}, which was considered during round-level resolution.`, hardRule: false },
  ];
}

function buildDonorDropExplanation(
  playerName: string,
  donorTeamName: string,
  receiverTeamName: string,
): Array<{ code: string; summary: string; hardRule?: boolean }> {
  return [
    { code: "core_match_drop_for_support", summary: `${playerName} was dropped from ${donorTeamName} core to provide support for ${receiverTeamName}. The donor team had surplus core players above target squad size.`, hardRule: false },
  ];
}

export async function resolveRoundSupport(
  matchResults: GeneratedSelection[],
): Promise<{
  resolvedMatchResults: GeneratedSelection[];
  roundWarnings: SelectionWarning[];
  assignedPlayerIds: Set<string>;
}> {
  const warnings: SelectionWarning[] = [];

  const paths = await db.rotationPath.findMany({
    where: { active: true, role: "SUPPORT" },
    select: { fromTeamId: true, toTeamId: true, role: true },
  });

  const matchesRaw = await db.match.findMany({
    where: { id: { in: matchResults.map((r) => r.matchId) } },
    include: {
      team: {
        select: {
          id: true,
          name: true,
          targetSquadSize: true,
          minAcceptedSquadSize: true,
          minCorePlayers: true,
          maxSquadSize: true,
          minSupportPlayers: true,
          targetSupportCount: true,
          maxSupportCount: true,
          supportPriority: true,
        },
      },
    },
  });

  const matches: MatchWithTeam[] = matchesRaw.map((m) => ({
    id: m.id,
    matchRoundId: m.matchRoundId,
    teamId: m.teamId,
    team: m.team as TeamInfo,
  }));

  const matchByTeamId = new Map(matches.map((m) => [m.teamId, m]));
  const matchResultByTeamId = new Map<string, { index: number; result: GeneratedSelection }>();
  for (let i = 0; i < matchResults.length; i++) {
    const teamId = matches.find((m) => m.id === matchResults[i]!.matchId)?.team.id;
    if (teamId) {
      matchResultByTeamId.set(teamId, { index: i, result: matchResults[i]! });
    }
  }

  const supportSlots: SupportSlot[] = [];

  for (const match of matches) {
    const result = matchResults.find((r) => r.matchId === match.id);
    if (!result) continue;

    const currentSupportCount = result.selectedPlayers.filter(
      (p) => p.selectionCategory === "SUPPORT",
    ).length;

    if (currentSupportCount >= match.team.targetSupportCount) continue;

    supportSlots.push({
      matchId: match.id,
      teamId: match.teamId,
      teamName: match.team.name,
      currentSupportCount,
      targetSupportCount: match.team.targetSupportCount,
      minSupportCount: match.team.minSupportPlayers,
      maxSupportCount: match.team.maxSupportCount,
      supportPriority: match.team.supportPriority,
      squadSize: match.team.targetSquadSize,
      currentSquadCount: result.selectedPlayers.length,
      maxSquadSize: match.team.maxSquadSize,
    });
  }

  supportSlots.sort((a, b) => a.supportPriority - b.supportPriority);

  const assignedPlayerIds = new Set<string>();
  for (const result of matchResults) {
    for (const player of result.selectedPlayers) {
      assignedPlayerIds.add(player.playerId);
    }
  }

  const results = matchResults.map((r) => ({
    selectedPlayers: [...r.selectedPlayers],
    excludedPlayers: [...r.excludedPlayers],
    warnings: [] as SelectionWarning[],
  }));

  for (const slot of supportSlots) {
    const shortfall = slot.targetSupportCount - slot.currentSupportCount;
    if (shortfall <= 0) continue;

    const receivingResultIdx = results.findIndex(
      (_r, idx) => matchResults[idx]!.matchId === slot.matchId,
    );
    if (receivingResultIdx < 0) continue;

    const originalIdx = matchResults.findIndex((r) => r.matchId === slot.matchId);

    const donorPaths = paths.filter((p) => p.toTeamId === slot.teamId);

    const donorSlots: DonorSlot[] = [];

    for (const donorPath of donorPaths) {
      const donorMatchData = matchByTeamId.get(donorPath.fromTeamId);
      if (!donorMatchData) continue;

      const donorResultEntry = matchResultByTeamId.get(donorPath.fromTeamId);
      if (!donorResultEntry) continue;

      const donorSelectedPlayers = results[donorResultEntry.index]!.selectedPlayers;
      const donorExcludedPlayers = results[donorResultEntry.index]!.excludedPlayers;
      const donorCorePlayers = donorSelectedPlayers.filter(
        (p) => p.selectionCategory === "CORE" && p.coreTeamId === donorPath.fromTeamId,
      );
      const donorExcludedCorePlayers = donorExcludedPlayers.filter(
        (p) => (p.automaticSelectionCategory === "CORE" || p.selectionCategory === "EXCLUDED") && p.coreTeamId === donorPath.fromTeamId,
      );
      const donorsAvailable = [...donorCorePlayers, ...donorExcludedCorePlayers];

      const donorMatchInfo = matchByTeamId.get(donorPath.fromTeamId);

      const donorMinCore = donorMatchInfo?.team.minCorePlayers ?? donorMatchInfo?.team.targetSquadSize ?? 8;
      const surplus = donorsAvailable.length - donorMinCore;

      if (surplus <= 0) continue;

      donorSlots.push({
        matchId: donorMatchData.id,
        teamId: donorPath.fromTeamId,
        teamName: donorMatchData.team.name,
        currentCoreCount: donorsAvailable.length,
        targetSquadSize: donorMatchInfo?.team.targetSquadSize ?? 11,
        minAcceptedSquadSize: donorMatchInfo?.team.minAcceptedSquadSize ?? 9,
        minCorePlayers: donorMatchInfo?.team.minCorePlayers ?? 8,
        surplusCorePlayers: donorsAvailable,
      });
    }

    donorSlots.sort((a, b) => b.currentCoreCount - a.targetSquadSize - (a.currentCoreCount - a.targetSquadSize));

    let filled = 0;
    const donorsMovedCount = new Map<string, number>();

    for (const donor of donorSlots) {
      if (filled >= shortfall) break;

      const donorResultIdx = matchResultByTeamId.get(donor.teamId)?.index;
      if (donorResultIdx === undefined) continue;

      const available = donor.surplusCorePlayers.filter(
        (p) => !assignedPlayerIds.has(p.playerId) || results[donorResultIdx]!.selectedPlayers.some((sp) => sp.playerId === p.playerId),
      );

      const donorPlayers = await db.player.findMany({
        where: {
          id: { in: available.map((p) => p.playerId) },
          nonRotatable: false,
          removedAt: null,
          active: true,
          currentAvailability: "AVAILABLE",
        },
        include: {
          coreTeam: { select: { id: true, name: true } },
        },
        orderBy: [{ playerCode: "asc" }],
      });

      for (const donorPlayer of donorPlayers) {
        if (filled >= shortfall) break;
        if (slot.currentSquadCount + filled >= slot.maxSquadSize) break;

        const playerId = donorPlayer.id;
        const playerName = donorPlayer.firstName + (donorPlayer.lastName ? ` ${donorPlayer.lastName}` : "");

        const isCurrentlySelected = results[donorResultIdx]!.selectedPlayers.some(
          (p) => p.playerId === playerId,
        );

        if (isCurrentlySelected) {
          const selectedCoreRemaining = results[donorResultIdx]!.selectedPlayers.filter(
            (p) => p.selectionCategory === "CORE" && p.coreTeamId === donor.teamId,
          ).length;
          if (selectedCoreRemaining - 1 < donor.minCorePlayers) {
            continue;
          }

          results[donorResultIdx]!.selectedPlayers = results[donorResultIdx]!.selectedPlayers.filter(
            (p) => p.playerId !== playerId,
          );

          results[donorResultIdx]!.excludedPlayers.push({
            autoSelected: false,
            coreTeamId: donor.teamId,
            coreTeamName: donor.teamName,
            eligibility: true,
            explanations: buildDonorDropExplanation(playerName, donor.teamName, slot.teamName),
            finalSelected: false,
            manualOverride: false,
            playerId,
            playerName,
            playerPosition: donorPlayer.primaryPosition,
            priorityScore: null,
            automaticSelectionCategory: "SUPPORT",
            selectionCategory: "EXCLUDED",
            exclusionReason: `Dropped from ${donor.teamName} core to provide support for ${slot.teamName}.`,
          });
        } else {
          results[donorResultIdx]!.excludedPlayers = results[donorResultIdx]!.excludedPlayers.filter(
            (p) => p.playerId !== playerId,
          );
        }

        const supportPlayer: SelectedPlayer = {
          autoSelected: true,
          chosenPosition: donorPlayer.primaryPosition,
          coreTeamId: donor.teamId,
          coreTeamName: donor.teamName,
          eligibility: true,
          explanations: buildSupportExplanations(playerName, donor.teamName, slot.teamName, slot.supportPriority),
          finalSelected: false,
          manualOverride: false,
          playerId,
          playerName,
          playerPosition: donorPlayer.primaryPosition,
          priorityScore: 80,
          selectionCategory: "SUPPORT",
          selectionReason: `Selected as support for ${slot.teamName} during round-level support resolution. Moved from ${donor.teamName} core.`,
        };

        results[originalIdx]!.selectedPlayers.push(supportPlayer);
        filled++;
      }
    }

    if (filled < shortfall && filled < slot.minSupportCount - slot.currentSupportCount) {
      warnings.push({
        code: "support_shortfall_after_resolution",
        message: `${slot.teamName} has only ${slot.currentSupportCount + filled} support player(s) after round-level resolution, below the minimum of ${slot.minSupportCount}.`,
      });
    } else if (filled > 0 && filled < shortfall) {
      warnings.push({
        code: "support_below_target",
        message: `${slot.teamName} reached ${slot.currentSupportCount + filled} support player(s), below the target of ${slot.targetSupportCount} but meeting the minimum of ${slot.minSupportCount}.`,
      });
    }

    slot.currentSupportCount += filled;
    slot.currentSquadCount = results[originalIdx]!.selectedPlayers.length;
  }

  const resolvedMatchResults: GeneratedSelection[] = matchResults.map((original, i) => ({
    ...original,
    selectedPlayers: results[i]!.selectedPlayers,
    excludedPlayers: results[i]!.excludedPlayers,
    warnings: [...original.warnings, ...results[i]!.warnings],
  }));

  return {
    resolvedMatchResults,
    roundWarnings: warnings,
    assignedPlayerIds,
  };
}

export async function resolveBackfillAfterSupport(
  matchResults: GeneratedSelection[],
  assignedPlayerIds: Set<string>,
): Promise<{
  matchResults: GeneratedSelection[];
  warnings: SelectionWarning[];
}> {
  const backfillPaths = await db.rotationPath.findMany({
    where: { active: true, role: "BACKFILL" },
    select: { fromTeamId: true, toTeamId: true, role: true },
  });

  const matchesRaw = await db.match.findMany({
    where: { id: { in: matchResults.map((r) => r.matchId) } },
    include: {
      team: {
        select: {
          id: true,
          name: true,
          targetSquadSize: true,
          minAcceptedSquadSize: true,
          minCorePlayers: true,
          maxSquadSize: true,
          minSupportPlayers: true,
          targetSupportCount: true,
          maxSupportCount: true,
          supportPriority: true,
        },
      },
    },
  });

  const matches: MatchWithTeam[] = matchesRaw.map((m) => ({
    id: m.id,
    matchRoundId: m.matchRoundId,
    teamId: m.teamId,
    team: m.team as TeamInfo,
  }));

  const updatedAssignedIds = new Set(assignedPlayerIds);
  for (const result of matchResults) {
    for (const player of result.selectedPlayers) {
      updatedAssignedIds.add(player.playerId);
    }
  }

  return resolveBackfillFromSupportInner(matchResults, backfillPaths, matches, updatedAssignedIds);
}

type TeamInfo = {
  id: string;
  name: string;
  targetSquadSize: number;
  minAcceptedSquadSize: number;
  maxSquadSize: number;
  minCorePlayers: number;
  minSupportPlayers: number;
  targetSupportCount: number;
  maxSupportCount: number;
  supportPriority: number;
};

type MatchWithTeam = {
  id: string;
  matchRoundId: string;
  teamId: string;
  team: TeamInfo;
};

async function resolveBackfillFromSupportInner(
  matchResults: GeneratedSelection[],
  backfillPaths: RotationPathRow[],
  matches: MatchWithTeam[],
  assignedPlayerIds: Set<string>,
): Promise<{ matchResults: GeneratedSelection[]; warnings: SelectionWarning[] }> {
  const warnings: SelectionWarning[] = [];

  for (const match of matches) {
    const resultIdx = matchResults.findIndex((r) => r.matchId === match.id);
    if (resultIdx < 0) continue;

    const result = matchResults[resultIdx]!;
    const selectedCount = result.selectedPlayers.length;

    const needsBackfill = selectedCount < match.team.targetSquadSize;

    if (!needsBackfill) continue;

    const eligiblePathSources = backfillPaths
      .filter((p) => p.toTeamId === match.teamId)
      .map((p) => p.fromTeamId);

    if (eligiblePathSources.length === 0) continue;

    const backfillCandidates = await db.player.findMany({
      where: {
        coreTeamId: { in: eligiblePathSources },
        id: { notIn: [...assignedPlayerIds] },
        nonRotatable: false,
        removedAt: null,
        active: true,
        currentAvailability: "AVAILABLE",
      },
      include: {
        coreTeam: { select: { id: true, name: true } },
      },
      orderBy: [{ playerCode: "asc" }],
      take: match.team.maxSquadSize - selectedCount,
    });

    for (const candidate of backfillCandidates) {
      if (result.selectedPlayers.length >= match.team.maxSquadSize) break;

      const playerName = candidate.firstName + (candidate.lastName ? ` ${candidate.lastName}` : "");
      assignedPlayerIds.add(candidate.id);

      const backfillPlayer: SelectedPlayer = {
        autoSelected: true,
        chosenPosition: candidate.primaryPosition,
        coreTeamId: candidate.coreTeam.id,
        coreTeamName: candidate.coreTeam.name,
        eligibility: true,
        explanations: [
          { code: "backfill_from_support_loss", summary: `${playerName} was selected as backfill for ${match.team.name} after the team lost core players to support duty elsewhere.`, hardRule: false },
        ],
        finalSelected: false,
        manualOverride: false,
        playerId: candidate.id,
        playerName,
        playerPosition: candidate.primaryPosition,
        priorityScore: 70,
        selectionCategory: "BACKFILL",
        selectionReason: `Selected as backfill for ${match.team.name} to cover players lost to support rotation.`,
      };

      matchResults[resultIdx] = {
        ...matchResults[resultIdx]!,
        selectedPlayers: [...matchResults[resultIdx]!.selectedPlayers, backfillPlayer],
      };
    }
  }

  return { matchResults, warnings };
}