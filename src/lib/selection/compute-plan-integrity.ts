import { db } from "@/lib/db";

export type PlanIntegritySignalKind = "BLOCKED" | "DECISION_REQUIRED";

export type PlanIntegrityRuleCode =
  | "SQUAD_BELOW_MINIMUM"
  | "SELECTED_PLAYER_UNAVAILABLE"
  | "DUPLICATE_PLANNED_ASSIGNMENT_INTEGRITY_FAILURE"
  | "AVAILABLE_PLAYER_WITHOUT_PLANNED_OPPORTUNITY";

export type PlanIntegritySignal = {
  idempotencyKey: string;
  kind: PlanIntegritySignalKind;
  ruleCode: PlanIntegrityRuleCode;
  matchRoundId: string;
  matchId?: string;
  teamId?: string;
  playerId?: string;
  title: string;
  currentState: string;
  consequence: string;
  classificationReason: string;
  primaryActionLabel: string;
  primaryActionTarget: string;
  repeatedContext?: { earlierMissedRoundCount: number; roundLabels: string[] };
};

export type PlanningNoteCode =
  | "BELOW_TARGET_BUT_PLAYABLE"
  | "PREFERRED_SUPPORT_NOT_MET"
  | "SQUAD_REPAIR_BELOW_PREFERRED_TARGET"
  | "FALLBACK_POSITION_USED";

export type PlanningNote = {
  idempotencyKey: string;
  code: PlanningNoteCode;
  matchRoundId: string;
  matchId?: string;
  teamId?: string;
  playerId?: string;
  title: string;
  detail: string;
};

export type RoundPlanIntegrity = {
  matchRoundId: string;
  signals: PlanIntegritySignal[];
  planningNotes: PlanningNote[];
  summary: {
    blockerCount: number;
    decisionRequiredCount: number;
    belowMinimumMatchCount: number;
    unavailableSelectedPlayerCount: number;
    missingOpportunityPlayerCount: number;
    integrityFailureCount: number;
  };
  coverage: {
    eligibleAvailablePlayerCount: number;
    assignedEligibleAvailablePlayerCount: number;
    unassignedEligibleAvailablePlayerIds: string[];
  };
  computedAt: Date;
};

const AVAILABILITY_VALUES_AVAILABLE = new Set(["AVAILABLE", "TENTATIVE"]);

function makeIdempotencyKey(
  ruleCode: string,
  matchRoundId: string,
  matchId?: string | null,
  teamId?: string | null,
  playerId?: string | null,
): string {
  return `${ruleCode}|${matchRoundId}|${matchId ?? ""}|${teamId ?? ""}|${playerId ?? ""}`;
}

export async function computeRoundPlanIntegrity(
  matchRoundId: string,
): Promise<RoundPlanIntegrity> {
  const round = await db.matchRound.findUnique({
    where: { id: matchRoundId },
    include: {
      matches: {
        where: { status: { not: "CANCELLED" } },
        include: {
          team: true,
          selections: {
            where: { status: "DRAFT" },
            include: { player: true },
          },
        },
      },
      selections: {
        where: { status: "DRAFT" },
        include: { player: true },
      },
    },
  });

  if (!round) {
    return {
      matchRoundId,
      signals: [],
      planningNotes: [],
      summary: {
        blockerCount: 0,
        decisionRequiredCount: 0,
        belowMinimumMatchCount: 0,
        unavailableSelectedPlayerCount: 0,
        missingOpportunityPlayerCount: 0,
        integrityFailureCount: 0,
      },
      coverage: {
        eligibleAvailablePlayerCount: 0,
        assignedEligibleAvailablePlayerCount: 0,
        unassignedEligibleAvailablePlayerIds: [],
      },
      computedAt: new Date(),
    };
  }

  const signals: PlanIntegritySignal[] = [];
  const planningNotes: PlanningNote[] = [];

  const allSelections = round.selections;
  const selectedPlayerIds = new Set(allSelections.map((s) => s.playerId));

  const playerAvailabilityMap = new Map<string, string>();
  const playerActiveMap = new Map<string, boolean>();

  const activePlayers = await db.player.findMany({
    where: { removedAt: null },
    select: { id: true, firstName: true, lastName: true, coreTeamId: true, availabilities: true, removedAt: true },
  });

  for (const p of activePlayers) {
    const latestAvailability = await db.availability.findFirst({
      where: { playerId: p.id, matchRoundId },
      orderBy: { createdAt: "desc" },
      select: { status: true },
    });
    playerAvailabilityMap.set(p.id, latestAvailability?.status ?? "UNKNOWN");
    playerActiveMap.set(p.id, true);
  }

  const playerSelectionCountInRound = new Map<string, number>();
  for (const sel of allSelections) {
    playerSelectionCountInRound.set(
      sel.playerId,
      (playerSelectionCountInRound.get(sel.playerId) ?? 0) + 1,
    );
  }

  // Per-team availability for this round
  const roundAvailabilities = await db.availability.findMany({
    where: { matchRoundId },
    select: { playerId: true, status: true },
  });
  const availabilityMap = new Map<string, string>();
  for (const a of roundAvailabilities) {
    availabilityMap.set(a.playerId, a.status);
  }

  // 1. SQUAD_BELOW_MINIMUM: one signal per affected match
  for (const match of round.matches) {
    const selectedCount = match.selections.filter((s) =>
      ["CORE", "SUPPORT", "DEVELOPMENT", "BACKFILL"].includes(s.role),
    ).length;
    const minSize = match.team.minAcceptedSquadSize ?? match.team.targetSquadSize ?? 7;
    if (selectedCount < minSize) {
      const teamName = match.team.name;
      signals.push({
        idempotencyKey: makeIdempotencyKey("SQUAD_BELOW_MINIMUM", matchRoundId, match.id, match.teamId),
        kind: "BLOCKED",
        ruleCode: "SQUAD_BELOW_MINIMUM",
        matchRoundId,
        matchId: match.id,
        teamId: match.teamId,
        title: `Blocked: ${teamName} is below minimum squad size`,
        currentState: `${selectedCount} players selected. Minimum accepted squad size is ${minSize}.`,
        consequence: "The match cannot be finalised normally until the squad reaches minimum size.",
        classificationReason: "Squad below configured minimum accepted size",
        primaryActionLabel: "Review squad",
        primaryActionTarget: `/rounds/${matchRoundId}`,
      });
    } else {
      const targetSize = match.team.targetSquadSize ?? 10;
      if (selectedCount < targetSize && selectedCount >= minSize) {
        planningNotes.push({
          idempotencyKey: makeIdempotencyKey("BELOW_TARGET_BUT_PLAYABLE", matchRoundId, match.id, match.teamId),
          code: "BELOW_TARGET_BUT_PLAYABLE",
          matchRoundId,
          matchId: match.id,
          teamId: match.teamId,
          title: `${match.team.name} below target`,
          detail: `${selectedCount} players selected. Target ${targetSize}, minimum ${minSize}. Squad is playable but below target.`,
        });
      }
    }
  }

  // 2. SELECTED_PLAYER_UNAVAILABLE: one signal per unavailable selected player/match
  for (const match of round.matches) {
    for (const sel of match.selections) {
      const avail = availabilityMap.get(sel.playerId) ?? "UNKNOWN";
      if (!AVAILABILITY_VALUES_AVAILABLE.has(avail)) {
        const playerName = sel.player
          ? `${sel.player.firstName}${sel.player.lastName ? ` ${sel.player.lastName}` : ""}`
          : sel.playerId;

        if (avail === "INJURED" || avail === "SICK" || avail === "AWAY" || avail === "UNAVAILABLE") {
          signals.push({
            idempotencyKey: makeIdempotencyKey("SELECTED_PLAYER_UNAVAILABLE", matchRoundId, match.id, match.teamId, sel.playerId),
            kind: "BLOCKED",
            ruleCode: "SELECTED_PLAYER_UNAVAILABLE",
            matchRoundId,
            matchId: match.id,
            teamId: match.teamId,
            playerId: sel.playerId,
            title: `Blocked: ${playerName} is unavailable but selected for ${match.team.name}`,
            currentState: `${playerName} is marked ${avail.toLowerCase()} for this round and is included in the planned squad.`,
            consequence: "Remove the player or correct availability before finalising.",
            classificationReason: "Unavailable player included in planned squad",
            primaryActionLabel: "Remove or correct availability",
            primaryActionTarget: `/rounds/${matchRoundId}`,
          });
        }
      }
    }
  }

  // 3. DUPLICATE_PLANNED_ASSIGNMENT_INTEGRITY_FAILURE: one signal per affected player/round
  for (const [playerId, count] of playerSelectionCountInRound) {
    if (count > 1) {
      const player = allSelections.find((s) => s.playerId === playerId)?.player;
      const playerName = player
        ? `${player.firstName}${player.lastName ? ` ${player.lastName}` : ""}`
        : playerId;

      signals.push({
        idempotencyKey: makeIdempotencyKey("DUPLICATE_PLANNED_ASSIGNMENT_INTEGRITY_FAILURE", matchRoundId, null, null, playerId),
        kind: "BLOCKED",
        ruleCode: "DUPLICATE_PLANNED_ASSIGNMENT_INTEGRITY_FAILURE",
        matchRoundId,
        playerId,
        title: `Blocked: invalid duplicate planned assignment found for ${playerName}`,
        currentState: `${playerName} appears in more than one planned match in this round.`,
        consequence: "A player can have only one planned match opportunity per round.",
        classificationReason: "Invalid duplicate persisted assignment",
        primaryActionLabel: "Review assignments",
        primaryActionTarget: `/rounds/${matchRoundId}`,
      });
    }
  }

  // 4. AVAILABLE_PLAYER_WITHOUT_PLANNED_OPPORTUNITY: one signal per affected player
  const leagueSeason = await db.leagueSeason.findFirst({
    where: { matchRounds: { some: { id: matchRoundId } } },
    select: { id: true },
  });

  const eligibleActivePlayers = activePlayers.filter((p) => p.removedAt === null);

  const unassignedEligibleAvailable: string[] = [];
  for (const player of eligibleActivePlayers) {
    const avail = availabilityMap.get(player.id) ?? "UNKNOWN";
    if (!AVAILABILITY_VALUES_AVAILABLE.has(avail)) continue;
    if (selectedPlayerIds.has(player.id)) continue;

    unassignedEligibleAvailable.push(player.id);

    const playerName = `${player.firstName}${player.lastName ? ` ${player.lastName}` : ""}`;

    let repeatedContext: { earlierMissedRoundCount: number; roundLabels: string[] } | undefined;

    if (leagueSeason) {
      const earlierRounds = await db.matchRound.findMany({
        where: {
          leagueSeasonId: leagueSeason.id,
          status: "FINALIZED",
          id: { not: matchRoundId },
        },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      });

      let missedEarlierCount = 0;
      const missedLabels: string[] = [];

      for (const er of earlierRounds) {
        const earlierSelection = await db.selection.findFirst({
          where: { playerId: player.id, matchRoundId: er.id, status: { in: ["DRAFT", "FINALIZED"] } },
          select: { id: true },
        });
        const earlierAvail = await db.availability.findFirst({
          where: { playerId: player.id, matchRoundId: er.id },
          select: { status: true },
        });

        if (!earlierSelection && earlierAvail?.status === "AVAILABLE") {
          missedEarlierCount++;
          missedLabels.push(er.name);
        }
      }

      if (missedEarlierCount > 0) {
        repeatedContext = {
          earlierMissedRoundCount: missedEarlierCount,
          roundLabels: missedLabels,
        };
      }
    }

    signals.push({
      idempotencyKey: makeIdempotencyKey("AVAILABLE_PLAYER_WITHOUT_PLANNED_OPPORTUNITY", matchRoundId, null, null, player.id),
      kind: "BLOCKED",
      ruleCode: "AVAILABLE_PLAYER_WITHOUT_PLANNED_OPPORTUNITY",
      matchRoundId,
      playerId: player.id,
      title: `Blocked: ${playerName} has no planned match opportunity this round`,
      currentState: `${playerName} is available for this round but is not assigned to a match.`,
      consequence: "Assign the player to an eligible match or provide an override reason before finalising.",
      classificationReason: "Available eligible player without planned match opportunity",
      primaryActionLabel: "Assign player",
      primaryActionTarget: `/rounds/${matchRoundId}`,
      repeatedContext,
    });
  }

  const blockerCount = signals.filter((s) => s.kind === "BLOCKED").length;
  const decisionRequiredCount = signals.filter((s) => s.kind === "DECISION_REQUIRED").length;
  const belowMinimumMatchCount = signals.filter((s) => s.ruleCode === "SQUAD_BELOW_MINIMUM").length;
  const unavailableSelectedPlayerCount = signals.filter((s) => s.ruleCode === "SELECTED_PLAYER_UNAVAILABLE").length;
  const missingOpportunityPlayerCount = signals.filter((s) => s.ruleCode === "AVAILABLE_PLAYER_WITHOUT_PLANNED_OPPORTUNITY").length;
  const integrityFailureCount = signals.filter((s) => s.ruleCode === "DUPLICATE_PLANNED_ASSIGNMENT_INTEGRITY_FAILURE").length;

  return {
    matchRoundId,
    signals,
    planningNotes,
    summary: {
      blockerCount,
      decisionRequiredCount,
      belowMinimumMatchCount,
      unavailableSelectedPlayerCount,
      missingOpportunityPlayerCount,
      integrityFailureCount,
    },
    coverage: {
      eligibleAvailablePlayerCount: eligibleActivePlayers.length,
      assignedEligibleAvailablePlayerCount: eligibleActivePlayers.filter((p) => selectedPlayerIds.has(p.id)).length,
      unassignedEligibleAvailablePlayerIds: unassignedEligibleAvailable,
    },
    computedAt: new Date(),
  };
}

export type FixtureRoundIntegritySummary = {
  blockerCount: number;
  decisionRequiredCount: number;
  belowMinimumMatchCount: number;
  unavailableSelectedPlayerCount: number;
  missingOpportunityPlayerCount: number;
  integrityFailureCount: number;
};