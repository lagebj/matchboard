import { db } from "@/lib/db";
import { buildPolicyInput } from "@/lib/policies/build-policy-input";
import { evaluateSelectionPolicy } from "@/lib/policies/policy-evaluation";
import { policyBlockedToSignals, policyWarningsToSignals, mergePolicySignals } from "@/lib/policies/policy-signal-mapper";

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
  const round = await db.matchRound.findFirst({
    where: { id: matchRoundId },
    include: {
      matches: {
        where: { status: { not: "CANCELLED" } },
        include: {
          team: true,
          // DRAFT and FINALIZED: a match finalized individually within an
          // otherwise-DRAFT round (per-match finalization) must still count
          // toward its own squad size, goalkeeper coverage, and duplicate/
          // opportunity checks below — it did not stop having players just
          // because it's locked. Only SELECTED_PLAYER_UNAVAILABLE narrows
          // back to DRAFT-only, since a finalized selection isn't something
          // a draft action can fix.
          selections: {
            where: { status: { in: ["DRAFT", "FINALIZED"] } },
            include: { player: true },
          },
        },
      },
      selections: {
        where: { status: { in: ["DRAFT", "FINALIZED"] } },
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

  const activePlayers = await db.player.findMany({
    where: { removedAt: null, coreTeam: { organisationId: round.organisationId } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      coreTeamId: true,
      availabilities: true,
      removedAt: true,
      currentAvailability: true,
    },
  });

  const playerActiveMap = new Map<string, boolean>();
  for (const p of activePlayers) {
    playerActiveMap.set(p.id, true);
  }

  const playerSelectionCountInRound = new Map<string, number>();
  for (const sel of allSelections) {
    playerSelectionCountInRound.set(
      sel.playerId,
      (playerSelectionCountInRound.get(sel.playerId) ?? 0) + 1,
    );
  }

  // Current-round availability comes from Player.currentAvailability, not the round-scoped
  // Availability model (ARR-0041) -- that model has no production write path anywhere in the
  // app, so a bulk query against it always resolves every player to the "no row" fallback
  // (UNKNOWN) in real usage, silently disabling the two live checks below. currentAvailability
  // is the one field the Players page's availability control, and generateSelection()'s own
  // eligibility loop, actually write/read -- reading it here is what "recomputed live from
  // current state on every read" (AGENTS.md "Warnings and plan integrity signals") requires for
  // a round that has not yet reached its planning boundary. Historical, per-round availability
  // for already-finalized rounds (the "repeatedContext" check and season-fairness's own
  // "unavailable rounds excluded from fairness debt" rule further below and in
  // get-planning-period-fairness.ts) still depends on the same unpopulated model and remains a
  // separate, not-yet-resolved part of ARR-0041.
  const availabilityMap = new Map<string, string>();
  for (const p of activePlayers) {
    availabilityMap.set(p.id, p.currentAvailability);
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
  // DRAFT only — a FINALIZED selection can't be fixed by a draft action, and the
  // match it belongs to isn't part of what round-level finalization is about to change.
  for (const match of round.matches) {
    for (const sel of match.selections.filter((s) => s.status === "DRAFT")) {
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

      // Batch fetch earlier round selections and availabilities instead of per-player per-round queries
      const earlierRoundIds = earlierRounds.map((er) => er.id);
      const [earlierSelections, earlierAvailabilities] = await Promise.all([
        db.selection.findMany({
          where: {
            playerId: { in: unassignedEligibleAvailable },
            matchRoundId: { in: earlierRoundIds },
            status: { in: ["DRAFT", "FINALIZED"] },
          },
          select: { playerId: true, matchRoundId: true },
        }),
        db.availability.findMany({
          where: {
            playerId: { in: unassignedEligibleAvailable },
            matchRoundId: { in: earlierRoundIds },
          },
          select: { playerId: true, matchRoundId: true, status: true },
        }),
      ]);

      const earlierSelectionSet = new Set(
        earlierSelections.map((s) => `${s.playerId}|${s.matchRoundId}`),
      );
      const earlierAvailabilityMap = new Map<string, string>();
      for (const a of earlierAvailabilities) {
        earlierAvailabilityMap.set(`${a.playerId}|${a.matchRoundId}`, a.status);
      }

      let missedEarlierCount = 0;
      const missedLabels: string[] = [];

      for (const er of earlierRounds) {
        const hadSelection = earlierSelectionSet.has(`${player.id}|${er.id}`);
        const earlierAvail = earlierAvailabilityMap.get(`${player.id}|${er.id}`);

        if (!hadSelection && earlierAvail === "AVAILABLE") {
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
      // Decision required, not Blocked (AGENTS.md "Decision required conditions") -- this
      // signal was previously unreachable in production (ARR-0041: it depends on the same
      // never-populated round-scoped Availability model the two live checks above were fixed
      // to stop reading), so this mislabeling was never exercised. The Round Board's own
      // per-chip badge already overrode it correctly via warningSeverityMap
      // (src/app/(app)/o/[orgSlug]/rounds/[matchRoundId]/page.tsx), but the round-level
      // blocked/decisionRequired summary counts below read `kind` directly and would have
      // double-counted this as Blocked instead of Decision required.
      kind: "DECISION_REQUIRED",
      ruleCode: "AVAILABLE_PLAYER_WITHOUT_PLANNED_OPPORTUNITY",
      matchRoundId,
      playerId: player.id,
      title: `Decision required: ${playerName} has no planned match opportunity this round`,
      currentState: `${playerName} is available for this round but is not assigned to a match.`,
      consequence: "Assign the player to an eligible match or provide an override reason before finalising.",
      classificationReason: "Available eligible player without planned match opportunity",
      primaryActionLabel: "Assign player",
      primaryActionTarget: `/rounds/${matchRoundId}`,
      repeatedContext,
    });
  }

  // 5. Policy-derived signals: evaluate policy and add to canonical signals
  try {
    const policyInput = buildPolicyInput({
      mode: "league",
      phase: "post_selection",
      decisionType: "league_round_fairness",
      fairnessScope: "round",
      players: activePlayers.map((p) => ({
        id: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        active: true,
        removedAt: p.removedAt,
        primaryPosition: "",
        secondaryPosition: null,
        tertiaryPosition: null,
        goalkeeperAbility: "NO",
        nonRotatable: false,
        shirtNumber: null,
        coreTeamId: p.coreTeamId,
        availabilities: p.availabilities?.map((a) => ({
          status: a.status,
          matchRoundId,
        })),
      })),
      teams: round.matches.map((m) => ({
        id: m.teamId,
        name: m.team.name,
        targetSquadSize: m.team.targetSquadSize,
        minSquadSize: m.team.minAcceptedSquadSize,
        maxSquadSize: m.team.maxSquadSize,
      })),
      squads: round.matches.map((m) => {
        const isStrongGK = (s: typeof m.selections[number]) => {
          const gkAbility = s.player?.goalkeeperAbility ?? "NO";
          const primaryPos = s.player?.primaryPosition;
          return gkAbility === "YES" || primaryPos === "GK";
        };
        const isAcceptableGK = (s: typeof m.selections[number]) => {
          const secondaryPos = s.player?.secondaryPosition;
          return secondaryPos === "GK" && !isStrongGK(s);
        };
        return {
          id: m.id,
          name: m.team.name,
          teamId: m.teamId,
          playerIdList: m.selections.map((s) => s.playerId),
          primaryGoalkeeperCount: m.selections.filter(isStrongGK).length,
          secondaryGoalkeeperCount: m.selections.filter(isAcceptableGK).length,
          anyGoalkeeperCount: m.selections.filter((s) => {
            const gkAbility = s.player?.goalkeeperAbility ?? "NO";
            return isStrongGK(s) || isAcceptableGK(s) || gkAbility === "EMERGENCY";
          }).length,
        };
      }),
      matches: round.matches.map((m) => ({
        id: m.id,
        startsAt: m.startsAt,
        matchStatus: m.status,
      })),
      nowIso: new Date().toISOString(),
      leagueMatchId: matchRoundId,
    });
    const policyResult = await evaluateSelectionPolicy(policyInput);
    const blockedSignals = policyBlockedToSignals(policyResult.result, matchRoundId);
    const warningSignals = policyWarningsToSignals(policyResult.result, matchRoundId);
    const allPolicySignals = mergePolicySignals(blockedSignals, warningSignals);

    for (const ps of allPolicySignals) {
      if (ps.kind === "BLOCKED" || ps.kind === "DECISION_REQUIRED") {
        const alreadyExists = signals.some((s) => s.idempotencyKey === ps.idempotencyKey);
        if (!alreadyExists) {
          signals.push({
            idempotencyKey: ps.idempotencyKey,
            kind: ps.kind as PlanIntegritySignalKind,
            ruleCode: ps.ruleCode as PlanIntegrityRuleCode,
            matchRoundId,
            matchId: ps.matchId,
            teamId: ps.teamId,
            playerId: ps.playerId,
            title: ps.title,
            currentState: ps.detail,
            consequence: ps.kind === "BLOCKED" ? "Resolve this condition before finalising." : "Review and decide before finalising.",
            classificationReason: `Policy: ${ps.ruleCode}`,
            primaryActionLabel: "Review",
            primaryActionTarget: `/rounds/${matchRoundId}`,
          });
        }
      } else if (ps.kind === "PLANNING_NOTE") {
        const alreadyExists = planningNotes.some((n) => n.idempotencyKey === ps.idempotencyKey);
        if (!alreadyExists) {
          planningNotes.push({
            idempotencyKey: ps.idempotencyKey,
            code: ps.ruleCode as PlanningNoteCode,
            matchRoundId,
            matchId: ps.matchId,
            teamId: ps.teamId,
            playerId: ps.playerId,
            title: ps.title,
            detail: ps.detail,
          });
        }
      }
    }
  } catch {
    // Policy evaluation failure must not block plan integrity computation.
    // Canonical signals are always computed; policy signals are additive.
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